import { View, Text, StyleSheet } from 'react-native';
import { AVATAR_COLORS, AvatarKey, SERIF } from './theme';

type Props = {
  letter: string;
  size?: number;
};

const FALLBACK_PALETTE = Object.values(AVATAR_COLORS);

function colorFor(letter: string) {
  const known = AVATAR_COLORS[letter as AvatarKey];
  if (known) return known;
  const idx = letter.charCodeAt(0) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

export default function Avatar({ letter, size = 42 }: Props) {
  const c = colorFor(letter);
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
