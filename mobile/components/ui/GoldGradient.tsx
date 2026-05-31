import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants';

interface GoldGradientProps {
  children: React.ReactNode;
  style?: object;
  horizontal?: boolean;
}

export function GoldGradient({ children, style, horizontal = false }: GoldGradientProps) {
  return (
    <LinearGradient
      colors={[Colors.goldDark, Colors.gold, Colors.goldLight]}
      start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
      end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
