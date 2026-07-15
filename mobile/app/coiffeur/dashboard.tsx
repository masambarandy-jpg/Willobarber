import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { DownloadIcon, UsersIcon, ListIcon, PersonIcon, CalendarIcon, ChevronDownIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF, AvatarKey } from '@/components/coiffeur/theme';

const BAR_MAX = 52;
const REVENUE_BARS: { label: string; value: number; active?: boolean }[] = [
  { label: 'Jan', value: 30 },
  { label: 'Fév', value: 20 },
  { label: 'Mar', value: 38, active: true },
  { label: 'Avr', value: 42 },
  { label: 'Mai', value: 52 },
  { label: 'Juin', value: 30 },
  { label: 'Juil', value: 33 },
];

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

export default function CoiffeurDashboardScreen() {
  return (
    <CoiffeurScreen active="dashboard">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Aperçu</Text>
        <TouchableOpacity style={styles.reportBtn}>
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
          <TouchableOpacity style={styles.periodBtn}>
            <Text style={styles.periodBtnText}>Mensuel</Text>
            <ChevronDownIcon size={12} />
          </TouchableOpacity>
        </View>
        <Text style={styles.revenueAmount}>12 233,23 €</Text>

        <View style={styles.chart}>
          {REVENUE_BARS.map((bar) => (
            <View key={bar.label} style={styles.chartCol}>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: (bar.value / BAR_MAX) * 130,
                      backgroundColor: bar.active ? CC.gold : CC.barTrackBg,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, bar.active && styles.chartLabelActive]}>{bar.label}</Text>
            </View>
          ))}
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
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  periodBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.black,
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
