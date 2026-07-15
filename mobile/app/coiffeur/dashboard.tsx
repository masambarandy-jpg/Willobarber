import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { DownloadIcon, UsersIcon, ListIcon, PersonIcon, CalendarIcon, ChevronDownIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF, AvatarKey } from '@/components/coiffeur/theme';

type Period = 'jour' | 'semaine' | 'mois';

const PERIODS: Period[] = ['jour', 'semaine', 'mois'];
const PERIOD_LABELS: Record<Period, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois' };

const CA_DATA: Record<Period, { total: string; bars: { label: string; v: number }[]; active: string }> = {
  jour: {
    total: '487,50 €',
    bars: [
      { label: '9h', v: 45 },
      { label: '10h', v: 90 },
      { label: '11h', v: 75 },
      { label: '12h', v: 30 },
      { label: '14h', v: 120 },
      { label: '15h', v: 87 },
      { label: '16h', v: 40 },
    ],
    active: '14h',
  },
  semaine: {
    total: '2 840 €',
    bars: [
      { label: 'Lun', v: 0 },
      { label: 'Mar', v: 520 },
      { label: 'Mer', v: 480 },
      { label: 'Jeu', v: 610 },
      { label: 'Ven', v: 590 },
      { label: 'Sam', v: 640 },
      { label: 'Dim', v: 0 },
    ],
    active: 'Sam',
  },
  mois: {
    total: '12 233,23 €',
    bars: [
      { label: 'Jan', v: 30 },
      { label: 'Fév', v: 20 },
      { label: 'Mar', v: 38 },
      { label: 'Avr', v: 42 },
      { label: 'Mai', v: 52 },
      { label: 'Juin', v: 30 },
      { label: 'Juil', v: 33 },
    ],
    active: 'Mar',
  },
};

const TOP_SERVICES = [
  { name: 'Signature WilloBarber', pct: 38 },
  { name: 'Taille & rasage', pct: 25 },
  { name: 'Le Rituel', pct: 17 },
  { name: 'Coupe express', pct: 12 },
  { name: 'Soin du visage', pct: 8 },
];

const UPCOMING_CLIENTS: { letter: AvatarKey; name: string; service: string; barber: string; time: string }[] = [
  { letter: 'A', name: 'Antoine Rivière', service: 'Signature', barber: 'Willo', time: '10:30' },
  { letter: 'K', name: 'Karim Benali', service: 'Barbe', barber: 'Malik', time: '11:15' },
  { letter: 'L', name: 'Léo Martin', service: 'Le Rituel', barber: 'Willo', time: '14:00' },
  { letter: 'N', name: 'Noé Vasseur', service: 'Camouflage', barber: 'Idris', time: '16:30' },
];

