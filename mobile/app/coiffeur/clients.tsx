import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { API_BASE_URL } from '@/constants';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { EditIcon, MailIcon, PhoneIcon, PersonIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';
import { useClientMedia } from '@/hooks/useClientMedia';
import ClientMediaGrid from '@/components/media/ClientMediaGrid';
import AddMediaButton from '@/components/media/AddMediaButton';

type Badge = 'VIP' | 'Nouveau' | 'Fidèle' | 'Inactif' | null;

type Client = {
  id: number;
  letter: string;
  name: string;
  badge: Badge;
  email: string;
  phone: string;
  rdv: number;
  last: string;
  total: string;
};

type ApiClient = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  total_reservations: number;
  last_visit: string | null;
  total_spent: number;
  status: string;
};

function badgeFromReservations(count: number): Badge {
  if (count >= 10) return 'VIP';
  if (count === 1) return 'Nouveau';
  return 'Fidèle';
}

function mapApiClient(c: ApiClient): Client {
  const firstName = (c.first_name ?? '').trim();
  const lastName = (c.last_name ?? '').trim();
  const name = `${firstName} ${lastName}`.trim() || c.email;

  return {
    id: c.id,
    letter: (firstName || name).charAt(0).toUpperCase() || '?',
    name,
    badge: badgeFromReservations(c.total_reservations),
    email: c.email ?? '',
    phone: c.phone ?? '',
    rdv: c.total_reservations,
    last: c.last_visit ? format(new Date(c.last_visit), 'd MMM', { locale: fr }) : '—',
    total: `${Math.round(c.total_spent)}€`,
  };
}

const TABS = ['Tous', 'VIP', 'Nouveaux', 'Fidèles', 'Inactifs'] as const;
const TAB_TO_BADGE: Record<(typeof TABS)[number], Badge | 'ALL'> = {
  Tous: 'ALL',
  VIP: 'VIP',
  Nouveaux: 'Nouveau',
  Fidèles: 'Fidèle',
  Inactifs: 'Inactif',
};

const EMPTY_FORM = { firstName: '', lastName: '', email: '', phone: '' };

type EditBadge = 'VIP' | 'Nouveau' | 'Fidèle' | 'Inactif' | '';
const EMPTY_EDIT_FORM = { name: '', email: '', phone: '', badge: '' as EditBadge };
const BADGE_OPTIONS: Exclude<EditBadge, ''>[] = ['VIP', 'Nouveau', 'Fidèle', 'Inactif'];

