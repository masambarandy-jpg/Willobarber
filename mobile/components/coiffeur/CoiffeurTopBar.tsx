import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { HamburgerIcon, BellIcon } from './Icons';
import Avatar from './Avatar';
import { CC, SERIF } from './theme';

type Props = {
  onMenuPress: () => void;
};

export default function CoiffeurTopBar({ onMenuPress }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <TouchableOpacity onPress={onMenuPress} hitSlop={10} style={styles.menuBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={styles.logo}>{'{w}'}</Text>
        <Text style={styles.brand}>willobarber</Text>
      </View>
      <View style={styles.right}>
        <TouchableOpacity
          onPress={() => router.push('/coiffeur/notifications')}
          hitSlop={10}
          style={styles.bellWrap}
        >
          <BellIcon />
          <View style={styles.dot} />
        </TouchableOpacity>
        <Avatar letter="W" size={36} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CC.white,
    borderBottomWidth: 1,
    borderBottomColor: CC.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuBtn: {
    marginRight: 2,
  },
  logo: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.gold,
  },
  brand: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 16,
    color: CC.black,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bellWrap: {
    position: 'relative',
    padding: 2,
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C0392B',
    borderWidth: 1.5,
    borderColor: CC.white,
  },
});
