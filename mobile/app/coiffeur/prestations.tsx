import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import { ScissorsIcon, ClockIcon, EditIcon, TrashIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

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

export default function CoiffeurPrestationsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Toutes');

  const category = TAB_TO_CATEGORY[activeTab];
  const filtered = category ? SERVICES.filter((s) => s.category === category) : SERVICES;
  const avgPrice = Math.round(
    SERVICES.reduce((sum, s) => sum + parseInt(s.price, 10), 0) / SERVICES.length
  );

  return (
    <CoiffeurScreen active="prestations">
      <Text style={styles.title}>Prestations</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL</Text>
          <Text style={styles.statValue}>{SERVICES.length}</Text>
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

      {filtered.map((s) => {
        const catStyle = CATEGORY_STYLE[s.category];
        const statusStyle = s.status === 'Actif' ? styles.statusActif : styles.statusBrouillon;
        const statusTextStyle = s.status === 'Actif' ? styles.statusActifText : styles.statusBrouillonText;
        return (
          <View key={s.name} style={styles.serviceCard}>
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
                <TouchableOpacity style={styles.actionBtn}>
                  <EditIcon size={14} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]}>
                  <TrashIcon size={14} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
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
});
