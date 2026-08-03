import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import { servicesApi } from '@/services/api';
import type { Service } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const PADDING_H = 22;
const PEEK = 20;
const GAP = 12;
const SLIDE_W = SCREEN_W - PADDING_H * 2 - PEEK;
const PHOTO_H = 200;
const SLIDE_DURATION = 10000;
const SNAP_INTERVAL = SLIDE_W + GAP;

export const SERVICES = [
  {
    id: 'signature', apiId: 1, cat: 'COUPE HOMME', name: 'Signature WilloBarber',
    short: 'Diagnostic, shampooing, coupe ciseaux & finition rasoir.',
    dur: '45 min', price: 45, popular: true,
    photo: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
  },
  {
    id: 'barbe', apiId: 2, cat: 'BARBE', name: "Taille & rasage à l'ancienne",
    short: 'Serviette chaude, huile pré-rasage, rasoir droit.',
    dur: '30 min', price: 28, popular: false,
    photo: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80',
  },
  {
    id: 'rituel', apiId: 3, cat: 'PACKAGE', name: 'Le Rituel',
    short: 'Coupe signature + barbe + soin du visage.',
    dur: '1h15', price: 75, popular: true,
    photo: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  },
  {
    id: 'express', apiId: 4, cat: 'COUPE HOMME', name: 'Coupe express',
    short: 'Pour les habitués pressés. Le savoir-faire, version concentrée.',
    dur: '25 min', price: 28, popular: false,
    photo: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80',
  },
  {
    id: 'camouflage', apiId: 5, cat: 'COLORATION', name: 'Camouflage gris',
    short: 'Pigmentation sur-mesure, sans ammoniaque.',
    dur: '40 min', price: 35, popular: false,
    photo: 'https://images.unsplash.com/photo-1518710843675-2540dd79065c?w=800&q=80',
  },
  {
    id: 'soin', apiId: 6, cat: 'SOIN', name: 'Soin du visage',
    short: "Gommage, masque à l'argile, modelage.",
    dur: '30 min', price: 32, popular: false,
    photo: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
  },
] as const;

export type ServiceId = (typeof SERVICES)[number]['id'];

