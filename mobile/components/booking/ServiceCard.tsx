import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants';
import { Badge } from '@/components/ui/Badge';
import { SERVICE_CATEGORIES } from '@/constants';
import type { Service } from '@/types';

interface ServiceCardProps {
  service: Service;
  selected?: boolean;
  onSelect: (service: Service) => void;
}

const categoryIcons: Record<string, string> = {
  coupe_homme: '✂️',
  barbe: '🪒',
  package: '💫',
  coloration: '🎨',
  soin: '✨',
  enfant: '👦',
};

export function ServiceCard({ service, selected = false, onSelect }: ServiceCardProps) {
  const icon = categoryIcons[service.category] ?? '💈';
  const categoryLabel = SERVICE_CATEGORIES[service.category] ?? service.category;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
      onPress={() => onSelect(service)}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{service.name}</Text>
          {service.is_popular && <Badge label="Populaire" variant="gold" />}
        </View>
        <Text style={styles.category}>{categoryLabel}</Text>
        <Text style={styles.description} numberOfLines={2}>{service.description}</Text>
      </View>

      <View style={styles.priceBlock}>
        <Text style={styles.price}>{parseFloat(service.price).toFixed(0)}€</Text>
        <Text style={styles.duration}>{service.duration} min</Text>
      </View>

      {selected && (
        <View style={styles.selectedBorder} />
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
    overflow: 'hidden',
  },
  selected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSubtle,
  },
  pressed: { opacity: 0.85 },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  category: {
    fontSize: FontSize.xs,
    color: Colors.gold,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  priceBlock: { alignItems: 'flex-end' },
  price: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.gold,
  },
  duration: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  selectedBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.gold,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
});
