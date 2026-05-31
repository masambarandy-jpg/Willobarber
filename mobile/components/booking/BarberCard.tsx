import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants';
import { Avatar } from '@/components/ui/Avatar';
import { StarRating } from '@/components/ui/StarRating';
import type { Barber } from '@/types';

interface BarberCardProps {
  barber: Barber;
  selected?: boolean;
  onSelect: (barber: Barber) => void;
}

export function BarberCard({ barber, selected = false, onSelect }: BarberCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
      onPress={() => onSelect(barber)}
    >
      <Avatar name={barber.full_name} size={52} color={barber.color} />

      <View style={styles.info}>
        <Text style={styles.name}>{barber.full_name}</Text>
        <Text style={styles.title}>{barber.title}</Text>
        {barber.avg_rating !== null && (
          <View style={styles.ratingRow}>
            <StarRating rating={barber.avg_rating} size={12} />
            <Text style={styles.ratingText}>
              {barber.avg_rating.toFixed(1)} ({barber.review_count})
            </Text>
          </View>
        )}
      </View>

      {selected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  selected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSubtle,
  },
  pressed: { opacity: 0.85 },
  info: { flex: 1 },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  ratingText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  checkmark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 14,
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },
});
