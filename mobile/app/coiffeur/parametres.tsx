import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { CameraIcon, LockIcon, LogOutIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

const TABS = ['Profil', 'Établissement', 'Notifications', 'Paiement', 'Sécurité'] as const;
type Tab = (typeof TABS)[number];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  half,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  half?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.field, half && styles.fieldHalf]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={CC.textSecondary}
        multiline={multiline}
      />
    </View>
  );
}

function ProfilTab() {
  const [firstName, setFirstName] = useState('Willo');
  const [lastName, setLastName] = useState('Diallo');
  const [email, setEmail] = useState('willo@willobarber.fr');
  const [phone, setPhone] = useState('06 45 78 29 70');
  const [role, setRole] = useState('Gérant');
  const [profilEnregistre, setProfilEnregistre] = useState(false);

  const enregistrerProfil = () => {
    setProfilEnregistre(true);
    setTimeout(() => setProfilEnregistre(false), 3000);
  };

  return (
    <View style={styles.card}>
      <View style={styles.avatarRow}>
        <View>
          <Avatar letter="W" size={64} />
          <TouchableOpacity style={styles.cameraBtn}>
            <CameraIcon />
          </TouchableOpacity>
        </View>
        <View>
          <Text style={styles.avatarName}>Willo Diallo</Text>
          <Text style={styles.avatarSub}>Photo de profil</Text>
        </View>
      </View>

      <View style={styles.row2}>
        <Field label="PRÉNOM" value={firstName} onChangeText={setFirstName} half />
        <Field label="NOM" value={lastName} onChangeText={setLastName} half />
      </View>
      <Field label="EMAIL" value={email} onChangeText={setEmail} />
      <View style={styles.row2}>
        <Field label="TÉLÉPHONE" value={phone} onChangeText={setPhone} half />
        <Field label="RÔLE" value={role} onChangeText={setRole} half />
      </View>

      <TouchableOpacity
        onPress={enregistrerProfil}
        style={[styles.saveBtn, profilEnregistre && styles.saveBtnDone]}
      >
        <Text style={[styles.saveBtnText, profilEnregistre && styles.saveBtnTextDone]}>
          {profilEnregistre ? '✓ Profil enregistré !' : 'Enregistrer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

type DayHours = { day: string; open: boolean; debut: string; fin: string };

const DEFAULT_HOURS: DayHours[] = [
  { day: 'Lundi', open: false, debut: '11:00', fin: '20:00' },
  { day: 'Mardi', open: true, debut: '11:00', fin: '20:00' },
  { day: 'Mercredi', open: true, debut: '11:00', fin: '20:00' },
  { day: 'Jeudi', open: true, debut: '11:00', fin: '20:00' },
  { day: 'Vendredi', open: true, debut: '11:00', fin: '20:00' },
  { day: 'Samedi', open: true, debut: '11:00', fin: '20:00' },
  { day: 'Dimanche', open: true, debut: '11:00', fin: '20:00' },
];

const HOURS_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00',
];

function EtablissementTab() {
  const [name, setName] = useState('WilloBarber');
  const [address, setAddress] = useState('Rue Auguste Van Zande 78, 1082 Bruxelles');
  const [description, setDescription] = useState('Barber privé sur rendez-vous uniquement.');
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [pickerType, setPickerType] = useState<'debut' | 'fin'>('debut');
  const [horairesEnregistres, setHorairesEnregistres] = useState(false);

  const enregistrerHoraires = () => {
    setHorairesEnregistres(true);
    setTimeout(() => setHorairesEnregistres(false), 3000);
  };

  const toggleDay = (day: string) => {
    setHours((prev) => prev.map((h) => (h.day === day ? { ...h, open: !h.open } : h)));
  };

  const openPicker = (index: number, type: 'debut' | 'fin') => {
    setPickerIndex(index);
    setPickerType(type);
    setPickerVisible(true);
  };

  const selectHeure = (heure: string) => {
    setHours((prev) => prev.map((h, i) => (i === pickerIndex ? { ...h, [pickerType]: heure } : h)));
    setPickerVisible(false);
  };

  const heureSelectionnee = hours[pickerIndex]?.[pickerType];

  return (
    <>
      <View style={styles.card}>
        <Field label="NOM DU SALON" value={name} onChangeText={setName} />
        <Field label="ADRESSE" value={address} onChangeText={setAddress} />
        <Field label="DESCRIPTION" value={description} onChangeText={setDescription} multiline />

        <Text style={styles.hoursLabel}>HORAIRES</Text>
        {hours.map((h, i) => (
          <View key={h.day} style={styles.hourRow}>
            <Text style={styles.hourDay}>{h.day}</Text>
            <View style={styles.hourRight}>
              {h.open ? (
                <View style={styles.hourTimesRow}>
                  <TouchableOpacity style={styles.hourTimeChip} onPress={() => openPicker(i, 'debut')}>
                    <Text style={styles.hourTimeText}>{h.debut}</Text>
                  </TouchableOpacity>
                  <Text style={styles.hourTimeSeparator}>—</Text>
                  <TouchableOpacity style={styles.hourTimeChip} onPress={() => openPicker(i, 'fin')}>
                    <Text style={styles.hourTimeText}>{h.fin}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.hourValue, styles.hourValueClosed]}>Fermé</Text>
              )}
              <Toggle value={h.open} onChange={() => toggleDay(h.day)} />
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={enregistrerHoraires}
          style={[styles.saveBtn, styles.saveHorairesBtn, horairesEnregistres && styles.saveBtnDone]}
        >
          <Text style={[styles.saveBtnText, horairesEnregistres && styles.saveBtnTextDone]}>
            {horairesEnregistres ? '✓ Horaires enregistrés !' : 'Enregistrer les horaires'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerType === 'debut' ? "Heure d'ouverture" : 'Heure de fermeture'}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {HOURS_OPTIONS.map((heure) => {
                const active = heure === heureSelectionnee;
                return (
                  <TouchableOpacity
                    key={heure}
                    onPress={() => selectHeure(heure)}
                    style={[styles.modalHeureItem, active && styles.modalHeureItemActive]}
                  >
                    <Text style={[styles.modalHeureText, active && styles.modalHeureTextActive]}>{heure}</Text>
                    {active && <Text style={styles.modalCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

type NotifSetting = { label: string; email: boolean; sms: boolean; push: boolean };

const DEFAULT_NOTIF_SETTINGS: NotifSetting[] = [
  { label: 'Nouveau RDV', email: true, sms: true, push: true },
  { label: 'Annulation', email: true, sms: true, push: false },
  { label: 'Nouvel avis', email: true, sms: false, push: true },
  { label: 'Rappel quotidien', email: false, sms: true, push: true },
  { label: 'Rapport hebdo', email: true, sms: false, push: false },
];

function NotificationsTab() {
  const [settings, setSettings] = useState(DEFAULT_NOTIF_SETTINGS);

  const toggle = (label: string, key: 'email' | 'sms' | 'push') => {
    setSettings((prev) => prev.map((s) => (s.label === label ? { ...s, [key]: !s[key] } : s)));
  };

  return (
    <View style={styles.card}>
      {settings.map((s, i) => (
        <View key={s.label} style={[styles.notifBlock, i === settings.length - 1 && styles.notifBlockLast]}>
          <Text style={styles.notifLabel}>{s.label}</Text>
          <View style={styles.notifTogglesRow}>
            <View style={styles.notifToggleItem}>
              <Text style={styles.notifToggleLabel}>Email</Text>
              <Toggle value={s.email} onChange={() => toggle(s.label, 'email')} />
            </View>
            <View style={styles.notifToggleItem}>
              <Text style={styles.notifToggleLabel}>SMS</Text>
              <Toggle value={s.sms} onChange={() => toggle(s.label, 'sms')} />
            </View>
            <View style={styles.notifToggleItem}>
              <Text style={styles.notifToggleLabel}>Push</Text>
              <Toggle value={s.push} onChange={() => toggle(s.label, 'push')} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function PaiementTab() {
  return (
    <>
      <View style={styles.cardCompact}>
        <View style={styles.cardRow}>
          <View style={styles.cardLogo}>
            <Text style={styles.cardLogoText}>Vi</Text>
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardName}>Visa</Text>
            <Text style={styles.cardNumber}>•••• 4582</Text>
          </View>
          <View style={[styles.badge, styles.badgeActif]}>
            <Text style={[styles.badgeText, styles.badgeActifText]}>Actif</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardCompact}>
        <View style={styles.cardRow}>
          <View style={styles.cardLogo}>
            <Text style={styles.cardLogoText}>Ma</Text>
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardName}>Mastercard</Text>
            <Text style={styles.cardNumber}>•••• 1190</Text>
          </View>
          <View style={[styles.badge, styles.badgeSecondaire]}>
            <Text style={[styles.badgeText, styles.badgeSecondaireText]}>Secondaire</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.commissionRow}>
          <Text style={styles.commissionLabel}>Commission plateforme</Text>
          <Text style={styles.commissionValue}>4%</Text>
        </View>
        <View style={styles.sliderTrack}>
          <View style={styles.sliderFill} />
          <View style={styles.sliderThumb} />
        </View>
        <View style={styles.sliderLabelsRow}>
          <Text style={styles.sliderLabel}>0%</Text>
          <Text style={styles.sliderLabel}>10%</Text>
        </View>
      </View>
    </>
  );
}

function SecuriteTab() {
  const [currentPassword, setCurrentPassword] = useState('••••••••');
  const [newPassword, setNewPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState(true);
  const [motDePasseMisAJour, setMotDePasseMisAJour] = useState(false);

  const mettreAJourMotDePasse = () => {
    setMotDePasseMisAJour(true);
    setTimeout(() => setMotDePasseMisAJour(false), 3000);
  };

  return (
    <>
      <View style={styles.card}>
        <Field label="MOT DE PASSE ACTUEL" value={currentPassword} onChangeText={setCurrentPassword} />
        <Field label="NOUVEAU MOT DE PASSE" value={newPassword} onChangeText={setNewPassword} />
        <TouchableOpacity
          onPress={mettreAJourMotDePasse}
          style={[styles.saveBtn, motDePasseMisAJour && styles.saveBtnDone]}
        >
          <Text style={[styles.saveBtnText, motDePasseMisAJour && styles.saveBtnTextDone]}>
            {motDePasseMisAJour ? '✓ Mot de passe mis à jour !' : 'Mettre à jour'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.cardCompact, styles.twoFactorRow]}>
        <View style={styles.twoFactorIcon}>
          <LockIcon />
        </View>
        <View style={styles.twoFactorInfo}>
          <Text style={styles.twoFactorTitle}>Double authentification</Text>
          <Text style={styles.twoFactorSub}>Sécurité renforcée par SMS</Text>
        </View>
        <Toggle value={twoFactor} onChange={setTwoFactor} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sessionsLabel}>SESSIONS ACTIVES</Text>
        <View style={styles.sessionRow}>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionDevice}>MacBook Pro · Bruxelles</Text>
            <Text style={styles.sessionMeta}>Maintenant</Text>
          </View>
          <View style={[styles.badge, styles.badgeActif]}>
            <Text style={[styles.badgeText, styles.badgeActifText]}>Actuelle</Text>
          </View>
        </View>
        <View style={styles.sessionDivider} />
        <View style={styles.sessionRow}>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionDevice}>iPhone 15 · Bruxelles</Text>
            <Text style={styles.sessionMeta}>il y a 2 h</Text>
          </View>
          <TouchableOpacity style={styles.disconnectBtn}>
            <Text style={styles.disconnectBtnText}>Déconnecter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn}>
        <LogOutIcon />
        <Text style={styles.logoutBtnText}>Déconnexion</Text>
      </TouchableOpacity>
    </>
  );
}

export default function CoiffeurParametresScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('Profil');

  return (
    <CoiffeurScreen active="parametres">
      <Text style={styles.title}>Paramètres</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeTab === 'Profil' && <ProfilTab />}
      {activeTab === 'Établissement' && <EtablissementTab />}
      {activeTab === 'Notifications' && <NotificationsTab />}
      {activeTab === 'Paiement' && <PaiementTab />}
      {activeTab === 'Sécurité' && <SecuriteTab />}
    </CoiffeurScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
    marginBottom: 18,
  },
  tabsScroll: {
    marginBottom: 18,
  },
  tabsContent: {
    gap: 8,
  },
  tab: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  tabActive: {
    backgroundColor: CC.gold,
    borderColor: CC.gold,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.textSecondary,
  },
  tabTextActive: {
    color: CC.black,
    fontWeight: '700',
  },
  card: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardCompact: {
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: CC.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CC.white,
  },
  avatarName: {
    fontSize: 16,
    fontWeight: '700',
    color: CC.black,
  },
  avatarSub: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    marginBottom: 16,
    flex: 1,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  input: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    color: CC.black,
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveBtnDone: {
    backgroundColor: '#2D6A4F',
  },
  saveBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CC.black,
  },
  saveBtnTextDone: {
    color: '#fff',
  },
  hoursLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 10,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eadf',
  },
  hourDay: {
    fontSize: 14,
    color: CC.black,
    fontWeight: '600',
  },
  hourRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hourValue: {
    fontSize: 13,
    color: CC.black,
  },
  hourValueClosed: {
    color: CC.textSecondary,
  },
  hourTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hourTimeChip: {
    backgroundColor: CC.trackBg,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hourTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  hourTimeSeparator: {
    fontSize: 13,
    color: CC.textSecondary,
  },
  saveHorairesBtn: {
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: CC.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '600',
    color: CC.black,
  },
  modalClose: {
    fontSize: 20,
    color: CC.textSecondary,
  },
  modalHeureItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeureItemActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  modalHeureText: {
    fontSize: 16,
    fontWeight: '400',
    color: CC.black,
  },
  modalHeureTextActive: {
    fontWeight: '700',
    color: CC.goldDark,
  },
  modalCheck: {
    fontSize: 18,
    color: CC.goldDark,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: CC.gold,
    alignItems: 'flex-end',
  },
  toggleTrackOff: {
    backgroundColor: '#d8d2c6',
    alignItems: 'flex-start',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: CC.white,
  },
  toggleThumbOn: {},
  notifBlock: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eadf',
  },
  notifBlockLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  notifLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
    marginBottom: 12,
  },
  notifTogglesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notifToggleItem: {
    alignItems: 'center',
    gap: 6,
  },
  notifToggleLabel: {
    fontSize: 11.5,
    color: CC.textSecondary,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardLogo: {
    width: 48,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#1a140a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLogoText: {
    color: CC.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  cardDetails: {
    flex: 1,
  },
  cardName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CC.black,
  },
  cardNumber: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeActif: {
    backgroundColor: CC.successBg,
  },
  badgeActifText: {
    color: CC.successText,
  },
  badgeSecondaire: {
    backgroundColor: CC.grayBg,
  },
  badgeSecondaireText: {
    color: CC.grayText,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  commissionLabel: {
    fontSize: 14,
    color: CC.textSecondary,
  },
  commissionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: CC.goldDark,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.trackBg,
    justifyContent: 'center',
    marginBottom: 8,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    width: '40%',
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.gold,
  },
  sliderThumb: {
    position: 'absolute',
    left: '40%',
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: CC.gold,
    borderWidth: 3,
    borderColor: CC.white,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 11,
    color: CC.textSecondary,
  },
  twoFactorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  twoFactorIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: CC.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoFactorInfo: {
    flex: 1,
  },
  twoFactorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  twoFactorSub: {
    fontSize: 12,
    color: CC.textSecondary,
    marginTop: 2,
  },
  sessionsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sessionInfo: {},
  sessionDevice: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  sessionMeta: {
    fontSize: 12,
    color: CC.textSecondary,
    marginTop: 2,
  },
  sessionDivider: {
    height: 1,
    backgroundColor: '#f0eadf',
    marginVertical: 10,
  },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.3)',
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  disconnectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C0392B',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CC.errorBg,
    borderRadius: 100,
    paddingVertical: 15,
    marginBottom: 8,
  },
  logoutBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#C0392B',
  },
});
