import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { reservationsApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { Reservation } from '@/types';

// Shape réel de /reservations/ : 'time' (absent du type partagé Reservation).
type ApiReservation = Reservation & { time: string };

// Store partagé entre « Mon espace » et la sidebar tablette/web
// (ClientIPadLayout). Chaque appel au hook avait auparavant son propre état,
// chargé une seule fois au montage : la sidebar, montée avec le layout des
// onglets avant la connexion, gardait une liste vide (401) et ne voyait
// jamais un RDV réservé ou annulé ensuite → carte « Prochain RDV » absente.
type State = { reservations: Reservation[]; isLoading: boolean; error: string | null };

let state: State = { reservations: [], isLoading: true, error: null };
const listeners = new Set<() => void>();
// Seule la réponse de la dernière requête est appliquée (un refetch lancé après
// une annulation ne doit pas être écrasé par une réponse plus ancienne).
let latestRequest = 0;
// Session pour laquelle le store a été chargé : évite que chaque instance du
// hook relance le même chargement au changement d'état de connexion.
let loadedFor: 'auth' | 'anon' | null = null;

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => state;

async function load() {
  const request = ++latestRequest;
  setState({ isLoading: true, error: null });
  try {
    const data = await reservationsApi.list();
    if (request === latestRequest) setState({ reservations: data, isLoading: false });
  } catch {
    if (request === latestRequest) setState({ error: 'Impossible de charger les réservations.', isLoading: false });
  }
}

// Déconnexion : on vide la liste (pas de RDV de l'ancien compte dans la
// sidebar) et on invalide une éventuelle requête encore en vol.
function reset() {
  latestRequest++;
  setState({ reservations: [], isLoading: false, error: null });
}

// RDV à venir encore devant nous, du plus proche au plus lointain — le
// premier est le « Prochain RDV » (carte hero de Mon espace + sidebar).
function sortUpcoming(list: Reservation[]): ApiReservation[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  return (list as ApiReservation[])
    .filter((r) => `${r.date}T${r.time}` >= nowKey)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

export function useReservations() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { reservations, isLoading, error } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (authLoading) return;
    const session = isAuthenticated ? 'auth' : 'anon';
    if (loadedFor === session) return;
    loadedFor = session;
    if (isAuthenticated) load();
    else reset();
  }, [isAuthenticated, authLoading]);

  // Sans session, l'appel partirait sans token (401 → expiration de session).
  const refetch = useCallback(
    () => (isAuthenticated ? load() : Promise.resolve()),
    [isAuthenticated],
  );

  const cancel = useCallback(async (id: number, reason?: string) => {
    await reservationsApi.cancel(id, reason);
    // Mise à jour optimiste : dès que le serveur a confirmé l'annulation, on
    // retire le RDV de `upcoming` immédiatement (recalculé depuis `reservations`)
    // sans attendre l'aller-retour du load() de réconciliation ci-dessous.
    setState({
      reservations: state.reservations.map((r) => (r.id === id ? { ...r, status: 'cancelled_client' } : r)),
    });
    await load();
  }, []);

  // Masque / réaffiche une coupe passée. `beforeApply` s'exécute entre la
  // confirmation serveur et la mise à jour du store (ex. fondu de la carte).
  const setHidden = useCallback(async (id: number, hidden: boolean, beforeApply?: () => Promise<void>) => {
    await reservationsApi.hide(id, hidden);
    await beforeApply?.();
    setState({
      reservations: state.reservations.map((r) => (r.id === id ? { ...r, hidden_by_client: hidden } : r)),
    });
  }, []);

  const upcoming = reservations.filter(
    (r) => r.status === 'pending' || r.status === 'confirmed',
  );
  const past = reservations.filter(
    (r) => r.status === 'completed' || r.status === 'cancelled_client' || r.status === 'cancelled_barber' || r.status === 'no_show',
  );
  const upcomingSorted = sortUpcoming(upcoming);

  return { reservations, upcoming, upcomingSorted, past, isLoading, error, refetch, cancel, setHidden };
}
