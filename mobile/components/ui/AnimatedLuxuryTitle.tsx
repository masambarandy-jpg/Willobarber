import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const ENTRANCE_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const ENTRANCE_DURATION = 700;

const STAGGER_DELAYS = {
  line1Plain: 0,
  line1Gold: 150,
  line2Plain: 350,
  line2Gold: 500,
} as const;

const GLOW_MIN_OPACITY = 0.75;
const GLOW_DURATION = 1800; // demi-cycle -> cycle complet ~3.6s

const SERIF_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

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

function useSegmentAnimation(delay: number, withGlow: boolean) {
  const translateY = useSharedValue(18);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: ENTRANCE_DURATION, easing: ENTRANCE_EASING })
    );

    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: ENTRANCE_DURATION, easing: ENTRANCE_EASING }),
        withGlow
          ? withRepeat(
              withSequence(
                withTiming(GLOW_MIN_OPACITY, {
                  duration: GLOW_DURATION,
                  easing: Easing.inOut(Easing.sin),
                }),
                withTiming(1, {
                  duration: GLOW_DURATION,
                  easing: Easing.inOut(Easing.sin),
                })
              ),
              -1,
              false
            )
          : withTiming(1, { duration: 0 })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export default function AnimatedLuxuryTitle() {
  const { fontSize, lineHeight, letterSpacing, gap } = useResponsiveSizes();

  const line1PlainStyle = useSegmentAnimation(STAGGER_DELAYS.line1Plain, false);
  const line1GoldStyle = useSegmentAnimation(STAGGER_DELAYS.line1Gold, true);
  const line2PlainStyle = useSegmentAnimation(STAGGER_DELAYS.line2Plain, false);
  const line2GoldStyle = useSegmentAnimation(STAGGER_DELAYS.line2Gold, true);

  const plainTextStyle = {
    fontSize,
    lineHeight,
    letterSpacing,
    color: '#F5F5F0',
    fontFamily: SERIF_FONT,
  };

  const goldTextStyle = {
    fontSize,
    lineHeight,
    letterSpacing,
    color: '#D4AF37',
    fontFamily: SERIF_FONT,
    fontStyle: 'italic' as const,
  };

  return (
    <View style={styles.container}>
      <View style={[styles.row, { marginBottom: gap }]}>
        <Animated.Text style={[plainTextStyle, line1PlainStyle]}>
          L'art de la{' '}
        </Animated.Text>
        <Animated.Text style={[goldTextStyle, line1GoldStyle]}>coupe,</Animated.Text>
      </View>
      <View style={styles.row}>
        <Animated.Text style={[plainTextStyle, line2PlainStyle]}>
          l'esprit du{' '}
        </Animated.Text>
        <Animated.Text style={[goldTextStyle, line2GoldStyle]}>détail.</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

/* Exemple d'import :
import AnimatedLuxuryTitle from '@/components/ui/AnimatedLuxuryTitle';
<AnimatedLuxuryTitle />
*/
