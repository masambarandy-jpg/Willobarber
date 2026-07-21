import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { type BookingState, formatDateShortFr, formatSlot } from './data';
import type { TranslationKey } from '@/i18n/translations';

const GOLD        = '#C9A84C';
const HEADER_BG   = 'rgba(13,12,10,0.85)';
const BORDER_THIN = 'rgba(255,255,255,0.08)';

interface Props {
  paddingTop: number;
  booking: BookingState;
  totalPrice: number;
}

export function BookingHeader({ paddingTop, booking, totalPrice }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  const { service, barber, date, time } = booking;

  const recapItems: { label: string; value: string }[] = [];
  if (service) recapItems.push({ label: t('book.recap.service'), value: t(`services.svc.${service.id}.name` as TranslationKey) });
  if (barber)  recapItems.push({ label: t('book.recap.barber'), value: barber.name });
  if (date)    recapItems.push({ label: t('book.recap.date'), value: formatDateShortFr(date) });
  if (time)    recapItems.push({ label: t('book.recap.time'), value: formatSlot(time) });

  const hasRecap = recapItems.length > 0;

  return (
    <View style={[styles.root, { paddingTop }]}>
      {/* Top row: logo + help button */}
      <View style={styles.topRow}>
        <View style={styles.logoRow}>
          <Text style={styles.logoMark}>{'{w}'}</Text>
          <Text style={styles.logoText}>willobarber</Text>
        </View>
        <View style={styles.helpCircle}>
          <Text style={styles.helpText}>?</Text>
        </View>
      </View>

      {/* Accordion: "Voir le récapitulatif" */}
      <TouchableOpacity
        style={styles.accordion}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
      >
        <View style={styles.accordionLeft}>
          <Text style={styles.chevron}>{expanded ? '↑' : '↓'}</Text>
          <Text style={styles.accordionLabel}>{t('bookingHeader.recapToggle')}</Text>
        </View>
        {totalPrice > 0 && (
          <Text style={styles.accordionPrice}>{totalPrice} €</Text>
        )}
      </TouchableOpacity>

      {/* Expanded summary */}
      {expanded && hasRecap && (
        <View style={styles.summaryBox}>
          {recapItems.map((item) => (
            <View key={item.label} style={styles.summaryRow}>
              <View style={styles.dot} />
              <Text style={styles.summaryKey}>{item.label}</Text>
              <Text style={styles.summaryVal}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Bottom border */}
      <View style={styles.borderBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: HEADER_BG,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoMark: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: GOLD,
    letterSpacing: 1,
  },
  logoText: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  helpCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
  },

  accordion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER_THIN,
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    fontSize: 12,
    color: '#6B6560',
  },
  accordionLabel: {
    fontSize: 13,
    color: '#6B6560',
    letterSpacing: 0.2,
  },
  accordionPrice: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: GOLD,
  },

  summaryBox: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  summaryKey: {
    fontSize: 12,
    color: '#6B6560',
    width: 68,
    flexShrink: 0,
  },
  summaryVal: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: Fonts.semiBold,
  },

  borderBottom: {
    height: 1,
    backgroundColor: BORDER_THIN,
  },
});
