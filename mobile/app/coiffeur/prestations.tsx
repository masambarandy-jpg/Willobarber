import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import { ScissorsIcon, ClockIcon, EditIcon, TrashIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';

type Category = 'Coupe' | 'Rasage' | 'Pack' | 'Soin';
type Status = 'Actif' | 'Brouillon';

type Service = {
  name: string;
  description: string;
  category: Category;
  duration: string;
  price: string;
  status: Status;
};

const SERVICES: Service[] = [
  { name: 'Signature WilloBarber', description: 'Coupe ciseaux & finition rasoir', category: 'Coupe', duration: '45 min', price: '45€', status: 'Actif' },
  { name: 'Taille & rasage à l’ancienne', description: 'Serviette chaude, rasoir droit', category: 'Rasage', duration: '30 min', price: '28€', status: 'Actif' },
  { name: 'Le Rituel', description: 'Coupe + barbe + soin', category: 'Pack', duration: '1h15', price: '75€', status: 'Actif' },
  { name: 'Coupe express', description: 'Version concentrée', category: 'Coupe', duration: '25 min', price: '28€', status: 'Actif' },
  { name: 'Camouflage gris', description: 'Pigmentation sans ammoniaque', category: 'Soin', duration: '40 min', price: '35€', status: 'Brouillon' },
  { name: 'Soin du visage', description: 'Gommage & masque argile', category: 'Soin', duration: '30 min', price: '32€', status: 'Actif' },
];

const CATEGORY_STYLE: Record<Category, { bg: string; text: string }> = {
  Coupe: { bg: '#3a2f12', text: '#C9A84C' },
  Rasage: { bg: '#1c2c3a', text: '#7ab6d8' },
  Pack: { bg: '#2c2340', text: '#b69ae0' },
  Soin: { bg: '#1d3328', text: '#6fc191' },
};

const TABS = ['Toutes', 'Coupes', 'Rasage', 'Soins', 'Packs'] as const;
const TAB_TO_CATEGORY: Record<string, Category | null> = {
  Toutes: null,
  Coupes: 'Coupe',
  Rasage: 'Rasage',
  Soins: 'Soin',
  Packs: 'Pack',
};

const EMPTY_EDIT_FORM = { name: '', description: '', price: '', duration: '', status: 'Actif' as Status };

export default function CoiffeurPrestationsScreen() {
  const isTablet = useIsTablet();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Toutes');
  const [services, setServices] = useState<Service[]>(SERVICES);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [serviceASupprimer, setServiceASupprimer] = useState<Service | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [serviceEnEdition, setServiceEnEdition] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const category = TAB_TO_CATEGORY[activeTab];
  const filtered = category ? services.filter((s) => s.category === category) : services;
  const avgPrice = Math.round(
    services.reduce((sum, s) => sum + parseInt(s.price, 10), 0) / services.length
  );

  const demanderSuppression = (service: Service) => {
    setServiceASupprimer(service);
    setDeleteModalVisible(true);
  };

  const confirmerSuppression = () => {
    if (serviceASupprimer) {
      setServices((prev) => prev.filter((s) => s.name !== serviceASupprimer.name));
    }
    setDeleteModalVisible(false);
    setServiceASupprimer(null);
  };

  const ouvrirEdition = (service: Service) => {
    setServiceEnEdition(service);
    setEditForm({
      name: service.name,
      description: service.description,
      price: service.price,
      duration: service.duration,
      status: service.status,
    });
    setEditModalVisible(true);
  };

  const updateEditField = (key: keyof typeof EMPTY_EDIT_FORM, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const sauvegarderModification = () => {
    if (!serviceEnEdition) return;
    setServices((prev) =>
      prev.map((s) => (s.name === serviceEnEdition.name ? { ...s, ...editForm } : s))
    );
    setEditModalVisible(false);
    setServiceEnEdition(null);
  };

  return (
    <>
    <CoiffeurScreen active="prestations">
      <Text style={styles.title}>Prestations</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL</Text>
          <Text style={styles.statValue}>{services.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>PRIX MOYEN</Text>
          <Text style={styles.statValue}>{avgPrice}€</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOP</Text>
          <Text style={styles.statValueSerif}>Signature</Text>
        </View>
      </View>

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

      <View style={isTablet && styles.serviceGrid}>
      {filtered.map((s) => {
        const catStyle = CATEGORY_STYLE[s.category];
        const statusStyle = s.status === 'Actif' ? styles.statusActif : styles.statusBrouillon;
        const statusTextStyle = s.status === 'Actif' ? styles.statusActifText : styles.statusBrouillonText;
        return (
          <View key={s.name} style={[styles.serviceCard, isTablet && styles.serviceCardTablet]}>
            <View style={styles.serviceTop}>
              <View style={styles.serviceIconWrap}>
                <ScissorsIcon color={CC.gold} size={20} />
              </View>
              <View style={styles.serviceInfo}>
                <View style={styles.serviceNameRow}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.servicePrice}>{s.price}</Text>
                </View>
                <Text style={styles.serviceDesc}>{s.description}</Text>
              </View>
            </View>

            <View style={styles.serviceBottom}>
              <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
                <Text style={[styles.categoryBadgeText, { color: catStyle.text }]}>{s.category}</Text>
              </View>
              <ClockIcon size={12} />
              <Text style={styles.durationText}>{s.duration}</Text>
              <View style={[styles.statusBadge, statusStyle]}>
                <Text style={[styles.statusBadgeText, statusTextStyle]}>{s.status}</Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => ouvrirEdition(s)}>
                  <EditIcon size={14} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => demanderSuppression(s)}>
                  <TrashIcon size={14} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
      </View>
    </CoiffeurScreen>

    <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
      <View style={styles.deleteOverlay}>
        <View style={styles.deleteCard}>
          <View style={styles.deleteIconWrap}>
            <TrashIcon size={22} color={CC.errorText} />
          </View>

          <Text style={styles.deleteTitle}>Supprimer la prestation ?</Text>
          <Text style={styles.deleteText}>
            « {serviceASupprimer?.name} » sera définitivement supprimée. Cette action est irréversible.
          </Text>

          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmerSuppression}>
              <Text style={styles.deleteConfirmBtnText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal visible={editModalVisible} transparent animationType={isTablet ? 'fade' : 'slide'} onRequestClose={() => setEditModalVisible(false)}>
      <View style={[styles.editOverlay, isTablet && styles.editOverlayTablet]}>
        <View style={[styles.editCard, isTablet && styles.editCardTablet]}>
          <Text style={styles.modalTitle}>Modifier la prestation</Text>

          <Text style={styles.fieldLabel}>NOM</Text>
          <TextInput
            value={editForm.name}
            onChangeText={(v) => updateEditField('name', v)}
            style={styles.input}
            placeholder="Nom de la prestation"
            placeholderTextColor={CC.textSecondary}
          />

          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput
            value={editForm.description}
            onChangeText={(v) => updateEditField('description', v)}
            style={[styles.input, styles.inputMultiline]}
            placeholder="Description"
            placeholderTextColor={CC.textSecondary}
            multiline
          />

          <Text style={styles.fieldLabel}>PRIX (€)</Text>
          <TextInput
            value={editForm.price}
            onChangeText={(v) => updateEditField('price', v)}
            style={styles.input}
            placeholder="45€"
            placeholderTextColor={CC.textSecondary}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>DURÉE</Text>
          <TextInput
            value={editForm.duration}
            onChangeText={(v) => updateEditField('duration', v)}
            style={styles.input}
            placeholder="45 min"
            placeholderTextColor={CC.textSecondary}
          />

          <Text style={styles.fieldLabel}>STATUT</Text>
          <View style={styles.statusToggle}>
            {(['Actif', 'Brouillon'] as Status[]).map((status) => {
              const active = editForm.status === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.statusToggleItem, active && styles.statusToggleItemActive]}
                  onPress={() => setEditForm((prev) => ({ ...prev, status }))}
                >
                  <Text style={[styles.statusToggleText, active && styles.statusToggleTextActive]}>{status}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={sauvegarderModification}>
              <Text style={styles.confirmBtnText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
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
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.black,
  },
  statValueSerif: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 16,
    color: CC.black,
  },
  tabsScroll: {
    marginBottom: 16,
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
    backgroundColor: CC.black,
    borderColor: CC.black,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.textSecondary,
  },
  tabTextActive: {
    color: CC.white,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
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
  serviceCardTablet: {
    width: '48%',
  },
  serviceTop: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  serviceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  serviceName: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 17,
    color: CC.black,
    flex: 1,
  },
  servicePrice: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 16,
    color: CC.goldDark,
  },
  serviceDesc: {
    fontSize: 12,
    color: CC.textSecondary,
    marginTop: 4,
  },
  serviceBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  durationText: {
    fontSize: 12,
    color: CC.textSecondary,
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusActif: {
    backgroundColor: CC.successBg,
  },
  statusBrouillon: {
    backgroundColor: CC.grayBg,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusActifText: {
    color: CC.successText,
  },
  statusBrouillonText: {
    color: CC.grayText,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: {
    borderColor: 'rgba(192,57,43,0.3)',
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
  modalTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 22,
    color: CC.black,
    marginBottom: 20,
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
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  statusToggle: {
    flexDirection: 'row',
    backgroundColor: CC.barTrackBg,
    borderRadius: 9,
    padding: 3,
    marginBottom: 20,
  },
  statusToggleItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 7,
    alignItems: 'center',
  },
  statusToggleItemActive: {
    backgroundColor: CC.white,
  },
  statusToggleText: {
    fontSize: 13,
    color: CC.textSecondary,
    fontWeight: '600',
  },
  statusToggleTextActive: {
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
  confirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 100,
    backgroundColor: CC.gold,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontWeight: '700',
    color: CC.black,
  },
});
