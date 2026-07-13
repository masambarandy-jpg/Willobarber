import React, { useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fonts } from '@/constants';
import { SLOT_GROUPS, isSlotAvailable, type BookingState } from './data';

const GOLD       = '#C9A84C';
const CARD       = '#1A1814';
const GREY       = '#6B6560';
const FAINT      = 'rgba(255,255,255,0.22)';
const BORDER_MED = 'rgba(255,255,255,0.16)';

const { width: SCREEN_W } = Dimensions.get('window');
// 3 columns, 2 gaps of 9, 20px padding each side
const SLOT_W = Math.floor((SCREEN_W - 40 - 18) / 3);

const MONTH_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

type Cell = { day: number; prev: boolean } | null;

function buildCells(year: number, month: number): Cell[] {
  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();
  const offset      = (firstDay.getDay() + 6) % 7; // Mon = 0

  const cells: Cell[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push({ day: prevDays - offset + 1 + i, prev: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, prev: false });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface CalendarProps {
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
}

function Calendar({ selectedDate, onSelect }: CalendarProps) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const cells = buildCells(viewYear, viewMonth);
  const rows  = Math.ceil(cells.length / 7);

  const canPrev = !(viewYear === todayY && viewMonth === todayM);
  const canNext = viewYear < todayY + 1;

  const prevMonth = () => {
    if (!canPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (!canNext) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isSelected = (day: number) =>
    selectedDate !== null &&
    selectedDate.getFullYear() === viewYear &&
    selectedDate.getMonth()   === viewMonth &&
    selectedDate.getDate()    === day;

  const isToday = (day: number) =>
    day === todayD && viewMonth === todayM && viewYear === todayY;

  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const t = new Date(todayY, todayM, todayD);
    return d < t;
  };

  // col 0 = lundi = fermé, col 6 = dimanche = fermé
  const isClosed = (col: number) => col === 0 || col === 6;

  const handleDay = (day: number, col: number) => {
    if (isClosed(col) || isPast(day)) return;
    onSelect(new Date(viewYear, viewMonth, day));
  };

  return (
    <View style={cal.wrap}>
      {/* Month nav */}
      <View style={cal.nav}>
        <Text style={cal.monthTitle}>
          {MONTH_LABELS[viewMonth]} {viewYear}
        </Text>
        <View style={cal.navBtns}>
          <TouchableOpacity
            onPress={prevMonth}
            disabled={!canPrev}
            style={[cal.navBtn, !canPrev && cal.navBtnDisabled]}
            activeOpacity={0.7}
          >
            <Text style={[cal.chevron, !canPrev && cal.chevronDisabled]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={nextMonth}
            disabled={!canNext}
            style={[cal.navBtn, !canNext && cal.navBtnDisabled]}
            activeOpacity={0.7}
          >
            <Text style={[cal.chevron, !canNext && cal.chevronDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day headers */}
      <View style={cal.dayRow}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={cal.dayCell}>
            <Text style={cal.dayLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={cal.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((cell, col) => {
            if (!cell) return <View key={col} style={cal.dayCell} />;

            if (cell.prev) {
              return (
                <View key={col} style={cal.dayCell}>
                  <View style={cal.dayCellInner}>
                    <Text style={cal.dayNumFaint}>{cell.day}</Text>
                  </View>
                </View>
              );
            }

            const { day }  = cell;
            const sel      = isSelected(day);
            const today    = isToday(day);
            const past     = isPast(day);
            const closed   = isClosed(col);
            const disabled = past || closed;

            return (
              <TouchableOpacity
                key={col}
                style={cal.dayCell}
                onPress={() => handleDay(day, col)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <View style={[
                  cal.dayCellInner,
                  sel            && cal.dayCellSel,
                  today && !sel  && cal.dayCellToday,
                ]}>
                  <Text style={[
                    cal.dayNum,
                    sel                   && cal.dayNumSel,
                    today && !sel         && cal.dayNumToday,
                    (past || closed)      && cal.dayNumFaint,
                  ]}>
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface Props {
  booking: BookingState;
  onDateSelect: (d: Date) => void;
  onTimeSelect: (t: string) => void;
}

export function Step3Date({ booking, onDateSelect, onTimeSelect }: Props) {
  const { date: selectedDate, time: selectedTime, service } = booking;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Date & heure</Text>
      <Text style={styles.subtitle}>
        Choisissez le jour, puis le créneau qui vous arrange.
      </Text>

      {/* Calendar card */}
      <View style={styles.calCard}>
        <Calendar selectedDate={selectedDate} onSelect={onDateSelect} />
      </View>

      {/* Hours badge */}
      <View style={styles.hoursBadge}>
        <Text style={styles.hoursBadgeIcon}>⏱</Text>
        <Text style={styles.hoursBadgeText}>
          Ouvert du mardi au dimanche, 11h – 20h. Fermé le lundi.
        </Text>
      </View>

      {/* Slot groups */}
      {selectedDate && (
        <View style={styles.slotsWrap}>
          {SLOT_GROUPS.map((group) => (
            <View key={group.label} style={styles.slotGroup}>
              <Text style={styles.slotGroupLabel}>{group.label}</Text>
              <View style={styles.slotsGrid}>
                {group.slots.map((slot) => {
                  const isOn     = selectedTime === slot;
                  const available = service ? isSlotAvailable(slot, service.dur) : true;
                  const disabled  = !available;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.slotPill,
                        isOn     && styles.slotPillActive,
                        disabled && styles.slotPillDisabled,
                      ]}
                      onPress={() => available && onTimeSelect(slot)}
                      disabled={disabled}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.slotText,
                        isOn     && styles.slotTextActive,
                        disabled && styles.slotTextDisabled,
                      ]}>
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Calendar styles ──────────────────────────────────────────────────────────

const cal = StyleSheet.create({
  wrap: {
    padding: 18,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 21,
    color: '#FFFFFF',
  },
  navBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_MED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chevron: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  chevronDisabled: {
    color: 'rgba(255,255,255,0.2)',
  },
  dayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  dayLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  dayCellInner: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
  },
  dayCellSel: {
    backgroundColor: GOLD,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: GOLD,
  },
  dayNum: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  dayNumSel: {
    color: '#1a1208',
    fontWeight: '700',
  },
  dayNumToday: {
    color: GOLD,
  },
  dayNumFaint: {
    fontSize: 14,
    color: FAINT,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

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
    marginBottom: 16,
  },

  calCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },

  hoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  hoursBadgeIcon: {
    fontSize: 14,
    color: GOLD,
  },
  hoursBadgeText: {
    flex: 1,
    fontSize: 12.5,
    color: GOLD,
    lineHeight: 18,
  },

  slotsWrap: {
    gap: 20,
  },
  slotGroup: {},
  slotGroupLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: GOLD,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  slotPill: {
    width: SLOT_W,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER_MED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPillActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  slotPillDisabled: {
    opacity: 0.35,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  slotTextActive: {
    color: '#1a1208',
    fontWeight: '700',
  },
  slotTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
});
