import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/services/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}

function SettingRow({ icon, label, value, onPress, rightElement, destructive = false }: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [rowStyles.row, pressed && onPress && rowStyles.pressed]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={rowStyles.content}>
        <Text style={[rowStyles.label, destructive && rowStyles.labelDestructive]}>{label}</Text>
        {value && <Text style={rowStyles.value}>{value}</Text>}
      </View>
      {rightElement ?? (onPress && <Text style={rowStyles.arrow}>›</Text>)}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  pressed: { opacity: 0.7 },
  icon: { fontSize: 20, width: 28 },
  content: { flex: 1 },
  label: { fontSize: FontSize.base, color: Colors.textPrimary },
  labelDestructive: { color: Colors.error },
  value: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  arrow: { fontSize: FontSize.lg, color: Colors.textMuted },
});

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editModal, setEditModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit profile fields
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [aiRec, setAiRec] = useState(user?.ai_recommendations ?? true);

  // Password change fields
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || undefined,
        ai_recommendations: aiRec,
      });
      await refreshUser();
      setEditModal(false);
      Alert.alert('✅ Profil mis à jour');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !newPw2) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (newPw !== newPw2) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ old_password: oldPw, new_password: newPw, new_password2: newPw2 });
      setPwModal(false);
      setOldPw('');
      setNewPw('');
      setNewPw2('');
      Alert.alert('✅ Mot de passe modifié');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const detail = msg ? Object.values(msg).flat().join('\n') : 'Erreur lors du changement de mot de passe.';
      Alert.alert('Erreur', detail);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  };

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Avatar name={fullName} size={84} color={Colors.gold} />
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{user.role}</Text>
            </View>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.phone && <Text style={styles.phone}>📱 {user.phone}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{user.loyalty_points}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{user.late_cancellations}</Text>
              <Text style={[styles.statLabel, user.late_cancellations > 0 && { color: Colors.warning }]}>
                Annulations tardives
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>
                {new Date(user.created_at).toLocaleDateString('fr-BE', { month: 'short', year: 'numeric' })}
              </Text>
              <Text style={styles.statLabel}>Membre depuis</Text>
            </View>
          </View>
        </View>

        {/* Account settings */}
        <Card padded style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <Divider spacing={Spacing.sm} />
          <SettingRow icon="✏️" label="Modifier le profil" onPress={() => {
            setFirstName(user.first_name);
            setLastName(user.last_name);
            setPhone(user.phone ?? '');
            setAiRec(user.ai_recommendations);
            setEditModal(true);
          }} />
          <Divider spacing={0} />
          <SettingRow icon="🔑" label="Changer le mot de passe" onPress={() => setPwModal(true)} />
          <Divider spacing={0} />
          <SettingRow
            icon="🤖"
            label="Recommandations IA"
            rightElement={
              <Switch
                value={aiRec}
                onValueChange={async (v) => {
                  setAiRec(v);
                  await authApi.updateProfile({ ai_recommendations: v });
                  await refreshUser();
                }}
                trackColor={{ false: Colors.surfaceBorder, true: Colors.goldSubtle }}
                thumbColor={aiRec ? Colors.gold : Colors.textMuted}
              />
            }
          />
        </Card>

        {/* Legal */}
        <Card padded style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <Divider spacing={Spacing.sm} />
          <SettingRow icon="📄" label="Conditions d'utilisation" />
          <Divider spacing={0} />
          <SettingRow icon="🔒" label="Politique de confidentialité" />
          <Divider spacing={0} />
          <SettingRow icon="📍" label="WilloBarber, Bruxelles" value="Rue de la Paix 12, 1000 Bruxelles" />
        </Card>

        {/* Logout */}
        <Button
          label="Se déconnecter"
          variant="danger"
          loading={loggingOut}
          onPress={handleLogout}
        />

        <Text style={styles.version}>WilloBarber v1.0.0 • TFE 2025-2026</Text>
      </ScrollView>

      {/* Edit profile modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <Pressable onPress={() => setEditModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalForm}>
                <ModalField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Jean" />
                <ModalField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Dupont" />
                <ModalField label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+32 470 …" keyboardType="phone-pad" />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Recommandations IA</Text>
                  <Switch
                    value={aiRec}
                    onValueChange={setAiRec}
                    trackColor={{ false: Colors.surfaceBorder, true: Colors.goldSubtle }}
                    thumbColor={aiRec ? Colors.gold : Colors.textMuted}
                  />
                </View>

                <Button label="Sauvegarder" onPress={handleSaveProfile} loading={saving} />
              </View>
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
              <Pressable onPress={() => setPwModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.modalForm}>
              <ModalField label="Mot de passe actuel" value={oldPw} onChangeText={setOldPw} placeholder="••••••••" secureTextEntry />
              <ModalField label="Nouveau mot de passe" value={newPw} onChangeText={setNewPw} placeholder="••••••••" secureTextEntry />
              <ModalField label="Confirmer" value={newPw2} onChangeText={setNewPw2} placeholder="••••••••" secureTextEntry />
              <Button label="Changer le mot de passe" onPress={handleChangePassword} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ModalField({
  label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'phone-pad' | 'email-address';
}) {
  return (
    <View style={mfStyles.wrapper}>
      <Text style={mfStyles.label}>{label}</Text>
      <TextInput
        style={mfStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const mfStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, fontWeight: FontWeight.medium },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    minHeight: 48,
  },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.xxxl },

  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  avatarWrap: { position: 'relative' },
  roleChip: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.goldSubtle,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  roleText: { fontSize: 9, color: Colors.gold, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  email: { fontSize: FontSize.base, color: Colors.textSecondary },
  phone: { fontSize: FontSize.sm, color: Colors.textMuted },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.surfaceBorder },

  section: { gap: 0 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },

  version: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalClose: { fontSize: FontSize.lg, color: Colors.textMuted, padding: Spacing.xs },
  modalForm: { gap: Spacing.sm },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  switchLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
});
