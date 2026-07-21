import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Fonts } from '@/constants';
import type { TranslationKey } from '@/i18n/translations';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MENU_W = Math.min(SCREEN_W * 0.82, 340);
const GOLD = '#C8A97E';

interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

const NAV_ITEM_KEYS = [
  { num: '01', labelKey: 'hamburgerMenu.nav.home.label',     subKey: 'hamburgerMenu.nav.home.sub',     route: '/(tabs)/index'    },
  { num: '02', labelKey: 'hamburgerMenu.nav.services.label', subKey: 'hamburgerMenu.nav.services.sub', route: '/(tabs)/catalogue' },
  { num: '03', labelKey: 'hamburgerMenu.nav.team.label',     subKey: 'hamburgerMenu.nav.team.sub',     route: '/(tabs)/equipe'    },
  { num: '04', labelKey: 'hamburgerMenu.nav.book.label',     subKey: 'hamburgerMenu.nav.book.sub',     route: '/(tabs)/book'     },
] as const satisfies { num: string; labelKey: TranslationKey; subKey: TranslationKey; route: string }[];

export function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { showLoginModal } = useAuthModal();
  const { t } = useLanguage();
  const NAV_ITEMS = NAV_ITEM_KEYS.map(item => ({ ...item, label: t(item.labelKey), sub: t(item.subKey) }));

  const displayName = user?.first_name || user?.username || '';
  const initial     = (displayName[0] ?? 'U').toUpperCase();

  const slideAnim   = useRef(new Animated.Value(MENU_W)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: MENU_W, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) { onClose(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 180);
  };

  const openLogin = () => {
    onClose();
    setTimeout(() => showLoginModal(), 180);
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoMark}>{'{w}'}</Text>
            <Text style={styles.logoText}>willobarber</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

        {/* ── MENU label ── */}
        <Text style={styles.menuLabel}>{t('hamburgerMenu.menuLabel')}</Text>

        {/* ── Nav items ── */}
        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.route ||
              (item.route === '/(tabs)/index' && (pathname === '/' || pathname === '/(tabs)'));

            return (
              <TouchableOpacity
                key={item.num}
                style={styles.navItem}
                onPress={() => navigate(item.route)}
                activeOpacity={0.6}
              >
                {/* Number column with dot */}
                <View style={styles.numCol}>
                  <View style={[styles.activeDot, { opacity: isActive ? 1 : 0 }]} />
                  <Text style={[styles.navNum, isActive && styles.navNumActive]}>{item.num}</Text>
                </View>

                {/* Label + sub */}
                <View style={styles.navTexts}>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.navSub}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />

        {/* ── Bottom badge ── */}
        {isAuthenticated ? (
          <TouchableOpacity
            style={styles.accountBadge}
            onPress={() => navigate('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={styles.accountLeft}>
              <Text style={styles.accountKicker}>{t('hamburgerMenu.accountKicker')}</Text>
              <View style={styles.accountRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
                <Text style={styles.accountName} numberOfLines={1}>{displayName}</Text>
              </View>
            </View>
            <Text style={styles.accountArrow}>→</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.loginBadge}
            onPress={openLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.loginBadgeText}>{t('hamburgerMenu.loginBtn')}</Text>
          </TouchableOpacity>
        )}

        </ScrollView>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: MENU_W,
    height: SCREEN_H,
    backgroundColor: '#0D0C0A',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(200,169,126,0.12)',
    paddingTop: Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingHorizontal: 28,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { fontFamily: Fonts.bold, fontSize: 20, color: GOLD, letterSpacing: 1 },
  logoText: { fontFamily: Fonts.semiBold, fontSize: 18, color: '#fff' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 16 },

  // Scrollable content area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // MENU label
  menuLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4.5,
    color: GOLD,
    marginBottom: 24,
  },

  // Nav list
  navList: {},
  navItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },

  // Number column: dot stacked above number
  numCol: {
    width: 26,
    alignItems: 'center',
    paddingTop: 4,
    gap: 5,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  navNum: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.28)',
  },
  navNumActive: { color: GOLD },

  // Label + sub
  navTexts: { flex: 1 },
  navLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 23,
    color: '#fff',
    letterSpacing: 0.1,
    lineHeight: 27,
  },
  navLabelActive: { color: GOLD },
  navSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.32)',
    marginTop: 3,
  },

  // Account badge
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200,169,126,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(200,169,126,0.22)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  accountLeft: { gap: 9, flex: 1 },
  accountKicker: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: GOLD,
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(200,169,126,0.14)',
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: GOLD,
  },
  accountName: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#fff',
    flex: 1,
  },
  accountArrow: { fontSize: 18, color: GOLD, marginLeft: 8 },

  // Login badge
  loginBadge: {
    borderWidth: 1,
    borderColor: 'rgba(200,169,126,0.35)',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(200,169,126,0.06)',
  },
  loginBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: GOLD,
    letterSpacing: 0.3,
  },
});