export function ServiceCarousel() {
  const router = useRouter();
  const { t } = useLanguage();
  const svcCat = (cat: string) => t(`services.cat.${cat}` as TranslationKey);
  const svcName = (id: string) => t(`services.svc.${id}.name` as TranslationKey);
  const svcShort = (id: string) => t(`services.svc.${id}.short` as TranslationKey);
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;

  // GET /services/ est public (pas de token requis) — on l'appelle au montage pour
  // remplacer les prix/durées figés de SERVICES par les vraies valeurs Railway,
  // en les recollant via apiId (cf. même mapping dans book.tsx). Si le fetch
  // échoue, on garde silencieusement les valeurs statiques : cette carousel est
  // une vitrine décorative sur la landing, elle ne doit jamais bloquer l'affichage.
  const [apiServicesById, setApiServicesById] = useState<Record<number, Service>>({});
  useEffect(() => {
    servicesApi.list()
      .then(data => {
        const byId: Record<number, Service> = {};
        data.forEach(s => { byId[s.id] = s; });
        setApiServicesById(byId);
      })
      .catch(() => {});
  }, []);

  const services = SERVICES.map(svc => {
    const live = apiServicesById[svc.apiId];
    if (!live) return svc;
    return {
      ...svc,
      price: parseFloat(live.price),
      dur: `${live.duration} min`,
      popular: live.is_popular ?? svc.popular,
    };
  });

  // Pour mobile, recalcule la largeur de slide dynamiquement
  const mobileSlideW = windowWidth - PADDING_H * 2 - PEEK;
  const mobileSnapInterval = mobileSlideW + GAP;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const currentSlideRef = useRef(0);
  const isPausedRef = useRef(false);

  const progress = useSharedValue(0);
  const trackWidth = useSharedValue(mobileSlideW);

  const handleAutoAdvance = useCallback(() => {
    const next = (currentSlideRef.current + 1) % SERVICES.length;
    currentSlideRef.current = next;
    setCurrentSlide(next);
    scrollRef.current?.scrollTo({ x: next * mobileSnapInterval, animated: true });
  }, []);

  const goToSlide = useCallback((index: number) => {
    const i = Math.max(0, Math.min(index, SERVICES.length - 1));
    currentSlideRef.current = i;
    isPausedRef.current = false;
    setCurrentSlide(i);
    setIsPaused(false);
    scrollRef.current?.scrollTo({ x: i * mobileSnapInterval, animated: true });
  }, []);

  useEffect(() => {
    if (isPaused) {
      cancelAnimation(progress);
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: SLIDE_DURATION, easing: Easing.linear }, finished => {
      if (finished) runOnJS(handleAutoAdvance)();
    });
    return () => cancelAnimation(progress);
  }, [currentSlide, isPaused, progress, handleAutoAdvance]);

  const handlePausePlay = useCallback(() => {
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    cancelAnimation(progress);
  }, [progress]);

  const handleMomentumScrollEnd = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / mobileSnapInterval);
    const clamped = Math.max(0, Math.min(idx, SERVICES.length - 1));

    if (clamped !== currentSlideRef.current) {
      currentSlideRef.current = clamped;
      setCurrentSlide(clamped);
    } else if (!isPausedRef.current) {
      // Same slide after the drag — the currentSlide effect won't re-fire, so restart the timer manually.
      progress.value = 0;
      progress.value = withTiming(1, { duration: SLIDE_DURATION, easing: Easing.linear }, finished => {
        if (finished) runOnJS(handleAutoAdvance)();
      });
    }
  }, [progress, handleAutoAdvance]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidth.value,
  }));

  if (isTablet) {
    return (
      <View style={tabletStyles.grid}>
        {services.map((svc) => (
          <View key={svc.id} style={tabletStyles.card}>

            {/* ── Photo zone ── */}
            <View style={styles.photoZone}>
              <Image
                source={{ uri: svc.photo }}
                style={styles.photo}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(26,20,8,0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.photoGradient}
              />
              <View style={styles.badgesRow}>
                <View style={styles.badgeCat}>
                  <Text style={styles.badgeCatText}>{svcCat(svc.cat)}</Text>
                </View>
                {svc.popular && (
                  <View style={styles.badgePopular}>
                    <Text style={styles.badgePopularText}>{t('common.popular')}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Text zone ── */}
            <View style={styles.cardContent}>
              <Text style={styles.serviceName} numberOfLines={2}>{svcName(svc.id)}</Text>
              <Text style={styles.serviceDesc} numberOfLines={2}>{svcShort(svc.id)}</Text>
              <View style={styles.sep} />
              <View style={styles.metaRow}>
                <View style={styles.durationRow}>
                  <Feather name="clock" size={13} color="#6B6560" />
                  <Text style={styles.duration}>{svc.dur}</Text>
                </View>
                <Text style={styles.price}>{svc.price} €</Text>
              </View>
              <TouchableOpacity
                style={styles.selectBtn}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(tabs)/book', params: { serviceId: svc.id } })}
              >
                <Text style={styles.selectBtnText}>{t('common.select')}  →</Text>
              </TouchableOpacity>
            </View>

          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={mobileSnapInterval}
        snapToAlignment="start"
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={styles.slidesRow}
        style={Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : undefined}
      >
        {services.map((svc) => (
          <View key={svc.id} style={[styles.slide, { width: mobileSlideW }]}>

            {/* ── Photo zone ── */}
            <View style={styles.photoZone}>
              <Image
                source={{ uri: svc.photo }}
                style={styles.photo}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(26,20,8,0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.photoGradient}
              />
              <View style={styles.badgesRow}>
                <View style={styles.badgeCat}>
                  <Text style={styles.badgeCatText}>{svcCat(svc.cat)}</Text>
                </View>
                {svc.popular && (
                  <View style={styles.badgePopular}>
                    <Text style={styles.badgePopularText}>{t('common.popular')}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Text zone ── */}
            <View style={styles.cardContent}>
              <Text style={styles.serviceName} numberOfLines={2}>{svcName(svc.id)}</Text>
              <Text style={styles.serviceDesc} numberOfLines={2}>{svcShort(svc.id)}</Text>
              <View style={styles.sep} />
              <View style={styles.metaRow}>
                <View style={styles.durationRow}>
                  <Feather name="clock" size={13} color="#6B6560" />
                  <Text style={styles.duration}>{svc.dur}</Text>
                </View>
                <Text style={styles.price}>{svc.price} €</Text>
              </View>
              <TouchableOpacity
                style={styles.selectBtn}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(tabs)/book', params: { serviceId: svc.id } })}
              >
                <Text style={styles.selectBtnText}>{t('common.select')}  →</Text>
              </TouchableOpacity>

              {/* ── Dots + pause/play ── */}
              <View style={styles.playerRow}>
                {SERVICES.map((_, i) =>
                  i === currentSlide ? (
                    <View
                      key={i}
                      style={styles.progressPill}
                      onLayout={e => { trackWidth.value = e.nativeEvent.layout.width; }}
                    >
                      <Animated.View style={[styles.progressFill, progressFillStyle]} />
                    </View>
                  ) : (
                    <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={10}>
                      <View style={styles.dot} />
                    </Pressable>
                  )
                )}
                <TouchableOpacity onPress={handlePausePlay} hitSlop={12} style={styles.pauseBtn}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 3, lineHeight: 16 }}>
                    {isPaused ? '▶' : '‖'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingLeft: PADDING_H },
  slidesRow: {
    flexDirection: 'row',
    gap: GAP,
    paddingRight: PADDING_H,
  },
  slide: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
    height: 80,
  },
  badgesRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  badgeCat: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeCatText: {
    fontFamily: Fonts.semiBold,
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  badgePopular: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePopularText: {
    fontFamily: Fonts.semiBold,
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },

  // Text zone
  cardContent: {
    backgroundColor: '#1A1814',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  serviceName: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 13,
    color: '#6B6560',
    lineHeight: 18,
    marginBottom: 12,
  },
  sep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 11,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  duration: {
    fontSize: 13,
    color: '#6B6560',
  },
  price: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: '#C9A84C',
  },
  selectBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  selectBtnText: {
    fontFamily: Fonts.semiBold,
    color: '#1a1208',
    fontSize: 15,
    fontWeight: '600',
  },

  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressPill: {
    width: 54,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C9A84C',
  },
  pauseBtn: {},
});

const tabletStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING_H,
  },
  card: {
    width: '48%',
    backgroundColor: '#1A1814',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});
