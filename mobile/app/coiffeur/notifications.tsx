import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import { CalendarIcon, StarIcon, CardIcon, XCircleIcon, BellIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

type Category = 'rdv' | 'avis' | 'paiement';
type IconKind = 'calendar' | 'star' | 'card' | 'x' | 'bell';

type Notif = {
  icon: IconKind;
  iconBg: string;
  category: Category;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
};

const TODAY: Notif[] = [
  {
    icon: 'calendar',
    iconBg: 'rgba(45,106,79,0.15)',
    category: 'rdv',
    title: 'Nouveau rendez-vous',
    desc: 'Antoine Rivière · Signature · 10:30',
    time: '09:12',
    unread: true,
  },
  {
    icon: 'star',
    iconBg: 'rgba(201,168,76,0.15)',
    category: 'avis',
    title: 'Nouvel avis 5★',
    desc: 'Thomas Leroy a laissé un avis',
    time: '08:40',
    unread: true,
  },
  {
    icon: 'card',
    iconBg: CC.grayBg,
    category: 'paiement',
    title: 'Acompte reçu',
    desc: '10€ — Karim Benali',
    time: '08:05',
    unread: true,
  },
];

const YESTERDAY: Notif[] = [
  {
    icon: 'x',
    iconBg: 'rgba(192,57,43,0.12)',
    category: 'rdv',
    title: 'Rendez-vous annulé',
    desc: 'Marc Dubois · Coupe express · 16:00',
    time: '18:22',
    unread: true,
  },
  {
    icon: 'bell',
    iconBg: 'rgba(58,106,138,0.15)',
    category: 'rdv',
    title: 'Rappel envoyé',
    desc: 'SMS de rappel · 4 clients pour demain',
    time: '17:00',
    unread: true,
  },
  {
    icon: 'star',
    iconBg: 'rgba(201,168,76,0.15)',
    category: 'avis',
    title: 'Avis à traiter',
    desc: 'Karim Benali · sans réponse',
    time: '14:30',
    unread: false,
  },
  {
    icon: 'card',
    iconBg: CC.grayBg,
    category: 'paiement',
    title: 'Virement hebdomadaire',
    desc: '1 840€ versés sur votre compte',
    time: '09:00',
    unread: false,
  },
];

const TABS = ['Toutes', 'Non lues', 'Rendez-vous', 'Avis', 'Paiements'] as const;

function renderIcon(kind: IconKind) {
  if (kind === 'calendar') return <CalendarIcon color="#2D6A4F" size={18} />;
  if (kind === 'star') return <StarIcon color={CC.gold} size={18} />;
  if (kind === 'card') return <CardIcon color={CC.grayText} size={18} />;
  if (kind === 'x') return <XCircleIcon color="#C0392B" size={18} />;
  return <BellIcon color="#3a6a8a" size={18} />;
}

function matchesTab(n: Notif, tab: (typeof TABS)[number]) {
  if (tab === 'Toutes') return true;
  if (tab === 'Non lues') return n.unread;
  if (tab === 'Rendez-vous') return n.category === 'rdv';
  if (tab === 'Avis') return n.category === 'avis';
  if (tab === 'Paiements') return n.category === 'paiement';
  return true;
}

function NotifCard({ n }: { n: Notif }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: n.iconBg }]}>{renderIcon(n.icon)}</View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{n.title}</Text>
        <Text style={styles.cardDesc}>{n.desc}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardTime}>{n.time}</Text>
        {n.unread && <View style={styles.unreadDot} />}
      </View>
    </View>
  );
}

export default function CoiffeurNotificationsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Toutes');

  const today = TODAY.filter((n) => matchesTab(n, activeTab));
  const yesterday = YESTERDAY.filter((n) => matchesTab(n, activeTab));
  const unreadCount = [...TODAY, ...YESTERDAY].filter((n) => n.unread).length;

  return (
    <CoiffeurScreen active="notifications">
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.unreadLabel}>{unreadCount} non lues</Text>

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

      {today.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>AUJOURD'HUI</Text>
          {today.map((n) => (
            <NotifCard key={n.title + n.time} n={n} />
          ))}
        </>
      )}

      {yesterday.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>HIER</Text>
          {yesterday.map((n) => (
            <NotifCard key={n.title + n.time} n={n} />
          ))}
        </>
      )}
    </CoiffeurScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
  },
  unreadLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: CC.goldDark,
    marginTop: 4,
    marginBottom: 18,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  cardDesc: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  cardTime: {
    fontSize: 11,
    color: CC.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3a6a8a',
  },
});
