import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({ rating, maxStars = 5, size = 16, interactive = false, onRate }: StarRatingProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <Pressable
            key={i}
            onPress={() => interactive && onRate?.(i + 1)}
            disabled={!interactive}
            style={styles.star}
          >
            <Text style={[{ fontSize: size }, filled ? styles.filled : styles.empty]}>
              ★
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { padding: 1 },
  filled: { color: Colors.gold },
  empty: { color: Colors.textMuted },
});
