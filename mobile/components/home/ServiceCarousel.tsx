import React, { useCallback, useEffect } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useState } from 'react';

const { width: SCREEN_W } = Dimensions.get('window');
const PADDING_H = 22;
const PEEK = 20;
const GAP = 12;
const SLIDE_W = SCREEN_W - PADDING_H * 2 - PEEK;
const IMAGE_H = 205;
const SLIDE_DURATION = 10000;
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// Per-service dark elegant gradients (top-right → bottom-left diagonal)
const GRADIENTS: readonly [string, string, string][] = [
  ['#2A1A08', '#1A1008', '#0D0804'],  // signature — warm espresso
  ['#10080E', '#1A1028', '#08060E'],  // barbe — deep plum
  ['#221808', '#1A1208', '#0D0A04'],  // rituel — dark amber
  ['#0E0E0E', '#181818', '#0A0A0A'],  // express — carbon
  ['#061410', '#0D2018', '#040E0A'],  // camouflage — dark forest
  ['#080C16', '#101422', '#040608'],  // soin — midnight blue
];

export const SERVICES = [
  { id: 'signature', apiId: 1, cat: 'COUPE HOMME', name: 'Signature WilloBarber',    short: 'Diagnostic, shampooing, coupe ciseaux & finition rasoir.',        dur: '45 min', price: 45, popular: true  },
  { id: 'barbe',     apiId: 2, cat: 'BARBE',       name: 'Taille & rasage à l\'ancienne', short: 'Serviette chaude, huile pré-rasage, rasoir droit.',              dur: '30 min', price: 28, popular: false },
  { id: 'rituel',    apiId: 3, cat: 'PACKAGE',     name: 'Le Rituel',                short: 'Coupe signature + barbe + soin du visage.',                        dur: '1h15',   price: 75, popular: true  },
  { id: 'express',   apiId: 4, cat: 'COUPE HOMME', name: 'Coupe express',            short: 'Pour les habitués pressés. Le savoir-faire, version concentrée.',  dur: '25 min', price: 28, popular: false },
  { id: 'camouflage',apiId: 5, cat: 'COLORATION',  name: 'Camouflage gris',          short: 'Pigmentation sur-mesure, sans ammoniaque.',                        dur: '40 min', price: 35, popular: false },
  { id: 'soin',      apiId: 6, cat: 'SOIN',        name: 'Soin du visage',           short: 'Gommage, masque à l\'argile, modelage.',                           dur: '30 min', price: 32, popular: false },
] as const;

export type ServiceId = (typeof SERVICES)[number]['id'];

export function ServiceCarousel() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const progress = useSharedValue(0);
  const slideX = useSharedValue(0);
  const trackWidth = useSharedValue(SLIDE_W);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    slideX.value = withTiming(-index * (SLIDE_W + GAP), { duration: 300 });
  }, [slideX]);

  const handleAutoAdvance = useCallback(() => {
    setCurrentSlide(prev => {
      const next = (prev + 1) % SERVICES.length;
      slideX.value = withTiming(-next * (SLIDE_W + GAP), { duration: 300 });
      return next;
    });
  }, [slideX]);

  useEffect(() => {
    if (isPaused) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: SLIDE_DURATION }, finished => {
      if (finished) runOnJS(handleAutoAdvance)();
    });
    return () => cancelAnimation(progress);
  }, [currentSlide, isPaused, progress, handleAutoAdvance]);

  const handlePausePlay = useCallback(() => {
    if (isPaused) {
      const remaining = (1 - progress.value) * SLIDE_DURATION;
      progress.value = withTiming(1, { duration: remaining }, finished => {
        if (finished) runOnJS(handleAutoAdvance)();
      });
      setIsPaused(false);
    } else {
      cancelAnimation(progress);
      setIsPaused(true);
    }
  }, [isPaused, progress, handleAutoAdvance]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidth.value,
  }));
  const slidesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.viewport}>
        <Animated.View style={[styles.slidesRow, slidesStyle]}>
          {SERVICES.map((svc, idx) => (
            <View key={svc.id} style={styles.slide}>

              {/* ── Dark gradient image area ── */}
              <View style={styles.imagePlaceholder}>
                {/* Base per-service gradient */}
                <LinearGradient
                  colors={GRADIENTS[idx]}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Bottom text scrim for readability */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  start={{ x: 0, y: 0.2 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                {/* Category & popular badges */}
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

                {/* Service name overlay */}
                <View style={styles.imageNameWrap}>
                  <View style={styles.imageGoldLine} />
                  <Text style={styles.imageName} numberOfLines={2}>{svc.name}</Text>
                </View>
              </View>

              {/* ── Cream content area ── */}
              <View style={styles.cardContent}>
                <Text style={styles.serviceDesc}>{svc.short}</Text>
                <View style={styles.goldSep} />
                <View style={styles.metaRow}>
                  <Text style={styles.duration}>⏱ {svc.dur}</Text>
                  <Text style={styles.price}>{svc.price} €</Text>
                </View>
                <TouchableOpacity
                  style={styles.selectBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    router.push({ pathname: '/(tabs)/book', params: { serviceId: svc.id } });
                  }}
                >
                  <Text style={styles.selectBtnText}>Sélectionner  →</Text>
                </TouchableOpacity>

                {/* Progress dots + pause */}
                <View style={styles.playerRow}>
                  {SERVICES.map((_, i) => {
                    if (i === currentSlide) {
                      return (
                        <View
                          key={i}
                          style={styles.progressPill}
                          onLayout={e => { trackWidth.value = e.nativeEvent.layout.width; }}
                        >
                          <Animated.View style={[styles.progressFill, progressFillStyle]} />
                        </View>
                      );
                    }
                    return (
                      <Pressable key={i} onPress={() => { setIsPaused(false); goToSlide(i); }} hitSlop={10}>
                        <View style={styles.dot} />
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={handlePausePlay} hitSlop={10} style={styles.pauseBtn}>
                    <Text style={styles.pauseIcon}>{isPaused ? '▶' : '⏸'}</Text>
                  </Pressable>
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
  badgesRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  badgeCat: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeCatText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  badgePopular: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgePopularText: {
    color: '#C9A84C',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imageNameWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  imageGoldLine: {
    width: 32,
    height: 1.5,
    backgroundColor: '#C9A84C',
    marginBottom: 8,
  },
  imageName: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 27,
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
    fontSize: 13,
    color: '#6B6560',
    lineHeight: 19,
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
  duration: {
    fontSize: 13,
    color: '#8B6914',
    fontWeight: '500',
  },
  price: {
    fontFamily: SERIF,
    fontSize: 23,
    fontWeight: '700',
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
    color: '#1A1208',
    fontWeight: '700',
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
  pauseBtn: {
    marginLeft: 4,
    padding: 4,
  },
  pauseIcon: {
    fontSize: 11,
    color: '#a89f93',
  },
});
