import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants';

type BadgeVariant = 'gold' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  gold: { bg: Colors.goldSubtle, text: Colors.gold, border: 'rgba(201,168,76,0.3)' },
  success: { bg: Colors.successSubtle, text: Colors.success, border: 'rgba(76,175,80,0.3)' },
  error: { bg: Colors.errorSubtle, text: Colors.error, border: 'rgba(239,83,80,0.3)' },
  warning: { bg: Colors.warningSubtle, text: Colors.warning, border: 'rgba(255,152,0,0.3)' },
  info: { bg: Colors.infoSubtle, text: Colors.info, border: 'rgba(33,150,243,0.3)' },
  neutral: { bg: Colors.surfaceElevated, text: Colors.textSecondary, border: Colors.surfaceBorder },
};

export function Badge({ label, variant = 'gold', size = 'sm' }: BadgeProps) {
  const { bg, text, border } = variantStyles[variant];

  return (
    <View
      style={[
        styles.base,
        size === 'md' ? styles.sizeMd : styles.sizeSm,
        { backgroundColor: bg, borderColor: border },
      ]}
    >
      <Text style={[styles.label, size === 'md' ? styles.labelMd : styles.labelSm, { color: text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sizeSm: { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  sizeMd: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  label: { fontWeight: FontWeight.semiBold, letterSpacing: 0.2 },
  labelSm: { fontSize: FontSize.xs },
  labelMd: { fontSize: FontSize.sm },
});