export default function CoiffeurClientsScreen() {
  const isTablet = useIsTablet();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Tous');
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [clientEnEdition, setClientEnEdition] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [panelEditing, setPanelEditing] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const { media, isLoading: mediaLoading, isUploading, upload } = useClientMedia(clientEnEdition?.id ?? null);

  const fetchClients = useCallback(async () => {
    setIsLoadingClients(true);
    setLoadError(null);
    try {
      const token = await AsyncStorage.getItem('coiffeur_token');
      if (!token) {
        console.log('[CLIENTS] aucun coiffeur_token en AsyncStorage');
        setLoadError('Impossible de charger les clients');
        return;
      }

      const url = `${API_BASE_URL}/clients/`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const bodyText = await res.text();
      console.log('[CLIENTS] GET', url, '→', res.status, bodyText);

      if (!res.ok) {
        setLoadError('Impossible de charger les clients');
        return;
      }

      const data: ApiClient[] = JSON.parse(bodyText);
      setClients(data.map(mapApiClient));
    } catch (e) {
      console.log('[CLIENTS] fetch error', e);
      setLoadError('Impossible de charger les clients');
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filter = TAB_TO_BADGE[activeTab];
  const filtered = filter === 'ALL' ? clients : clients.filter((c) => c.badge === filter);

  const updateField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeModal = () => {
    setForm(EMPTY_FORM);
    setModalVisible(false);
  };

  const handleAddClient = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;

    const newClient: Client = {
      id: Date.now(),
      letter: (form.firstName ?? '').trim().charAt(0).toUpperCase(),
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      badge: 'Nouveau',
      email: form.email.trim(),
      phone: form.phone.trim(),
      rdv: 0,
      last: '—',
      total: '0€',
    };

    setClients((prev) => [newClient, ...prev]);
    closeModal();
  };

  const fillEditForm = (client: Client) => {
    setClientEnEdition(client);
    setEditForm({ name: client.name, email: client.email, phone: client.phone, badge: client.badge || '' });
  };

  const selectClient = (client: Client) => {
    fillEditForm(client);
    setPanelEditing(false);
    if (!isTablet) setDetailModalVisible(true);
  };

  const ouvrirEdition = (client: Client) => {
    fillEditForm(client);
    if (isTablet) {
      setPanelEditing(true);
    } else {
      setEditModalVisible(true);
    }
  };

  const updateEditField = (key: 'name' | 'email' | 'phone', value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setClientEnEdition(null);
  };

  const fermerPanelEdition = () => {
    if (clientEnEdition) fillEditForm(clientEnEdition);
    setPanelEditing(false);
  };

  const sauvegarderClient = () => {
    if (!clientEnEdition) return;
    const name = editForm.name.trim();
    const updated: Client = {
      ...clientEnEdition,
      name,
      letter: (name ?? '').charAt(0).toUpperCase() || clientEnEdition.letter,
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      badge: editForm.badge || null,
    };

    setClients((prev) => prev.map((c) => (c.id === clientEnEdition.id ? updated : c)));

    if (isTablet) {
      setClientEnEdition(updated);
      setPanelEditing(false);
    } else {
      closeEditModal();
    }
  };

  useEffect(() => {
    if (isTablet && !clientEnEdition && clients.length) {
      selectClient(clients[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, clients]);

  const handlePickMedia = async (file: any) => {
    await upload(file);
  };

  const mediaSection = (
    <>
      <View style={styles.detailDivider} />
      <View style={styles.mediaHeaderRow}>
        <Text style={styles.mediaTitle}>Photos & vidéos</Text>
        <AddMediaButton
          label="📸 Ajouter photo/vidéo"
          busy={isUploading}
          onPick={handlePickMedia}
          style={styles.addMediaBtn}
          textStyle={styles.addMediaBtnText}
        />
      </View>
      <ClientMediaGrid
        media={media}
        isLoading={mediaLoading}
        emptyLabel="Aucune photo ou vidéo pour ce client."
        mutedColor={CC.textSecondary}
      />
    </>
  );

  const editFields = (
    <>
      <Text style={styles.fieldLabel}>NOM COMPLET</Text>
      <TextInput
        value={editForm.name}
        onChangeText={(v) => updateEditField('name', v)}
        style={styles.input}
        placeholder="Nom complet"
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
      <View style={styles.badgeToggleRow}>
        {BADGE_OPTIONS.map((option) => {
          const active = editForm.badge === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.badgeToggleItem, active && badgeToggleActiveStyle(option)]}
              onPress={() => setEditForm((prev) => ({ ...prev, badge: option }))}
            >
              <Text style={[styles.badgeToggleText, active && badgeToggleActiveTextStyle(option)]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  return (
    <>
      <CoiffeurScreen active="clients">
        <View style={styles.headerRow}>
          <Text style={styles.title}>Clients</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Ajouter un client</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardDark]}>
            <Text style={styles.statLabelDark}>CLIENTS TOTAUX</Text>
            <Text style={styles.statValueDark}>2 412</Text>
            <Text style={styles.statDeltaGreen}>+12% ce mois</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>NOUVEAUX</Text>
            <Text style={styles.statValue}>+38</Text>
            <Text style={styles.statSub}>ce mois</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>VIP</Text>
            <Text style={styles.statValue}>124</Text>
            <Text style={styles.statSub}>clients fidèles</Text>
          </View>
        </View>

        <View style={isTablet && styles.tabletRow}>
        <View style={isTablet ? styles.listColTablet : undefined}>
        <View style={styles.tabsRow}>
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
        </View>

        {isLoadingClients && clients.length === 0 && (
          <ActivityIndicator color={CC.gold} style={{ marginVertical: 24 }} />
        )}

        {loadError && !isLoadingClients && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchClients}>
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoadingClients && !loadError && filtered.map((c, i) => {
          const selected = isTablet && clientEnEdition?.name === c.name;
          return (
          <TouchableOpacity
            key={`${c.name}-${i}`}
            activeOpacity={0.6}
            onPress={() => selectClient(c)}
            style={[styles.clientCard, selected && styles.clientCardSelected]}
          >
            <View style={styles.clientTopRow}>
              <Avatar letter={c.letter} size={42} />
              <Text style={styles.clientName}>{c.name}</Text>
              {c.badge && (
                <View style={[styles.badge, badgeStyle(c.badge)]}>
                  <Text style={[styles.badgeText, badgeTextStyle(c.badge)]}>{c.badge}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.editBtn} onPress={() => ouvrirEdition(c)}>
                <EditIcon size={13} />
              </TouchableOpacity>
            </View>
            <Text style={styles.clientEmail}>{c.email}</Text>

            <View style={styles.divider} />

            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <Text style={styles.statColumnLabel}>RDV</Text>
                <Text style={styles.statColumnValue}>{c.rdv}</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={styles.statColumnLabel}>Dernière</Text>
                <Text style={styles.statColumnValue}>{c.last}</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={styles.statColumnLabel}>Total</Text>
                <Text style={styles.statColumnValue}>{c.total}</Text>
              </View>
            </View>
          </TouchableOpacity>
          );
        })}
        </View>

        {isTablet && (
          <View style={styles.detailColTablet}>
            {clientEnEdition ? (
              <View style={styles.detailPanel}>
                {panelEditing ? (
                  <>
                    <View style={styles.editAvatarWrap}>
                      <Avatar letter={clientEnEdition.letter} size={56} />
                    </View>

                    {editFields}

                    <View style={styles.modalActionsRow}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={fermerPanelEdition}>
                        <Text style={styles.cancelBtnText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmBtn} onPress={sauvegarderClient}>
                        <Text style={styles.confirmBtnText}>Enregistrer</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.detailAvatarWrap}>
                      <Avatar letter={clientEnEdition.letter} size={80} />
                    </View>
                    <Text style={styles.detailName}>{clientEnEdition.name}</Text>
                    {clientEnEdition.badge && (
                      <View style={[styles.badge, badgeStyle(clientEnEdition.badge), styles.detailBadge]}>
                        <Text style={[styles.badgeText, badgeTextStyle(clientEnEdition.badge)]}>
                          {clientEnEdition.badge}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailDivider} />

                    <View style={styles.detailContactBlock}>
                      <View style={styles.detailContactRow}>
                        <MailIcon size={16} color={CC.textSecondary} />
                        <Text style={styles.detailContactText}>{clientEnEdition.email}</Text>
                      </View>
                      <View style={styles.detailContactRow}>
                        <PhoneIcon size={16} color={CC.textSecondary} />
                        <Text style={styles.detailContactText}>{clientEnEdition.phone}</Text>
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailStatsRow}>
                      <View style={styles.detailStatCol}>
                        <Text style={styles.detailStatValue}>{clientEnEdition.rdv}</Text>
                        <Text style={styles.detailStatLabel}>RDV</Text>
                      </View>
                      <View style={styles.detailStatCol}>
                        <Text style={styles.detailStatValue}>{clientEnEdition.last}</Text>
                        <Text style={styles.detailStatLabel}>Dernière visite</Text>
                      </View>
                      <View style={styles.detailStatCol}>
                        <Text style={styles.detailStatValue}>{clientEnEdition.total}</Text>
                        <Text style={styles.detailStatLabel}>Total dépensé</Text>
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailActionsRow}>
                      <TouchableOpacity style={styles.detailEditBtn} onPress={() => setPanelEditing(true)}>
                        <EditIcon size={14} color={CC.black} />
                        <Text style={styles.detailEditBtnText}>Modifier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.detailCallBtn}>
                        <PhoneIcon size={18} color={CC.black} />
                      </TouchableOpacity>
                    </View>

                    {mediaSection}
                  </>
                )}
              </View>
            ) : (
              <View style={[styles.detailPanel, styles.detailEmptyPanel]}>
                <PersonIcon size={36} color={CC.textSecondary} />
                <Text style={styles.detailEmptyTitle}>Sélectionner un client</Text>
                <Text style={styles.detailEmptyText}>Cliquez sur un client pour voir ses détails</Text>
              </View>
            )}
          </View>
        )}
        </View>
      </CoiffeurScreen>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter un client</Text>

            <Text style={styles.fieldLabel}>PRÉNOM</Text>
            <TextInput
              value={form.firstName}
              onChangeText={(v) => updateField('firstName', v)}
              style={styles.input}
              placeholder="Prénom"
              placeholderTextColor={CC.textSecondary}
            />

            <Text style={styles.fieldLabel}>NOM</Text>
            <TextInput
              value={form.lastName}
              onChangeText={(v) => updateField('lastName', v)}
              style={styles.input}
              placeholder="Nom"
              placeholderTextColor={CC.textSecondary}
            />

            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={form.email}
              onChangeText={(v) => updateField('email', v)}
              style={styles.input}
              placeholder="email@exemple.com"
              placeholderTextColor={CC.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>TÉLÉPHONE</Text>
            <TextInput
              value={form.phone}
              onChangeText={(v) => updateField('phone', v)}
              style={styles.input}
              placeholder="06 00 00 00 00"
              placeholderTextColor={CC.textSecondary}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddClient}>
                <Text style={styles.confirmBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={closeEditModal}>
        <View style={styles.editOverlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Modifier le client</Text>

            {clientEnEdition && (
              <View style={styles.editAvatarWrap}>
                <Avatar letter={clientEnEdition.letter} size={56} />
              </View>
            )}

            {editFields}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeEditModal}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={sauvegarderClient}>
                <Text style={styles.confirmBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.editOverlay}>
          <ScrollView style={[styles.editCard, { maxHeight: '85%' }]}>
            {clientEnEdition && (
              <>
                <View style={styles.editAvatarWrap}>
                  <Avatar letter={clientEnEdition.letter} size={56} />
                </View>
                <Text style={[styles.detailName, { marginBottom: 4 }]}>{clientEnEdition.name}</Text>
                {clientEnEdition.badge && (
                  <View style={[styles.badge, badgeStyle(clientEnEdition.badge), styles.detailBadge]}>
                    <Text style={[styles.badgeText, badgeTextStyle(clientEnEdition.badge)]}>
                      {clientEnEdition.badge}
                    </Text>
                  </View>
                )}

                <View style={styles.detailDivider} />

                <View style={styles.detailContactBlock}>
                  <View style={styles.detailContactRow}>
                    <MailIcon size={16} color={CC.textSecondary} />
                    <Text style={styles.detailContactText}>{clientEnEdition.email}</Text>
                  </View>
                  <View style={styles.detailContactRow}>
                    <PhoneIcon size={16} color={CC.textSecondary} />
                    <Text style={styles.detailContactText}>{clientEnEdition.phone}</Text>
                  </View>
                </View>

                {mediaSection}

                <TouchableOpacity
                  style={[styles.cancelBtn, { marginTop: 18 }]}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Fermer</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function badgeStyle(badge: Exclude<Badge, null>) {
  if (badge === 'VIP') return { backgroundColor: CC.vipBg };
  if (badge === 'Nouveau') return { backgroundColor: CC.successBg };
  if (badge === 'Fidèle') return { backgroundColor: CC.grayBg };
  return { backgroundColor: CC.errorBg };
}

function badgeTextStyle(badge: Exclude<Badge, null>) {
  if (badge === 'VIP') return { color: CC.vipText };
  if (badge === 'Nouveau') return { color: CC.successText };
  if (badge === 'Fidèle') return { color: CC.grayText };
  return { color: CC.errorText };
}

function badgeToggleActiveStyle(badge: Exclude<EditBadge, ''>) {
  if (badge === 'VIP') return { backgroundColor: CC.vipBg, borderColor: CC.vipBg };
  if (badge === 'Nouveau') return { backgroundColor: CC.successBg, borderColor: CC.successBg };
  if (badge === 'Fidèle') return { backgroundColor: CC.grayBg, borderColor: CC.grayBg };
  return { backgroundColor: CC.errorBg, borderColor: CC.errorBg };
}

function badgeToggleActiveTextStyle(badge: Exclude<EditBadge, ''>) {
  if (badge === 'VIP') return { color: CC.vipText };
  if (badge === 'Nouveau') return { color: CC.successText };
  if (badge === 'Fidèle') return { color: CC.grayText };
  return { color: CC.errorText };
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 14,
  },
  statCardDark: {
    backgroundColor: CC.cardBlack,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  statLabelDark: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
  },
  statValueDark: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.white,
  },
  statSub: {
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: 2,
  },
  statDeltaGreen: {
    fontSize: 11,
    color: '#6fc191',
    marginTop: 2,
  },
  tabletRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  listColTablet: {
    width: '40%',
  },
  detailColTablet: {
    flex: 1,
    minWidth: 0,
  },
  detailPanel: {
    backgroundColor: CC.white,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailAvatarWrap: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailName: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 24,
    color: CC.black,
    textAlign: 'center',
    marginBottom: 6,
  },
  detailBadge: {
    alignSelf: 'center',
  },
  detailDivider: {
    height: 1,
    backgroundColor: CC.trackBg,
    marginVertical: 20,
  },
  detailContactBlock: {
    gap: 12,
  },
  detailContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailContactText: {
    fontSize: 14,
    color: CC.black,
    flexShrink: 1,
  },
  detailStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailStatCol: {
    alignItems: 'center',
  },
  detailStatValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.black,
  },
  detailStatLabel: {
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 14,
  },
  detailEditBtnText: {
    fontWeight: '700',
    color: CC.black,
    fontSize: 15,
  },
  detailCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailEmptyPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  detailEmptyTitle: {
    fontFamily: SERIF,
    fontSize: 18,
    color: CC.black,
    marginTop: 12,
    marginBottom: 6,
  },
  detailEmptyText: {
    fontSize: 14,
    color: CC.textSecondary,
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 14,
  },
  errorText: {
    fontSize: 14,
    color: CC.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  retryBtnText: {
    color: CC.white,
    fontWeight: '600',
    fontSize: 14,
  },
  tab: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: CC.black,
    borderColor: CC.black,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.textSecondary,
  },
  tabTextActive: {
    color: CC.white,
  },
  clientCard: {
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  clientCardSelected: {
    borderWidth: 1.5,
    borderColor: CC.gold,
  },
  clientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: CC.black,
    flex: 1,
  },
  badge: {
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientEmail: {
    fontSize: 11.5,
    color: CC.textSecondary,
    marginLeft: 52,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.2)',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statColumn: {
    flex: 1,
  },
  statColumnLabel: {
    fontSize: 11,
    color: CC.textSecondary,
    marginBottom: 3,
  },
  statColumnValue: {
    fontSize: 13.5,
    fontWeight: '700',
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
  modalTitle: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
    marginBottom: 18,
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
  badgeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  badgeToggleItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    backgroundColor: CC.white,
  },
  badgeToggleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: CC.textSecondary,
  },
  mediaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  mediaTitle: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 16,
    color: CC.black,
  },
  addMediaBtn: {
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  addMediaBtnText: {
    color: CC.white,
    fontWeight: '600',
    fontSize: 12.5,
  },
});
