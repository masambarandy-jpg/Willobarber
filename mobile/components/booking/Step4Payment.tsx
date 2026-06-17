import React from 'react';
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
import { Fonts } from '@/constants';
import {
  LOYALTY_DISCOUNT,
  calcDeposit,
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

const PAYMENT_TABS: { id: PaymentMethod; label: string }[] = [
  { id: 'card',   label: 'Carte'      },
  { id: 'apple',  label: 'Apple Pay'  },
  { id: 'google', label: 'Google Pay' },
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

function BankCard({ cardForm }: { cardForm: CardForm }) {
  const rawNumber = cardForm.cardNumber.replace(/\D/g, '');
  const last4 = rawNumber.length >= 4 ? rawNumber.slice(-4) : rawNumber.padEnd(4, '').trimEnd();
  const displayLast = last4 || '4582';

  const holderFirst = cardForm.prenom.trim();
  const holderLast  = cardForm.nom.trim();
  const holderName  = holderFirst || holderLast
    ? `${holderFirst} ${holderLast}`.trim()
    : null;

  const expiry = cardForm.expiry.trim() || null;

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
          <Text style={card.metaLabel}>TITULAIRE</Text>
          <Text style={[card.metaValue, !holderName && card.metaPlaceholder]}>
            {holderName ?? 'Antoine Rivière'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={card.metaLabel}>EXPIRATION</Text>
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

export function Step4Payment({
  booking,
  paymentMethod,
  cardForm,
  amountChoice,
  onPaymentMethodChange,
  onCardFormChange,
  onAmountChoiceChange,
}: Props) {
  const { service } = booking;

  const price   = service ? service.price : 0;
  const deposit = calcDeposit(price);
  const isFull  = amountChoice === 'full';
  const payNow  = isFull ? price : deposit;
  const solde   = isFull ? 0 : price - deposit - LOYALTY_DISCOUNT;

  const set = (key: keyof CardForm) => (v: string) =>
    onCardFormChange({ ...cardForm, [key]: v });

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
        <Text style={styles.title}>Acompte & paiement</Text>
        <Text style={styles.subtitle}>
          Un acompte de 10 % sécurise votre créneau. Le solde se règle au salon.
        </Text>

        {/* ── Informations de contact ───────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations de contact</Text>
          <Text style={styles.cardSubtitle}>
            Pour la confirmation et le rappel SMS la veille.
          </Text>
          <FieldInput
            label="PRÉNOM"
            value={cardForm.prenom}
            onChange={set('prenom')}
            placeholder="Jean"
          />
          <FieldInput
            label="NOM"
            value={cardForm.nom}
            onChange={set('nom')}
            placeholder="Dupont"
          />
          <FieldInput
            label="EMAIL"
            value={cardForm.email}
            onChange={set('email')}
            keyboard="email-address"
            placeholder="jean@exemple.com"
          />
          <FieldInput
            label="TÉLÉPHONE"
            value={cardForm.phone}
            onChange={set('phone')}
            keyboard="phone-pad"
            placeholder="+32 …"
          />
        </View>

        {/* ── Méthode de paiement ───────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Méthode de paiement</Text>

          <View style={styles.tabs}>
            {PAYMENT_TABS.map(({ id, label }) => {
              const isOn = paymentMethod === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.tab, isOn && styles.tabActive]}
                  onPress={() => onPaymentMethodChange(id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, isOn && styles.tabTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {paymentMethod === 'card' && (
            <View>
              <BankCard cardForm={cardForm} />
              <FieldInput
                label="NUMÉRO DE CARTE"
                value={cardForm.cardNumber}
                onChange={set('cardNumber')}
                keyboard="numeric"
                placeholder="•••• •••• •••• ••••"
              />
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <FieldInput
                    label="EXPIRATION"
                    value={cardForm.expiry}
                    onChange={set('expiry')}
                    keyboard="numeric"
                    placeholder="MM / AA"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldInput
                    label="CVC"
                    value={cardForm.cvc}
                    onChange={set('cvc')}
                    keyboard="numeric"
                    placeholder="•••"
                  />
                </View>
              </View>
            </View>
          )}

          {paymentMethod !== 'card' && (
            <View style={styles.altPay}>
              <Text style={styles.altPayIcon}>
                {paymentMethod === 'apple' ? '🍎' : '🔵'}
              </Text>
              <Text style={styles.altPayText}>
                {paymentMethod === 'apple'
                  ? 'Authentification via Touch ID ou Face ID'
                  : 'Authentification via votre compte Google'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Montant à régler maintenant ──────────────────────────────── */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.amountNowKicker}>MONTANT À RÉGLER MAINTENANT</Text>

          {/* Option 1 — Acompte 10% obligatoire */}
          <TouchableOpacity
            style={[styles.radioCard, amountChoice === 'deposit' && styles.radioCardActive]}
            onPress={() => onAmountChoiceChange('deposit')}
            activeOpacity={0.85}
          >
            <View style={styles.radioRow}>
              <View style={[styles.radioCircle, amountChoice === 'deposit' && styles.radioCircleActive]}>
                {amountChoice === 'deposit' && <Text style={styles.radioCheck}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.radioLabelRow}>
                  <Text style={styles.radioAmount}>{fmtPrice(deposit)}</Text>
                  <View style={styles.badgeGold}>
                    <Text style={styles.badgeGoldText}>OBLIGATOIRE</Text>
                  </View>
                </View>
                <Text style={styles.radioSub}>Acompte minimum pour sécuriser votre créneau</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Option 2 — Totalité optionnel */}
          <TouchableOpacity
            style={[styles.radioCard, amountChoice === 'full' && styles.radioCardActive]}
            onPress={() => onAmountChoiceChange('full')}
            activeOpacity={0.85}
          >
            <View style={styles.radioRow}>
              <View style={[styles.radioCircle, amountChoice === 'full' && styles.radioCircleActive]}>
                {amountChoice === 'full' && <Text style={styles.radioCheck}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.radioLabelRow}>
                  <Text style={styles.radioAmount}>{fmtPrice(price)}</Text>
                  <View style={styles.badgeGrey}>
                    <Text style={styles.badgeGreyText}>OPTIONNEL</Text>
                  </View>
                </View>
                <Text style={styles.radioSub}>Réglez la totalité maintenant, rien à payer au salon</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Montant à régler ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.amountKicker}>MONTANT À RÉGLER</Text>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{service?.name ?? '—'}</Text>
            <Text style={styles.amountValue}>{fmtPrice(price)}</Text>
          </View>
          {!isFull && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Réduction fidélité</Text>
              <Text style={[styles.amountValue, { color: GREEN_TEXT }]}>
                -{fmtPrice(LOYALTY_DISCOUNT)}
              </Text>
            </View>
          )}
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>
              {isFull ? 'Paiement total' : 'Acompte (10%)'}
            </Text>
            <Text style={[styles.amountValue, { color: GREEN_TEXT }]}>
              -{fmtPrice(payNow)}
            </Text>
          </View>

          <View style={styles.amountSep} />

          <View style={styles.soldeRow}>
            <Text style={styles.soldeLabel}>SOLDE À RÉGLER AU SALON</Text>
            {isFull ? (
              <Text style={[styles.soldeValue, { color: 'rgba(255,255,255,0.35)', fontSize: 15 }]}>
                Rien à régler au salon ✓
              </Text>
            ) : (
              <Text style={styles.soldeValue}>{fmtPrice(solde)}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
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
    gap: 8,
    marginBottom: 18,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
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

  cardRow: {
    flexDirection: 'row',
    gap: 12,
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
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  radioCheck: {
    fontSize: 12,
    color: '#1A1208',
    fontWeight: '700',
    lineHeight: 14,
  },
  radioLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  radioAmount: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  radioSub: {
    fontSize: 13,
    color: GREY,
  },
  badgeGold: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGoldText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: GOLD,
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
