import { View, Text, Image, StyleSheet } from 'react-native';
import { AVATAR_COLORS, AvatarKey, SERIF } from './theme';

type Props = {
  letter: string;
  size?: number;
  photoUri?: string;
};

const FALLBACK_PALETTE = Object.values(AVATAR_COLORS);

function colorFor(letter: string) {
  const key = (letter || '').charAt(0).toUpperCase();
  const known = AVATAR_COLORS[key as AvatarKey];
  if (known) return known;
  if (!key) return AVATAR_COLORS.W;
  const idx = key.charCodeAt(0) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx] ?? AVATAR_COLORS.W;
}

export default function Avatar({ letter, size = 42, photoUri }: Props) {
  const c = colorFor(letter);

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, borderColor: c.ring },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.bg,
          borderColor: c.ring,
        },
      ]}
    >
      <Text style={[styles.letter, { color: c.ring, fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: SERIF,
    fontWeight: '700',
  },
});
