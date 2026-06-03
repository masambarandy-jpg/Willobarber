import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Fonts } from '@/constants';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MENU_W = Math.min(SCREEN_W * 0.82, 340);

interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Accueil',       route: '/(tabs)/index' as const,        kicker: '01' },
  { label: 'Réserver',      route: '/(tabs)/book' as const,         kicker: '02' },
  { label: 'Mes réservations', route: '/(tabs)/reservations' as const, kicker: '03' },
  { label: 'Mon profil',    route: '/(tabs)/profile' as const,      kicker: '04' },
] as const;

function Avatar({ initial, color, ring, size = 44 }: { initial: string; color: string; ring: string; size?: number }) {
  return (
    <View style={[styles.avatarBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22', borderColor: ring }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.38, color }]}>{initial}</Text>
    </View>
  );
}

export function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const firstName = user?.first_name || user?.username || 'Vous';
  const email = user?.email ?? '';

  const slideAnim = useRef(new Animated.Value(MENU_W)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: MENU_W,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 180);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* Header row */}
        <View style={styles.panelHeader}>
          <View style={styles.logoRow}>
            <Text style={styles.logoMark}>{'{w}'}</Text>
            <Text style={styles.logoBrand}>willobarber</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* User identity */}
        <View style={styles.userRow}>
          <Avatar initial={(firstName[0] ?? 'U').toUpperCase()} color="#C9A84C" ring="#8B6914" size={48} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{firstName}</Text>
            {!!email && <Text style={styles.userEmail}>{email}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Navigation items */}
        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.navItem}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
            >
              <Text style={styles.navKicker}>{item.kicker}</Text>
              <Text style={styles.navLabel}>{item.label}</Text>
              <Text style={styles.navArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
          <Text style={styles.footerAddress}>Rue Auguste Van Zande 78 · Bruxelles</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: MENU_W,
    height: SCREEN_H,
    backgroundColor: '#111009',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(201,168,76,0.14)',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 40,
    paddingHorizontal: 28,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { fontFamily: Fonts.bold, fontSize: 20, color: '#C9A84C', letterSpacing: 1 },
  logoBrand: { fontFamily: Fonts.semiBold, fontSize: 18, color: '#fff' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 16 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 18,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  userInfo: { flex: 1 },
  userName: { fontFamily: Fonts.semiBold, fontSize: 20, color: '#fff' },
  userEmail: { fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  avatarBase: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarInitial: { fontFamily: Fonts.semiBold, fontWeight: '600' },
  navList: { gap: 4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  navKicker: {
    fontSize: 10,
    color: '#C9A84C',
    fontWeight: '600',
    letterSpacing: 1,
    width: 22,
  },
  navLabel: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: 0.2,
  },
  navArrow: { fontSize: 16, color: 'rgba(201,168,76,0.5)' },
  footer: { flex: 1, justifyContent: 'flex-end', gap: 16 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: { fontFamily: Fonts.semiBold, fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  footerAddress: { fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', letterSpacing: 0.5 },
});
