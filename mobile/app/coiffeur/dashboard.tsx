import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import jsPDF from 'jspdf';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { DownloadIcon, UsersIcon, ListIcon, PersonIcon, CalendarIcon, ChevronDownIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF, AvatarKey } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';

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
  if (typeof window === 'undefined') return;

  const doc = new jsPDF();
  const gold: [number, number, number] = [139, 105, 20];
  const dark: [number, number, number] = [26, 18, 8];
  const gray: [number, number, number] = [138, 132, 124];
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Header fond noir
  doc.setFillColor(13, 12, 10);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('willobarber', 15, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('RAPPORT DE GESTION', 15, 28);
  doc.text(date + ' · ' + heure, 15, 35);

  let y = 52;

  // Section helper
  const section = (titre: string) => {
    doc.setFillColor(245, 240, 232);
    doc.rect(10, y - 5, 190, 8, 'F');
    doc.setTextColor(...gold);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, 15, y);
    y += 10;
  };

  const ligne = (label: string, valeur: string) => {
    doc.setTextColor(...dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 15, y);
    doc.setFont('helvetica', 'bold');
    doc.text(valeur, 130, y);
    y += 8;
  };

  // RÉSUMÉ GÉNÉRAL
  section('RÉSUMÉ GÉNÉRAL');
  ligne('Clients totaux', '2 412');
  ligne('Prestations actives', '14');
  ligne('Équipe', '3 barbiers');
  ligne('Rendez-vous ce mois', '386');
  y += 6;

  // CHIFFRE D'AFFAIRES
  section("CHIFFRE D'AFFAIRES MENSUEL");
  doc.setTextColor(...gold);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('12 233,23 €', 15, y);
  y += 10;

  // Mini bar chart PDF
  const bars: { label: string; v: number; active?: boolean }[] = [
    { label: 'Jan', v: 30 },
    { label: 'Fév', v: 20 },
    { label: 'Mar', v: 38, active: true },
    { label: 'Avr', v: 42 },
    { label: 'Mai', v: 52 },
    { label: 'Juin', v: 30 },
    { label: 'Juil', v: 33 },
  ];
  const maxV = 52;
  const barW = 18;
  const barMaxH = 30;
  const startX = 15;
  bars.forEach((b, i) => {
    const bh = (b.v / maxV) * barMaxH;
    const bx = startX + i * (barW + 5);
    const by = y + barMaxH - bh;
    doc.setFillColor(b.active ? 201 : 236, b.active ? 168 : 228, b.active ? 76 : 211);
    doc.roundedRect(bx, by, barW, bh, 2, 2, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', b.active ? 'bold' : 'normal');
    if (b.active) doc.setTextColor(...gold);
    doc.text(b.label, bx + barW / 2, y + barMaxH + 5, { align: 'center' });
  });
  y += barMaxH + 14;

  // TOP PRESTATIONS
  section('TOP PRESTATIONS');
  const tops = [
    { rank: '1', name: 'Signature WilloBarber', pct: '38%', rdv: '148 RDV' },
    { rank: '2', name: 'Taille & rasage', pct: '25%', rdv: '96 RDV' },
    { rank: '3', name: 'Le Rituel', pct: '17%', rdv: '64 RDV' },
    { rank: '4', name: 'Coupe express', pct: '12%', rdv: '48 RDV' },
    { rank: '5', name: 'Soin du visage', pct: '8%', rdv: '30 RDV' },
  ];
  tops.forEach((t) => {
    doc.setFillColor(...gold);
    doc.roundedRect(15, y - 4, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(t.rank, 18, y, { align: 'center' });
    doc.setTextColor(...dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(t.name, 25, y);
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.text(t.pct, 150, y);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.text(t.rdv, 170, y);
    // Barre progression
    doc.setFillColor(240, 234, 223);
    doc.rect(25, y + 2, 120, 2, 'F');
    doc.setFillColor(...gold);
    doc.rect(25, y + 2, (120 * parseInt(t.pct, 10)) / 100, 2, 'F');
    y += 12;
  });
  y += 4;

  // PROCHAINS CLIENTS
  section("PROCHAINS CLIENTS AUJOURD'HUI");
  const clients = [
    { time: '10:30', name: 'Antoine Rivière', svc: 'Signature · Willo' },
    { time: '11:15', name: 'Karim Benali', svc: 'Barbe · Malik' },
    { time: '14:00', name: 'Léo Martin', svc: 'Le Rituel · Willo' },
    { time: '16:30', name: 'Noé Vasseur', svc: 'Camouflage · Idris' },
  ];
  clients.forEach((c, i) => {
    if (i > 0) {
      doc.setDrawColor(240, 234, 223);
      doc.line(15, y - 2, 195, y - 2);
    }
    doc.setTextColor(...gold);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(c.time, 15, y);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(c.name, 40, y);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(c.svc, 40, y + 5);
    y += 14;
  });

  // Footer
  doc.setFillColor(13, 12, 10);
  doc.rect(0, 280, 210, 17, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('willobarber', 15, 288);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text('Rue Auguste Van Zande 78, 1082 Bruxelles', 15, 293);
  doc.setTextColor(...gray);
  doc.text('Généré le ' + date + ' à ' + heure, 195, 293, { align: 'right' });

  doc.save(`rapport-willobarber-${new Date().toISOString().split('T')[0]}.pdf`);
}

export default function CoiffeurDashboardScreen() {
  const isTablet = useIsTablet();
  const [period, setPeriod] = useState<Period>('mois');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const periodBtnRef = useRef<View>(null);

  const caData = CA_DATA[period];
  const maxValue = Math.max(...caData.bars.map((b) => b.v), 1);

  const selectPeriod = (p: Period) => {
    setPeriod(p);
    setMenuOpen(false);
  };

  const togglePeriodMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    periodBtnRef.current?.measureInWindow((x, y, _width, height) => {
      setMenuPos({ top: y + height + 6, left: x });
      setMenuOpen(true);
    });
  };

  return (
    <>
    <CoiffeurScreen active="dashboard">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Aperçu</Text>
        <TouchableOpacity style={styles.reportBtn} onPress={genererRapport}>
          <DownloadIcon color={CC.black} size={13} />
          <Text style={styles.reportBtnText}>Rapport</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardDark, isTablet && styles.statCardTablet]}>
          <UsersIcon color={CC.white} size={18} />
          <Text style={styles.statLabelDark}>Clients totaux</Text>
          <Text style={styles.statValueDark}>2 412</Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <ListIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Prestations</Text>
          <Text style={styles.statValue}>14</Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <PersonIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Équipe</Text>
          <Text style={styles.statValue}>3</Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <CalendarIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Rendez-vous</Text>
          <Text style={styles.statValue}>386</Text>
        </View>
      </View>

      <View style={isTablet && styles.twoColRow}>
        <View style={[styles.card, isTablet && styles.cardHalf]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Chiffre d'affaires</Text>
            <View ref={periodBtnRef} collapsable={false}>
              <TouchableOpacity style={styles.periodBtn} onPress={togglePeriodMenu}>
                <Text style={styles.periodBtnText}>{PERIOD_LABELS[period]}</Text>
                <ChevronDownIcon size={12} />
              </TouchableOpacity>
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

        <View style={[styles.card, isTablet && styles.cardHalf]}>
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

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
        <View style={[styles.periodMenu, { top: menuPos.top, left: menuPos.left }]}>
          {PERIODS.map((p) => {
            const isActive = p === period;
            return (
              <TouchableOpacity key={p} style={styles.periodMenuItem} onPress={() => selectPeriod(p)}>
                <Text style={[styles.periodMenuItemText, isActive && styles.periodMenuItemTextActive]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </>
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
  statCardTablet: {
    width: '23%',
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
  twoColRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cardHalf: {
    flex: 1,
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
    backgroundColor: CC.white,
  },
  periodBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.black,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  periodMenu: {
    position: 'absolute',
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
