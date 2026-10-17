# Vérification des identités OAuth reçues par OAuthLoginView.
#
# Le backend ne fait JAMAIS confiance à un email envoyé par l'app : il vérifie
# l'id_token signé par Google (signature RS256 via les clés publiques Google,
# expiration, émetteur, audience = nos client IDs) et lit l'email dans ce token.
import jwt
from django.conf import settings
from jwt import PyJWKClient

GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

# Les clés publiques Google sont mises en cache par PyJWKClient (rotation gérée
# via le « kid » de l'en-tête du token).
_google_jwks = PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True)


class OAuthNotConfigured(Exception):
    pass


class InvalidOAuthToken(Exception):
    pass


def verify_google_id_token(id_token):
    """Retourne le payload vérifié de l'id_token Google, ou lève InvalidOAuthToken."""
    audiences = settings.GOOGLE_OAUTH_CLIENT_IDS
    if not audiences:
        raise OAuthNotConfigured()
    try:
        signing_key = _google_jwks.get_signing_key_from_jwt(id_token)
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=['RS256'],
            audience=audiences,
            issuer=GOOGLE_ISSUERS,
            options={'require': ['exp', 'iat', 'iss', 'aud', 'sub']},
        )
    except jwt.PyJWTError as e:
        raise InvalidOAuthToken(str(e)) from e
    # Un email non vérifié chez Google ne prouve pas qu'on en est propriétaire.
    if not payload.get('email') or payload.get('email_verified') is not True:
        raise InvalidOAuthToken('email absent ou non vérifié')
    return payload
