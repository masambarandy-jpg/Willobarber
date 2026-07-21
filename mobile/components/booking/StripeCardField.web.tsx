import React, { forwardRef, useImperativeHandle } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/constants';
import { paymentsApi } from '@/services/api';
import type { StripeCardFieldHandle, StripeCardFieldProps } from './StripeCardField.types';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const cardElementOptions = {
  style: {
    base: {
      color: '#FFFFFF',
      fontSize: '14px',
      '::placeholder': { color: 'rgba(255,255,255,0.35)' },
      iconColor: '#C9A84C',
    },
    invalid: { color: '#C0392B' },
  },
};

const StripeCardFieldInner = forwardRef<StripeCardFieldHandle, StripeCardFieldProps>(
  function StripeCardFieldInner({ onChange, incompleteMessage }, ref) {
    const stripe = useStripe();
    const elements = useElements();

    useImperativeHandle(ref, () => ({
      pay: async (amount, cardForm) => {
        const cardElement = elements?.getElement(CardElement);
        if (!stripe || !cardElement) {
          throw new Error(incompleteMessage);
        }

        const { clientSecret } = await paymentsApi.createPaymentIntent(amount, 'eur');

        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: cardForm.email || undefined,
              phone: cardForm.phone || undefined,
              name: `${cardForm.prenom} ${cardForm.nom}`.trim() || undefined,
            },
          },
        });

        if (error) {
          throw new Error(error.message || incompleteMessage);
        }
        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
          throw new Error(incompleteMessage);
        }

        return paymentIntent.id;
      },
    }));

    return (
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '14px 12px',
        }}
      >
        <CardElement
          options={cardElementOptions}
          onChange={(e) => onChange({ complete: e.complete })}
        />
      </div>
    );
  }
);

export const StripeCardField = forwardRef<StripeCardFieldHandle, StripeCardFieldProps>(
  function StripeCardField(props, ref) {
    return (
      <Elements stripe={stripePromise}>
        <StripeCardFieldInner {...props} ref={ref} />
      </Elements>
    );
  }
);
