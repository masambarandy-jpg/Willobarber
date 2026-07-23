import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '@/constants';
import { paymentsApi } from '@/services/api';
import type { StripeCardFieldHandle, StripeCardFieldProps } from './StripeCardField.types';

// Resolved once, ahead of render, so the Elements provider always mounts with a
// ready (or in-flight) Stripe instance instead of `null`.
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const elementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      '::placeholder': { color: 'rgba(255,255,255,0.35)' },
      iconColor: '#C9A84C',
    },
    invalid: { color: '#C0392B' },
  },
};

// Stripe's iframes need to sit above anything react-native-web may stack on top
// of them (absolutely-positioned overlays, etc.) to remain clickable.
const fieldWrapStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '14px 12px',
};

const rowStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'row',
  gap: 12,
  marginTop: 12,
};

const StripeCardFieldInner = forwardRef<StripeCardFieldHandle, StripeCardFieldProps>(
  function StripeCardFieldInner({ onChange, incompleteMessage }, ref) {
    const stripe = useStripe();
    const elements = useElements();
    const isProcessing = useRef(false);
    const [numberComplete, setNumberComplete] = useState(false);
    const [expiryComplete, setExpiryComplete] = useState(false);
    const [cvcComplete, setCvcComplete] = useState(false);

    const reportChange = (next: { number?: boolean; expiry?: boolean; cvc?: boolean }) => {
      const number = next.number ?? numberComplete;
      const expiry = next.expiry ?? expiryComplete;
      const cvc = next.cvc ?? cvcComplete;
      onChange({ complete: number && expiry && cvc });
    };

    useImperativeHandle(ref, () => ({
      pay: async (amount, cardForm) => {
        if (isProcessing.current) {
          throw new Error(incompleteMessage);
        }
        isProcessing.current = true;

        try {
          const cardNumberElement = elements?.getElement(CardNumberElement);
          if (!stripe || !elements || !cardNumberElement) {
            throw new Error(incompleteMessage);
          }

          const { clientSecret } = await paymentsApi.createPaymentIntent(amount, 'eur');

          const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card: cardNumberElement,
              billing_details: {
                email: cardForm.email || undefined,
                phone: cardForm.phone || undefined,
                name: `${cardForm.prenom} ${cardForm.nom}`.trim() || undefined,
              },
            },
          });

          console.log('CONFIRM RESULT:', JSON.stringify(result, null, 2));
          console.log('CONFIRM ERROR:', result.error?.message, result.error?.code, result.error?.decline_code);

          const { paymentIntent, error } = result;

          if (error) {
            throw new Error(error.message || incompleteMessage);
          }
          if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            throw new Error(incompleteMessage);
          }

          return paymentIntent.id;
        } finally {
          isProcessing.current = false;
        }
      },
    }));

    return (
      <div>
        <div style={fieldWrapStyle}>
          <CardNumberElement
            options={elementOptions}
            onChange={(e) => {
              setNumberComplete(e.complete);
              reportChange({ number: e.complete });
            }}
          />
        </div>
        <div style={rowStyle}>
          <div style={{ ...fieldWrapStyle, flex: 1 }}>
            <CardExpiryElement
              options={elementOptions}
              onChange={(e) => {
                setExpiryComplete(e.complete);
                reportChange({ expiry: e.complete });
              }}
            />
          </div>
          <div style={{ ...fieldWrapStyle, flex: 1 }}>
            <CardCvcElement
              options={elementOptions}
              onChange={(e) => {
                setCvcComplete(e.complete);
                reportChange({ cvc: e.complete });
              }}
            />
          </div>
        </div>
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
