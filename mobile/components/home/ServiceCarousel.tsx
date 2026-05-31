import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants';

interface Service {
  id: string;
  icon: string;
  tag: string;
  title: string;
  description: string;
  price: string;
}

const SERVICES: Service[] = [
  {
    id: '1',
    icon: '✂️',
    tag: 'POPULAIRE',
    title: 'Coupe Homme',
    description: 'Dégradé, taper fade ou coupe classique. Un look soigné taillé à votre style.',
    price: 'Dès 20€',
  },
  {
    id: '2',
    icon: '🪒',
    tag: 'SIGNATURE',
    title: 'Taille de Barbe',
    description: 'Barbe sculptée au rasoir traditionnel, contours nets et finitions parfaites.',
    price: 'Dès 15€',
  },
  {
    id: '3',
    icon: '💈',
    tag: 'BEST VALUE',
    title: 'Package Complet',
    description: 'Coupe + barbe pour un résultat impeccable. La formule complète WilloBarber.',
    price: 'Dès 30€',
  },
  {
    id: '4',
    icon: '🎨',
    tag: 'TENDANCE',
    title: 'Coloration',
    description: 'Mèches, dégradé de couleur ou teinte complète. Exprimez votre personnalité.',
    price: 'Sur devis',
  },
  {
    id: '5',
    icon: '👶',
    tag: 'FAMILLE',
    title: 'Coupe Enfant',
    description: 'Douceur et précision pour les plus jeunes. Un moment agréable pour toute la famille.',
    price: 'Dès 12€',
  },
];

export function ServiceCarousel() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 2 * Spacing.xl;
  const [currentSlide, setCurrentSlide] = useState(0);

  const progress = useSharedValue(0);
  const slideX = useSharedValue(0);
  const trackWidthSV = useSharedValue(cardWidth);

  const handleAutoAdvance = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SERVICES.length);
  }, []);

  // La barre de progression se remplit en 4 secondes
  // puis le slide change automatiquement
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 4000 }, (finished) => {
      if (finished) runOnJS(handleAutoAdvance)();
    });
    return () => {
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide]);

  // Slide transition
  useEffect(() => {
    slideX.value = withTiming(-currentSlide * cardWidth, { duration: 320 });
  }, [currentSlide, cardWidth, slideX]);

  const handleDotPress = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidthSV.value,
  }));

  const slidesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  return (
    <View style={styles.wrapper}>
      {/* Slides viewport */}
      <View style={[styles.viewport, { width: cardWidth }]}>
        <Animated.View
          style={[styles.slidesRow, { width: cardWidth * SERVICES.length }, slidesStyle]}
        >
          {SERVICES.map((service) => (
            <Pressable
              key={service.id}
              style={({ pressed }) => [styles.slide, { width: cardWidth }, pressed && styles.slidePressed]}
              onPress={() => router.push('/(tabs)/book')}
            >
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{service.tag}</Text>
                </View>
              </View>
              <Text style={styles.slideIcon}>{service.icon}</Text>
              <Text style={styles.slideTitle}>{service.title}</Text>
              <Text style={styles.slideDesc}>{service.description}</Text>
              <View style={styles.slideFooter}>
                <View style={styles.priceBadge}>
                  <Text style={styles.priceText}>{service.price}</Text>
                </View>
                <Text style={styles.ctaText}>Réserver →</Text>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </View>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {SERVICES.map((_, i) => (
          <Pressable key={i} onPress={() => handleDotPress(i)} hitSlop={8}>
            <View style={[styles.dot, i === currentSlide && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* Progress bar — au changement de slide, repart de zéro */}
      <View
        style={styles.progressTrack}
        onLayout={(e) => {
          trackWidthSV.value = e.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.md,
  },
  viewport: {
    overflow: 'hidden',
    borderRadius: BorderRadius.xl,
  },
  slidesRow: {
    flexDirection: 'row',
  },
  slide: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    minHeight: 220,
  },
  slidePressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  tagRow: {
    flexDirection: 'row',
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.goldSubtle,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  tagText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.gold,
    letterSpacing: 1.5,
  },
  slideIcon: {
    fontSize: 44,
    textAlign: 'center',
  },
  slideTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  slideDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    flex: 1,
  },
  slideFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  priceBadge: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  priceText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  ctaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.gold,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceBorder,
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
});
