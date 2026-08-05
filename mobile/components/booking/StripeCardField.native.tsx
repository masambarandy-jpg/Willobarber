import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { CardField, useConfirmPayment, type CardFieldInput } from '@stripe/stripe-react-native';
import { paymentsApi } from '@/services/api';
import type { StripeCardFieldHandle, StripeCardFieldProps } from './StripeCardField.types';

const INPUT_BG     = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';

const cardFieldStyle: CardFieldInput.Styles = {
  backgroundColor: INPUT_BG,
  borderColor: INPUT_BORDER,
  borderWidth: 1,
  borderRadius: 10,
  textColor: '#FFFFFF',
  placeholderColor: 'rgba(255,255,255,0.22)',
  fontSize: 14,
};

export const StripeCardField = forwardRef<StripeCardFieldHandle, StripeCardFieldProps>(
  function StripeCardField({ onChange, incompleteMessage }, ref) {
    const { confirmPayment } = useConfirmPayment();
    const detailsRef = useRef<CardFieldInput.Details | undefined>(undefined);

    useImperativeHandle(ref, () => ({
      pay: async (amount, cardForm) => {
        if (!detailsRef.current?.complete) {
          throw new Error(incompleteMessage);
        }

        const { clientSecret } = await paymentsApi.createPaymentIntent(amount, 'eur');

        const { paymentIntent, error } = await confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              email: cardForm.email || undefined,
              phone: cardForm.phone || undefined,
              name: `${cardForm.prenom} ${cardForm.nom}`.trim() || undefined,
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }
        if (!paymentIntent || paymentIntent.status !== 'Succeeded') {
          throw new Error(incompleteMessage);
        }

        return paymentIntent.id;
      },
    }));

    return (
      <CardField
        postalCodeEnabled={false}
        placeholders={{ number: '1234 5678 9012 3456', expiration: 'MM/AA', cvc: 'CVV' }}
        cardStyle={cardFieldStyle}
        style={styles.cardField}
        onCardChange={(details) => {
          detailsRef.current = details;
          onChange({
            complete: details.complete,
            last4: details.last4,
            expiryMonth: details.expiryMonth,
            expiryYear: details.expiryYear,
          });
        }}
      />
    );
  }
);

const styles = StyleSheet.create({
  cardField: {
    width: '100%',
    height: 50,
    marginBottom: 4,
  },
});
