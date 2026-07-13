import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Fonts } from '@/constants';
import {
  ACOMPTE_FIXE,
  dayBeforeLabel,
  fmtPrice,
  formatDateShortFr,
  formatSlot,
  getServiceDurationMinutes,
  type BookingState,
} from './data';

const GOLD        = '#C9A84C';
const CARD        = '#1A1814';
const GREY        = '#6B6560';
const GREEN_BG    = '#2D6A4F';
const GREEN_TEXT  = '#6fc191';
const BORDER_THIN = 'rgba(255,255,255,0.08)';
const ADDRESS     = 'Rue Auguste Van Zande 78';
const BOOKING_NUMBER = 'WB-2026-08471';

const MOIS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

interface Props {
  booking: BookingState;
  onGoHome: () => void;
  onReschedule: () => void;
}

function DotLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={styles.dot} />
      <Text style={styles.dotLabel}>{label}</Text>
      <Text style={styles.dotValue}>{value}</Text>
    </View>
  );
}

function RecapLine({
  label,
  value,
  green,
  noBorder,
}: {
  label: string;
  value: string;
  green?: boolean;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.recapRow, noBorder && { borderBottomWidth: 0 }]}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={[styles.recapValue, green && { color: GREEN_TEXT }]}>{value}</Text>
    </View>
  );
}

