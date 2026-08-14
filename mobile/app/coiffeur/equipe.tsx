import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { ChatIcon, EditIcon, TrashIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';

const API_BASE_URL = 'https://willobarber-production-6951.up.railway.app';

type SlotState = 'ferme' | 'reserve' | 'dispo';
type Status = 'Actif' | 'Absent';

type TeamMember = {
  id: string;
  initial: string;
  name: string;
  role: string;
  status: Status;
  tags: string[];
  rdv: number;
  rating: string;
  exp: string;
  email: string;
  phone: string;
  am: SlotState[];
  pm: SlotState[];
};

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'willo',
    initial: 'W',
    name: 'Willo Diallo',
    role: 'Fondateur & Master Barber',
    status: 'Actif',
    tags: ['Fade', 'Texturé', 'Rasoir'],
    rdv: 124,
    rating: '5,0',
    exp: '30 ans',
    email: 'willo@willobarber.fr',
    phone: '06 45 78 29 70',
    am: ['reserve', 'reserve', 'dispo', 'dispo', 'reserve', 'reserve', 'ferme'],
    pm: ['dispo', 'dispo', 'reserve', 'reserve', 'dispo', 'dispo', 'ferme'],
  },
  {
    id: 'malik',
    initial: 'M',
    name: 'Malik Haddad',
    role: 'Barbier Senior',
    status: 'Actif',
    tags: ['Barbe', 'Rasage', 'Classique'],
    rdv: 96,
    rating: '4,9',
    exp: '12 ans',
    email: 'malik@willobarber.fr',
    phone: '06 32 11 45 67',
    am: ['ferme', 'dispo', 'reserve', 'reserve', 'dispo', 'reserve', 'reserve'],
    pm: ['ferme', 'reserve', 'dispo', 'ferme', 'reserve', 'dispo', 'ferme'],
  },
  {
    id: 'idris',
    initial: 'I',
    name: 'Idris Camara',
    role: 'Barbier & Coloriste',
    status: 'Absent',
    tags: ['Color', 'Crop', 'Soin'],
    rdv: 64,
    rating: '4,8',
    exp: '8 ans',
    email: 'idris@willobarber.fr',
    phone: '06 78 90 12 34',
    am: ['ferme', 'reserve', 'dispo', 'reserve', 'reserve', 'dispo', 'ferme'],
    pm: ['dispo', 'ferme', 'reserve', 'dispo', 'ferme', 'reserve', 'dispo'],
  },
];

const EMPTY_EDIT_FORM = { name: '', role: '', email: '', phone: '', status: 'Actif' as Status };
const EMPTY_ADD_FORM = { name: '', role: '', email: '', phone: '', tag1: '', tag2: '', tag3: '', status: 'Actif' as Status };

// Réel : GET/PATCH/POST/DELETE /api/barbers/ → id, name, role, status, email,
// phone, specialties (pas de rdv/rating/exp/am/pm côté API — ces stats
// d'aperçu restent locales, cf. LOCAL_STATS_BY_NAME ci-dessous).
type ApiBarber = {
  id: number;
  name: string;
  role: string;
  status: Status;
  email: string;
  phone: string;
  specialties: string[];
};

type LocalStats = Pick<TeamMember, 'rdv' | 'rating' | 'exp' | 'am' | 'pm'>;

const LOCAL_STATS_BY_NAME: Record<string, LocalStats> = {
  'Willo Diallo': {
    rdv: 124, rating: '5,0', exp: '30 ans',
    am: ['reserve', 'reserve', 'dispo', 'dispo', 'reserve', 'reserve', 'ferme'],
    pm: ['dispo', 'dispo', 'reserve', 'reserve', 'dispo', 'dispo', 'ferme'],
  },
  'Malik Haddad': {
    rdv: 96, rating: '4,9', exp: '12 ans',
    am: ['ferme', 'dispo', 'reserve', 'reserve', 'dispo', 'reserve', 'reserve'],
    pm: ['ferme', 'reserve', 'dispo', 'ferme', 'reserve', 'dispo', 'ferme'],
  },
  'Idris Camara': {
    rdv: 64, rating: '4,8', exp: '8 ans',
    am: ['ferme', 'reserve', 'dispo', 'reserve', 'reserve', 'dispo', 'ferme'],
    pm: ['dispo', 'ferme', 'reserve', 'dispo', 'ferme', 'reserve', 'dispo'],
  },
};
const DEFAULT_STATS: LocalStats = {
  rdv: 0, rating: '—', exp: '—',
  am: Array(7).fill('dispo') as SlotState[],
  pm: Array(7).fill('dispo') as SlotState[],
};

