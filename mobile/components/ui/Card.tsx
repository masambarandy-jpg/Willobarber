import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow } from '@/constants';

interface CardProps extends ViewProps {
  elevated?: boolean;
  padded?: boolean;
}

export function Card({ children, style, elevated = false, padded = true, ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  elevated: {
    ...Shadow.md,
    borderWidth: 0,
  },
  padded: {
    padding: Spacing.base,
  },
});
