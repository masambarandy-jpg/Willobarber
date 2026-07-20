import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Avatar from './Avatar';
import { CC, SERIF } from './theme';
import { useSidebarWidth } from './useIsTablet';
import { CoiffeurRoute } from './CoiffeurDrawer';
import SupportModal from './SupportModal';
import { useCoiffeurProfile } from '@/contexts/CoiffeurProfileContext';
import {
  GridIcon,
  CalendarIcon,
  ScissorsIcon,
  UsersIcon,
  PersonIcon,
  StarIcon,
  BellIcon,
  GearIcon,
  HelpIcon,
} from './Icons';

type Props = {
  active: CoiffeurRoute;
  children: React.ReactNode;
};

const NAV_ITEMS: { key: CoiffeurRoute; label: string; icon: (color: string) => React.ReactNode; badge?: number }[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: (c) => <GridIcon color={c} /> },
  { key: 'planning', label: 'Planning', icon: (c) => <CalendarIcon color={c} /> },
  { key: 'prestations', label: 'Prestations', icon: (c) => <ScissorsIcon color={c} /> },
  { key: 'clients', label: 'Clients', icon: (c) => <UsersIcon color={c} /> },
  { key: 'equipe', label: 'Équipe', icon: (c) => <PersonIcon color={c} /> },
  { key: 'avis', label: 'Avis clients', icon: (c) => <StarIcon color={c} filled={false} /> },
  { key: 'notifications', label: 'Notifications', icon: (c) => <BellIcon color={c} />, badge: 5 },
  { key: 'parametres', label: 'Paramètres', icon: (c) => <GearIcon color={c} /> },
];

export default function CoiffeurIPadLayout({ active, children }: Props) {
  const sidebarWidth = useSidebarWidth();
  const { profile } = useCoiffeurProfile();
  const avatarLetter = profile.firstName.charAt(0).toUpperCase() || 'W';
  const [supportVisible, setSupportVisible] = useState(false);

  const go = (route: CoiffeurRoute) => router.push(`/coiffeur/${route}` as never);

  return (
    <View style={styles.root}>
      <View style={[styles.sidebar, { width: sidebarWidth }]}>
        <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.logo}>{'{w}'}</Text>
            <Text style={styles.brand}>willobarber</Text>
          </View>

          <View style={styles.profile}>
            <Avatar letter={avatarLetter} size={38} />
            <View>
              <Text style={styles.profileName}>{profile.firstName} {profile.lastName.charAt(0)}.</Text>
              <Text style={styles.profileRole}>{profile.role}</Text>
            </View>
          </View>

          <View style={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === active;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => go(item.key)}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                >
                  <View style={styles.navIcon}>{item.icon(isActive ? CC.black : 'rgba(255,255,255,0.65)')}</View>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <LinearGradient
            colors={[CC.gold, CC.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.helpBlock}
          >
            <View style={styles.helpIconCircle}>
              <HelpIcon />
            </View>
            <Text style={styles.helpTitle}>Besoin d'aide ?</Text>
            <Text style={styles.helpText}>Notre équipe répond en moins de 2h, du mardi au samedi.</Text>
            <TouchableOpacity style={styles.helpBtn} onPress={() => setSupportVisible(true)}>
              <Text style={styles.helpBtnText}>Contacter le support</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </View>

      <View style={styles.content}>{children}</View>

      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: CC.cream,
  },
  sidebar: {
    height: '100%',
    backgroundColor: CC.cardBlack,
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
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.gold,
  },
  brand: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 18,
    color: CC.white,
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
  profileName: {
    fontWeight: '700',
    fontSize: 14,
    color: CC.white,
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
    backgroundColor: CC.gold,
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
    color: CC.black,
  },
  badge: {
    backgroundColor: '#C0392B',
    borderRadius: 100,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: CC.white,
    fontSize: 10,
    fontWeight: '700',
  },
  helpBlock: {
    borderRadius: 14,
    padding: 16,
  },
  helpIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  helpTitle: {
    color: CC.white,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  helpText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  helpBtn: {
    backgroundColor: CC.white,
    borderRadius: 100,
    paddingVertical: 8,
    alignItems: 'center',
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: CC.goldDark,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
