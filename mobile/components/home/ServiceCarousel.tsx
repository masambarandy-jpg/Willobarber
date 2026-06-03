import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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

const { width: SCREEN_W } = Dimensions.get('window');
const PADDING_H = 22;
const PEEK = 20;
const GAP = 12;
const SLIDE_W = SCREEN_W - PADDING_H * 2 - PEEK;
const IMAGE_H = 205;
const SLIDE_DURATION = 10000;
const SWIPE_THRESHOLD = SLIDE_W * 0.25;

const GRADIENTS: readonly [string, string][] = [
  ['#2A1A08', '#1A1008'],
  ['#10080E', '#1A1028'],
  ['#221808', '#1A1208'],
  ['#0E0E0E', '#181818'],
  ['#061410', '#0D2018'],
  ['#080C16', '#101422'],
];

export const SERVICES = [
  { id: 'signature', apiId: 1, cat: 'COUPE HOMME', name: 'Signature WilloBarber',         short: 'Diagnostic, shampooing, coupe ciseaux & finition rasoir.',        dur: '45 min', price: 45, popular: true  },
  { id: 'barbe',     apiId: 2, cat: 'BARBE',       name: "Taille & rasage à l'ancienne",  short: 'Serviette chaude, huile pré-rasage, rasoir droit.',              dur: '30 min', price: 28, popular: false },
  { id: 'rituel',    apiId: 3, cat: 'PACKAGE',     name: 'Le Rituel',                     short: 'Coupe signature + barbe + soin du visage.',                     dur: '1h15',   price: 75, popular: true  },
  { id: 'express',   apiId: 4, cat: 'COUPE HOMME', name: 'Coupe express',                 short: 'Pour les habitués pressés. Le savoir-faire, version concentrée.', dur: '25 min', price: 28, popular: false },
  { id: 'camouflage',apiId: 5, cat: 'COLORATION',  name: 'Camouflage gris',               short: 'Pigmentation sur-mesure, sans ammoniaque.',                     dur: '40 min', price: 35, popular: false },
  { id: 'soin',      apiId: 6, cat: 'SOIN',        name: 'Soin du visage',                short: "Gommage, masque à l'argile, modelage.",                         dur: '30 min', price: 32, popular: false },
] as const;

export type ServiceId = (typeof SERVICES)[number]['id'];

