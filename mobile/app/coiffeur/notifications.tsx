import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Linking, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { CalendarIcon, StarIcon, CardIcon, XCircleIcon, BellIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useCoiffeurNotifications, type Notif, type NotifType, type Section } from '@/contexts/CoiffeurNotificationsContext';

type IconKind = 'calendar' | 'star' | 'card' | 'x' | 'bell';

const SECTION_ORDER: Section[] = ["AUJOURD'HUI", 'HIER'];
const TABS = ['Toutes', 'Non lues', 'Rendez-vous', 'Avis', 'Paiements'] as const;

const ICON_BY_TYPE: Record<NotifType, IconKind> = {
  rdv: 'calendar',
  annulation: 'x',
  rappel: 'bell',
  avis: 'star',
  paiement: 'card',
};

const ICON_BG_BY_TYPE: Record<NotifType, string> = {
  rdv: 'rgba(45,106,79,0.15)',
  annulation: 'rgba(192,57,43,0.12)',
  rappel: 'rgba(58,106,138,0.15)',
  avis: 'rgba(201,168,76,0.15)',
  paiement: CC.grayBg,
};

function renderIcon(kind: IconKind, size = 18) {
  if (kind === 'calendar') return <CalendarIcon color="#2D6A4F" size={size} />;
  if (kind === 'star') return <StarIcon color={CC.gold} size={size} />;
  if (kind === 'card') return <CardIcon color={CC.grayText} size={size} />;
  if (kind === 'x') return <XCircleIcon color="#C0392B" size={size} />;
  return <BellIcon color="#3a6a8a" size={size} />;
}

function matchesTab(n: Notif, tab: (typeof TABS)[number]) {
  if (tab === 'Toutes') return true;
  if (tab === 'Non lues') return n.unread === true;
  if (tab === 'Rendez-vous') return n.type === 'rdv' || n.type === 'annulation' || n.type === 'rappel';
  if (tab === 'Avis') return n.type === 'avis';
  if (tab === 'Paiements') return n.type === 'paiement';
  return true;
}

function NotifCard({ n, onPress }: { n: Notif; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: ICON_BG_BY_TYPE[n.type] }]}>{renderIcon(ICON_BY_TYPE[n.type])}</View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{n.title}</Text>
        <Text style={styles.cardDesc}>{n.desc}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardTime}>{n.time}</Text>
        {n.unread && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
}

