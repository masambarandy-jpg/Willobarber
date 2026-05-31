import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight } from '@/constants';

interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
  fontSize?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function Avatar({ name, size = 44, color = Colors.gold, fontSize }: AvatarProps) {
  const initials = getInitials(name);
  const textSize = fontSize ?? size * 0.38;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}20`,
          borderColor: `${color}40`,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: textSize, color }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  initials: {
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
