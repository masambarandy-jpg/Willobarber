import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants';
import type { TimeSlot } from '@/types';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selected: string | null;
  onSelect: (slot: TimeSlot) => void;
}

export function TimeSlotPicker({ slots, selected, onSelect }: TimeSlotPickerProps) {
  const available = slots.filter((s) => s.is_available);

  if (available.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🚫</Text>
        <Text style={styles.emptyText}>Aucun créneau disponible pour cette date</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={available}
      keyExtractor={(item) => item.start_time}
      numColumns={3}
      scrollEnabled={false}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => {
        const isSelected = selected === item.start_time;
        return (
          <Pressable
            style={[styles.slot, isSelected && styles.slotSelected]}
            onPress={() => onSelect(item)}
          >
            <Text style={[styles.slotTime, isSelected && styles.slotTimeSelected]}>
              {item.start_time.substring(0, 5)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.sm },
  slot: {
    flex: 1,
    margin: 4,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    minWidth: 90,
  },
  slotSelected: {
    backgroundColor: Colors.goldSubtle,
    borderColor: Colors.gold,
  },
  slotTime: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  slotTimeSelected: { color: Colors.gold },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },
});
