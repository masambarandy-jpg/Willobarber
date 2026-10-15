import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import RNEventSource from 'react-native-sse';

// Reconnexion après une coupure : 1s, 2s, 5s, 10s, 20s puis 30s max.
const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000];
// Au-delà de ce nombre d'échecs consécutifs SANS avoir jamais ouvert le flux
// (proxy qui refuse le streaming, 401…), on abandonne le SSE et l'appelant
// bascule en polling via onFallback.
const MAX_FAILURES_BEFORE_FALLBACK = 3;
// Un proxy qui bufferise la réponse ne renvoie jamais d'erreur : le flux reste
// simplement muet. Sans 'open' au bout de ce délai, la tentative est un échec.
const OPEN_TIMEOUT_MS = 10000;

export type SSEStatus = 'idle' | 'connecting' | 'open' | 'fallback';

type Handlers = {
  onOpen: () => void;
  onError: () => void;
  onEvent: (event: string, data: string | null) => void;
};

// Web : EventSource natif du navigateur. iOS/Android : react-native-sse
// (pas d'EventSource dans React Native). La reconnexion automatique des deux
// implémentations est désactivée : useSSE gère lui-même le back-off.
function openStream(url: string, events: readonly string[], h: Handlers): () => void {
  if (Platform.OS === 'web') {
    const es = new window.EventSource(url);
    es.onopen = h.onOpen;
    es.onerror = () => {
      es.close();
      h.onError();
    };
    events.forEach((name) => es.addEventListener(name, (e) => h.onEvent(name, (e as MessageEvent).data)));
    return () => es.close();
  }

  const es = new RNEventSource<string>(url, { pollingInterval: 0 });
  es.addEventListener('open', h.onOpen);
  es.addEventListener('error', () => {
    es.close();
    h.onError();
  });
  // pollingInterval: 0 → le flux terminé côté serveur n'est pas rouvert par la lib.
  es.addEventListener('close', h.onError);
  events.forEach((name) => es.addEventListener(name, (e) => h.onEvent(name, (e as { data: string | null }).data)));
  return () => {
    es.removeAllEventListeners();
    es.close();
  };
}

type Options<E extends string> = {
  // null = pas de connexion (coiffeur déconnecté) ; tout flux ouvert est fermé.
  url: string | null;
  events: readonly E[];
  onEvent: (event: E, data: unknown) => void;
  // Appelé à chaque ouverture ; reconnect = true après une coupure, pour que
  // l'appelant resynchronise ce qui a pu être manqué pendant la coupure.
  onOpen?: (reconnect: boolean) => void;
  onFallback?: () => void;
};

export function useSSE<E extends string>({ url, events, onEvent, onOpen, onFallback }: Options<E>): SSEStatus {
  const [status, setStatus] = useState<SSEStatus>('idle');

  // Callbacks lus via ref : un nouveau rendu de l'appelant ne doit pas rouvrir la connexion.
  const handlers = useRef({ onEvent, onOpen, onFallback });
  handlers.current = { onEvent, onOpen, onFallback };
  const eventsKey = events.join(',');

  useEffect(() => {
    if (!url) {
      setStatus('idle');
      return;
    }

    let closeStream: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let hasOpened = false;
    let failuresWithoutOpen = 0;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      setStatus('connecting');
      let settled = false;

      const fail = () => {
        // web : onerror puis close ; natif : error puis close → une seule prise en compte.
        if (disposed || settled) return;
        settled = true;
        if (openTimer) clearTimeout(openTimer);
        closeStream?.();
        closeStream = null;

        if (!hasOpened) failuresWithoutOpen += 1;
        if (failuresWithoutOpen >= MAX_FAILURES_BEFORE_FALLBACK) {
          console.log('[SSE] échecs répétés, bascule en polling');
          setStatus('fallback');
          handlers.current.onFallback?.();
          return;
        }

        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt += 1;
        setStatus('connecting');
        retryTimer = setTimeout(connect, delay);
      };

      openTimer = setTimeout(fail, OPEN_TIMEOUT_MS);

      closeStream = openStream(url, eventsKey.split(','), {
        onOpen: () => {
          if (disposed || settled) return;
          if (openTimer) clearTimeout(openTimer);
          const reconnect = hasOpened;
          hasOpened = true;
          failuresWithoutOpen = 0;
          attempt = 0;
          setStatus('open');
          handlers.current.onOpen?.(reconnect);
        },
        onError: fail,
        onEvent: (name, raw) => {
          if (disposed) return;
          let data: unknown = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            console.log('[SSE] payload illisible pour', name, raw);
            return;
          }
          handlers.current.onEvent(name as E, data);
        },
      });
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (openTimer) clearTimeout(openTimer);
      closeStream?.();
    };
  }, [url, eventsKey]);

  return status;
}
