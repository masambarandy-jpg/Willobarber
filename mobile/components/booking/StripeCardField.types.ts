import type { CardForm } from './data';

export interface CardInputDetails {
  complete: boolean;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface StripeCardFieldHandle {
  // savedPaymentMethodId : carte enregistrée (pm_…) à débiter à la place du
  // formulaire. Retourne l'id du PaymentIntent réglé.
  pay: (amount: number, cardForm: CardForm, savedPaymentMethodId?: string) => Promise<string>;
}

export interface StripeCardFieldProps {
  onChange: (details: CardInputDetails) => void;
  incompleteMessage: string;
  // Carte enregistrée sélectionnée : le composant reste monté (instance Stripe
  // nécessaire pour un éventuel challenge 3DS) mais le formulaire est masqué.
  hideForm?: boolean;
}
