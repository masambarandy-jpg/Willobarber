import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { CameraIcon, LockIcon, LogOutIcon, TrashIcon, ArrowRightIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useCoiffeurProfile } from '@/contexts/CoiffeurProfileContext';

const API_BASE_URL = 'https://willobarber-production-6951.up.railway.app';

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
  placeholder,
  keyboardType,
  maxLength,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  half?: boolean;
  multiline?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={[styles.field, half && styles.fieldHalf]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={CC.textSecondary}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function ProfilTab() {
  const { profile, updateProfile } = useCoiffeurProfile();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [role, setRole] = useState(profile.role);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl);
  const [profilEnregistre, setProfilEnregistre] = useState(false);
  const [loadingProfil, setLoadingProfil] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfil, setSavingProfil] = useState(false);
  const [profilError, setProfilError] = useState('');
  // Distinct du profilError générique : ne doit s'afficher qu'après un refus
  // explicite de la permission photo suite à un clic sur le bouton caméra —
  // jamais au chargement de la page ni pour une autre erreur.
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('coiffeur_token');
        if (!token) throw new Error('no-token');
        const res = await fetch(`${API_BASE_URL}/api/auth/me/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`me-fetch-failed-${res.status}`);
        const data = await res.json();
        console.log('[PARAMÈTRES] GET /api/auth/me/ →', JSON.stringify(data));
        if (cancelled) return;
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setEmail(data.email ?? '');
        // Le backend (UserSerializer) renvoie 'phone' — on garde 'telephone' /
        // 'phone_number' en repli défensif au cas où le nom du champ change côté API.
        setPhone(data.phone ?? data.telephone ?? data.phone_number ?? '');
        setRole(data.role === 'barber' ? 'Gérant' : data.role ?? profile.role);
        setPhotoUrl(data.profile_picture ?? '');
      } catch (error) {
        console.log('ERREUR PARAMÈTRES — GET /api/auth/me/:', error);
        if (!cancelled) setProfilError("Impossible de charger votre profil — dernières données connues affichées.");
      } finally {
        if (!cancelled) setLoadingProfil(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enregistrerProfil = async () => {
    setSavingProfil(true);
    setProfilError('');
    try {
      const token = await AsyncStorage.getItem('coiffeur_token');
      if (!token) throw new Error('no-token');
      const res = await fetch(`${API_BASE_URL}/api/auth/me/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone }),
      });
      if (!res.ok) throw new Error(`update-failed-${res.status}`);
      const data = await res.json();
      console.log('[PARAMÈTRES] PATCH /api/auth/me/ →', JSON.stringify(data));
      const savedPhone = data.phone ?? data.telephone ?? data.phone_number ?? '';
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
      setPhone(savedPhone);
      updateProfile({ firstName: data.first_name ?? '', lastName: data.last_name ?? '', email, phone: savedPhone, role });
      setProfilEnregistre(true);
      setTimeout(() => setProfilEnregistre(false), 3000);
    } catch (error) {
      console.log('ERREUR PARAMÈTRES — PATCH /api/auth/me/:', error);
      setProfilError("Impossible d'enregistrer votre profil. Réessayez.");
    } finally {
      setSavingProfil(false);
    }
  };

  const choisirPhoto = async () => {
    setPermissionError(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionError(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const token = await AsyncStorage.getItem('coiffeur_token');
    if (!token) {
      setProfilError('Session gérant expirée — reconnectez-vous.');
      return;
    }

    const asset = result.assets[0];
    setUploadingPhoto(true);
    setProfilError('');
    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName || `profil-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);

      const res = await fetch(`${API_BASE_URL}/api/auth/me/photo/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error(`photo-upload-failed-${res.status}`);
      const data = await res.json();
      setPhotoUrl(data.profile_picture ?? '');
      updateProfile({ photoUrl: data.profile_picture ?? '' });
    } catch (error) {
      console.log('ERREUR PARAMÈTRES — upload photo:', error);
      setProfilError("Impossible d'envoyer la photo. Réessayez.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loadingProfil) {
    return (
      <View style={[styles.card, styles.profilLoadingCard]}>
        <ActivityIndicator color={CC.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {!!profilError && (
        <View style={styles.profilErrorBox}>
          <Text style={styles.profilErrorText}>{profilError}</Text>
        </View>
      )}
      {permissionError && (
        <View style={styles.profilErrorBox}>
          <Text style={styles.profilErrorText}>Autorisez l'accès à vos photos pour changer la photo de profil.</Text>
        </View>
      )}
      <View style={styles.avatarRow}>
        <View>
          <Avatar letter={(firstName ?? '').charAt(0).toUpperCase() || 'W'} size={64} photoUri={photoUrl || undefined} />
          <TouchableOpacity style={styles.cameraBtn} onPress={choisirPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? <ActivityIndicator size="small" color={CC.white} /> : <CameraIcon />}
          </TouchableOpacity>
        </View>
        <View>
          <Text style={styles.avatarName}>{firstName} {lastName}</Text>
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
        disabled={savingProfil}
        style={[styles.saveBtn, profilEnregistre && styles.saveBtnDone, savingProfil && { opacity: 0.7 }]}
      >
        {savingProfil ? (
          <ActivityIndicator size="small" color={CC.white} />
        ) : (
          <Text style={[styles.saveBtnText, profilEnregistre && styles.saveBtnTextDone]}>
            {profilEnregistre ? '✓ Profil enregistré !' : 'Enregistrer'}
          </Text>
        )}
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

type Carte = { id: string; brand: string; prefix: string; num: string; actif: boolean };

const DEFAULT_CARTES: Carte[] = [
  { id: '1', brand: 'Visa', prefix: 'Vi', num: '4582', actif: true },
  { id: '2', brand: 'Mastercard', prefix: 'Ma', num: '1190', actif: false },
];

const detecterBrand = (num: string) => {
  if (num.startsWith('4')) return { brand: 'Visa', prefix: 'Vi' };
  if (num.startsWith('5')) return { brand: 'Mastercard', prefix: 'Ma' };
  if (num.startsWith('3')) return { brand: 'Amex', prefix: 'Am' };
  return { brand: 'Carte', prefix: '??' };
};

const formatNumeroCarte = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 16);
  return digits.match(/.{1,4}/g)?.join(' ') ?? digits;
};

const formatExpiration = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

function PaiementTab() {
  const [commission, setCommission] = useState(4);
  const [cartes, setCartes] = useState<Carte[]>(DEFAULT_CARTES);

  const [ajouterCarteVisible, setAjouterCarteVisible] = useState(false);
  const [supprimerCarteId, setSupprimerCarteId] = useState<string | null>(null);

  const [titulaire, setTitulaire] = useState('');
  const [numeroCarte, setNumeroCarte] = useState('');
  const [expiration, setExpiration] = useState('');
  const [cvv, setCvv] = useState('');

  const definirPrincipale = (id: string) => {
    setCartes((prev) => prev.map((c) => ({ ...c, actif: c.id === id })));
  };

  const fermerAjoutCarte = () => {
    setAjouterCarteVisible(false);
    setTitulaire('');
    setNumeroCarte('');
    setExpiration('');
    setCvv('');
  };

  const ajouterCarte = () => {
    const digits = numeroCarte.replace(/\D/g, '');
    if (!titulaire || digits.length < 4) return;
    const { brand, prefix } = detecterBrand(digits);
    setCartes((prev) => [...prev, { id: Date.now().toString(), brand, prefix, num: digits.slice(-4), actif: false }]);
    fermerAjoutCarte();
  };

  const carteASupprimer = cartes.find((c) => c.id === supprimerCarteId);

  const confirmerSuppressionCarte = () => {
    setCartes((prev) => prev.filter((c) => c.id !== supprimerCarteId));
    setSupprimerCarteId(null);
  };

  const brandApercu = detecterBrand(numeroCarte.replace(/\D/g, ''));

  return (
    <>
      {cartes.map((carte) => (
        <View key={carte.id} style={styles.cardCompact}>
          <View style={styles.cardRow}>
            <View style={styles.cardLogo}>
              <Text style={styles.cardLogoText}>{carte.prefix}</Text>
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardName}>{carte.brand}</Text>
              <Text style={styles.cardNumber}>•••• {carte.num}</Text>
            </View>
            <View style={[styles.badge, carte.actif ? styles.badgeActif : styles.badgeSecondaire]}>
              <Text style={[styles.badgeText, carte.actif ? styles.badgeActifText : styles.badgeSecondaireText]}>
                {carte.actif ? 'Actif' : 'Secondaire'}
              </Text>
            </View>
          </View>
          <View style={[styles.cardActionsRow, carte.actif && styles.cardActionsRowEnd]}>
            {!carte.actif && (
              <TouchableOpacity onPress={() => definirPrincipale(carte.id)}>
                <Text style={styles.cardSetPrimaryText}>Définir comme principale</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cardDeleteBtn} onPress={() => setSupprimerCarteId(carte.id)}>
              <TrashIcon size={15} color={CC.errorText} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addCardBtn} onPress={() => setAjouterCarteVisible(true)}>
        <Text style={styles.addCardPlus}>+</Text>
        <Text style={styles.addCardText}>Ajouter une carte</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.commissionRow}>
          <Text style={styles.commissionLabel}>Commission plateforme</Text>
          <Text style={styles.commissionValue}>{commission}%</Text>
        </View>
        <Slider
          minimumValue={0}
          maximumValue={10}
          step={0.5}
          value={commission}
          onValueChange={setCommission}
          minimumTrackTintColor={CC.gold}
          maximumTrackTintColor={CC.trackBg}
          thumbTintColor={CC.gold}
          style={styles.sliderControl}
        />
        <View style={styles.sliderLabelsRow}>
          <Text style={styles.sliderLabel}>0%</Text>
          <Text style={styles.sliderLabel}>10%</Text>
        </View>
      </View>

      <Modal visible={ajouterCarteVisible} transparent animationType="slide" onRequestClose={fermerAjoutCarte}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter une carte</Text>
              <TouchableOpacity onPress={fermerAjoutCarte}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.brandPreviewRow}>
                <View style={styles.cardLogo}>
                  <Text style={styles.cardLogoText}>{brandApercu.prefix}</Text>
                </View>
                <Text style={styles.brandPreviewText}>{brandApercu.brand}</Text>
              </View>

              <Field label="TITULAIRE DE LA CARTE" value={titulaire} onChangeText={setTitulaire} />
              <Field
                label="NUMÉRO DE CARTE"
                value={numeroCarte}
                onChangeText={(t) => setNumeroCarte(formatNumeroCarte(t))}
                keyboardType="numeric"
                maxLength={19}
              />
              <View style={styles.row2}>
                <Field
                  label="DATE D'EXPIRATION"
                  value={expiration}
                  onChangeText={(t) => setExpiration(formatExpiration(t))}
                  placeholder="MM/AA"
                  maxLength={5}
                  half
                />
                <Field
                  label="CVV"
                  value={cvv}
                  onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="numeric"
                  maxLength={3}
                  secureTextEntry
                  half
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={fermerAjoutCarte}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmAddBtn} onPress={ajouterCarte}>
                <Text style={styles.confirmAddBtnText}>Ajouter la carte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!supprimerCarteId} transparent animationType="fade" onRequestClose={() => setSupprimerCarteId(null)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconWrap}>
              <TrashIcon size={22} color={CC.errorText} />
            </View>
            <Text style={styles.deleteTitle}>Supprimer cette carte ?</Text>
            <Text style={styles.deleteText}>
              {carteASupprimer?.brand} •••• {carteASupprimer?.num} sera retirée de votre compte.
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSupprimerCarteId(null)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmerSuppressionCarte}>
                <Text style={styles.deleteConfirmBtnText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

type Session = { id: string; device: string; when: string; current: boolean };

const DEFAULT_SESSIONS: Session[] = [
  { id: '1', device: 'MacBook Pro · Bruxelles', when: 'Maintenant', current: true },
  { id: '2', device: 'iPhone 15 · Bruxelles', when: 'il y a 2 h', current: false },
];

function SecuriteTab() {
  const [mdpActuel, setMdpActuel] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [mdpMisAJour, setMdpMisAJour] = useState(false);
  const [mdpErreur, setMdpErreur] = useState('');
  const [twoFactor, setTwoFactor] = useState(true);

  const [sessions, setSessions] = useState<Session[]>(DEFAULT_SESSIONS);
  const [sessionASupprimer, setSessionASupprimer] = useState<string | null>(null);
  const [deconnexionVisible, setDeconnexionVisible] = useState(false);

  const mettreAJourMdp = () => {
    if (!mdpActuel.trim()) {
      setMdpErreur('Veuillez entrer votre mot de passe actuel.');
      return;
    }
    if (nouveauMdp.length < 6) {
      setMdpErreur('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setMdpErreur('');
    setMdpMisAJour(true);
    setMdpActuel('');
    setNouveauMdp('');
    setTimeout(() => setMdpMisAJour(false), 3000);
  };

  const deconnecterSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setSessionASupprimer(null);
  };

  const sessionCible = sessions.find((s) => s.id === sessionASupprimer);

  return (
    <>
      <View style={styles.card}>
        <Field label="MOT DE PASSE ACTUEL" value={mdpActuel} onChangeText={setMdpActuel} secureTextEntry />
        <Field label="NOUVEAU MOT DE PASSE" value={nouveauMdp} onChangeText={setNouveauMdp} secureTextEntry />
        {!!mdpErreur && <Text style={styles.mdpErreurText}>{mdpErreur}</Text>}
        <TouchableOpacity
          onPress={mettreAJourMdp}
          style={[styles.saveBtn, mdpMisAJour && styles.saveBtnDone]}
        >
          <Text style={[styles.saveBtnText, mdpMisAJour && styles.saveBtnTextDone]}>
            {mdpMisAJour ? '✓ Mot de passe mis à jour !' : 'Mettre à jour'}
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
        {sessions.map((session, i) => (
          <View key={session.id}>
            {i > 0 && <View style={styles.sessionDivider} />}
            <View style={styles.sessionRow}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionDevice}>{session.device}</Text>
                <Text style={styles.sessionMeta}>{session.when}</Text>
              </View>
              {session.current ? (
                <View style={[styles.badge, styles.badgeActif]}>
                  <Text style={[styles.badgeText, styles.badgeActifText]}>Actuelle</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.disconnectBtn} onPress={() => setSessionASupprimer(session.id)}>
                  <Text style={styles.disconnectBtnText}>Déconnecter</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => setDeconnexionVisible(true)}>
        <LogOutIcon />
        <Text style={styles.logoutBtnText}>Déconnexion</Text>
      </TouchableOpacity>

      <Modal visible={!!sessionASupprimer} transparent animationType="fade" onRequestClose={() => setSessionASupprimer(null)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconWrap}>
              <LogOutIcon size={22} color={CC.errorText} />
            </View>
            <Text style={styles.deleteTitle}>Déconnecter cet appareil ?</Text>
            <Text style={styles.deleteText}>{sessionCible?.device} sera déconnecté immédiatement.</Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSessionASupprimer(null)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => sessionASupprimer && deconnecterSession(sessionASupprimer)}
              >
                <Text style={styles.deleteConfirmBtnText}>Déconnecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deconnexionVisible} transparent animationType="fade" onRequestClose={() => setDeconnexionVisible(false)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconWrap}>
              <ArrowRightIcon size={22} color={CC.errorText} />
            </View>
            <Text style={styles.deleteTitle}>Se déconnecter ?</Text>
            <Text style={styles.deleteText}>Vous serez redirigé vers la page de connexion.</Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeconnexionVisible(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => {
                  setDeconnexionVisible(false);
                  router.replace('/coiffeur');
                }}
              >
                <Text style={styles.deleteConfirmBtnText}>Se déconnecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  profilLoadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  profilErrorBox: {
    backgroundColor: CC.errorBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  profilErrorText: {
    fontSize: 12.5,
    color: CC.errorText,
    lineHeight: 18,
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
  mdpErreurText: {
    fontSize: 12.5,
    color: CC.errorText,
    marginTop: -8,
    marginBottom: 14,
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0eadf',
  },
  cardActionsRowEnd: {
    justifyContent: 'flex-end',
  },
  cardSetPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: CC.gold,
  },
  cardDeleteBtn: {
    padding: 4,
  },
  addCardBtn: {
    borderWidth: 1.5,
    borderColor: CC.gold,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  addCardPlus: {
    fontSize: 20,
    color: CC.gold,
  },
  addCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.gold,
  },
  brandPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  brandPreviewText: {
    fontSize: 15,
    fontWeight: '700',
    color: CC.black,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    backgroundColor: CC.white,
  },
  cancelBtnText: {
    fontWeight: '600',
    color: CC.black,
  },
  confirmAddBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 100,
    backgroundColor: CC.gold,
    alignItems: 'center',
  },
  confirmAddBtnText: {
    fontWeight: '700',
    color: CC.black,
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteCard: {
    backgroundColor: CC.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CC.errorBg,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 20,
    color: CC.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteText: {
    fontSize: 14,
    color: CC.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  deleteConfirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 100,
    backgroundColor: CC.errorText,
    alignItems: 'center',
  },
  deleteConfirmBtnText: {
    fontWeight: '600',
    color: CC.white,
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
  sliderControl: {
    width: '100%',
    height: 40,
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