function mapApiBarber(b: ApiBarber): TeamMember {
  const stats = LOCAL_STATS_BY_NAME[b.name] ?? DEFAULT_STATS;
  return {
    id: String(b.id),
    initial: (b.name ?? '').charAt(0).toUpperCase() || '?',
    name: b.name,
    role: b.role,
    status: b.status,
    tags: b.specialties ?? [],
    email: b.email ?? '',
    phone: b.phone ?? '',
    ...stats,
  };
}

// Le fondateur (WilloBarber) doit toujours apparaître en premier dans la liste.
function trierFondateurEnPremier(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    const aFondateur = a.role === 'Fondateur & Master Barber' ? 0 : 1;
    const bFondateur = b.role === 'Fondateur & Master Barber' ? 0 : 1;
    return aFondateur - bFondateur;
  });
}

function slotColor(state: SlotState) {
  if (state === 'reserve') return { backgroundColor: CC.gold, borderWidth: 0 };
  if (state === 'ferme') return { backgroundColor: '#e5ddd0', borderWidth: 0 };
  return { backgroundColor: CC.white, borderWidth: 1, borderColor: CC.inputBorder };
}

export default function CoiffeurEquipeScreen() {
  const isTablet = useIsTablet();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [usingMockTeam, setUsingMockTeam] = useState(false);

  // undefined = pas encore lu dans AsyncStorage, null = lu mais absent, string = token trouvé
  const [token, setToken] = useState<string | null | undefined>(undefined);

  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [memberPourMessage, setMemberPourMessage] = useState<TeamMember | null>(null);
  const [message, setMessage] = useState('');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [memberEnEdition, setMemberEnEdition] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState('');
  const [savingMembre, setSavingMembre] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [memberASupprimer, setMemberASupprimer] = useState<TeamMember | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deletingMembre, setDeletingMembre] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addError, setAddError] = useState('');
  const [addingMembre, setAddingMembre] = useState(false);

  // Le token du gérant est stocké sous 'coiffeur_token' (cf. app/coiffeur/index.tsx)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await AsyncStorage.getItem('coiffeur_token');
      if (!cancelled) setToken(t);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchTeam = useCallback(async (authToken: string | null) => {
    setLoadingTeam(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/barbers/`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      const data = await res.json().catch(() => null);
      console.log('ÉQUIPE — GET /api/barbers/ statut:', res.status, 'données:', JSON.stringify(data));
      if (!res.ok || !Array.isArray(data)) throw new Error(`fetch-team-failed-${res.status}`);
      setTeam(trierFondateurEnPremier(data.map(mapApiBarber)));
      setUsingMockTeam(false);
    } catch (error) {
      console.log('ERREUR ÉQUIPE — fallback données démo:', error);
      setTeam(INITIAL_TEAM);
      setUsingMockTeam(true);
    } finally {
      setLoadingTeam(false);
    }
  }, []);

  // On attend que le token soit lu dans AsyncStorage (undefined = pas encore lu)
  // avant de lancer le fetch, pour être sûr d'envoyer le header Authorization.
  useEffect(() => {
    if (token === undefined) return;
    fetchTeam(token);
  }, [token, fetchTeam]);

  const ouvrirChat = (member: TeamMember) => {
    setMemberPourMessage(member);
    setMessage('');
    setChatModalVisible(true);
  };

  const fermerChat = () => {
    setChatModalVisible(false);
    setMemberPourMessage(null);
    setMessage('');
  };

  const envoyerMessage = () => {
    if (!memberPourMessage) return;
    Alert.alert(`Message envoyé à ${memberPourMessage.name} !`);
    fermerChat();
  };

  const ouvrirEdition = (member: TeamMember) => {
    setMemberEnEdition(member);
    setEditForm({ name: member.name, role: member.role, email: member.email, phone: member.phone, status: member.status });
    setEditError('');
    setEditModalVisible(true);
  };

  const updateEditField = (key: 'name' | 'role' | 'email' | 'phone', value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const fermerEdition = () => {
    if (savingMembre) return;
    setEditModalVisible(false);
    setMemberEnEdition(null);
    setEditError('');
  };

  const sauvegarderMembre = async () => {
    if (!memberEnEdition) return;
    const name = editForm.name.trim();
    if (!name) {
      setEditError('Le nom est obligatoire.');
      return;
    }
    if (!token) {
      setEditError('Session gérant expirée — reconnectez-vous.');
      return;
    }

    setSavingMembre(true);
    setEditError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/barbers/${memberEnEdition.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          role: editForm.role.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          status: editForm.status,
        }),
      });
      const data = await res.json().catch(() => null);
      console.log(`ÉQUIPE — PATCH /api/barbers/${memberEnEdition.id}/ statut:`, res.status, 'réponse:', JSON.stringify(data));
      if (!res.ok) {
        const apiMessage = data ? Object.values(data).flat().join(' ') : '';
        throw new Error(apiMessage || `Erreur ${res.status}`);
      }
      // On reconstruit la ligne à partir de la réponse API (pas du formulaire local)
      // pour être sûr d'afficher ce qui a réellement été persisté côté serveur.
      const updated = mapApiBarber(data);
      setTeam((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      fermerEdition();
    } catch (error) {
      console.log('ERREUR ÉQUIPE — sauvegarde:', error);
      setEditError(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSavingMembre(false);
    }
  };

  const demanderSuppression = (member: TeamMember) => {
    setMemberASupprimer(member);
    setDeleteError('');
    setDeleteModalVisible(true);
  };

  const fermerSuppression = () => {
    if (deletingMembre) return;
    setDeleteModalVisible(false);
    setMemberASupprimer(null);
    setDeleteError('');
  };

  const confirmerSuppression = async () => {
    if (!memberASupprimer) return;
    if (!token) {
      setDeleteError('Session gérant expirée — reconnectez-vous.');
      return;
    }

    setDeletingMembre(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/barbers/${memberASupprimer.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`ÉQUIPE — DELETE /api/barbers/${memberASupprimer.id}/ statut:`, res.status);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setTeam((prev) => prev.filter((m) => m.id !== memberASupprimer.id));
      setDeleteModalVisible(false);
      setMemberASupprimer(null);
    } catch (error) {
      console.log('ERREUR ÉQUIPE — suppression:', error);
      setDeleteError(error instanceof Error ? error.message : 'Erreur lors de la suppression.');
    } finally {
      setDeletingMembre(false);
    }
  };

  const updateAddField = (key: keyof typeof EMPTY_ADD_FORM, value: string) => {
    setAddForm((prev) => ({ ...prev, [key]: value }));
  };

  const fermerAjout = () => {
    if (addingMembre) return;
    setAddModalVisible(false);
    setAddForm(EMPTY_ADD_FORM);
    setAddError('');
  };

  const ajouterMembre = async () => {
    const name = addForm.name.trim();
    if (!name || !addForm.role.trim()) {
      setAddError('Le nom et le rôle sont obligatoires.');
      return;
    }
    if (!token) {
      setAddError('Session gérant expirée — reconnectez-vous.');
      return;
    }

    const tags = [addForm.tag1, addForm.tag2, addForm.tag3].map((t) => t.trim()).filter(Boolean);

    setAddingMembre(true);
    setAddError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/barbers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          role: addForm.role.trim(),
          status: addForm.status,
          email: addForm.email.trim(),
          phone: addForm.phone.trim(),
          specialties: tags,
        }),
      });
      const data = await res.json().catch(() => null);
      console.log('ÉQUIPE — POST /api/barbers/ statut:', res.status, 'réponse:', JSON.stringify(data));
      if (!res.ok) {
        const apiMessage = data ? Object.values(data).flat().join(' ') : '';
        throw new Error(apiMessage || `Erreur ${res.status}`);
      }
      setTeam((prev) => [...prev, mapApiBarber(data)]);
      fermerAjout();
    } catch (error) {
      console.log('ERREUR ÉQUIPE — ajout:', error);
      setAddError(error instanceof Error ? error.message : "Erreur lors de l'ajout.");
    } finally {
      setAddingMembre(false);
    }
  };

  return (
    <>
      <CoiffeurScreen active="equipe">
        <View style={styles.headerRow}>
          <Text style={styles.title}>Équipe</Text>
          <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Ajouter un équipier</Text>
          </TouchableOpacity>
        </View>

        {usingMockTeam && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerText}>
              ⚠️ Aperçu de démonstration — API indisponible, données fictives affichées.
            </Text>
          </View>
        )}

        {loadingTeam ? (
          <ActivityIndicator color={CC.gold} size="large" style={{ marginTop: 40 }} />
        ) : (
        <View style={isTablet && styles.teamGrid}>
        {team.map((m) => {
          const stats = [
            { value: String(m.rdv), label: 'RDV/mois' },
            { value: m.rating, label: 'Note' },
            { value: m.exp, label: 'Expérience' },
          ];
          return (
            <View key={m.id} style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.topRow}>
                <Avatar letter={m.initial} size={56} />
                <View style={styles.identity}>
                  <Text style={styles.name}>{m.name}</Text>
                  <Text style={styles.role}>{m.role}</Text>
                </View>
                <View style={[styles.statusBadge, m.status === 'Actif' ? styles.statusActif : styles.statusAbsent]}>
                  <Text style={[styles.statusText, m.status === 'Actif' ? styles.statusActifText : styles.statusAbsentText]}>
                    {m.status}
                  </Text>
                </View>
              </View>

              <View style={styles.tagsRow}>
                {m.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                {stats.map((s) => (
                  <View key={s.label} style={styles.statColumn}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.availLabel}>DISPONIBILITÉ — SEMAINE</Text>
              <View style={styles.availGrid}>
                {DAYS.map((day, i) => (
                  <View key={i} style={styles.availCol}>
                    <Text style={styles.availDayLabel}>{day}</Text>
                    <View style={[styles.slot, slotColor(m.am[i])]} />
                    <View style={[styles.slot, slotColor(m.pm[i])]} />
                  </View>
                ))}
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.planningBtn} onPress={() => router.push('/coiffeur/planning')}>
                  <Text style={styles.planningBtnText}>Planning</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.circleBtn} onPress={() => ouvrirChat(m)}>
                  <ChatIcon size={16} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.circleBtn} onPress={() => ouvrirEdition(m)}>
                  <EditIcon size={15} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.circleBtn, styles.circleBtnDanger]} onPress={() => demanderSuppression(m)}>
                  <TrashIcon size={15} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        </View>
        )}

        <View style={styles.legendCard}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: CC.white, borderWidth: 1, borderColor: CC.inputBorder }]} />
            <Text style={styles.legendText}>Disponible</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: CC.gold }]} />
            <Text style={styles.legendText}>Réservé</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#e5ddd0' }]} />
            <Text style={styles.legendText}>Fermé</Text>
          </View>
        </View>
      </CoiffeurScreen>

      <Modal visible={chatModalVisible} transparent animationType="fade" onRequestClose={fermerChat}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.chatTitleWrap}>
              <Text style={styles.modalTitle}>Envoyer un message</Text>
              <Text style={styles.chatSubName}>{memberPourMessage?.name}</Text>
            </View>

            {memberPourMessage && (
              <View style={styles.chatAvatarWrap}>
                <Avatar letter={memberPourMessage.initial} size={64} />
              </View>
            )}

            <TextInput
              value={message}
              onChangeText={setMessage}
              style={styles.messageInput}
              placeholder="Écrivez votre message..."
              placeholderTextColor={CC.textSecondary}
              multiline
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={fermerChat}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={envoyerMessage}>
                <Text style={styles.confirmBtnText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType={isTablet ? 'fade' : 'slide'} onRequestClose={fermerEdition}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={[styles.editOverlay, isTablet && styles.editOverlayTablet]}>
          <View style={[styles.editCard, isTablet && styles.editCardTablet, styles.editCardMaxHeight]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.editTitle}>Modifier le membre</Text>

            {memberEnEdition && (
              <View style={styles.editAvatarWrap}>
                <Avatar letter={memberEnEdition.initial} size={56} />
              </View>
            )}

            <Text style={styles.fieldLabel}>NOM COMPLET</Text>
            <TextInput
              value={editForm.name}
              onChangeText={(v) => updateEditField('name', v)}
              style={styles.input}
              placeholder="Nom complet"
              placeholderTextColor={CC.textSecondary}
            />

            <Text style={styles.fieldLabel}>RÔLE</Text>
            <TextInput
              value={editForm.role}
              onChangeText={(v) => updateEditField('role', v)}
              style={styles.input}
              placeholder="Barbier"
              placeholderTextColor={CC.textSecondary}
            />

            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={editForm.email}
              onChangeText={(v) => updateEditField('email', v)}
              style={styles.input}
              placeholder="email@exemple.com"
              placeholderTextColor={CC.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>TÉLÉPHONE</Text>
            <TextInput
              value={editForm.phone}
              onChangeText={(v) => updateEditField('phone', v)}
              style={styles.input}
              placeholder="06 00 00 00 00"
              placeholderTextColor={CC.textSecondary}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>STATUT</Text>
            <View style={styles.statusToggleRow}>
              {(['Actif', 'Absent'] as Status[]).map((status) => {
                const active = editForm.status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusToggleItem, active && statusToggleActiveStyle(status)]}
                    onPress={() => setEditForm((prev) => ({ ...prev, status }))}
                  >
                    <Text style={[styles.statusToggleText, active && statusToggleActiveTextStyle(status)]}>{status}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!!editError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{editError}</Text>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={fermerEdition} disabled={savingMembre}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, savingMembre && styles.btnDisabled]}
                onPress={sauvegarderMembre}
                disabled={savingMembre}
              >
                <Text style={styles.confirmBtnText}>{savingMembre ? 'Enregistrement…' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={fermerSuppression}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconWrap}>
              <TrashIcon size={22} color={CC.errorText} />
            </View>

            <Text style={styles.deleteTitle}>Retirer {memberASupprimer?.name} de l’équipe ?</Text>
            <Text style={styles.deleteText}>Cette action est irréversible.</Text>

            {!!deleteError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={fermerSuppression} disabled={deletingMembre}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deletingMembre && styles.btnDisabled]}
                onPress={confirmerSuppression}
                disabled={deletingMembre}
              >
                <Text style={styles.deleteConfirmBtnText}>{deletingMembre ? 'Suppression…' : 'Retirer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={fermerAjout}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.addModalCard]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nouvel équipier</Text>

              <Text style={styles.fieldLabel}>NOM COMPLET</Text>
              <TextInput
                value={addForm.name}
                onChangeText={(v) => updateAddField('name', v)}
                style={styles.input}
                placeholder="Nom complet"
                placeholderTextColor={CC.textSecondary}
              />

              <Text style={styles.fieldLabel}>RÔLE</Text>
              <TextInput
                value={addForm.role}
                onChangeText={(v) => updateAddField('role', v)}
                style={styles.input}
                placeholder="Barbier"
                placeholderTextColor={CC.textSecondary}
              />

              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                value={addForm.email}
                onChangeText={(v) => updateAddField('email', v)}
                style={styles.input}
                placeholder="email@exemple.com"
                placeholderTextColor={CC.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.fieldLabel}>TÉLÉPHONE</Text>
              <TextInput
                value={addForm.phone}
                onChangeText={(v) => updateAddField('phone', v)}
                style={styles.input}
                placeholder="06 00 00 00 00"
                placeholderTextColor={CC.textSecondary}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>SPÉCIALITÉS</Text>
              <TextInput
                value={addForm.tag1}
                onChangeText={(v) => updateAddField('tag1', v)}
                style={styles.input}
                placeholder="Spécialité 1"
                placeholderTextColor={CC.textSecondary}
              />
              <TextInput
                value={addForm.tag2}
                onChangeText={(v) => updateAddField('tag2', v)}
                style={styles.input}
                placeholder="Spécialité 2"
                placeholderTextColor={CC.textSecondary}
              />
              <TextInput
                value={addForm.tag3}
                onChangeText={(v) => updateAddField('tag3', v)}
                style={styles.input}
                placeholder="Spécialité 3"
                placeholderTextColor={CC.textSecondary}
              />

              <Text style={styles.fieldLabel}>STATUT</Text>
              <View style={styles.statusToggleRow}>
                {(['Actif', 'Absent'] as Status[]).map((status) => {
                  const active = addForm.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.statusToggleItem, active && statusToggleActiveStyle(status)]}
                      onPress={() => setAddForm((prev) => ({ ...prev, status }))}
                    >
                      <Text style={[styles.statusToggleText, active && statusToggleActiveTextStyle(status)]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!!addError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{addError}</Text>
                </View>
              )}

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={fermerAjout} disabled={addingMembre}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, addingMembre && styles.btnDisabled]}
                  onPress={ajouterMembre}
                  disabled={addingMembre}
                >
                  <Text style={styles.confirmBtnText}>{addingMembre ? 'Ajout…' : 'Ajouter'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function statusToggleActiveStyle(status: Status) {
  if (status === 'Actif') return { backgroundColor: CC.successBg, borderColor: CC.successBg };
  return { backgroundColor: CC.errorBg, borderColor: CC.errorBg };
}

function statusToggleActiveTextStyle(status: Status) {
  if (status === 'Actif') return { color: CC.successText };
  return { color: CC.errorText };
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  mockBanner: {
    backgroundColor: CC.errorBg,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  mockBannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: CC.errorText,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
  },
  addBtn: {
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 11,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: {
    color: CC.white,
    fontWeight: '600',
    fontSize: 14,
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTablet: {
    width: '48%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
  },
  role: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusActif: {
    backgroundColor: CC.successBg,
  },
  statusAbsent: {
    backgroundColor: CC.errorBg,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statusActifText: {
    color: CC.successText,
  },
  statusAbsentText: {
    color: CC.errorText,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: 'rgba(201,168,76,0.13)',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: CC.goldDark,
  },
  divider: {
    height: 1,
    backgroundColor: CC.border,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
  },
  statLabel: {
    fontSize: 10,
    color: CC.textSecondary,
    marginTop: 2,
  },
  availLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  availGrid: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 18,
  },
  availCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  availDayLabel: {
    fontSize: 10,
    color: CC.textSecondary,
    marginBottom: 2,
  },
  slot: {
    width: '100%',
    height: 16,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planningBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 11,
    alignItems: 'center',
  },
  planningBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: CC.black,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnDanger: {
    borderColor: 'rgba(192,57,43,0.3)',
  },
  legendCard: {
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12.5,
    color: CC.black,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: CC.cream,
    borderRadius: 20,
    padding: 22,
  },
  addModalCard: {
    maxHeight: '85%',
  },
  modalTitle: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
    marginBottom: 18,
  },
  chatTitleWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  chatSubName: {
    fontSize: 13.5,
    color: CC.textSecondary,
    marginTop: -12,
    marginBottom: 14,
  },
  chatAvatarWrap: {
    alignSelf: 'center',
    marginBottom: 18,
  },
  messageInput: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 12,
    minHeight: 120,
    padding: 13,
    fontSize: 14,
    color: CC.black,
    textAlignVertical: 'top',
    marginBottom: 6,
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
    borderColor: CC.inputBorder,
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    color: CC.black,
    marginBottom: 14,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusToggleItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    backgroundColor: CC.white,
  },
  statusToggleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: CC.textSecondary,
  },
  errorBox: {
    backgroundColor: CC.errorBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CC.errorText,
    padding: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: CC.errorText,
    lineHeight: 18,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: CC.white,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editCard: {
    backgroundColor: CC.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  editCardMaxHeight: {
    maxHeight: '90%',
  },
  editOverlayTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  editCardTablet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
  },
  editTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 22,
    color: CC.black,
    textAlign: 'center',
    marginBottom: 18,
  },
  editAvatarWrap: {
    alignSelf: 'center',
    marginBottom: 20,
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
});
