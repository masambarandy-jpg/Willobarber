import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  useFonts,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { useLanguage } from '@/contexts/LanguageContext';

const ENTRANCE_EASING = Easing.bezier(0.19, 1, 0.22, 1);
const ENTRANCE_DURATION = 700;
const ENTRANCE_TRANSLATE_Y = 40;

const STAGGER_DELAYS = {
  line1: 0,
  line2: 150,
  line3: 350,
  line4: 500,
} as const;

const GOLD_BASE = '#C9A84C';
const GOLD_PEAK = '#F6E7B8';
const SHIMMER_SWEEP_DURATION = 350;
const SHIMMER_LOOP_INTERVAL = 8000; // cycle complet (sweep aller-retour + pause)

function useResponsiveSizes() {
  const { width } = useWindowDimensions();

  if (width >= 768) {
    // Tablette / iPad
    return { fontSize: 34, lineHeight: 44, letterSpacing: 0.4, gap: 6 };
  }

  if (width < 360) {
    // Petits GSM
    return { fontSize: 21, lineHeight: 28, letterSpacing: 0.15, gap: 2 };
  }

  // GSM standard / Web
  return { fontSize: 25, lineHeight: 33, letterSpacing: 0.25, gap: 3 };
}

function useLineEntrance(delay: number) {
  const translateY = useRef(new Animated.Value(ENTRANCE_TRANSLATE_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTRANCE_DURATION,
        delay,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTRANCE_DURATION,
        delay,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity,
    transform: [{ translateY }],
  };
}

function useGoldShimmer(delay: number) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay + ENTRANCE_DURATION),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: SHIMMER_SWEEP_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: SHIMMER_SWEEP_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: SHIMMER_LOOP_INTERVAL - SHIMMER_SWEEP_DURATION * 2,
            useNativeDriver: false,
          }),
        ])
      ),
    ]);

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    color: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [GOLD_BASE, GOLD_PEAK],
    }),
  };
}

export default function AnimatedLuxuryTitle() {
  const { t } = useLanguage();
  const { fontSize, lineHeight, letterSpacing, gap } = useResponsiveSizes();

  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
  });

  const line1Entrance = useLineEntrance(STAGGER_DELAYS.line1);
  const line2Entrance = useLineEntrance(STAGGER_DELAYS.line2);
  const line3Entrance = useLineEntrance(STAGGER_DELAYS.line3);
  const line4Entrance = useLineEntrance(STAGGER_DELAYS.line4);

  const line2Shimmer = useGoldShimmer(STAGGER_DELAYS.line2);
  const line4Shimmer = useGoldShimmer(STAGGER_DELAYS.line4);

  if (!fontsLoaded) {
    return <View style={[styles.container, { height: lineHeight * 4 + gap * 3 }]} />;
  }

  const plainTextStyle = {
    fontSize,
    lineHeight,
    letterSpacing,
    color: '#F5F5F0',
    fontFamily: 'CormorantGaramond_600SemiBold',
  };

  const goldTextStyle = {
    fontSize,
    lineHeight,
    letterSpacing,
    fontFamily: 'CormorantGaramond_600SemiBold_Italic',
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mask, { height: lineHeight, marginBottom: gap }]}>
        <Animated.Text style={[plainTextStyle, line1Entrance]}>{t('home.hero.line1')}</Animated.Text>
      </View>
      <View style={[styles.mask, { height: lineHeight, marginBottom: gap }]}>
        <Animated.Text style={[goldTextStyle, line2Entrance, line2Shimmer]}>{t('home.hero.line2')}</Animated.Text>
      </View>
      <View style={[styles.mask, { height: lineHeight, marginBottom: gap }]}>
        <Animated.Text style={[plainTextStyle, line3Entrance]}>{t('home.hero.line3')}</Animated.Text>
      </View>
      <View style={[styles.mask, { height: lineHeight }]}>
        <Animated.Text style={[goldTextStyle, line4Entrance, line4Shimmer]}>{t('home.hero.line4')}</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  mask: {
    overflow: 'hidden',
  },
});

/* Exemple d'import :
import AnimatedLuxuryTitle from '@/components/ui/AnimatedLuxuryTitle';
<AnimatedLuxuryTitle />
*/