function genererRapport() {
  const contenu = `
RAPPORT WILLOBARBER — ${new Date().toLocaleDateString('fr-FR')}
═══════════════════════════════════════

RÉSUMÉ GÉNÉRAL
- Clients totaux : 2 412
- Prestations actives : 14
- Équipe : 3 barbiers
- Rendez-vous ce mois : 386

CHIFFRE D'AFFAIRES
- Total mensuel : 12 233,23 €
- Jan: 7 200€ | Fév: 4 800€ | Mar: 9 120€
- Avr: 10 080€ | Mai: 12 480€ | Juin: 7 200€ | Juil: 7 920€

TOP PRESTATIONS
1. Signature WilloBarber — 38% (148 RDV)
2. Taille & rasage — 25% (96 RDV)
3. Le Rituel — 17% (64 RDV)
4. Coupe express — 12% (48 RDV)
5. Soin du visage — 8% (30 RDV)

PROCHAINS CLIENTS
- 10:30 — Antoine Rivière (Signature · Willo)
- 11:15 — Karim Benali (Barbe · Malik)
- 14:00 — Léo Martin (Le Rituel · Willo)
- 16:30 — Noé Vasseur (Camouflage · Idris)

═══════════════════════════════════════
Généré par WilloBarber le ${new Date().toLocaleString('fr-FR')}
  `;

  if (typeof window !== 'undefined') {
    const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-willobarber-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default function CoiffeurDashboardScreen() {
  const [period, setPeriod] = useState<Period>('mois');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);

  const caData = CA_DATA[period];
  const maxValue = Math.max(...caData.bars.map((b) => b.v), 1);

  return (
    <CoiffeurScreen active="dashboard">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Aperçu</Text>
        <TouchableOpacity style={styles.reportBtn} onPress={genererRapport}>
          <DownloadIcon color={CC.black} size={13} />
          <Text style={styles.reportBtnText}>Rapport</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardDark]}>
          <UsersIcon color={CC.white} size={18} />
          <Text style={styles.statLabelDark}>Clients totaux</Text>
          <Text style={styles.statValueDark}>2 412</Text>
        </View>
        <View style={styles.statCard}>
          <ListIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Prestations</Text>
          <Text style={styles.statValue}>14</Text>
        </View>
        <View style={styles.statCard}>
          <PersonIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Équipe</Text>
          <Text style={styles.statValue}>3</Text>
        </View>
        <View style={styles.statCard}>
          <CalendarIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Rendez-vous</Text>
          <Text style={styles.statValue}>386</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Chiffre d'affaires</Text>
          <View style={styles.periodWrap}>
            <TouchableOpacity style={styles.periodBtn} onPress={() => setPeriodMenuOpen((v) => !v)}>
              <Text style={styles.periodBtnText}>{PERIOD_LABELS[period]}</Text>
              <ChevronDownIcon size={12} />
            </TouchableOpacity>
            {periodMenuOpen && (
              <View style={styles.periodMenu}>
                {PERIODS.map((p) => {
                  const isActive = p === period;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={styles.periodMenuItem}
                      onPress={() => {
                        setPeriod(p);
                        setPeriodMenuOpen(false);
                      }}
                    >
                      <Text style={[styles.periodMenuItemText, isActive && styles.periodMenuItemTextActive]}>
                        {PERIOD_LABELS[p]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
        <Text style={styles.revenueAmount}>{caData.total}</Text>

        <View style={styles.chart}>
          {caData.bars.map((bar) => {
            const isActive = bar.label === caData.active;
            return (
              <View key={bar.label} style={styles.chartCol}>
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: (bar.v / maxValue) * 130,
                        backgroundColor: isActive ? CC.gold : CC.barTrackBg,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartLabel, isActive && styles.chartLabelActive]}>{bar.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Top prestations</Text>
          <TouchableOpacity onPress={() => router.push('/coiffeur/prestations')}>
            <Text style={styles.linkText}>Voir tout →</Text>
          </TouchableOpacity>
        </View>

        {TOP_SERVICES.map((s, i) => (
          <View key={s.name} style={styles.topServiceRow}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{i + 1}</Text>
            </View>
            <View style={styles.topServiceInfo}>
              <View style={styles.topServiceTop}>
                <Text style={styles.topServiceName}>{s.name}</Text>
                <Text style={styles.topServicePct}>{s.pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${s.pct}%` }]} />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Prochains clients</Text>
          <TouchableOpacity onPress={() => router.push('/coiffeur/planning')}>
            <Text style={styles.linkText}>Agenda →</Text>
          </TouchableOpacity>
        </View>

        {UPCOMING_CLIENTS.map((c, i) => (
          <View key={c.name} style={[styles.clientRow, i === UPCOMING_CLIENTS.length - 1 && styles.clientRowLast]}>
            <Avatar letter={c.letter} size={40} />
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{c.name}</Text>
              <Text style={styles.clientMeta}>
                {c.service} · {c.barber}
              </Text>
            </View>
            <Text style={styles.clientTime}>{c.time}</Text>
          </View>
        ))}
      </View>
    </CoiffeurScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 32,
    color: CC.black,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: CC.black,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  statCardDark: {
    backgroundColor: CC.cardBlack,
  },
  statLabel: {
    fontSize: 12.5,
    color: CC.textSecondary,
  },
  statLabelDark: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 30,
    color: CC.black,
  },
  statValueDark: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 30,
    color: CC.white,
  },
  card: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 19,
    color: CC.black,
  },
  periodWrap: {
    position: 'relative',
    zIndex: 20,
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: CC.white,
  },
  periodBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.black,
  },
  periodMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 130,
    backgroundColor: CC.white,
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  periodMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  periodMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.black,
  },
  periodMenuItemTextActive: {
    color: CC.goldDark,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.goldDark,
  },
  revenueAmount: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 32,
    color: CC.black,
    marginBottom: 18,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarTrack: {
    height: 130,
    justifyContent: 'flex-end',
    width: '60%',
  },
  chartBar: {
    width: '100%',
    borderRadius: 5,
  },
  chartLabel: {
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: 8,
  },
  chartLabelActive: {
    color: CC.goldDark,
    fontWeight: '700',
  },
  topServiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 14,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: CC.goldDark,
    fontWeight: '700',
    fontSize: 12,
  },
  topServiceInfo: {
    flex: 1,
  },
  topServiceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topServiceName: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  topServicePct: {
    fontSize: 12.5,
    color: CC.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.trackBg,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.gold,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eadf',
  },
  clientRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CC.black,
  },
  clientMeta: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
  },
  clientTime: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
});