function DetailRow({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailEmoji}>{emoji}</Text>
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function CoiffeurNotificationsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Toutes');
  const { notifications, unreadCount, marquerLue } = useCoiffeurNotifications();
  const [selectedNotif, setSelectedNotif] = useState<Notif | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const ouvrirDetail = (notif: Notif) => {
    setSelectedNotif(notif);
    setDetailVisible(true);
    marquerLue(notif.id);
  };

  const fermerDetail = () => {
    setDetailVisible(false);
    setSelectedNotif(null);
  };

  const appelerClient = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  };

  const allerVersPlanning = () => {
    fermerDetail();
    router.push('/coiffeur/planning');
  };

  const allerVersAvis = (reviewId?: number) => {
    fermerDetail();
    router.push(reviewId != null ? `/coiffeur/avis?reviewId=${reviewId}` : '/coiffeur/avis');
  };

  const filtered = notifications.filter((n) => matchesTab(n, activeTab));
  const groups = SECTION_ORDER.map((section) => ({
    section,
    items: filtered.filter((n) => n.section === section),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <CoiffeurScreen active="notifications">
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Text style={styles.unreadLabel}>{unreadCount} non lues</Text>
        ) : (
          <Text style={styles.upToDateLabel}>Tout est à jour ✓</Text>
        )}

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

        {groups.map((g) => (
          <View key={g.section}>
            <Text style={styles.sectionLabel}>{g.section}</Text>
            {g.items.map((n) => (
              <NotifCard key={n.id} n={n} onPress={() => ouvrirDetail(n)} />
            ))}
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>Tout est à jour</Text>
            <Text style={styles.emptyText}>Aucune notification dans cette catégorie.</Text>
          </View>
        )}
      </CoiffeurScreen>

      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={fermerDetail}>
        <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={fermerDetail}>
          <TouchableOpacity style={styles.detailCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity style={styles.detailCloseBtn} onPress={fermerDetail}>
              <Text style={styles.detailCloseBtnText}>✕</Text>
            </TouchableOpacity>

            {selectedNotif && (
              <>
                <View style={[styles.detailIconWrap, { backgroundColor: ICON_BG_BY_TYPE[selectedNotif.type] }]}>
                  {renderIcon(ICON_BY_TYPE[selectedNotif.type], 26)}
                </View>
                <Text style={styles.detailTitle}>{selectedNotif.title}</Text>

                <View style={styles.detailDivider} />

                {selectedNotif.type === 'rdv' && (
                  <>
                    <DetailRow emoji="👤" label="Client" value={selectedNotif.client ?? ''} />
                    <DetailRow emoji="✂️" label="Prestation" value={selectedNotif.service ?? ''} />
                    <DetailRow emoji="👨" label="Coiffeur" value={selectedNotif.barber ?? ''} />
                    <DetailRow emoji="📅" label="Date" value={selectedNotif.date ?? ''} />
                    <DetailRow emoji="🕐" label="Heure" value={selectedNotif.time} />
                    <DetailRow emoji="📞" label="Téléphone" value={selectedNotif.phone ?? ''} />
                  </>
                )}

                {selectedNotif.type === 'annulation' && (
                  <>
                    <DetailRow emoji="👤" label="Client" value={selectedNotif.client ?? ''} />
                    <DetailRow emoji="✂️" label="Prestation" value={selectedNotif.service ?? ''} />
                    <DetailRow emoji="📅" label="Rendez-vous" value={selectedNotif.date ?? ''} />
                    <DetailRow emoji="❌" label="Annulé" value={`à ${selectedNotif.cancelledAt ?? ''}`} />
                  </>
                )}

                {selectedNotif.type === 'avis' && (
                  <View style={styles.avisBlock}>
                    <View style={styles.avisTopRow}>
                      <Avatar letter={selectedNotif.avatarLetter ?? '?'} size={32} />
                      <Text style={styles.avisName}>{selectedNotif.client}</Text>
                    </View>
                    <View style={styles.avisStarsRow}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <StarIcon key={i} filled={i < (selectedNotif.rating ?? 0)} />
                      ))}
                    </View>
                    <Text style={styles.avisQuote}>« {selectedNotif.reviewText} »</Text>
                  </View>
                )}

                {selectedNotif.type === 'paiement' && (
                  <>
                    <DetailRow emoji="💰" label="Montant" value={selectedNotif.amount ?? ''} />
                    <DetailRow emoji="👤" label="Client" value={selectedNotif.client ?? ''} />
                    <DetailRow emoji="🕐" label="Heure" value={selectedNotif.time} />
                  </>
                )}

                {selectedNotif.type === 'rappel' && (
                  <>
                    <DetailRow emoji="📱" label="Type" value="SMS de rappel envoyé" />
                    <DetailRow emoji="👥" label="Destinataires" value={selectedNotif.smsInfo ?? ''} />
                    <DetailRow emoji="🕐" label="Heure" value={selectedNotif.time} />
                  </>
                )}

                <View style={styles.detailDivider} />

                <View style={styles.detailActionsRow}>
                  {selectedNotif.type === 'rdv' && (
                    <>
                      <TouchableOpacity style={styles.detailBtnOutline} onPress={() => appelerClient(selectedNotif.phone)}>
                        <Text style={styles.detailBtnOutlineText}>Appeler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.detailBtnGold} onPress={allerVersPlanning}>
                        <Text style={styles.detailBtnGoldText}>Voir planning</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {selectedNotif.type === 'annulation' && (
                    <>
                      <TouchableOpacity style={styles.detailBtnOutline} onPress={fermerDetail}>
                        <Text style={styles.detailBtnOutlineText}>Fermer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.detailBtnGold} onPress={allerVersPlanning}>
                        <Text style={styles.detailBtnGoldText}>Voir planning</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {selectedNotif.type === 'avis' && (
                    <>
                      <TouchableOpacity style={styles.detailBtnOutline} onPress={fermerDetail}>
                        <Text style={styles.detailBtnOutlineText}>Fermer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.detailBtnGold} onPress={() => allerVersAvis(selectedNotif.reviewId)}>
                        <Text style={styles.detailBtnGoldText}>Répondre</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {(selectedNotif.type === 'paiement' || selectedNotif.type === 'rappel') && (
                    <TouchableOpacity style={[styles.detailBtnOutline, styles.detailBtnFull]} onPress={fermerDetail}>
                      <Text style={styles.detailBtnOutlineText}>Fermer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
  },
  unreadLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: CC.goldDark,
    marginTop: 4,
    marginBottom: 18,
  },
  upToDateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: CC.successText,
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
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
    color: CC.successText,
  },
  emptyTitle: {
    fontFamily: SERIF,
    fontSize: 18,
    color: CC.black,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: CC.textSecondary,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CC.white,
    borderRadius: 20,
    padding: 24,
  },
  detailCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CC.trackBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  detailCloseBtnText: {
    fontSize: 16,
    color: CC.black,
    fontWeight: '600',
  },
  detailIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  detailTitle: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
    textAlign: 'center',
  },
  detailDivider: {
    height: 1,
    backgroundColor: CC.trackBg,
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  detailEmoji: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  detailTextWrap: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  avisBlock: {
    marginBottom: 4,
  },
  avisTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avisName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CC.black,
  },
  avisStarsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 10,
  },
  avisQuote: {
    fontSize: 13.5,
    lineHeight: 20,
    color: CC.black,
    fontStyle: 'italic',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  detailBtnFull: {
    flex: 1,
  },
  detailBtnOutlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  detailBtnGold: {
    flex: 1,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  detailBtnGoldText: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
});
