import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { useReservations } from '@/hooks/useReservations';
import { useClientSidebarWidth } from './useIsTablet';
import { useLanguage } from '@/contexts/LanguageContext';
import { Fonts } from '@/constants';
import type { TranslationKey } from '@/i18n/translations';
import type { Reservation } from '@/types';

export type ClientRoute = 'home' | 'catalogue' | 'book' | 'space' | 'profile';

const JOURS_ABBR_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MOIS_ABBR_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function parseApiDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Le backend n'a pas de champ d'affectation barbier sur Reservation — "Willo" en
// fallback ici reprend la même convention que le planning coiffeur (cf. planning.tsx).
function formatNextRdvLabel(reservation: Reservation & { time: string }): string {
  const d = parseApiDate(reservation.date);
  const jourAbbr = JOURS_ABBR_FR[d.getDay()];
  const moisAbbr = MOIS_ABBR_FR[d.getMonth()];
  const heure = reservation.time.slice(0, 5);
  return `${jourAbbr} ${d.getDate()} ${moisAbbr} · ${heure} · Willo`;
}

const GOLD = '#C9A84C';
const GOLD_DARK = '#8B6914';
const DARK = '#0D0C0A';

type Props = {
  active: ClientRoute;
  children: React.ReactNode;
};

const ROUTES: Record<ClientRoute, string> = {
  home: '/(tabs)',
  catalogue: '/(tabs)/catalogue',
  book: '/(tabs)/book',
  space: '/(tabs)/reservations',
  profile: '/(tabs)/profile',
};

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

function ScissorsIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="6" cy="6" r="3" />
      <Circle cx="6" cy="18" r="3" />
      <Line x1="20" y1="4" x2="8.12" y2="15.88" />
      <Line x1="14.47" y1="14.48" x2="20" y2="20" />
      <Line x1="8.12" y1="8.12" x2="12" y2="12" />
    </Svg>
  );
}

function CalendarPlusIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
      <Line x1="12" y1="14" x2="12" y2="18" />
      <Line x1="10" y1="16" x2="14" y2="16" />
    </Svg>
  );
}

function GridIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="7" height="7" />
      <Rect x="14" y="3" width="7" height="7" />
      <Rect x="14" y="14" width="7" height="7" />
      <Rect x="3" y="14" width="7" height="7" />
    </Svg>
  );
}

function UserIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

const NAV_ITEM_KEYS: { key: ClientRoute; labelKey: TranslationKey; icon: (color: string) => React.ReactNode }[] = [
  { key: 'home', labelKey: 'nav.home', icon: (c) => <HomeIcon color={c} /> },
  { key: 'catalogue', labelKey: 'nav.services', icon: (c) => <ScissorsIcon color={c} /> },
  { key: 'book', labelKey: 'nav.book', icon: (c) => <CalendarPlusIcon color={c} /> },
  { key: 'space', labelKey: 'nav.mySpace', icon: (c) => <GridIcon color={c} /> },
  { key: 'profile', labelKey: 'nav.profile', icon: (c) => <UserIcon color={c} /> },
];

export default function ClientIPadLayout({ active, children }: Props) {
  const sidebarWidth = useClientSidebarWidth();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { upcoming } = useReservations();
  const NAV_ITEMS = NAV_ITEM_KEYS.map(item => ({ ...item, label: t(item.labelKey) }));

  const firstName = user?.first_name || user?.username || 'Client';
  const lastName = user?.last_name || '';
  const avatarLetter = (firstName ?? '').charAt(0).toUpperCase() || 'W';

  const go = (route: ClientRoute) => router.push(ROUTES[route] as never);

  // Même dérivation que "Prochain RDV" dans reservations.tsx : le plus proche des
  // réservations à venir (pending/confirmed), trié par date+heure croissante.
  const upcomingList = upcoming as (Reservation & { time: string })[];
  const nextReservation = isAuthenticated
    ? [...upcomingList].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0] ?? null
    : null;

  return (
    <View style={styles.root}>
      <View style={[styles.sidebar, { width: sidebarWidth }]}>
        <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.logo}>{'{w}'}</Text>
            <Text style={styles.brand}>willobarber</Text>
          </View>

          {isAuthenticated && (
            <View style={styles.profile}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {firstName} {lastName ? `${lastName.charAt(0)}.` : ''}
                </Text>
                <Text style={styles.profileRole}>{t('clientSidebar.loyalClient')}</Text>
              </View>
            </View>
          )}

          <View style={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === active;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => go(item.key)}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  activeOpacity={0.85}
                >
                  <View style={styles.navIcon}>{item.icon(isActive ? '#1A1208' : 'rgba(255,255,255,0.65)')}</View>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {nextReservation && (
            <LinearGradient
              colors={[GOLD, GOLD_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoBlock}
              pointerEvents="box-none"
            >
              <Text style={styles.promoKicker}>{t('clientSidebar.nextRdvKicker')}</Text>
              <Text style={styles.promoText}>{formatNextRdvLabel(nextReservation)}</Text>
              <TouchableOpacity
                style={[styles.promoBtn, { zIndex: 999 }]}
                pointerEvents="auto"
                onPress={() => {
                  const d = parseApiDate(nextReservation.date);
                  const dateLabel = `${JOURS_ABBR_FR[d.getDay()]} ${d.getDate()} ${MOIS_ABBR_FR[d.getMonth()]}`;
                  const heureLabel = nextReservation.time.slice(0, 5);
                  Alert.alert(
                    'Votre prochain RDV',
                    `📅 ${dateLabel}\n⏰ ${heureLabel}\n✂️ ${nextReservation.service_name}\n👤 Willo`,
                    [{ text: 'Fermer', style: 'cancel' }]
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.promoBtnText}>{t('clientSidebar.viewDetails')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </ScrollView>
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: DARK,
  },
  sidebar: {
    height: '100%',
    backgroundColor: DARK,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  sidebarContent: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  logo: {
    fontFamily: Fonts.bold,
    fontWeight: '700',
    fontSize: 22,
    color: GOLD,
  },
  brand: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    color: '#FFFFFF',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: GOLD,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    fontSize: 15,
  },
  profileName: {
    fontWeight: '700',
    fontSize: 14,
    color: '#FFFFFF',
  },
  profileRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  nav: {
    gap: 2,
    marginBottom: 24,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  navItemActive: {
    backgroundColor: GOLD,
  },
  navIcon: {
    width: 20,
    alignItems: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
  },
  navLabelActive: {
    fontWeight: '700',
    color: '#1A1208',
  },
  promoBlock: {
    borderRadius: 14,
    padding: 16,
  },
  promoKicker: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  promoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  promoBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: 'center',
  },
  promoBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: GOLD_DARK,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
