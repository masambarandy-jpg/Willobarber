"""Diffusion temps réel (Server-Sent Events) vers l'espace coiffeur et les clients.

Broker en mémoire : deux dicts {id: set(queue.Queue)} protégés par un lock —
un pour les coiffeurs (clé barber_id), un pour les clients (clé user_id).

LIMITE : ne fonctionne que si les flux SSE et les écritures de réservations
passent par le MÊME processus Python — d'où `gunicorn --workers 1` avec des
threads (cf. railway.toml). Avec plusieurs workers ou plusieurs instances
Railway, un événement publié dans un processus n'atteindrait pas les coiffeurs
connectés aux autres : il faudra alors remplacer publish()/subscribe() par un
pub/sub Redis.

Reservation n'a pas de champ barbier (agenda unique du salon, cf. models.py) :
chaque événement est donc diffusé à tous les coiffeurs connectés, quel que soit
le barber_id de l'URL. Les événements client (publish_to_client), eux, ne
partent que vers les flux ouverts par ce client.
"""
import json
import queue
import threading

from django.db import connection
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken, TokenError

# Les proxies (Railway compris) coupent les connexions HTTP inactives : un
# commentaire SSE toutes les 25 s garde le flux vivant.
PING_INTERVAL_SECONDS = 25
# Un client trop lent perd les événements au-delà : il se resynchronise via
# un rechargement complet à la reconnexion (cf. useSSE côté mobile).
MAX_QUEUED_EVENTS = 100

_subscribers: dict[int, set[queue.Queue]] = {}
_client_subscribers: dict[int, set[queue.Queue]] = {}
_lock = threading.Lock()


def _format(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _subscribe(registry, key):
    q = queue.Queue(maxsize=MAX_QUEUED_EVENTS)
    with _lock:
        registry.setdefault(key, set()).add(q)
    return q


def _unsubscribe(registry, key, q):
    with _lock:
        queues = registry.get(key)
        if queues is None:
            return
        queues.discard(q)
        if not queues:
            del registry[key]


def _put_all(queues, message):
    for q in queues:
        try:
            q.put_nowait(message)
        except queue.Full:
            pass


def publish(event, payload):
    message = _format(event, payload)
    with _lock:
        queues = [q for qs in _subscribers.values() for q in qs]
    _put_all(queues, message)


def publish_to_client(user_id, event, payload):
    message = _format(event, payload)
    with _lock:
        queues = list(_client_subscribers.get(user_id, ()))
    _put_all(queues, message)


def _stream(registry, key):
    # Le flux peut rester ouvert des heures : on rend la connexion Postgres
    # ouverte par l'authentification au lieu de la garder pendant tout le stream.
    connection.close()
    q = _subscribe(registry, key)
    try:
        # Premier octet immédiat : déclenche 'open' côté client et force les
        # proxies à commencer à streamer.
        yield ": connected\n\n"
        while True:
            try:
                yield q.get(timeout=PING_INTERVAL_SECONDS)
            except queue.Empty:
                yield ": ping\n\n"
    finally:
        # Exécuté quand le client se déconnecte (écriture échouée → GeneratorExit).
        _unsubscribe(registry, key, q)


def _user_from_query_token(request):
    # EventSource ne permet pas d'envoyer un header Authorization : le JWT
    # arrive en query string (?token=...).
    auth = JWTAuthentication()
    try:
        return auth.get_user(auth.get_validated_token(request.GET.get('token', '')))
    except (InvalidToken, TokenError, AuthenticationFailed):
        return None


def _event_stream_response(generator):
    response = StreamingHttpResponse(generator, content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


def coiffeur_stream(request, barber_id):
    user = _user_from_query_token(request)
    if user is None:
        return HttpResponse(status=401)
    if not (user.is_superuser or getattr(user, 'role', None) == 'admin'):
        return HttpResponse(status=403)
    return _event_stream_response(_stream(_subscribers, barber_id))


def client_stream(request):
    # Flux personnel : l'identité vient du JWT, jamais de l'URL.
    user = _user_from_query_token(request)
    if user is None:
        return HttpResponse(status=401)
    return _event_stream_response(_stream(_client_subscribers, user.id))
