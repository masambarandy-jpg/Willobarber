import { useEffect, useMemo, useState } from 'react';
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

const TODAY_EVENTS: Event[] = [
  { time: '11:00', service: 'Signature', client: 'Antoine R.', barber: 'Willo' },
  { time: '12:00', service: 'Barbe', client: 'Karim B.', barber: 'Willo' },
  { time: '13:30', service: 'Camouflage', client: 'Noé V.', barber: 'Idris' },
  { time: '15:00', service: 'Le Rituel', client: 'Léo M.', barber: 'Willo' },
  { time: '16:00', service: 'Rasage', client: 'Thomas L.', barber: 'Malik' },
  { time: '17:30', service: 'Soin', client: 'Marc D.', barber: 'Idris' },
  { time: '18:00', service: 'Signature', client: 'Hugo P.', barber: 'Willo' },
];

const MOCK_SERVICES = ['Signature', 'Barbe', 'Camouflage', 'Le Rituel', 'Rasage', 'Soin'];
const MOCK_CLIENTS = [
  'Antoine R.', 'Karim B.', 'Noé V.', 'Léo M.', 'Thomas L.', 'Marc D.', 'Hugo P.',
  'Sami K.', 'Yanis T.', 'Adam B.', 'Nathan G.', 'Rayan F.',
];
const MOCK_BARBERS: Barber[] = ['Willo', 'Malik', 'Idris'];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

function getEventsForDate(date: Date): Event[] {
  if (isSameDay(date, new Date())) return TODAY_EVENTS;

  const rand = seededRandom(dateKey(date));
  const count = Math.floor(rand() * 4);
  const usedHours = new Set<number>();
  const events: Event[] = [];

  for (let i = 0; i < count; i++) {
    let hour = START_HOUR + Math.floor(rand() * (END_HOUR - START_HOUR));
    let guard = 0;
    while (usedHours.has(hour) && guard < 10) {
      hour = START_HOUR + Math.floor(rand() * (END_HOUR - START_HOUR));
      guard++;
    }
    usedHours.add(hour);
    const minute = rand() > 0.5 ? '30' : '00';
    events.push({
      time: `${hour.toString().padStart(2, '0')}:${minute}`,
      service: MOCK_SERVICES[Math.floor(rand() * MOCK_SERVICES.length)],
      client: MOCK_CLIENTS[Math.floor(rand() * MOCK_CLIENTS.length)],
      barber: MOCK_BARBERS[Math.floor(rand() * MOCK_BARBERS.length)],
    });
  }

  return events.sort((a, b) => a.time.localeCompare(b.time));
}

function timeOffset(time: string) {
  const [h, m] = time.split(':').map(Number);
  return (((h - START_HOUR) * 60 + m) / 60) * HOUR_HEIGHT;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(date: Date, view: (typeof VIEW_MODES)[number]) {
  if (view === 'Jour') {
    return capitalize(date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }));
  }
  if (view === 'Semaine') {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endMonth = capitalize(end.toLocaleDateString('fr-FR', { month: 'long' }));
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }
    const startMonth = capitalize(start.toLocaleDateString('fr-FR', { month: 'long' }));
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }
  return capitalize(date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
}

function getMonthGrid(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(1 - startOffset);

  const lastOfMonth = new Date(year, month + 1, 0);
  const endOffset = (7 - (((lastOfMonth.getDay() + 6) % 7) + 1)) % 7;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + endOffset);

  const days: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getNowPosition() {
  const now = new Date();
  const totalMinutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  return (totalMinutes / 60) * HOUR_HEIGHT;
}

