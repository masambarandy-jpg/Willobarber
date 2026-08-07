import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { StripeCardField } from './StripeCardField';
import type { CardInputDetails, StripeCardFieldHandle } from './StripeCardField.types';
import type { TranslationKey } from '@/i18n/translations';
import {
  ACOMPTE_FIXE,
  fmtPrice,
  type AmountChoice,
  type BookingState,
  type CardForm,
  type PaymentMethod,
} from './data';

const GOLD       = '#C9A84C';
const CARD       = '#1A1814';
const GREY       = '#6B6560';
const GREEN_TEXT = '#6fc191';

const INPUT_BG     = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';

const PAYMENT_TAB_KEYS: { id: PaymentMethod; labelKey: TranslationKey }[] = [
  { id: 'card',   labelKey: 'step4.tabCard'   },
  { id: 'apple',  labelKey: 'step4.tabApple'  },
  { id: 'google', labelKey: 'step4.tabGoogle' },
];

interface Props {
  booking: BookingState;
  paymentMethod: PaymentMethod;
  cardForm: CardForm;
  amountChoice: AmountChoice;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  onCardFormChange: (f: CardForm) => void;
  onAmountChoiceChange: (a: AmountChoice) => void;
}

function BankCard({ cardForm, cardDetails }: { cardForm: CardForm; cardDetails?: CardInputDetails }) {
  const { t } = useLanguage();
  const displayLast = cardDetails?.last4 || '••••';

  const holderFirst = cardForm.prenom.trim();
  const holderLast  = cardForm.nom.trim();
  const holderName  = holderFirst || holderLast
    ? `${holderFirst} ${holderLast}`.trim()
    : null;

  const expiry = cardDetails?.expiryMonth && cardDetails?.expiryYear
    ? `${String(cardDetails.expiryMonth).padStart(2, '0')} / ${String(cardDetails.expiryYear).slice(-2)}`
    : null;

  return (
    <LinearGradient
      colors={['#2A2010', '#1A1408', '#221A08']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={card.container}
    >
      {/* Top row */}
      <View style={card.topRow}>
        {/* Chip */}
        <LinearGradient
          colors={['#C9A84C', '#A9863A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={card.chip}
        />
        {/* Brand */}
        <Text style={card.brand}>willobarber</Text>
      </View>

      {/* Card number */}
      <Text style={card.number}>
        {'• • • •  • • • •  • • • •  ' + displayLast}
      </Text>

      {/* Bottom row */}
      <View style={card.bottomRow}>
        <View>
          <Text style={card.metaLabel}>{t('step4.cardHolderLabel')}</Text>
          <Text style={[card.metaValue, !holderName && card.metaPlaceholder]}>
            {holderName ?? 'Antoine Rivière'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={card.metaLabel}>{t('step4.cardExpiryLabel')}</Text>
          <Text style={[card.metaValue, !expiry && card.metaPlaceholder]}>
            {expiry ?? '05 / 28'}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const card = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 22,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    width: 38,
    height: 28,
    borderRadius: 6,
  },
  brand: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    fontStyle: 'italic',
    color: '#C9A84C',
  },
  number: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'left',
    marginTop: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  metaPlaceholder: {
    color: 'rgba(255,255,255,0.35)',
  },
});

function FieldLabel({ text }: { text: string }) {
  return <Text style={fStyles.label}>{text}</Text>;
}

function FieldInput({
  label,
  value,
  onChange,
  keyboard = 'default',
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  placeholder?: string;
}) {
  return (
    <View style={fStyles.wrap}>
      <FieldLabel text={label} />
      <TextInput
        style={fStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.22)"
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#FFFFFF',
  },
});

export interface Step4PaymentHandle {
  pay: () => Promise<string>;
}

export const Step4Payment = forwardRef<Step4PaymentHandle, Props>(function Step4Payment({
  booking,
  paymentMethod,
  cardForm,
  amountChoice,
  onPaymentMethodChange,
  onCardFormChange,
  onAmountChoiceChange,
}, ref) {
  const { service } = booking;
  const { t } = useLanguage();
  const [cardDetails, setCardDetails] = useState<CardInputDetails>();
  const cardFieldRef = useRef<StripeCardFieldHandle>(null);

  const price   = service ? service.price : 0;
  const deposit = ACOMPTE_FIXE;
  const isFull  = amountChoice === 'full';
  const payNow  = isFull ? price : deposit;
  const solde   = isFull ? 0 : price - deposit;
  const serviceName = service ? t(`services.svc.${service.id}.name` as TranslationKey) : '—';

  const set = (key: keyof CardForm) => (v: string) =>
    onCardFormChange({ ...cardForm, [key]: v });

  useImperativeHandle(ref, () => ({
    pay: async () => {
      if (!cardDetails?.complete || !cardFieldRef.current) {
        throw new Error(t('step4.cardIncomplete'));
      }
      return cardFieldRef.current.pay(payNow, cardForm);
    },
  }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={130}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.title}>{t('step4.title')}</Text>
        <Text style={styles.subtitle}>
          {t('step4.subtitle')}
        </Text>

        {/* ── Informations de contact ───────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('step4.contactTitle')}</Text>
          <Text style={styles.cardSubtitle}>
            {t('step4.contactSubtitle')}
          </Text>
          <FieldInput
            label={t('step4.firstName')}
            value={cardForm.prenom}
            onChange={set('prenom')}
            placeholder="Jean"
          />
          <FieldInput
            label={t('step4.lastName')}
            value={cardForm.nom}
            onChange={set('nom')}
            placeholder="Dupont"
          />
          <FieldInput
            label={t('step4.email')}
            value={cardForm.email}
            onChange={set('email')}
            keyboard="email-address"
            placeholder="jean@exemple.com"
          />
          <FieldInput
            label={t('step4.phone')}
            value={cardForm.phone}
            onChange={set('phone')}
            keyboard="phone-pad"
            placeholder="+32 …"
          />
        </View>

        {/* ── Méthode de paiement ───────────────────────────────────────── */}
        <View style={[styles.card, styles.paymentMethodCard]}>
          <Text style={styles.cardTitle}>{t('step4.paymentMethodTitle')}</Text>

          <View style={styles.tabs}>
            {PAYMENT_TAB_KEYS.map(({ id, labelKey }) => {
              const isOn = paymentMethod === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.tab, isOn && styles.tabActive]}
                  onPress={() => onPaymentMethodChange(id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, isOn && styles.tabTextActive]}>
                    {t(labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {paymentMethod === 'card' && (
            <View>
              <BankCard cardForm={cardForm} cardDetails={cardDetails} />
              <View style={styles.cardFieldsBlock}>
                <Text style={styles.cardFieldsLabel}>
                  {t('step4.cardNumberLabel')} · {t('step4.cardExpiryLabel')} · {t('step4.cvcLabel')}
                </Text>
                <StripeCardField
                  ref={cardFieldRef}
                  incompleteMessage={t('step4.cardIncomplete')}
                  onChange={setCardDetails}
                />
              </View>
              <Text style={styles.cardFieldHint}>{t('step4.cardFieldHint')}</Text>
            </View>
          )}

          {paymentMethod !== 'card' && (
            <View style={styles.altPay}>
              <Text style={styles.altPayIcon}>
                {paymentMethod === 'apple' ? '🍎' : '🔵'}
              </Text>
              <Text style={styles.altPayText}>
                {paymentMethod === 'apple'
                  ? t('step4.altPayApple')
                  : t('step4.altPayGoogle')}
              </Text>
            </View>
          )}
        </View>

        {/* ── Montant à régler maintenant ──────────────────────────────── */}
        <View style={{ marginTop: 0, paddingTop: 0, minHeight: 0 }}>
          <Text style={styles.amountNowKicker}>{t('step4.amountNowKicker')}</Text>

          {/* Option 1 — Acompte fixe obligatoire */}
          <TouchableOpacity
            style={[styles.radioCard, amountChoice === 'deposit' && styles.radioCardActive]}
            onPress={() => onAmountChoiceChange('deposit')}
            activeOpacity={0.85}
          >
            <View style={styles.radioRow}>
              <View style={[styles.radioIconCircle, amountChoice === 'deposit' && styles.radioIconCircleActive]}>
                <Feather name="shield" size={18} color={amountChoice === 'deposit' ? '#1A1208' : GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.radioLabelRow}>
                  <Text style={styles.radioAmount}>{fmtPrice(deposit)}</Text>
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>{t('step4.depositBadge')}</Text>
                  </View>
                </View>
                <Text style={styles.radioSub}>{t('step4.depositSub')}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Option 2 — Totalité optionnelle */}
          <TouchableOpacity
            style={[styles.radioCard, amountChoice === 'full' && styles.radioCardActive]}
            onPress={() => onAmountChoiceChange('full')}
            activeOpacity={0.85}
          >
            <View style={styles.radioRow}>
              <View style={[styles.radioIconCircle, amountChoice === 'full' && styles.radioIconCircleActive]}>
                <Feather name="award" size={18} color={amountChoice === 'full' ? '#1A1208' : GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.radioLabelRow}>
                  <Text style={styles.radioAmount}>{fmtPrice(price)}</Text>
                  <View style={styles.badgeGrey}>
                    <Text style={styles.badgeGreyText}>{t('step4.fullBadge')}</Text>
                  </View>
                </View>
                <Text style={styles.radioSub}>{t('step4.fullSub')}</Text>
                <View style={styles.economyRow}>
                  <Feather name="check-circle" size={12} color={GREEN_TEXT} />
                  <Text style={styles.economyText}>{t('step4.fullEconomy')}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Montant à régler ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.amountKicker}>{t('step4.amountKicker')}</Text>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{serviceName}</Text>
            <Text style={styles.amountValue}>{fmtPrice(price)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>
              {isFull ? t('step4.paymentTotalLabel') : t('step4.depositLabel')}
            </Text>
            <Text style={[styles.amountValue, { color: GREEN_TEXT }]}>
              -{fmtPrice(payNow)}
            </Text>
          </View>

          <View style={styles.amountSep} />

          <View style={styles.soldeRow}>
            <Text style={styles.soldeLabel}>{t('step4.soldeLabel')}</Text>
            {isFull ? (
              <Text style={[styles.soldeValue, { color: 'rgba(255,255,255,0.35)', fontSize: 15 }]}>
                {t('step4.soldeNone')}
              </Text>
            ) : (
              <Text style={styles.soldeValue}>{fmtPrice(solde)}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 80,
  },

  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: GREY,
    lineHeight: 19,
    marginBottom: 20,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  paymentMethodCard: {
    paddingBottom: 8,
    marginBottom: 0,
  },
  cardTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 19,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: GREY,
    marginBottom: 16,
  },

  // Payment tabs
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
  },
  tabTextActive: {
    color: '#1a1208',
    fontWeight: '600',
  },

  cardFieldsBlock: {
    marginTop: 2,
  },
  cardFieldsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardFieldHint: {
    fontSize: 11,
    color: GREY,
    marginTop: 8,
    lineHeight: 15,
  },

  altPay: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  altPayIcon: { fontSize: 34 },
  altPayText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 220,
  },

  // Amount now — radio cards
  amountNowKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  radioCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  radioCardActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radioIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.4)',
    backgroundColor: 'rgba(201,168,76,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioIconCircleActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  radioLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  radioAmount: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: GOLD,
    fontWeight: '700',
  },
  radioSub: {
    fontSize: 12.5,
    color: GREY,
  },
  economyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  economyText: {
    fontSize: 12,
    color: GREEN_TEXT,
    fontWeight: '500',
  },
  badgeGreen: {
    backgroundColor: '#1B4332',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGreenText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#2D6A4F',
  },
  badgeGrey: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGreyText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
  },

  // Amount
  amountKicker: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  amountLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  amountValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  amountSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginVertical: 12,
  },

  soldeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soldeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    flex: 1,
  },
  soldeValue: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    color: GOLD,
  },
});
