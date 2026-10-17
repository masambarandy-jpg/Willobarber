import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationToast, type ToastData } from '@/components/NotificationToast';
import { closedPeriodsApi, openingHoursApi, slotsApi, waitingListApi, waitlistApi, waitlistErrorCode } from '@/services/api';
import type { BarberName, ClosedPeriod, OpeningHoursDay } from '@/types';
import {
  DEFAULT_CLOSING_MINUTES,
  closingMinutesOf,
  groupSlots,
  hhmmToMinutes,
  isSlotAvailable,
  type BookingState,
} from './data';
import type { TranslationKey } from '@/i18n/translations';

const GOLD       = '#C9A84C';
const CARD       = '#1A1814';
const GREY       = '#6B6560';
const FAINT      = 'rgba(255,255,255,0.22)';
const BORDER_MED = 'rgba(255,255,255,0.16)';
// Sous ce délai, le backend ne prévient plus (cf. waitlist.NOTIFY_MIN_LEAD) :
// inutile de proposer l'alerte.
const WAITLIST_MIN_LEAD_MS = 2 * 60 * 60 * 1000;

const { width: SCREEN_W } = Dimensions.get('window');
// 3 columns, 2 gaps of 9, 20px padding each side
const SLOT_W = Math.floor((SCREEN_W - 40 - 18) / 3);

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findClosedPeriod(date: Date, closedPeriods: ClosedPeriod[]): ClosedPeriod | null {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return closedPeriods.find((p) => {
    const start = parseIsoDate(p.start_date);
    const end = parseIsoDate(p.end_date);
    return d >= start && d <= end;
  }) ?? null;
}

function formatHour(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** « MAR – DIM 11h – 21h · Fermé : LUN » — jours consécutifs aux mêmes horaires regroupés. */
function summarizeHours(hours: OpeningHoursDay[], dayLabel: (i: number) => string, closedLabel: string): string {
  const byDay = [...hours].sort((a, b) => a.weekday - b.weekday);
  const span = (h: OpeningHoursDay) =>
    `${formatHour(hhmmToMinutes(h.open_time))} – ${formatHour(closingMinutesOf(h.close_time))}`;
  const parts: string[] = [];
  let i = 0;
  while (i < byDay.length) {
    if (byDay[i].is_closed) { i++; continue; }
    let j = i;
    while (j + 1 < byDay.length && !byDay[j + 1].is_closed && span(byDay[j + 1]) === span(byDay[i])) j++;
    const days = j > i ? `${dayLabel(byDay[i].weekday)} – ${dayLabel(byDay[j].weekday)}` : dayLabel(byDay[i].weekday);
    parts.push(`${days} ${span(byDay[i])}`);
    i = j + 1;
  }
  const closed = byDay.filter((h) => h.is_closed).map((h) => dayLabel(h.weekday));
  if (closed.length) parts.push(`${closedLabel} : ${closed.join(', ')}`);
  return parts.join(' · ');
}

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
  closedPeriods: ClosedPeriod[];
  openingHours: OpeningHoursDay[];
}

function Calendar({ selectedDate, onSelect, closedPeriods, openingHours }: CalendarProps) {
  const { t } = useLanguage();
  const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => t(`step3.month.${i}` as TranslationKey));
  const DAY_LABELS = Array.from({ length: 7 }, (_, i) => t(`step3.day.${i}` as TranslationKey));
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

  // col 0 = lundi = weekday 0 côté backend. Tant que les horaires ne sont pas
  // chargés, on garde l'ancien défaut (lundi fermé).
  const isWeekdayClosed = (col: number) =>
    openingHours.length
      ? openingHours.find((h) => h.weekday === col)?.is_closed ?? false
      : col === 0;

  const isPeriodClosed = (day: number) =>
    findClosedPeriod(new Date(viewYear, viewMonth, day), closedPeriods) !== null;

  const handleDay = (day: number, col: number) => {
    if (isWeekdayClosed(col) || isPeriodClosed(day) || isPast(day)) return;
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
            const closed   = isWeekdayClosed(col) || isPeriodClosed(day);
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
  serviceId: number | null;
  titleOverride?: string;
  footerHeight?: number;
}

export interface Step3DateHandle {
  /** Force un nouveau fetch des créneaux de la date sélectionnée (ex: après un 409 réservation). */
  refresh: () => void;
}

