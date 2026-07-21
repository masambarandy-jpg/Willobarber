import type { CardForm } from './data';

export interface CardInputDetails {
  complete: boolean;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface StripeCardFieldHandle {
  pay: (amount: number, cardForm: CardForm) => Promise<string>;
}

export interface StripeCardFieldProps {
  onChange: (details: CardInputDetails) => void;
  incompleteMessage: string;
}