export function ServiceCarousel() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentSlideRef = useRef(0);
  const isPausedRef = useRef(false);
  const swipeStartProgress = useRef(0);

  const progress = useSharedValue(0);
  const slideX = useSharedValue(0);
  const trackWidth = useSharedValue(SLIDE_W);

  const handleAutoAdvance = useCallback(() => {
    const next = (currentSlideRef.current + 1) % SERVICES.length;
    currentSlideRef.current = next;
    setCurrentSlide(next);
    slideX.value = withTiming(-next * (SLIDE_W + GAP), {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [slideX]);

  const goToSlide = useCallback((index: number) => {
    const i = Math.max(0, Math.min(index, SERVICES.length - 1));
    currentSlideRef.current = i;
    isPausedRef.current = false;
    setCurrentSlide(i);
    setIsPaused(false);
    slideX.value = withTiming(-i * (SLIDE_W + GAP), {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [slideX]);

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2,

      onPanResponderGrant: () => {
        swipeStartProgress.current = progress.value;
        cancelAnimation(progress);
        cancelAnimation(slideX);
      },

      onPanResponderMove: (_, { dx }) => {
        const base = -currentSlideRef.current * (SLIDE_W + GAP);
        slideX.value = base + dx;
      },

      onPanResponderRelease: (_, { dx, vx }) => {
        const curr = currentSlideRef.current;
        let next = curr;

        if ((dx < -SWIPE_THRESHOLD || vx < -0.5) && curr < SERVICES.length - 1) {
          next = curr + 1;
        } else if ((dx > SWIPE_THRESHOLD || vx > 0.5) && curr > 0) {
          next = curr - 1;
        }

        slideX.value = withTiming(-next * (SLIDE_W + GAP), {
          duration: 400,
          easing: Easing.inOut(Easing.ease),
        });

        if (next !== curr) {
          currentSlideRef.current = next;
          setCurrentSlide(next);
        } else if (!isPausedRef.current) {
          const remaining = (1 - swipeStartProgress.current) * SLIDE_DURATION;
          if (remaining > 200) {
            progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, finished => {
              if (finished) runOnJS(handleAutoAdvance)();
            });
          } else {
            runOnJS(handleAutoAdvance)();
          }
        }
      },

      onPanResponderTerminate: () => {
        slideX.value = withTiming(-currentSlideRef.current * (SLIDE_W + GAP), {
          duration: 300,
          easing: Easing.inOut(Easing.ease),
        });
        if (!isPausedRef.current) {
          const remaining = (1 - swipeStartProgress.current) * SLIDE_DURATION;
          if (remaining > 200) {
            progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, finished => {
              if (finished) runOnJS(handleAutoAdvance)();
            });
          }
        }
      },
    })
  ).current;

  const progressFillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidth.value,
  }));

  const slidesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.viewport} {...panResponder.panHandlers}>
        <Animated.View style={[styles.slidesRow, slidesStyle]}>
          {SERVICES.map((svc, idx) => (
            <View key={svc.id} style={styles.slide}>

              {/* ── Gradient image area — sombre en haut → crème en bas ── */}
              <View style={styles.imagePlaceholder}>
                <LinearGradient
                  colors={[GRADIENTS[idx][0], GRADIENTS[idx][1], '#F5F0E8']}
                  locations={[0, 0.42, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.imageBottom}>
                  <View style={styles.badgesRow}>
                    <View style={styles.badgeCat}>
                      <Text style={styles.badgeCatText}>{svc.cat}</Text>
                    </View>
                    {svc.popular && (
                      <View style={styles.badgePopular}>
                        <Text style={styles.badgePopularText}>POPULAIRE</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.imageNameWrap}>
                    <View style={styles.imageGoldLine} />
                    <Text style={styles.imageName} numberOfLines={2}>{svc.name}</Text>
                  </View>
                </View>
              </View>

              {/* ── Cream content area ── */}
              <View style={styles.cardContent}>
                <Text style={styles.serviceDesc}>{svc.short}</Text>
                <View style={styles.goldSep} />
                <View style={styles.metaRow}>
                  <View style={styles.durationRow}>
                    <Feather name="clock" size={14} color="#6B6560" />
                    <Text style={styles.duration}>{svc.dur}</Text>
                  </View>
                  <Text style={styles.price}>{svc.price} €</Text>
                </View>
                <TouchableOpacity
                  style={styles.selectBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(tabs)/book', params: { serviceId: svc.id } })}
                >
                  <Text style={styles.selectBtnText}>Sélectionner  →</Text>
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
                    <Text style={{ fontSize: 12, color: '#9B9490', fontWeight: '600', letterSpacing: 3, lineHeight: 16 }}>
                      {isPaused ? '▶' : '‖'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingLeft: PADDING_H },
  viewport: {
    width: SCREEN_W - PADDING_H,
    overflow: 'hidden',
  },
  slidesRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  slide: {
    width: SLIDE_W,
    backgroundColor: '#F5F0E8',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },

  // Image area
  imagePlaceholder: {
    height: IMAGE_H,
    justifyContent: 'flex-end',
  },
  imageBottom: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 9,
  },
  badgeCat: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeCatText: {
    fontFamily: Fonts.semiBold,
    color: '#fff',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  badgePopular: {
    backgroundColor: '#0D0A04',
    borderWidth: 1,
    borderColor: '#C9A84C',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgePopularText: {
    fontFamily: Fonts.semiBold,
    color: '#C9A84C',
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  imageNameWrap: {},
  imageGoldLine: {
    width: 32,
    height: 1.5,
    backgroundColor: '#C9A84C',
    marginBottom: 8,
  },
  imageName: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: '#1A1208',
    lineHeight: 32,
    letterSpacing: 0.2,
  },

  // Content area
  cardContent: {
    backgroundColor: '#F5F0E8',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  serviceDesc: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: '#6B6560',
    lineHeight: 21,
    marginBottom: 13,
  },
  goldSep: {
    height: 1,
    backgroundColor: '#C9A84C',
    opacity: 0.4,
    marginBottom: 11,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  duration: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#8B6914',
  },
  price: {
    fontFamily: Fonts.semiBold,
    fontSize: 23,
    color: '#8B6914',
  },
  selectBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  selectBtnText: {
    fontFamily: Fonts.bold,
    color: '#1A1208',
    fontSize: 14.5,
    letterSpacing: 0.3,
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
    backgroundColor: '#D4CFC9',
  },
  progressPill: {
    width: 54,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D4CFC9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C9A84C',
  },
  pauseBtn: {},
});