const VIEW_MODES = ['Jour', 'Semaine', 'Mois'] as const;
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function CoiffeurPlanningScreen() {
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('Jour');
  const [selectedBarbers, setSelectedBarbers] = useState<Barber[]>(['Willo', 'Malik', 'Idris']);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [nowPosition, setNowPosition] = useState(getNowPosition());

  useEffect(() => {
    const interval = setInterval(() => setNowPosition(getNowPosition()), 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleBarber = (b: Barber) => {
    setSelectedBarbers((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const goBack = () => {
    const d = new Date(currentDate);
    if (viewMode === 'Jour') d.setDate(d.getDate() - 1);
    if (viewMode === 'Semaine') d.setDate(d.getDate() - 7);
    if (viewMode === 'Mois') d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'Jour') d.setDate(d.getDate() + 1);
    if (viewMode === 'Semaine') d.setDate(d.getDate() + 7);
    if (viewMode === 'Mois') d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const goToDay = (d: Date) => {
    setCurrentDate(d);
    setViewMode('Jour');
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const isToday = isSameDay(currentDate, new Date());
  const showNowLine = isToday && new Date().getHours() >= START_HOUR && new Date().getHours() < END_HOUR;

  const dayEvents = useMemo(
    () => getEventsForDate(currentDate).filter((e) => selectedBarbers.includes(e.barber)),
    [currentDate, selectedBarbers]
  );

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const monthDays = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const monthWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
    return weeks;
  }, [monthDays]);

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
        <TouchableOpacity style={styles.navBtn} onPress={goBack}>
          <ChevronLeftIcon size={14} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{formatDateLabel(currentDate, viewMode)}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={goNext}>
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

      {viewMode === 'Jour' && (
        <View style={styles.calendar}>
          {hours.map((h) => (
            <View key={h} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{h}h</Text>
            </View>
          ))}
          <View style={styles.hourRowFinal}>
            <Text style={styles.hourLabel}>{END_HOUR}h</Text>
          </View>

          {showNowLine && (
            <View style={[styles.currentTimeLine, { top: nowPosition }]}>
              <View style={styles.currentTimeDot} />
              <View style={styles.currentTimeBar} />
            </View>
          )}

          {dayEvents.map((e) => {
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
      )}

      {viewMode === 'Semaine' && (
        <View style={styles.weekGrid}>
          {weekDays.map((d) => {
            const today = isSameDay(d, new Date());
            const events = getEventsForDate(d).filter((e) => selectedBarbers.includes(e.barber));
            return (
              <TouchableOpacity
                key={dateKey(d)}
                style={[styles.weekColumn, today && styles.weekColumnToday]}
                onPress={() => goToDay(d)}
              >
                <Text style={styles.weekDayHeader}>
                  {capitalize(d.toLocaleDateString('fr-FR', { weekday: 'short' })).replace('.', '')} {d.getDate()}
                </Text>
                {events.map((e) => {
                  const style = BARBER_STYLE[e.barber];
                  return (
                    <View
                      key={e.time + e.client}
                      style={[styles.weekEventCard, { backgroundColor: style.bg, borderLeftColor: style.border }]}
                    >
                      <Text style={[styles.weekEventText, { color: style.border }]} numberOfLines={1}>
                        {e.time}
                      </Text>
                      <Text style={styles.weekEventClient} numberOfLines={1}>
                        {e.client}
                      </Text>
                    </View>
                  );
                })}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {viewMode === 'Mois' && (
        <View style={styles.monthGrid}>
          <View style={styles.monthWeekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={`${label}-${i}`} style={styles.monthDayCell}>
                <Text style={styles.monthHeaderLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {monthWeeks.map((week, wi) => (
            <View key={wi} style={styles.monthWeekRow}>
              {week.map((d) => {
                const inMonth = d.getMonth() === currentDate.getMonth();
                const today = isSameDay(d, new Date());
                const hasEvents = getEventsForDate(d).length > 0;
                return (
                  <TouchableOpacity
                    key={dateKey(d)}
                    style={styles.monthDayCell}
                    onPress={() => goToDay(d)}
                  >
                    <View style={[styles.monthDayNumberWrap, today && styles.monthDayToday]}>
                      <Text style={[styles.monthDayNumber, !inMonth && styles.monthDayOutside]}>{d.getDate()}</Text>
                    </View>
                    {hasEvents && <View style={styles.monthDayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}
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
  weekGrid: {
    flexDirection: 'row',
  },
  weekColumn: {
    flex: 1,
    minHeight: 260,
    paddingHorizontal: 3,
    paddingTop: 4,
    borderRightWidth: 1,
    borderRightColor: CC.barTrackBg,
    borderRadius: 6,
  },
  weekColumnToday: {
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  weekDayHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: CC.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  weekEventCard: {
    borderRadius: 6,
    borderLeftWidth: 2,
    padding: 4,
    marginBottom: 4,
  },
  weekEventText: {
    fontSize: 9,
    fontWeight: '700',
  },
  weekEventClient: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  monthGrid: {
    gap: 2,
  },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthDayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CC.textSecondary,
  },
  monthDayNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayToday: {
    borderWidth: 1.5,
    borderColor: CC.gold,
  },
  monthDayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.black,
  },
  monthDayOutside: {
    color: CC.textSecondary,
    opacity: 0.35,
  },
  monthDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: CC.gold,
    marginTop: 2,
  },
});
