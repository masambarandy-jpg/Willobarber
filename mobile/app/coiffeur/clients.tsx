import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { EditIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

type Badge = 'VIP' | 'Nouveau' | 'Inactif' | null;

type Client = {
  letter: string;
  name: string;
  badge: Badge;
  email: string;
  rdv: number;
  last: string;
  total: string;
};

const INITIAL_CLIENTS: Client[] = [
  { letter: 'A', name: 'Antoine Rivière', badge: 'VIP', email: 'antoine.r@gmail.com', rdv: 12, last: '28 avr.', total: '540€' },
  { letter: 'K', name: 'Karim Benali', badge: 'VIP', email: 'karim.b@gmail.com', rdv: 18, last: '2 mai', total: '720€' },
  { letter: 'L', name: 'Léo Martin', badge: 'Nouveau', email: 'leo.martin@gmail.com', rdv: 1, last: '30 mai', total: '45€' },
  { letter: 'N', name: 'Noé Vasseur', badge: 'Nouveau', email: 'noe.v@gmail.com', rdv: 2, last: '21 mai', total: '63€' },
  { letter: 'T', name: 'Thomas Leroy', badge: 'Inactif', email: 'thomas.l@gmail.com', rdv: 6, last: '12 nov.', total: '310€' },
  { letter: 'M', name: 'Marc Dubois', badge: null, email: 'marc.d@gmail.com', rdv: 4, last: '8 avr.', total: '180€' },
];

const TABS = ['Tous', 'VIP', 'Nouveaux', 'Inactifs'] as const;
const TAB_TO_BADGE: Record<(typeof TABS)[number], Badge | 'ALL'> = {
  Tous: 'ALL',
  VIP: 'VIP',
  Nouveaux: 'Nouveau',
  Inactifs: 'Inactif',
};

const EMPTY_FORM = { firstName: '', lastName: '', email: '', phone: '' };

export default function CoiffeurClientsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Tous');
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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
      letter: form.firstName.trim().charAt(0).toUpperCase(),
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      badge: 'Nouveau',
      email: form.email.trim(),
      rdv: 0,
      last: '—',
      total: '0€',
    };

    setClients((prev) => [newClient, ...prev]);
    closeModal();
  };

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

        {filtered.map((c, i) => (
          <View key={`${c.name}-${i}`} style={styles.clientCard}>
            <View style={styles.clientTopRow}>
              <Avatar letter={c.letter} size={42} />
              <Text style={styles.clientName}>{c.name}</Text>
              {c.badge && (
                <View style={[styles.badge, badgeStyle(c.badge)]}>
                  <Text style={[styles.badgeText, badgeTextStyle(c.badge)]}>{c.badge}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.editBtn}>
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
          </View>
        ))}
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
    </>
  );
}

function badgeStyle(badge: Exclude<Badge, null>) {
  if (badge === 'VIP') return { backgroundColor: CC.vipBg };
  if (badge === 'Nouveau') return { backgroundColor: CC.successBg };
  return { backgroundColor: CC.errorBg };
}

function badgeTextStyle(badge: Exclude<Badge, null>) {
  if (badge === 'VIP') return { color: CC.vipText };
  if (badge === 'Nouveau') return { color: CC.successText };
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
    maxWidth: 420,
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
});
