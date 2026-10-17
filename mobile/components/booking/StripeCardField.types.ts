import type { CardForm } from './data';
import type { BoutiqueOrderPayload } from '@/services/api';

export interface CardInputDetails {
  complete: boolean;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface StripeCardFieldHandle {
  // savedPaymentMethodId : carte enregistrée (pm_…) à débiter à la place du
  // formulaire. order : commande boutique dont le backend calcule le montant.
  // Retourne l'id du PaymentIntent réglé.
  pay: (amount: number, cardForm: CardForm, savedPaymentMethodId?: string, order?: BoutiqueOrderPayload) => Promise<string>;
}

export interface StripeCardFieldProps {
  onChange: (details: CardInputDetails) => void;
  incompleteMessage: string;
  // Carte enregistrée sélectionnée : le composant reste monté (instance Stripe
  // nécessaire pour un éventuel challenge 3DS) mais le formulaire est masqué.
  hideForm?: boolean;
}
