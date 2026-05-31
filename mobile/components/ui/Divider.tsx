import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants';

interface DividerProps {
  vertical?: boolean;
  spacing?: number;
  color?: string;
}

export function Divider({ vertical = false, spacing = Spacing.base, color = Colors.surfaceBorder }: DividerProps) {
  if (vertical) {
    return <View style={[styles.vertical, { marginHorizontal: spacing, backgroundColor: color }]} />;
  }
  return <View style={[styles.horizontal, { marginVertical: spacing, backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  horizontal: { height: 1, width: '100%' },
  vertical: { width: 1, alignSelf: 'stretch' },
});