export function BookingConfirmation({ booking, onGoHome, onReschedule }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { service, barber, date, time } = booking;

  const price   = service ? service.price : 0;
  const deposit = ACOMPTE_FIXE;
  const solde   = price - deposit;

  const smsDate    = date ? dayBeforeLabel(date) : '';
  const dateStr    = date ? formatDateShortFr(date) : '—';
  const timeStr    = time ? formatSlot(time) : '—';

  const topPadding = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight ?? 0) + 20;

  const handleAddToCalendar = () => {
    if (!date || !time) return;
    const durMin = service ? getServiceDurationMinutes(service.dur) : 30;
    const [h, m] = time.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + durMin * 60000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

    const text    = encodeURIComponent(`${service?.name ?? 'Rendez-vous'} — WilloBarber`);
    const details = encodeURIComponent(
      `Barbier : ${barber?.name ?? '—'}\nAdresse : ${ADDRESS}\nSolde à payer au salon : ${fmtPrice(solde)}`
    );
    const location = encodeURIComponent(ADDRESS);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const handleGoToReservations = () => {
    router.push('/(tabs)/reservations');
  };

  const handleGenerateInvoice = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Facture', 'La facture téléchargeable est disponible sur la version web.');
      return;
    }

    const qty      = service?.counter ? booking.childCount : 1;
    const unitTTC  = service?.price ?? 0;
    const totalTTC = unitTTC * qty;
    const totalHT  = totalTTC / 1.21;
    const unitHT   = unitTTC / 1.21;
    const tva      = totalTTC - totalHT;
    const soldeFacture = totalTTC - ACOMPTE_FIXE;

    const clientName  = escapeHtml(
      user?.username || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Client'
    );
    const clientEmail = escapeHtml(user?.email || '—');
    const serviceName = escapeHtml(service?.name ?? 'Prestation');

    const today = new Date();
    const issueDateStr = `${today.getDate()} ${MOIS_LONG[today.getMonth()]} ${today.getFullYear()}`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Facture ${BOOKING_NUMBER} — WilloBarber</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    background: #F5F0E8;
    color: #1A1814;
    padding: 48px 24px;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #F5F0E8;
    position: relative;
    padding: 48px;
  }
  .print-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1A1814;
    color: #F5F0E8;
    border: none;
    border-radius: 100px;
    padding: 10px 20px;
    font-family: Georgia, serif;
    font-size: 14px;
    cursor: pointer;
  }
  @media print { .print-btn { display: none; } }
  .stamp {
    position: absolute;
    top: 220px;
    right: 60px;
    border: 4px solid #2D6A4F;
    color: #2D6A4F;
    font-weight: bold;
    font-size: 34px;
    letter-spacing: 4px;
    padding: 10px 24px;
    transform: rotate(-14deg);
    opacity: 0.35;
    border-radius: 8px;
    pointer-events: none;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1A1814;
    padding-bottom: 28px;
    margin-bottom: 28px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 40px; height: 40px;
    background: #C9A84C;
    color: #1A1814;
    display: flex; align-items: center; justify-content: center;
    font-weight: bold; font-size: 18px; border-radius: 8px;
  }
  .brand-name { font-size: 20px; letter-spacing: 1px; }
  .brand-sub { font-size: 11px; letter-spacing: 2px; color: #6B6560; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 34px; font-style: italic; font-weight: normal; }
  .doc-title .meta { font-size: 12px; color: #6B6560; margin-top: 6px; line-height: 1.6; }
  .parties { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 36px; }
  .party h3 { font-size: 11px; letter-spacing: 1.5px; color: #8a8378; text-transform: uppercase; margin-bottom: 8px; }
  .party p { font-size: 13px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th { text-align: left; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #6B6560; border-bottom: 1px solid #1A1814; padding: 8px 6px; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 12px 6px; font-size: 13px; border-bottom: 1px solid rgba(26,24,20,0.12); }
  .recap { margin-left: auto; width: 300px; margin-bottom: 24px; }
  .recap-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .recap-row.total { border-top: 1px solid #1A1814; margin-top: 6px; padding-top: 10px; font-weight: bold; font-size: 15px; }
  .recap-row.deposit { color: #2D6A4F; }
  .paid-block {
    background: #1A1814;
    color: #F5F0E8;
    border-radius: 10px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .paid-block .label { font-size: 12px; letter-spacing: 1px; }
  .paid-block .amount { font-size: 20px; color: #C9A84C; font-weight: bold; }
  .note { font-size: 11.5px; color: #6B6560; line-height: 1.6; border-top: 1px solid rgba(26,24,20,0.15); padding-top: 16px; }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Imprimer</button>
  <div class="sheet">
    <div class="stamp">PAYÉ</div>

    <div class="header">
      <div class="brand">
        <div class="logo">w</div>
        <div>
          <div class="brand-name">willobarber</div>
          <div class="brand-sub">SALON DE BARBIER · BERCHEM</div>
        </div>
      </div>
      <div class="doc-title">
        <h1>Facture.</h1>
        <div class="meta">N° ${BOOKING_NUMBER}<br/>Émise le ${issueDateStr}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Émetteur</h3>
        <p>
          WilloBarber SRL<br/>
          78 rue Auguste van Zande<br/>
          1082 Bruxelles<br/>
          contact@willobarber.be<br/>
          +32 2 555 04 04<br/>
          TVA BE 0789.123.456
        </p>
      </div>
      <div class="party">
        <h3>Facturé à</h3>
        <p>
          ${clientName}<br/>
          ${clientEmail}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qté</th>
          <th class="num">P.U. HT</th>
          <th class="num">TVA</th>
          <th class="num">Total TTC</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${serviceName}</td>
          <td class="num">${qty}</td>
          <td class="num">${fmtPrice(unitHT)}</td>
          <td class="num">21%</td>
          <td class="num">${fmtPrice(totalTTC)}</td>
        </tr>
      </tbody>
    </table>

    <div class="recap">
      <div class="recap-row"><span>Méthode</span><span>Carte ····4242</span></div>
      <div class="recap-row"><span>Sous-total HT</span><span>${fmtPrice(totalHT)}</span></div>
      <div class="recap-row"><span>TVA 21%</span><span>${fmtPrice(tva)}</span></div>
      <div class="recap-row total"><span>Total TTC</span><span>${fmtPrice(totalTTC)}</span></div>
      <div class="recap-row deposit"><span>Acompte réglé</span><span>-${fmtPrice(ACOMPTE_FIXE)}</span></div>
      <div class="recap-row total"><span>Solde dû au salon</span><span>${fmtPrice(soldeFacture)}</span></div>
    </div>

    <div class="paid-block">
      <span class="label">RÉGLÉ CE JOUR · Acompte de réservation</span>
      <span class="amount">${fmtPrice(ACOMPTE_FIXE)}</span>
    </div>

    <p class="note">
      Cette facture concerne uniquement l'acompte de ${fmtPrice(ACOMPTE_FIXE)} encaissé pour sécuriser la réservation.
      Une facture finale sera émise à l'issue du rendez-vous.
    </p>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Facture_WilloBarber_WB-2026-${Math.floor(Math.random() * 90000) + 10000}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCancelAppointment = () => {
    const label = `${service?.name ?? 'votre rendez-vous'} du ${dateStr} à ${timeStr}`;
    if (Platform.OS === 'web') {
      const confirmedCancel = window.confirm(`Annuler ${label} ?`);
      if (confirmedCancel) {
        window.alert('Rendez-vous annulé. Vous recevrez un email de confirmation.');
        onGoHome();
      }
      return;
    }
    Alert.alert(
      'Annuler le rendez-vous ?',
      `${label} sera annulé.`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: "Confirmer l'annulation",
          style: 'destructive',
          onPress: () => {
            Alert.alert('Rendez-vous annulé', 'Vous recevrez un email de confirmation.');
            onGoHome();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Halo vert ─────────────────────────────────────────────────── */}
        <View style={styles.haloZone}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.kicker}>CONFIRMATION</Text>
          <Text style={styles.heroTitle}>
            Votre rendez-vous est{' '}
            <Text style={styles.heroTitleGold}>confirmé.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Un email de confirmation vient de vous être envoyé.
            Rappel SMS la veille.
          </Text>
        </View>

        {/* ── Numéro de réservation ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.bookingNumRow}>
            <View style={styles.bookingNumLeft}>
              <Text style={styles.bookingNumKicker}>NUMÉRO DE RÉSERVATION</Text>
              <Text style={styles.bookingNum}>{BOOKING_NUMBER}</Text>
            </View>
            <View style={styles.emailBadge}>
              <Text style={styles.emailBadgeText}>✓ Email envoyé</Text>
            </View>
          </View>
        </View>

        {/* ── Votre rendez-vous ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.calIcon}>📅</Text>
            <Text style={styles.cardTitle}>Votre rendez-vous</Text>
          </View>

          {service && (
            <View style={styles.serviceBadge}>
              <Text style={styles.serviceBadgeText}>{service.name}</Text>
            </View>
          )}

          <View style={styles.dotList}>
            <DotLine label="Barbier"      value={barber?.name ?? '—'} />
            <DotLine label="Date & heure" value={`${dateStr} · ${timeStr}`} />
            <DotLine label="Adresse"      value={ADDRESS} />
          </View>
        </View>

        {/* ── Récapitulatif de paiement ─────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Récapitulatif de paiement</Text>

          <RecapLine label={service?.name ?? '—'} value={fmtPrice(price)} />
          <RecapLine label="Acompte réglé"      value={`-${fmtPrice(deposit)}`}          green noBorder />

          <View style={styles.recapSep} />

          <View style={styles.soldeRow}>
            <Text style={styles.soldeLabel}>SOLDE À RÉGLER AU SALON</Text>
            <Text style={styles.soldeValue}>{fmtPrice(solde)}</Text>
          </View>
        </View>

        {/* ── Et maintenant ? ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Et maintenant ?</Text>

          <View style={styles.nextRow}>
            <Text style={styles.nextIcon}>📧</Text>
            <Text style={styles.nextLabel}>Email de confirmation</Text>
            <View style={styles.nextBadgeGreen}>
              <Text style={styles.nextBadgeGreenText}>Envoyé ✓</Text>
            </View>
          </View>

          <View style={styles.nextRow}>
            <Text style={styles.nextIcon}>📱</Text>
            <Text style={styles.nextLabel}>Rappel SMS</Text>
            <View style={styles.nextBadgeGold}>
              <Text style={styles.nextBadgeGoldText}>{smsDate}</Text>
            </View>
          </View>

          <View style={[styles.nextRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.nextIcon}>✕</Text>
            <Text style={styles.nextLabel}>Annulation gratuite</Text>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>-24h</Text>
            </View>
          </View>
        </View>

        {/* ── Points gagnés ─────────────────────────────────────────────── */}
        {service && (() => {
          const earned      = service.price * 10;
          const mockCurrent = 980;
          const newTotal    = mockCurrent + earned;
          const nextReward  = 1000;
          const remaining   = Math.max(nextReward - newTotal, 0);
          return (
            <View style={styles.pointsCard}>
              <View style={styles.pointsCardHeader}>
                <Text style={styles.pointsStarIcon}>★</Text>
                <Text style={styles.pointsCardTitle}>Vous avez gagné</Text>
              </View>
              <Text style={styles.pointsEarned}>+{earned} pts</Text>
              <Text style={styles.pointsSubtext}>Crédités sur votre compte fidélité</Text>
              <View style={styles.pointsSep} />
              <Text style={styles.pointsFooter}>
                Total : {newTotal} pts
                {remaining > 0
                  ? ` · ${remaining} avant coupe offerte`
                  : ' · Coupe offerte disponible 🎉'}
              </Text>
            </View>
          );
        })()}

        {/* ── Boutons ───────────────────────────────────────────────────── */}
        <View style={styles.btns}>
          <TouchableOpacity style={styles.btnCalendar} onPress={handleAddToCalendar} activeOpacity={0.85}>
            <Text style={styles.btnCalendarText}>Ajouter au calendrier 📅</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnDark}
            onPress={handleGoToReservations}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDarkText}>→ Mon espace</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnDark}
            onPress={handleGenerateInvoice}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDarkText}>↓ Facture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancelAppointment}
            activeOpacity={0.7}
            style={styles.btnCancel}
          >
            <Text style={styles.btnCancelText}>Annuler le rendez-vous</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  // Halo zone
  haloZone: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  checkCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: GREEN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: GREEN_BG,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
      },
      android: { elevation: 8 },
    }),
  },
  checkIcon: {
    fontSize: 38,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 12,
  },
  heroTitleGold: {
    color: GOLD,
    fontStyle: 'italic',
    fontFamily: Fonts.semiBoldItalic,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: GREY,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  // Cards
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  calIcon: { fontSize: 16, color: GOLD },
  cardTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 19,
    color: '#FFFFFF',
  },

  // Booking number card
  bookingNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookingNumLeft: { flex: 1 },
  bookingNumKicker: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bookingNum: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  emailBadge: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(111,193,145,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(111,193,145,0.3)',
  },
  emailBadgeText: {
    fontSize: 12,
    color: GREEN_TEXT,
    fontWeight: '500',
  },

  // Service badge
  serviceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  serviceBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1208',
  },

  // Dot rows
  dotList: {},
  dotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: BORDER_THIN,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginTop: 5,
    flexShrink: 0,
  },
  dotLabel: {
    fontSize: 13,
    color: GREY,
    width: 80,
    flexShrink: 0,
  },
  dotValue: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },

  // Recap payment card
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_THIN,
    marginTop: 12,
  },
  recapLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  recapValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  recapSep: {
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

  // "Et maintenant" rows
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_THIN,
    marginTop: 12,
  },
  nextIcon: { fontSize: 15, width: 20, textAlign: 'center' },
  nextLabel: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
  },
  nextBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: GREY,
  },
  nextBadgeGreen: {
    backgroundColor: 'rgba(111,193,145,0.12)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextBadgeGreenText: {
    fontSize: 11,
    fontWeight: '500',
    color: GREEN_TEXT,
  },
  nextBadgeGold: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  nextBadgeGoldText: {
    fontSize: 11,
    fontWeight: '500',
    color: GOLD,
  },

  // Points earned card
  pointsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    alignItems: 'center',
  },
  pointsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pointsStarIcon: { fontSize: 20, color: GOLD },
  pointsCardTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: '#FFFFFF' },
  pointsEarned: { fontFamily: Fonts.bold, fontSize: 36, color: GOLD, fontWeight: '700', lineHeight: 40 },
  pointsSubtext: { fontSize: 13, color: GREY, marginTop: 4 },
  pointsSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%', marginVertical: 12 },
  pointsFooter: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

  // Buttons
  btns: {
    gap: 12,
    paddingTop: 8,
  },
  btnCalendar: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  btnCalendarText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#1a1208',
  },
  btnDark: {
    backgroundColor: CARD,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnDarkText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  btnCancel: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    color: '#e53935',
    textAlign: 'center',
  },
});
