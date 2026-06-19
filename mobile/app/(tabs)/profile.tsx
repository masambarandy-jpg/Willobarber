import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { authApi } from '@/services/api';
import { Fonts } from '@/constants';


function Avatar({ initial, size = 72 }: { initial: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function SettingRow({ icon, label, value, onPress, rightElement, destructive }: {
  icon?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.settingRow, pressed && onPress && { opacity: 0.7 }]} onPress={onPress} disabled={!onPress && !rightElement}>
      {icon && <Text style={styles.settingIcon}>{icon}</Text>}
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, destructive && { color: '#C0392B' }]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement ?? (onPress && <Text style={styles.settingArrow}>›</Text>)}
    </Pressable>
  );
}

function ModalField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'phone-pad' | 'email-address';
}) {
  return (
    <View style={styles.mfWrap}>
      <Text style={styles.mfLabel}>{label}</Text>
      <TextInput
        style={styles.mfInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const { showLoginModal } = useAuthModal();
  const [editModal, setEditModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [aiRec, setAiRec] = useState(user?.ai_recommendations ?? true);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPhone(user.phone ?? '');
      setAiRec(user.ai_recommendations ?? true);
    }
  }, [user]);

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 10, textAlign: 'center' }}>
          Mon Profil
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          Connectez-vous pour accéder à votre profil et gérer votre compte.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#C9A84C', borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40 }}
          onPress={() => showLoginModal(undefined, 'Connectez-vous pour accéder à votre profil.')}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#1A1208', fontWeight: '700', fontSize: 15 }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;
  const initial = (user.first_name?.[0] ?? user.username?.[0] ?? 'U').toUpperCase();
  const memberSince = new Date(user.created_at).toLocaleDateString('fr-BE', { month: 'short', year: 'numeric' });

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || undefined, ai_recommendations: aiRec });
      await refreshUser();
      setEditModal(false);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !newPw2) { Alert.alert('Erreur', 'Tous les champs sont requis.'); return; }
    if (newPw !== newPw2) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ old_password: oldPw, new_password: newPw, new_password2: newPw2 });
      setPwModal(false);
      setOldPw(''); setNewPw(''); setNewPw2('');
      Alert.alert('✅ Mot de passe modifié');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const detail = msg ? Object.values(msg).flat().join('\n') : 'Erreur.';
      Alert.alert('Erreur', detail);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: async () => { setLoggingOut(true); await logout(); setLoggingOut(false); } },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero section */}
        <View style={styles.hero}>
          {/* Dark bg with subtle gradient */}
          <View style={styles.heroBg} />
          <Avatar initial={initial} size={80} />
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{(user.role ?? 'client').toUpperCase()}</Text>
          </View>
          <Text style={styles.heroName}>{fullName}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>
          {user.phone && <Text style={styles.heroPhone}>{user.phone}</Text>}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{user.loyalty_points}</Text>
            <Text style={styles.statLabel}>Points{'\n'}fidélité</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, user.late_cancellations > 0 && { color: '#C0392B' }]}>{user.late_cancellations}</Text>
            <Text style={styles.statLabel}>Annulations{'\n'}tardives</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{memberSince}</Text>
            <Text style={styles.statLabel}>Membre{'\n'}depuis</Text>
          </View>
        </View>

        {/* Account settings */}
        <View style={styles.settingCard}>
          <SectionTitle label="Mon compte" />
          <View style={styles.settingDivider} />
          <SettingRow icon="✏️" label="Modifier le profil" onPress={() => { setFirstName(user.first_name); setLastName(user.last_name); setPhone(user.phone ?? ''); setAiRec(user.ai_recommendations); setEditModal(true); }} />
          <View style={styles.settingDivider} />
          <SettingRow icon="🔑" label="Changer le mot de passe" onPress={() => setPwModal(true)} />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="🤖"
            label="Recommandations IA"
            rightElement={
              <Switch
                value={aiRec}
                onValueChange={async v => { setAiRec(v); await authApi.updateProfile({ ai_recommendations: v }); await refreshUser(); }}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(201,168,76,0.4)' }}
                thumbColor={aiRec ? '#C9A84C' : 'rgba(255,255,255,0.5)'}
              />
            }
          />
        </View>

        {/* Info */}
        <View style={styles.settingCard}>
          <SectionTitle label="Informations" />
          <View style={styles.settingDivider} />
          <SettingRow icon="📄" label="Conditions d'utilisation" />
          <View style={styles.settingDivider} />
          <SettingRow icon="🔒" label="Politique de confidentialité" />
          <View style={styles.settingDivider} />
          <SettingRow icon="📍" label="WilloBarber" value="Rue Auguste Van Zande 78, Bruxelles" />
        </View>

        {/* Logout */}
        {Platform.OS === 'android' ? (
          <View style={[styles.logoutBtn, { overflow: 'hidden', paddingVertical: 0 }]}>
            <TouchableNativeFeedback
              onPress={handleLogout}
              disabled={loggingOut}
              background={TouchableNativeFeedback.Ripple('rgba(192,57,43,0.15)', false)}
            >
              <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                <Text style={styles.logoutBtnText}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutBtnText}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.version}>WilloBarber v1.0.0 · TFE 2025-2026</Text>
      </ScrollView>

      {/* Edit profile modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <Pressable onPress={() => setEditModal(false)}><Text style={styles.modalClose}>✕</Text></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ModalField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Jean" />
              <ModalField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Dupont" />
              <ModalField label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+32 470 …" keyboardType="phone-pad" />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Recommandations IA</Text>
                <Switch value={aiRec} onValueChange={setAiRec} trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(201,168,76,0.4)' }} thumbColor={aiRec ? '#C9A84C' : 'rgba(255,255,255,0.5)'} />
              </View>
              {Platform.OS === 'android' ? (
                <View style={[styles.btnPrimary, saving && { opacity: 0.7 }, { overflow: 'hidden', paddingVertical: 0 }]}>
                  <TouchableNativeFeedback onPress={handleSaveProfile} disabled={saving} background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}>
                    <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                      <Text style={styles.btnPrimaryText}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</Text>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity style={[styles.btnPrimary, saving && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => setPwModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Changer le mot de passe</Text>
              <Pressable onPress={() => setPwModal(false)}><Text style={styles.modalClose}>✕</Text></Pressable>
            </View>
            <ModalField label="Mot de passe actuel" value={oldPw} onChangeText={setOldPw} placeholder="••••••••" secureTextEntry />
            <ModalField label="Nouveau mot de passe" value={newPw} onChangeText={setNewPw} placeholder="••••••••" secureTextEntry />
            <ModalField label="Confirmer" value={newPw2} onChangeText={setNewPw2} placeholder="••••••••" secureTextEntry />
            {Platform.OS === 'android' ? (
              <View style={[styles.btnPrimary, saving && { opacity: 0.7 }, { overflow: 'hidden', paddingVertical: 0 }]}>
                <TouchableNativeFeedback onPress={handleChangePassword} disabled={saving} background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}>
                  <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                    <Text style={styles.btnPrimaryText}>{saving ? 'Modification…' : 'Changer le mot de passe'}</Text>
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity style={[styles.btnPrimary, saving && { opacity: 0.7 }]} onPress={handleChangePassword} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>{saving ? 'Modification…' : 'Changer le mot de passe'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },
  content: { paddingBottom: 40 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 0) + 10,
    paddingBottom: 28,
    paddingHorizontal: 22,
    backgroundColor: '#1A1814',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  heroBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1A1814' },
  avatar: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 2,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  avatarText: { color: '#C9A84C', fontFamily: Fonts.semiBold, fontWeight: '600' },
  rolePill: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#C9A84C',
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 4,
  },
  roleText: { fontSize: 9.5, color: '#C9A84C', fontWeight: '700', letterSpacing: 1 },
  heroName: { fontFamily: Fonts.semiBold, fontSize: 26, fontWeight: '600', color: '#fff', textAlign: 'center' },
  heroEmail: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  heroPhone: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1814',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 22 },
  statLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 3, lineHeight: 13 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Settings card
  settingCard: {
    backgroundColor: '#1A1814',
    marginHorizontal: 22,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12 },
  settingDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 0 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  settingIcon: { fontSize: 18, width: 26 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14.5, color: '#fff' },
  settingValue: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  settingArrow: { fontSize: 20, color: 'rgba(255,255,255,0.35)' },

  // Logout
  logoutBtn: {
    backgroundColor: '#FDECEA',
    borderRadius: 100,
    marginHorizontal: 22,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutBtnText: { color: '#C0392B', fontWeight: '700', fontSize: 14.5 },

  version: { fontSize: 11.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 8 },

  // Buttons
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
    marginTop: 8,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#1A1814',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff' },
  modalClose: { fontSize: 18, color: 'rgba(255,255,255,0.45)', padding: 4 },

  mfWrap: { marginBottom: 14 },
  mfLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 7 },
  mfInput: {
    backgroundColor: '#252018',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 13,
    fontSize: 14,
    color: '#fff',
    minHeight: 46,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 8 },
  switchLabel: { fontSize: 14.5, color: '#fff' },
});
