import React from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { SERVICES, type BookingState, type StaticService } from './data';
import type { TranslationKey } from '@/i18n/translations';

const GOLD       = '#C9A84C';
const CARD       = '#1A1814';
const BORDER_SEP = 'rgba(255,255,255,0.08)';
const BORDER_MED = 'rgba(255,255,255,0.16)';
const GREY       = '#6B6560';
const PHOTO_H    = 180;

interface Props {
  booking: BookingState;
  onSelect: (s: StaticService) => void;
  onChildCountChange: (n: number) => void;
  footerHeight?: number;
}

export function Step1Service({ booking, onSelect, onChildCountChange, footerHeight }: Props) {
  const selected   = booking.service;
  const childCount = booking.childCount;
  const { t } = useLanguage();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: footerHeight ?? 100 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title section */}
      <Text style={styles.kicker}>{t('booking.kicker')}</Text>
      <Text style={styles.title}>{t('step1.title')}</Text>
      <Text style={styles.subtitle}>
        {t('step1.subtitle')}
      </Text>

      {/* Service cards */}
      {SERVICES.map((svc) => {
        const isOn = selected?.id === svc.id;
        return (
          <TouchableOpacity
            key={svc.id}
            style={[styles.card, isOn && styles.cardActive]}
            onPress={() => onSelect(svc)}
            activeOpacity={0.8}
          >
            {/* Photo zone */}
            <View style={styles.photoZone}>
              {svc.photo ? (
                <Image
                  source={{ uri: svc.photo }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.photo, { backgroundColor: '#2a1f10' }]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(26,20,8,0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.photoGradient}
              />
              <View style={styles.photoBadges}>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{t(`services.cat.${svc.cat}` as TranslationKey)}</Text>
                </View>
                {svc.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t('common.popular')}</Text>
                  </View>
                )}
              </View>
              {/* Radio indicator in top-right corner of photo */}
              <View style={[styles.radioCircle, isOn && styles.radioCircleActive]}>
                {isOn && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </View>

            {/* Text zone */}
            <View style={styles.cardTextZone}>
              {/* Name */}
              <Text style={styles.cardName}>{t(`services.svc.${svc.id}.name` as TranslationKey)}</Text>

              {/* Description */}
              <Text style={styles.cardDesc}>{t(`services.svc.${svc.id}.desc` as TranslationKey)}</Text>

              {/* Separator */}
              <View style={styles.cardSep} />

              {/* Footer: duration + price */}
              <View style={styles.cardFooter}>
                <View style={styles.durRow}>
                  <Text style={styles.clockIcon}>⏱</Text>
                  <Text style={styles.cardDur}>{svc.dur}</Text>
                </View>
                <Text style={styles.cardPrice}>{svc.price} €</Text>
              </View>

              {/* Child counter (selected + counter) */}
              {isOn && svc.counter && (
                <View style={styles.childBlock}>
                  <View style={styles.childSep} />
                  <View style={styles.childRow}>
                    <Text style={styles.childLabel}>{t('step1.childCountLabel')}</Text>
                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        style={styles.counterBtnMinus}
                        onPress={() => onChildCountChange(Math.max(1, childCount - 1))}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.counterBtnMinusText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{childCount}</Text>
                      <TouchableOpacity
                        style={styles.counterBtnPlus}
                        onPress={() => onChildCountChange(Math.min(6, childCount + 1))}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.counterBtnPlusText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 80,
  },

  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: GOLD,
    marginBottom: 10,
    textTransform: 'uppercase',
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

  // Card
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardActive: {
    borderColor: GOLD,
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },

  // Photo zone
  photoZone: {
    height: PHOTO_H,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: PHOTO_H,
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  photoBadges: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    gap: 6,
  },
  catBadge: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  popularBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  radioCircle: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  checkMark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Text zone
  cardTextZone: {
    padding: 16,
    paddingTop: 14,
  },

  cardName: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: GREY,
    lineHeight: 19,
    marginBottom: 12,
  },

  cardSep: {
    height: 1,
    backgroundColor: BORDER_SEP,
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clockIcon: {
    fontSize: 13,
    color: GOLD,
  },
  cardDur: {
    fontSize: 13,
    color: GREY,
  },
  cardPrice: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    color: GOLD,
  },

  // Child counter
  childBlock: {
    marginTop: 4,
  },
  childSep: {
    height: 1,
    backgroundColor: BORDER_SEP,
    marginBottom: 12,
    marginTop: 12,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  childLabel: {
    fontSize: 13,
    color: GREY,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counterBtnMinus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: BORDER_MED,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnMinusText: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  counterValue: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: '#FFFFFF',
    minWidth: 24,
    textAlign: 'center',
  },
  counterBtnPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnPlusText: {
    fontSize: 18,
    color: '#1a1208',
    lineHeight: 20,
    fontWeight: '700',
  },
});
