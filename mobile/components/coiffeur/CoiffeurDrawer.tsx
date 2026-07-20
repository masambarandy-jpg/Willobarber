import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Avatar from './Avatar';
import { CC, SERIF } from './theme';
import SupportModal from './SupportModal';
import { useCoiffeurProfile } from '@/contexts/CoiffeurProfileContext';
import {
  CloseIcon,
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

export type CoiffeurRoute =
  | 'dashboard'
  | 'planning'
  | 'prestations'
  | 'clients'
  | 'equipe'
  | 'avis'
  | 'notifications'
  | 'parametres';

type Props = {
  visible: boolean;
  onClose: () => void;
  active: CoiffeurRoute;
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

export default function CoiffeurDrawer({ visible, onClose, active }: Props) {
  const { profile } = useCoiffeurProfile();
  const avatarLetter = profile.firstName.charAt(0).toUpperCase() || 'W';
  const [supportVisible, setSupportVisible] = useState(false);

  if (!visible) return null;

  const go = (route: CoiffeurRoute) => {
    onClose();
    router.push(`/coiffeur/${route}` as never);
  };

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.drawer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.logo}>{'{w}'}</Text>
              <Text style={styles.brand}>willobarber</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <CloseIcon />
            </TouchableOpacity>
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
                  {item.icon(isActive ? CC.black : CC.black)}
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
      <Pressable style={styles.backdrop} onPress={onClose} />

      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 100,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    width: 276,
    height: '100%',
    backgroundColor: CC.cream,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 19,
    color: CC.gold,
  },
  brand: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 15,
    color: CC.black,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CC.border,
  },
  profileName: {
    fontWeight: '700',
    fontSize: 14,
    color: CC.black,
  },
  profileRole: {
    fontSize: 12,
    color: CC.textSecondary,
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
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  navItemActive: {
    backgroundColor: CC.gold,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: CC.black,
  },
  navLabelActive: {
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#C0392B',
    borderRadius: 100,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: CC.white,
    fontSize: 11,
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
    fontSize: 15,
    marginBottom: 4,
  },
  helpText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  helpBtn: {
    backgroundColor: CC.white,
    borderRadius: 100,
    paddingVertical: 11,
    alignItems: 'center',
  },
  helpBtnText: {
    color: CC.goldDark,
    fontWeight: '700',
    fontSize: 13,
  },
});
