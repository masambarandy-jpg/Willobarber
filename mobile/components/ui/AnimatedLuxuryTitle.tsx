import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TextStyle, View, useWindowDimensions } from 'react-native';
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

// Reflet doré : même dégradé que la classe CSS .gold-sweep (web). L'or des bords
// est la couleur du texte, si bien que le dégradé est invisible hors du reflet.
const GOLD = '#C9A84C';
const SWEEP_GRADIENT_COLORS = [GOLD, '#F6E7B8', '#FFF7DF', '#F6E7B8', GOLD] as const;
const SWEEP_GRADIENT_LOCATIONS = [0.34, 0.47, 0.5, 0.53, 0.66] as const;
const SWEEP_SIZE_RATIO = 2.8; // background-size: 280%
// background-position 120% -> -40% : décalage = position × (largeur texte − largeur dégradé).
const SWEEP_FROM_X_RATIO = 1.2 * (1 - SWEEP_SIZE_RATIO);
const SWEEP_TO_X_RATIO = -0.4 * (1 - SWEEP_SIZE_RATIO);
const SWEEP_DURATION = 1400;
const SWEEP_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const SWEEP_LOOP_INTERVAL = 8000;
// Premier reflet une fois les 4 lignes entrées, puis « détail. » juste après « coupe, ».
const SWEEP_START_DELAY = STAGGER_DELAYS.line4 + ENTRANCE_DURATION;
const SWEEP_SECOND_LINE_OFFSET = 220;

// Web : MaskedView n'y applique pas de masque (il rend le dégradé puis le texte
// plein par-dessus, cf. MaskedView.web.js) — le reflet passe donc par du CSS
// background-clip: text. Délais = ceux du natif (SWEEP_START_DELAY, +220ms).
const GOLD_SWEEP_CSS = `
.gold-sweep {
  font-style: italic;
  background-image: linear-gradient(100deg, #C9A84C 34%, #F6E7B8 47%, #FFF7DF 50%, #F6E7B8 53%, #C9A84C 66%);
  background-size: 280% 100%;
  background-position: 120% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmerLoop ${SWEEP_LOOP_INTERVAL}ms cubic-bezier(.4,0,.2,1) ${SWEEP_START_DELAY}ms infinite both;
}
.gold-sweep.second { animation-delay: ${SWEEP_START_DELAY + SWEEP_SECOND_LINE_OFFSET}ms; }
@keyframes shimmerLoop {
  0% { background-position: 120% 0 }
  ${(SWEEP_DURATION / SWEEP_LOOP_INTERVAL) * 100}%, 100% { background-position: -40% 0 }
}
`;

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('gold-sweep-css')) {
  const tag = document.createElement('style');
  tag.id = 'gold-sweep-css';
  tag.textContent = GOLD_SWEEP_CSS;
  document.head.appendChild(tag);
}

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
  second = false,
}: {
  text: string;
  style: TextStyle;
  delay: number;
  lineHeight: number;
  second?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web' || !width) {
      return;
    }

    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: SWEEP_DURATION,
            easing: SWEEP_EASING,
            useNativeDriver: true,
          }),
          Animated.delay(SWEEP_LOOP_INTERVAL - SWEEP_DURATION),
          // Retour invisible : en fin de balayage, seul l'or du bord couvre le texte.
          Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ]);

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  if (Platform.OS === 'web') {
    return (
      <span
        className={second ? 'gold-sweep second' : 'gold-sweep'}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: `${style.lineHeight}px`,
          letterSpacing: style.letterSpacing,
          // La police est déjà la coupe italique : sans ça, font-style: italic
          // (.gold-sweep) ajouterait une fausse inclinaison par-dessus.
          fontSynthesis: 'none',
        }}
      >
        {text}
      </span>
    );
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [width * SWEEP_FROM_X_RATIO, width * SWEEP_TO_X_RATIO],
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
          style={[StyleSheet.absoluteFill, { width, height: lineHeight }]}
          maskElement={<Text style={style}>{text}</Text>}
        >
          <Animated.View style={{ width: width * SWEEP_SIZE_RATIO, height: lineHeight, transform: [{ translateX }] }}>
            <LinearGradient
              colors={SWEEP_GRADIENT_COLORS}
              locations={SWEEP_GRADIENT_LOCATIONS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
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
    color: GOLD,
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
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={{ marginBottom: gap }}>
        <View style={[styles.mask, { height: lineHeight + 8 }]}>
          <Animated.View style={line2Entrance}>
            <GoldSweepText
              text={t('home.hero.line2')}
              style={goldTextStyle}
              delay={SWEEP_START_DELAY}
              lineHeight={lineHeight}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.underline, line2Underline]}>
          <LinearGradient
            colors={UNDERLINE_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
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
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View>
        <View style={[styles.mask, { height: lineHeight + 8 }]}>
          <Animated.View style={line4Entrance}>
            <GoldSweepText
              text={t('home.hero.line4')}
              style={goldTextStyle}
              delay={SWEEP_START_DELAY + SWEEP_SECOND_LINE_OFFSET}
              second
              lineHeight={lineHeight}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.underline, line4Underline]}>
          <LinearGradient
            colors={UNDERLINE_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
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
