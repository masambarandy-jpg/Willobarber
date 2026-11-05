// Délais d'annulation, mêmes règles que backend/core/cancellations.py. La date et
// l'heure d'un RDV sont en heure de Bruxelles, quel que soit le fuseau de l'appareil.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const NO_SHOW_GRACE_MS = 15 * MINUTE_MS;
export const LATE_CANCELLATION_MS = 24 * HOUR_MS;

// Dernier dimanche du mois, 01:00 UTC : changement d'heure européen.
function dstSwitchUtc(year: number, month: number): number {
  const day = new Date(Date.UTC(year, month + 1, 0, 1));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.getTime();
}

export function salonStartMs(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const summer = wallClock >= dstSwitchUtc(year, 2) && wallClock < dstSwitchUtc(year, 9);
  return wallClock - (summer ? 2 : 1) * HOUR_MS;
}

// L'app crée ses RDV en 'pending' : les deux statuts sont annulables côté serveur.
export function isCancellableStatus(status: string): boolean {
  return status === 'pending' || status === 'confirmed';
}

export function isCancelledStatus(status: string): boolean {
  return status.startsWith('cancelled');
}

// Ex. « 2j 15h », « 3h 20min », « 12min ».
export function formatDelay(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}j ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}min`;
  return `${minutes}min`;
}

// Montant réellement payé en ligne : seule la 1re résa d'un groupe porte le paiement.
export function paidOnlineAmount(reservation: { payment_intent_id?: string; amount_paid?: string | null }): number {
  if (!reservation.payment_intent_id) return 0;
  return parseFloat(reservation.amount_paid ?? '0') || 0;
}

// Ex. « 45€ », « 45,50€ ».
export function formatEuro(amount: number): string {
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2).replace('.', ',')}€`;
}