export const Step3Date = forwardRef<Step3DateHandle, Props>(function Step3Date(
  { booking, onDateSelect, onTimeSelect, serviceId, titleOverride },
  ref
) {
  const { date: selectedDate, time: selectedTime, service } = booking;
  // Prénom du barbier choisi à l'étape 2 (BARBERS : 'Willo' | 'Malik' | 'Idris').
  const barberName = (booking.barber?.name ?? 'Willo') as BarberName;
  const { t } = useLanguage();

  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([]);
  const [openingHours, setOpeningHours] = useState<OpeningHoursDay[]>([]);
  // Grille du jour sélectionné, telle que renvoyée par le backend (horaires du salon).
  const [daySlots, setDaySlots] = useState<string[]>([]);
  const [dayClosed, setDayClosed] = useState(false);
  const [closingMinutes, setClosingMinutes] = useState(DEFAULT_CLOSING_MINUTES);
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  // Liste d'attente par créneau : créneaux pris par un RDV, et ceux que le
  // client suit déjà (alerte « 🔔 Me prévenir » active).
  const [takenTimes, setTakenTimes] = useState<Set<string>>(new Set());
  const [watchedTimes, setWatchedTimes] = useState<Set<string>>(new Set());
  const [notifyingTime, setNotifyingTime] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let cancelled = false;
    closedPeriodsApi.list()
      .then((periods) => { if (!cancelled) setClosedPeriods(periods); })
      .catch(() => {});
    openingHoursApi.list()
      .then((hours) => { if (!cancelled) setOpeningHours(hours); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Créneaux de l'agenda du barbier choisi.
  const fetchSlots = useCallback((date: Date) => {
    setJoinedWaitlist(false);
    setLoadingSlots(true);
    let cancelled = false;
    slotsApi.available(barberName, toIsoDate(date))
      .then((res) => {
        if (cancelled) return;
        const taken = new Set(res.slots.filter((s) => !s.is_available).map((s) => s.start_time));
        setBookedTimes(taken);
        setTakenTimes(new Set(res.slots.filter((s) => s.is_booked).map((s) => s.start_time)));
        setDaySlots(res.slots.map((s) => s.start_time));
        setDayClosed(Boolean(res.is_closed));
        setClosingMinutes(closingMinutesOf(res.close_time));
      })
      .catch(() => {
        if (cancelled) return;
        setBookedTimes(new Set());
        setTakenTimes(new Set());
        setDaySlots([]);
        setDayClosed(false);
      })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    // Alertes déjà posées sur ce jour (silencieux si non connecté).
    setWatchedTimes(new Set());
    waitlistApi.mine()
      .then((entries) => {
        if (cancelled) return;
        const day = toIsoDate(date);
        setWatchedTimes(new Set(
          entries.filter((e) => e.barber === barberName && e.date === day).map((e) => e.time.slice(0, 5)),
        ));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [barberName]);

  useEffect(() => {
    if (!selectedDate) {
      setBookedTimes(new Set());
      setDaySlots([]);
      setDayClosed(false);
      setJoinedWaitlist(false);
      return;
    }
    return fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      if (selectedDate) fetchSlots(selectedDate);
    },
  }), [selectedDate, fetchSlots]);

  const closedPeriod = selectedDate ? findClosedPeriod(selectedDate, closedPeriods) : null;

  const slotAvailable = (slot: string) => {
    if (!service) return !bookedTimes.has(slot);
    if (!isSlotAvailable(slot, service.dur, closingMinutes)) return false;

    // Pour les services "counter" (enfants multiples), on doit s'assurer
    // que N créneaux consécutifs sont libres pour éviter que le coiffeur
    // déborde sur le créneau d'un autre client.
    const count = service.counter ? Math.max(1, booking.childCount) : 1;
    if (count === 1) {
      return !bookedTimes.has(slot);
    }

    // Trouve l'index du créneau dans la grille du jour puis vérifie les N suivants
    const startIdx = daySlots.indexOf(slot);
    if (startIdx === -1) return !bookedTimes.has(slot);

    for (let i = 0; i < count; i++) {
      const candidate = daySlots[startIdx + i];
      // Si on dépasse la grille (fin de journée), impossible
      if (!candidate) return false;
      // Si on dépasse l'horaire de fermeture, impossible
      if (!isSlotAvailable(candidate, service.dur, closingMinutes)) return false;
      // Si le créneau est déjà pris, impossible
      if (bookedTimes.has(candidate)) return false;
    }
    return true;
  };

  const dayFull = Boolean(
    selectedDate && !closedPeriod && !dayClosed && !loadingSlots && daySlots.length > 0 &&
    daySlots.every((slot) => !slotAvailable(slot))
  );

  const hoursNote = openingHours.length
    ? summarizeHours(openingHours, (i) => t(`step3.day.${i}` as TranslationKey), t('step3.closedLabel'))
    : t('step3.hoursNote');

  const canWatch = (slot: string) => {
    if (!selectedDate || !takenTimes.has(slot)) return false;
    const [h, m] = slot.split(':').map(Number);
    const start = new Date(selectedDate);
    start.setHours(h, m, 0, 0);
    return start.getTime() - Date.now() >= WAITLIST_MIN_LEAD_MS;
  };

  const handleNotifyMe = async (slot: string) => {
    if (!selectedDate || notifyingTime || watchedTimes.has(slot)) return;
    setNotifyingTime(slot);
    try {
      await waitlistApi.create({
        barber: barberName,
        date: toIsoDate(selectedDate),
        time: slot,
        service_name: service?.name,
      });
      setWatchedTimes((prev) => new Set(prev).add(slot));
      setToast({ message: t('waitlist.added'), testID: 'waitlist-added-toast' });
    } catch (error) {
      const code = waitlistErrorCode(error);
      if (code === 'already_subscribed') setWatchedTimes((prev) => new Set(prev).add(slot));
      const key: TranslationKey =
        code === 'already_subscribed' ? 'waitlist.alreadySubscribed'
        : code === 'full' ? 'waitlist.full'
        : 'waitlist.error';
      setToast({ message: t(key), color: code === 'already_subscribed' ? GOLD : '#C0392B' });
    } finally {
      setNotifyingTime(null);
    }
  };

  const handleJoinWaitingList = async () => {
    if (!selectedDate || !serviceId) return;
    setJoiningWaitlist(true);
    try {
      await waitingListApi.create({
        service: serviceId,
        preferred_date: toIsoDate(selectedDate),
      });
      setJoinedWaitlist(true);
      const message = t('step3.waitingListConfirm');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(t('step3.waitingListTitle'), message);
      }
    } catch {
      const message = t('step3.waitingListError');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(t('common.error'), message);
      }
    } finally {
      setJoiningWaitlist(false);
    }
  };

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{titleOverride ?? t('step3.title')}</Text>
      <Text style={styles.subtitle}>
        {t('step3.subtitle')}
      </Text>

      {/* Calendar card */}
      <View style={styles.calCard}>
        <Calendar
          selectedDate={selectedDate}
          onSelect={onDateSelect}
          closedPeriods={closedPeriods}
          openingHours={openingHours}
        />
      </View>

      {/* Hours badge */}
      <View style={styles.hoursBadge}>
        <Text style={styles.hoursBadgeIcon}>⏱</Text>
        <Text style={styles.hoursBadgeText}>
          {hoursNote}
        </Text>
      </View>

      {/* Closed day warning */}
      {closedPeriod && (
        <View style={styles.closedBadge}>
          <Text style={styles.closedBadgeIcon}>🏖️</Text>
          <Text style={styles.closedBadgeText}>
            Le salon est fermé ce jour ({closedPeriod.reason}) — choisissez une autre date.
          </Text>
        </View>
      )}

      {/* Jour fermé dans les horaires du salon */}
      {selectedDate && !closedPeriod && !loadingSlots && dayClosed && (
        <View style={styles.closedBadge}>
          <Text style={styles.closedBadgeIcon}>🔒</Text>
          <Text style={styles.closedBadgeText}>{t('step3.dayClosed')}</Text>
        </View>
      )}

      {/* Slot groups */}
      {selectedDate && !closedPeriod && !dayClosed && (
        <View style={styles.slotsWrap}>
          {groupSlots(daySlots).map((group) => (
            <View key={group.label} style={styles.slotGroup}>
              <Text style={styles.slotGroupLabel}>{t(`step3.slotGroup.${group.label}` as TranslationKey)}</Text>
              <View style={styles.slotsGrid}>
                {group.slots.map((slot) => {
                  const isOn     = selectedTime === slot;
                  const available = slotAvailable(slot);
                  const disabled  = !available;
                  if (!available && canWatch(slot)) {
                    const watched = watchedTimes.has(slot);
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[styles.slotPill, styles.slotPillTaken]}
                        onPress={() => handleNotifyMe(slot)}
                        disabled={watched || notifyingTime !== null}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${slot} — ${t(watched ? 'waitlist.subscribed' : 'waitlist.notifyMe')}`}
                        testID={`btn-notify-${slot}`}
                      >
                        <Text style={[styles.slotText, styles.slotTextDisabled]}>{slot}</Text>
                        <Text style={[styles.notifyText, watched && styles.notifyTextOn]} numberOfLines={1}>
                          {notifyingTime === slot ? '…' : t(watched ? 'waitlist.subscribed' : 'waitlist.notifyMe')}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
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

      {dayFull && !joinedWaitlist && (
        <TouchableOpacity
          style={{ backgroundColor: '#C9A84C', padding: 16, borderRadius: 12, margin: 16, opacity: joiningWaitlist ? 0.6 : 1 }}
          onPress={handleJoinWaitingList}
          disabled={joiningWaitlist || !serviceId}
          activeOpacity={0.85}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            📋 Rejoindre la liste d'attente
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    <NotificationToast toast={toast} onHide={hideToast} />
    </>
  );
});

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

  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(192,57,43,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.3)',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  closedBadgeIcon: {
    fontSize: 14,
  },
  closedBadgeText: {
    flex: 1,
    fontSize: 12.5,
    color: '#C0392B',
    lineHeight: 18,
    fontWeight: '600',
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
  slotPillTaken: {
    paddingVertical: 7,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  notifyText: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(201,168,76,0.85)',
  },
  notifyTextOn: {
    color: GOLD,
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
