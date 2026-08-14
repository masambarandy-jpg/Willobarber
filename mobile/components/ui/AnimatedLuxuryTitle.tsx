import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextStyle, View, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { useLanguage } from '@/contexts/LanguageContext';

const ENTRANCE_EASING = Easing.bezier(0.19, 1, 0.22, 1);
const ENTRANCE_DURATION = 1400;
const ENTRANCE_TRANSLATE_Y_RATIO = 1.1; // le texte part entierement sous le masque

const STAGGER_DELAYS = {
  line1: 0,
  line2: 350,
  line3: 700,
  line4: 1050,
} as const;

const UNDERLINE_REVEAL_DURATION = 350;
const UNDERLINE_REVEAL_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const UNDERLINE_PEAK_OPACITY = 0.6;
const UNDERLINE_FADE_DURATION = 250;
const UNDERLINE_FADE_EASING = Easing.in(Easing.ease);
const UNDERLINE_GRADIENT_COLORS = ['transparent', '#C9A84C', '#F6E7B8', '#C9A84C', 'transparent'] as const;

const SWEEP_GRADIENT_COLORS = ['#C9A059', '#F6E7B8', '#FFF7DF', '#F6E7B8', '#C9A059'] as const;
const SWEEP_DURATION = 1400;
const SWEEP_FADE_OUT_DURATION = 300;
const SWEEP_LOOP_INTERVAL = 8000; // cycle complet (balayage + fondu + pause)
const SWEEP_TRANSLATE_RATIO = 1.5; // +150% -> -150%

function useResponsiveSizes() {
  const { width } = useWindowDimensions();

  if (width >= 768) {
    // Tablette / iPad
    return { fontSize: 58, lineHeight: 66, letterSpacing: 0.4, gap: 6 };
  }

  if (width < 360) {
    // Petits GSM
    return { fontSize: 42, lineHeight: 50, letterSpacing: 0.15, gap: 2 };
  }

  // GSM standard / Web
  return { fontSize: 48, lineHeight: 56, letterSpacing: 0.25, gap: 3 };
}

function useLineEntrance(delay: number, lineHeight: number) {
  const translateY = useRef(new Animated.Value(lineHeight * ENTRANCE_TRANSLATE_Y_RATIO)).current;
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

function useUnderlineReveal(delay: number) {
  const scaleX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(UNDERLINE_PEAK_OPACITY)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(scaleX, {
        toValue: 1,
        duration: UNDERLINE_REVEAL_DURATION,
        delay,
        easing: UNDERLINE_REVEAL_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: UNDERLINE_FADE_DURATION,
        easing: UNDERLINE_FADE_EASING,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity,
    transform: [{ scaleX }],
  };
}

function GoldSweepText({
  text,
  style,
  delay,
  lineHeight,
}: {
  text: string;
  style: TextStyle;
  delay: number;
  lineHeight: number;
}) {
  const [width, setWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!width) {
      return;
    }

    const animation = Animated.sequence([
      Animated.delay(delay + ENTRANCE_DURATION),
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 1,
            duration: SWEEP_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: SWEEP_FADE_OUT_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(SWEEP_LOOP_INTERVAL - SWEEP_DURATION - SWEEP_FADE_OUT_DURATION),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ),
    ]);

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const translateXValue = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [width * SWEEP_TRANSLATE_RATIO, width * -SWEEP_TRANSLATE_RATIO],
  });

  return (
    <View>
      <Text
        style={style}
        onLayout={(event) => {
          const measured = event.nativeEvent.layout.width;
          setWidth((current) => (current !== measured ? measured : current));
        }}
      >
        {text}
      </Text>
      {width > 0 && (
        <MaskedView
          style={[StyleSheet.absoluteFillObject, { width, height: lineHeight }]}
          maskElement={<Text style={style}>{text}</Text>}
        >
          <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: translateXValue }] }}>
            <LinearGradient
              colors={SWEEP_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: width * 2.5, height: lineHeight }}
            />
          </Animated.View>
        </MaskedView>
      )}
    </View>
  );
}

export default function AnimatedLuxuryTitle() {
  const { t } = useLanguage();
  const { fontSize, lineHeight, letterSpacing, gap } = useResponsiveSizes();

  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
  });

  const line1Entrance = useLineEntrance(STAGGER_DELAYS.line1, lineHeight);
  const line2Entrance = useLineEntrance(STAGGER_DELAYS.line2, lineHeight);
  const line3Entrance = useLineEntrance(STAGGER_DELAYS.line3, lineHeight);
  const line4Entrance = useLineEntrance(STAGGER_DELAYS.line4, lineHeight);

  const line1Underline = useUnderlineReveal(STAGGER_DELAYS.line1);
  const line2Underline = useUnderlineReveal(STAGGER_DELAYS.line2);
  const line3Underline = useUnderlineReveal(STAGGER_DELAYS.line3);
  const line4Underline = useUnderlineReveal(STAGGER_DELAYS.line4);

  if (!fontsLoaded) {
    return <View style={[styles.container, { height: (lineHeight + 8) * 4 + gap * 3 }]} />;
  }

  const plainTextStyle: TextStyle = {
    fontSize,
    lineHeight,
    letterSpacing,
    color: '#F5F5F0',
    fontFamily: 'CormorantGaramond_600SemiBold',
  };

  const goldTextStyle: TextStyle = {
    fontSize,
    lineHeight,
    letterSpacing,
    color: SWEEP_GRADIENT_COLORS[0],
    fontFamily: 'CormorantGaramond_600SemiBold_Italic',
  };

  return (
    <View style={styles.container}>
      <View style={{ marginBottom: gap }}>
        <View style={[styles.mask, { height: lineHeight + 8 }]}>
          <Animated.Text style={[plainTextStyle, line1Entrance]}>{t('home.hero.line1')}</Animated.Text>
        </View>
        <Animated.View style={[styles.underline, line1Underline]}>
          <LinearGradient
            colors={UNDERLINE_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
      <View style={{ marginBottom: gap }}>
        <View style={[styles.mask, { height: lineHeight + 8 }]}>
          <Animated.View style={line2Entrance}>
            <GoldSweepText
              text={t('home.hero.line2')}
              style={goldTextStyle}
              delay={STAGGER_DELAYS.line4}
              lineHeight={lineHeight}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.underline, line2Underline]}>
          <LinearGradient
            colors={UNDERLINE_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
      <View style={{ marginBottom: gap }}>
        <View style={[styles.mask, { height: lineHeight + 8 }]}>
          <Animated.Text style={[plainTextStyle, line3Entrance]}>{t('home.hero.line3')}</Animated.Text>
        </View>
        <Animated.View style={[styles.underline, line3Underline]}>
          <LinearGradient
            colors={UNDERLINE_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
      <View>
        <View style={[styles.mask, { height: lineHeight + 8 }]}>
          <Animated.View style={line4Entrance}>
            <GoldSweepText
              text={t('home.hero.line4')}
              style={goldTextStyle}
              delay={STAGGER_DELAYS.line4}
              lineHeight={lineHeight}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.underline, line4Underline]}>
          <LinearGradient
            colors={UNDERLINE_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
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
    backgroundColor: 'transparent',
    paddingTop: 4,
    paddingBottom: 4,
  },
  underline: {
    height: 1.5,
    overflow: 'hidden',
    transformOrigin: 'left',
  },
});

/* Exemple d'import :
import AnimatedLuxuryTitle from '@/components/ui/AnimatedLuxuryTitle';
<AnimatedLuxuryTitle />
*/
