import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HamburgerIcon, BellIcon, GearIcon, PersonIcon, HelpIcon, LogOutIcon } from './Icons';
import Avatar from './Avatar';
import SupportModal from './SupportModal';
import { CC, SERIF } from './theme';
import { useIsTablet } from './useIsTablet';
import { useCoiffeurProfile } from '@/contexts/CoiffeurProfileContext';

type Props = {
  onMenuPress: () => void;
};

export default function CoiffeurTopBar({ onMenuPress }: Props) {
  const isTablet = useIsTablet();
  const { profile } = useCoiffeurProfile();
  const avatarLetter = (profile.firstName ?? '').charAt(0).toUpperCase() || 'W';
  const { width: windowWidth } = useWindowDimensions();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [supportVisible, setSupportVisible] = useState(false);
  const avatarRef = useRef<View>(null);

  const MENU_ITEMS: { label: string; icon: (color: string) => React.ReactNode; action: () => void }[] = [
    { label: 'Paramètres', icon: (c) => <GearIcon color={c} size={16} />, action: () => router.push('/coiffeur/parametres') },
    { label: 'Mon profil', icon: (c) => <PersonIcon color={c} size={16} />, action: () => router.push('/coiffeur/parametres') },
    { label: 'Notifications', icon: (c) => <BellIcon color={c} size={16} />, action: () => router.push('/coiffeur/notifications') },
    { label: 'Aide & support', icon: (c) => <HelpIcon color={c} size={16} />, action: () => setSupportVisible(true) },
  ];

  const toggleProfileMenu = () => {
    avatarRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPos({ top: y + height + 8, right: windowWidth - (x + width) });
      setProfileMenuVisible(true);
    });
  };

  const selectMenuItem = (action: () => void) => {
    setProfileMenuVisible(false);
    action();
  };

  const confirmerDeconnexion = () => {
    setProfileMenuVisible(false);

    if (Platform.OS === 'web') {
      const ok = window.confirm('Voulez-vous vraiment vous déconnecter ?');
      if (ok) router.replace('/coiffeur');
    } else {
      Alert.alert('Se déconnecter', 'Voulez-vous vraiment vous déconnecter ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => router.replace('/coiffeur') },
      ]);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: CC.white }}>
    <View style={styles.bar}>
      <View style={styles.left}>
        {!isTablet && (
          <TouchableOpacity onPress={onMenuPress} hitSlop={10} style={styles.menuBtn}>
            <HamburgerIcon />
          </TouchableOpacity>
        )}
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
        <View ref={avatarRef} collapsable={false}>
          <TouchableOpacity onPress={toggleProfileMenu} hitSlop={6}>
            <Avatar letter={avatarLetter} size={36} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setProfileMenuVisible(false)} />
        <View style={[styles.profileMenu, { top: menuPos.top, right: menuPos.right }]}>
          <View style={styles.profileMenuHeader}>
            <Avatar letter={avatarLetter} size={36} />
            <View>
              <Text style={styles.profileMenuName}>{profile.firstName} {profile.lastName}</Text>
              <Text style={styles.profileMenuRole}>{profile.role}</Text>
            </View>
          </View>

          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => selectMenuItem(item.action)}
              style={styles.profileMenuItem}
            >
              {item.icon(CC.textSecondary)}
              <Text style={styles.profileMenuItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.profileMenuDivider} />

          <TouchableOpacity onPress={confirmerDeconnexion} style={styles.profileMenuItem}>
            <LogOutIcon size={16} />
            <Text style={styles.profileMenuLogoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </View>
    </SafeAreaView>
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
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  profileMenu: {
    position: 'absolute',
    minWidth: 220,
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  profileMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: CC.trackBg,
  },
  profileMenuName: {
    fontWeight: '700',
    fontSize: 14,
    color: CC.black,
  },
  profileMenuRole: {
    fontSize: 12,
    color: CC.textSecondary,
    marginTop: 1,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
  },
  profileMenuItemText: {
    fontSize: 14,
    color: CC.black,
  },
  profileMenuDivider: {
    height: 1,
    backgroundColor: CC.trackBg,
    marginVertical: 4,
  },
  profileMenuLogoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.errorText,
  },
});
