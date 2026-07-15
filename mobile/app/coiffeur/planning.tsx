import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

const HOUR_HEIGHT = 66;
const START_HOUR = 11;
const END_HOUR = 19;

type Barber = 'Willo' | 'Malik' | 'Idris';

const BARBER_CHIPS: { key: Barber; color: string }[] = [
  { key: 'Willo', color: '#C9A84C' },
  { key: 'Malik', color: '#8a5a35' },
  { key: 'Idris', color: '#2D6A4F' },
];

const BARBER_STYLE: Record<Barber, { bg: string; border: string }> = {
  Willo: { bg: '#3a2f12', border: '#C9A84C' },
  Malik: { bg: '#33241a', border: '#8a5a35' },
  Idris: { bg: '#1d3328', border: '#2D6A4F' },
};

type Event = { time: string; service: string; client: string; barber: Barber };

const EVENTS: Event[] = [
  { time: '11:00', service: 'Signature', client: 'Antoine R.', barber: 'Willo' },
  { time: '12:00', service: 'Barbe', client: 'Karim B.', barber: 'Willo' },
  { time: '13:30', service: 'Camouflage', client: 'Noé V.', barber: 'Idris' },
  { time: '15:00', service: 'Le Rituel', client: 'Léo M.', barber: 'Willo' },
  { time: '16:00', service: 'Rasage', client: 'Thomas L.', barber: 'Malik' },
  { time: '17:30', service: 'Soin', client: 'Marc D.', barber: 'Idris' },
  { time: '18:00', service: 'Signature', client: 'Hugo P.', barber: 'Willo' },
];

function timeOffset(time: string) {
  const [h, m] = time.split(':').map(Number);
  return ((h - START_HOUR) * 60 + m) / 60 * HOUR_HEIGHT;
}

const VIEW_MODES = ['Jour', 'Semaine', 'Mois'] as const;

export default function CoiffeurPlanningScreen() {
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('Semaine');
  const [selectedBarbers, setSelectedBarbers] = useState<Barber[]>(['Willo', 'Malik', 'Idris']);

  const toggleBarber = (b: Barber) => {
    setSelectedBarbers((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const visibleEvents = EVENTS.filter((e) => selectedBarbers.includes(e.barber));
  const currentTimeTop = timeOffset('14:30');

  return (
    <CoiffeurScreen active="planning">
      <Text style={styles.title}>Planning</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>RDV SEMAINE</Text>
          <Text style={styles.statValue}>42</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TEMPS RÉSERVÉ</Text>
          <Text style={styles.statValue}>31h</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>CA PRÉVISIONNEL</Text>
          <Text style={styles.statValue}>1 840€</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TAUX REMPLISSAGE</Text>
          <Text style={styles.statValue}>78%</Text>
        </View>
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.navBtn}>
          <ChevronLeftIcon size={14} />
        </TouchableOpacity>
        <Text style={styles.dateText}>Sam. 30 mai</Text>
        <TouchableOpacity style={styles.navBtn}>
          <ChevronRightIcon size={14} />
        </TouchableOpacity>
      </View>

      <View style={styles.viewToggle}>
        {VIEW_MODES.map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewToggleItem, viewMode === mode && styles.viewToggleItemActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>{mode}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        {BARBER_CHIPS.map((chip) => {
          const active = selectedBarbers.includes(chip.key);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, !active && styles.chipInactive]}
              onPress={() => toggleBarber(chip.key)}
            >
              <View style={[styles.chipDot, { backgroundColor: chip.color }]} />
              <Text style={styles.chipText}>{chip.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.calendar}>
        {hours.map((h) => (
          <View key={h} style={styles.hourRow}>
            <Text style={styles.hourLabel}>{h}h</Text>
          </View>
        ))}
        <View style={styles.hourRowFinal}>
          <Text style={styles.hourLabel}>{END_HOUR}h</Text>
        </View>

        <View style={[styles.currentTimeLine, { top: currentTimeTop }]}>
          <View style={styles.currentTimeDot} />
          <View style={styles.currentTimeBar} />
        </View>

        {visibleEvents.map((e) => {
          const style = BARBER_STYLE[e.barber];
          return (
            <View
              key={e.time + e.client}
              style={[
                styles.event,
                {
                  top: timeOffset(e.time) + 2,
                  backgroundColor: style.bg,
                  borderLeftColor: style.border,
                },
              ]}
            >
              <Text style={[styles.eventText, { color: style.border }]}>
                {e.time} · {e.service}
              </Text>
              <Text style={styles.eventClient}>{e.client}</Text>
            </View>
          );
        })}
      </View>
    </CoiffeurScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
    marginBottom: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    width: '47%',
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.black,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CC.white,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
    minWidth: 100,
    textAlign: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: CC.barTrackBg,
    borderRadius: 9,
    padding: 3,
    marginBottom: 14,
  },
  viewToggleItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  viewToggleItemActive: {
    backgroundColor: CC.white,
  },
  viewToggleText: {
    fontSize: 12.5,
    color: CC.textSecondary,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: CC.black,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: CC.white,
  },
  chipInactive: {
    opacity: 0.4,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CC.black,
  },
  calendar: {
    position: 'relative',
    marginLeft: 0,
  },
  hourRow: {
    height: HOUR_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: CC.barTrackBg,
    paddingLeft: 2,
  },
  hourRowFinal: {
    height: 1,
    borderTopWidth: 1,
    borderTopColor: CC.barTrackBg,
  },
  hourLabel: {
    width: 36,
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: -6,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C0392B',
    marginRight: -4,
    marginLeft: 32,
    zIndex: 2,
  },
  currentTimeBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#C0392B',
  },
  event: {
    position: 'absolute',
    left: 44,
    right: 0,
    minHeight: 56,
    borderRadius: 8,
    borderLeftWidth: 3,
    padding: 8,
    justifyContent: 'center',
  },
  eventText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  eventClient: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});
