import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useReservations } from '@/hooks/useReservations';
import type { Reservation, Review } from '@/types';
import { Fonts } from '@/constants';
import { useIsTablet } from '@/components/client/useIsTablet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClientNotifications } from '@/contexts/ClientNotificationsContext';
import type { TranslationKey } from '@/i18n/translations';
import { ACOMPTE_FIXE, SERVICES, fmtPrice } from '@/components/booking/data';
import { useClientMedia } from '@/hooks/useClientMedia';
import ClientMediaGrid from '@/components/media/ClientMediaGrid';
import ReservationComment from '@/components/client/ReservationComment';
import { HistoryErrorBanner } from '@/components/client/HistoryErrorBanner';
import { WaitlistAlerts } from '@/components/client/WaitlistAlerts';
import { NotificationToast, type ToastData } from '@/components/NotificationToast';
import {
  HISTORY_PREVIEW_COUNT, HistoryToggleButton, useListAccordion, useTrackedScroll,
} from '@/components/client/HistoryAccordion';
import { reviewsApi, loyaltyApi } from '@/services/api';

// Réutilisé par le ScrollView de l'onglet "Mes coupes" (tablette/web) pour rendre son
// inset horizontal local plutôt qu'hérité de tabletContainer — cf. usage plus bas.
const TABLET_CONTAINER_PADDING_H = 20;

// Statuts qui ne comptent pas comme une visite (stats VISITES / DERNIÈRE VISITE).
const NOT_A_VISIT_STATUSES: string[] = ['cancelled', 'cancelled_client', 'no_show'];

const PRICE_BY_SERVICE_NAME: Record<string, number> = {
  'Signature WilloBarber': 45,
  "Taille & rasage à l'ancienne": 28,
  'Le Rituel': 75,
  'Coupe express': 28,
  'Camouflage gris': 35,
  'Soin du visage': 32,
  'Coupe enfant −15 ans': 15,
  'Coupe enfant +15 ans': 20,
};

// Shape réel de /reservations/ (core/serializers.py) : 'time', 'service_price'
// et 'amount_paid' (montant encaissé en ligne, en euros) sont absents du type partagé.
type ApiReservation = Reservation & { time: string; service_price?: string; amount_paid?: string | null };

function servicePrice(r: ApiReservation): number {
  const fromApi = Number(r.service_price);
  return Number.isFinite(fromApi) && fromApi > 0 ? fromApi : PRICE_BY_SERVICE_NAME[r.service_name] ?? 0;
}

function parseApiDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Dernière visite en langage naturel (« Hier », « Il y a 3 mois »…) ;
// null = aucune visite passée.
function formatLastVisit(daysAgo: number | null, t: (key: TranslationKey) => string): string {
  if (daysAgo === null) return t('reservations.lastVisit.none');
  if (daysAgo <= 0) return t('reservations.lastVisit.today');
  if (daysAgo === 1) return t('reservations.lastVisit.yesterday');
  if (daysAgo < 30) return t('reservations.lastVisit.daysAgo').replace('{n}', String(daysAgo));
  if (daysAgo < 60) return t('reservations.lastVisit.monthAgo');
  if (daysAgo < 365) return t('reservations.lastVisit.monthsAgo').replace('{n}', String(Math.floor(daysAgo / 30)));
  const years = Math.floor(daysAgo / 365);
  return years === 1
    ? t('reservations.lastVisit.yearAgo')
    : t('reservations.lastVisit.yearsAgo').replace('{n}', String(years));
}

function formatHmm(timeStr: string): string {
  return timeStr.slice(0, 5).replace(':', 'h');
}

function formatDateLong(dateStr: string, t: (key: TranslationKey) => string): string {
  const d = parseApiDate(dateStr);
  return `${d.getDate()} ${t(`step3.month.${d.getMonth()}` as TranslationKey)} ${d.getFullYear()}`;
}

const TIERS_META = [
  { labelKey: 'reservations.loyalty.tier.bronze' as TranslationKey, min: 0,   threshold: '0',   color: '#8B6914' },
  { labelKey: 'reservations.loyalty.tier.argent' as TranslationKey, min: 200, threshold: '200', color: '#6B6560' },
  { labelKey: 'reservations.loyalty.tier.or' as TranslationKey,     min: 500, threshold: '500', color: '#C9A84C' },
];

const BARBER_HIST_COLORS: Record<string, string> = { Willo: '#C9A84C', Malik: '#7A3B1E', Idris: '#1A6B4A' };

const SALON_ADDRESS = 'Rue Auguste Van Zande 78';

function getNextTarget(pts: number): number {
  if (pts < 1000) return 1000;
  return Math.ceil((pts + 1) / 1000) * 1000;
}

function getBarProgress(pts: number): number {
  if (pts <= 0) return 0;
  const cycle = pts % 1000;
  return cycle === 0 ? 1 : cycle / 1000;
}

function GoldItalic({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: '#C9A84C', fontStyle: 'italic', fontFamily: Fonts.italic, fontWeight: '500' }}>
      {children}
    </Text>
  );
}

interface CancelModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}
function CancelModal({ visible, onClose, onConfirm, loading }: CancelModalProps) {
  const [reason, setReason] = useState('');
  const isTablet = useIsTablet();
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
          <View style={[styles.modalBox, isTablet && styles.modalBoxTablet]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{t('reservations.cancelModal.title')}</Text>
              <Text style={styles.modalSub}>{t('reservations.cancelModal.sub')}</Text>
              <Text style={styles.fieldLabel}>{t('reservations.cancelModal.reasonLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                value={reason}
                onChangeText={setReason}
                placeholder={t('reservations.cancelModal.placeholder')}
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnKeep} onPress={onClose}>
                  <Text style={styles.btnKeepText}>{t('reservations.cancelModal.keep')}</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="btn-confirm-cancel" style={styles.btnDanger} onPress={() => onConfirm(reason)} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color="#C0392B" size="small" />
                    : <Text style={styles.btnDangerText}>{t('reservations.cancelModal.confirmCancel')}</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ReviewModalProps {
  target: { id: number; service: string } | null;
  review: Review | null;
  onClose: () => void;
  onChange: (reservationId: number, review: Review | null) => void;
}

function ReviewModal({ target, review, onClose, onChange }: ReviewModalProps) {
  const isTablet = useIsTablet();
  const { t } = useLanguage();
  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
          <View style={[styles.modalBox, isTablet && styles.modalBoxTablet]}>
            <View pointerEvents="box-none" style={{ flexShrink: 1 }}>
              <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
                {target && (
                  <ReservationComment reservationId={target.id} review={review} onChange={onChange} collapsible={false} />
                )}
              </ScrollView>
            </View>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface HideCoupeButtonProps {
  // Coupe déjà masquée (visible via « Afficher les coupes masquées ») : l'icône
  // devient un œil pour la réafficher.
  hidden: boolean;
  onPress: () => void;
  testID?: string;
}

// ✕ discrète dans le coin supérieur droit d'une carte d'historique. Jamais à
// l'intérieur d'un autre bouton (sur web : <button> imbriqué interdit).
function HideCoupeButton({ hidden, onPress, testID }: HideCoupeButtonProps) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t(hidden ? 'history.unhideCoupe' : 'history.hideCoupe')}
      // `hovered` n'existe que sur react-native-web (absent des types RN).
      style={(state) => [styles.hideBtn, { opacity: (state as { hovered?: boolean }).hovered ? 1 : 0.6 }]}
    >
      {(state) => (
        <Ionicons
          name={hidden ? 'eye-outline' : 'close'}
          size={15}
          color={(state as { hovered?: boolean }).hovered ? (hidden ? '#C9A84C' : '#E57368') : '#9A9490'}
        />
      )}
    </Pressable>
  );
}

// Fondu de sortie d'une carte masquée ; onDone une fois l'animation finie.
function FadeOut({ active, onDone, children }: { active: boolean; onDone: () => void; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' })
      .start(({ finished }) => { if (finished) onDoneRef.current(); });
  }, [active, opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

interface HideCoupeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}
function HideCoupeModal({ visible, onClose, onConfirm, loading }: HideCoupeModalProps) {
  const isTablet = useIsTablet();
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
        <View testID="hide-coupe-modal" style={[styles.modalBox, isTablet && styles.modalBoxTablet]}>
          <Text style={styles.modalTitle}>{t('history.hideCoupeTitle')}</Text>
          <Text style={styles.modalSub}>{t('history.hideCoupeMessage')}</Text>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnKeep} onPress={onClose}>
              <Text style={styles.btnKeepText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-confirm-hide" style={styles.btnHideConfirm} onPress={onConfirm} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#1A1208" size="small" />
                : <Text style={styles.btnHideConfirmText}>{t('history.hideConfirm')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface RdvActionsProps {
  onReschedule: () => void;
  onCancel: () => void;
  // Absent tant que le RDV n'a pas de QR code.
  onQr?: () => void;
  onCalendar: () => void;
  // Distingue les testID de la modale détail de ceux de la carte hero.
  idPrefix?: string;
}

// Actions d'un RDV à venir, 2 lignes de 2 : Reprogrammer · Annuler / Mon QR · Calendrier.
function RdvActions({ onReschedule, onCancel, onQr, onCalendar, idPrefix = '' }: RdvActionsProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.rdvActions}>
      <View style={styles.rdvActionsRow}>
        <TouchableOpacity testID={`${idPrefix}btn-reprogrammer`} style={[styles.btnOutline, styles.rdvActionBtn]} onPress={onReschedule} activeOpacity={0.85}>
          <Text style={[styles.btnOutlineText, styles.rdvActionText]}>{t('reservations.reschedule')}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`${idPrefix}btn-cancel-next-rdv`} style={[styles.btnDangerSm, styles.rdvActionBtn]} onPress={onCancel} activeOpacity={0.85}>
          <Text style={[styles.btnDangerSmText, styles.rdvActionText]}>{t('reservations.cancelBtn')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.rdvActionsRow}>
        {onQr && (
          <TouchableOpacity testID={`${idPrefix}btn-mon-qr`} style={[styles.btnOutline, styles.rdvActionBtn]} onPress={onQr} activeOpacity={0.85}>
            <Text style={[styles.btnOutlineText, styles.rdvActionText]}>{t('reservations.myQrBtn')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity testID={`${idPrefix}btn-add-calendar`} style={[styles.btnPrimary, styles.rdvActionBtn]} onPress={onCalendar} activeOpacity={0.85}>
          <Text style={[styles.btnPrimaryText, styles.rdvActionText]}>{t('reservations.addToCalendar')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface QrCodeModalProps {
  reservation: (Reservation & { time: string }) | null;
  onClose: () => void;
}
function QrCodeModal({ reservation, onClose }: QrCodeModalProps) {
  const isTablet = useIsTablet();
  const { t } = useLanguage();
  return (
    <Modal visible={!!reservation} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
        <View style={[styles.modalBox, isTablet && styles.modalBoxTablet, styles.qrModalBox]}>
          <Text style={[styles.modalTitle, { textAlign: 'center' }]}>{reservation?.service_name}</Text>
          <Text style={[styles.modalSub, { textAlign: 'center' }]}>
            {reservation ? formatDateLong(reservation.date, t) : ''}
          </Text>
          {reservation?.qr_code && (
            <Image
              source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${reservation.qr_code}&size=250x250` }}
              style={styles.qrModalImage}
            />
          )}
          <Text style={styles.qrModalCaption}>{t('reservations.qrCode.caption')}</Text>
          <View style={{ width: '100%', marginTop: 16 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: '100%',
                backgroundColor: '#C9A84C',
                borderRadius: 50,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold' }}>
                {t('common.close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ReservationsScreen() {
  const router = useRouter();
  const isTablet = useIsTablet();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { showLoginModal } = useAuthModal();
  const { isLoading, refetch, cancel, setHidden, upcomingSorted, reservations, error } = useReservations();
  // Rien n'a pu être chargé : bandeau « Réessayer » à la place des listes. Si un
  // rechargement échoue alors que des réservations sont déjà affichées (refetch
  // au focus), on garde ces vraies données plutôt que de les masquer.
  const loadFailed = !!error && reservations.length === 0;
  const { t, language } = useLanguage();

  // Recharge les réservations à chaque prise de focus de l'onglet — sans ça, une
  // réservation créée depuis l'écran "book" n'apparaît pas tant que l'app n'est pas relancée.
  useFocusEffect(useCallback(() => {
    refetch();
    refreshUser().catch(() => {});
  }, [refetch, refreshUser]));
  const [histFilter, setHistFilter] = useState('Tous');
  // null = aucun RDV sélectionné — le panneau de détail (tablette) affiche alors un
  // message de sélection par défaut plutôt que le premier élément de la liste.
  const [selectedHistIndex, setSelectedHistIndex] = useState<number | null>(null);
  // Historique des RDV et des points : deux accordéons indépendants, repliés
  // à l'arrivée (3 éléments). La ScrollView suivie est celle de la mise en page
  // affichée (colonne droite tablette ou écran téléphone).
  const historyScroll = useTrackedScroll();
  const histAccordion = useListAccordion(historyScroll);
  const pointsAccordion = useListAccordion(historyScroll);
  // « Mes autres RDV à venir » vit dans la colonne gauche sur tablette/web,
  // dans l'unique ScrollView sur téléphone.
  const leftColScroll = useTrackedScroll();
  const upcomingAccordion = useListAccordion(isTablet ? leftColScroll : historyScroll);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [qrTarget, setQrTarget] = useState<(Reservation & { time: string }) | null>(null);
  // RDV à venir ouvert en détail depuis une mini-carte.
  const [detailTarget, setDetailTarget] = useState<ApiReservation | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  // Masquer une coupe de l'historique : cible de la modale de confirmation,
  // carte en cours de fondu, et affichage optionnel des coupes masquées.
  const [hideTarget, setHideTarget] = useState<number | null>(null);
  const [hiding, setHiding] = useState(false);
  const [fadingId, setFadingId] = useState<number | null>(null);
  const fadeDoneRef = useRef<(() => void) | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [reviewModalTarget, setReviewModalTarget] = useState<{ id: number; service: string } | null>(null);
  const [mainTab, setMainTab] = useState<'apercu' | 'coupes'>('apercu');
  // Solde réel du client (backend /auth/me/), resynchronisé quand user change.
  const [loyaltyPoints, setLoyaltyPoints] = useState(user?.loyalty_points ?? 0);
  const [barWidth, setBarWidth] = useState(0);
  const barAnim = useRef(new Animated.Value(0)).current;
  const { media: myMedia, isLoading: myMediaLoading } = useClientMedia(user?.id ?? null);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (!isLoading) setHasLoadedOnce(true);
  }, [isLoading]);
  // Loader tant que rien n'est affichable : premier chargement, ou « Réessayer »
  // après un échec (refetch remet `error` à null avant la requête : sans ce cas,
  // l'écran afficherait « Aucun historique » pendant le rechargement).
  const showInitialLoader = isLoading && (!hasLoadedOnce || reservations.length === 0);

  // L'API /reservations/ retourne un champ 'time', absent du type Reservation partagé
  // (utilisé ailleurs avec un shape différent) — on type le réel localement ici.
  // Le scoping par client connecté est géré côté backend (ReservationViewSet.get_queryset).
  const allReservations = reservations as ApiReservation[];
  if (__DEV__ && allReservations[0]) {
    console.log('[RESERVATIONS] Réservation brute reçue de l\'API:', JSON.stringify(allReservations[0]));
  }
  // L'historique doit montrer tout RDV dont la date est passée, quel que soit son statut
  // (pending/confirmed oubliés, completed, cancelled...) — pas seulement status === 'completed'.
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const pastListAll = allReservations.filter((r) => `${r.date}T${r.time}` < nowKey);
  // Masquer une coupe est purement cosmétique : elle sort de la liste
  // historique (sauf « Afficher les coupes masquées »), pas des stats ni de
  // l'historique des points — le client est bien venu au salon.
  const pastList = pastListAll.filter((r) => !r.hidden_by_client);
  const hiddenCount = pastListAll.length - pastList.length;
  // Visites réellement honorées, masquées comprises : les stats (visites,
  // dernière visite, favoris) ignorent annulations et no-shows, contrairement
  // à l'historique qui affiche tout.
  const visitList = pastListAll.filter((r) => !NOT_A_VISIT_STATUSES.includes(r.status));

  // Sync loyaltyPoints avec le user du contexte auth. Utilise [user] comme
  // dep (pas [user?.loyalty_points]) pour que l'effet re-tourne à chaque
  // fois que le contexte émet un nouvel objet user (login, refreshUser, etc.)
  useEffect(() => {
    if (user) setLoyaltyPoints(user.loyalty_points ?? 0);
  }, [user]);

  // RDV à venir triés (cf. useReservations) : le 1er est la carte hero, les
  // suivants « Mes autres RDV à venir ». La sidebar tablette/web lit le même
  // store : une annulation recompose les trois.
  const upcomingList = upcomingSorted as ApiReservation[];
  const nextReservation = upcomingList[0] ?? null;
  const otherUpcoming = upcomingList.slice(1);

  const pastSorted = [...(showHidden ? pastListAll : pastList)].sort((a, b) =>
    `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
  );

  // Visite la plus récente, en jours calendaires (minuit à minuit, arrondi pour
  // absorber le changement d'heure) — parseApiDate() plutôt que `new Date(string)`
  // pour éviter le décalage de fuseau horaire d'un parsing UTC sur "YYYY-MM-DD".
  const lastVisitDate = visitList.reduce<string | null>((max, r) => (max === null || r.date > max ? r.date : max), null);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastVisitDays = lastVisitDate === null
    ? null
    : Math.round((todayMidnight.getTime() - parseApiDate(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24));
  const lastVisitLabel = formatLastVisit(lastVisitDays, t);

  // Commentaires du client, rechargés quand le barbier répond (SSE new_comment_reply).
  const { commentReplyVersion } = useClientNotifications();
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  useEffect(() => {
    if (!isAuthenticated) return;
    reviewsApi.mine().then(setMyReviews).catch(() => {});
  }, [isAuthenticated, commentReplyVersion]);

  const reviewForReservation = (reservationId: number) =>
    myReviews.find((rv) => rv.reservation === reservationId) ?? null;

  const handleCommentChange = (reservationId: number, review: Review | null) => {
    setMyReviews((prev) => [...prev.filter((rv) => rv.reservation !== reservationId), ...(review ? [review] : [])]);
  };

  // Seul un RDV passé et honoré se commente (même règle que le backend,
  // core/comments.py) — annulations et no-shows exclus.
  const isCommentable = (h: { id: number | null; status: string | null }) =>
    h.id != null && h.status != null && !NOT_A_VISIT_STATUSES.includes(h.status);

  // Données d'affichage d'un RDV à venir (carte hero, mini-cartes, modale détail).
  const rdvView = (r: ApiReservation) => {
    const d = parseApiDate(r.date);
    const diffDays = Math.ceil(
      (new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
    );
    const daysLabel =
      diffDays <= 0 ? t('reservations.nextRdvToday')
      : diffDays === 1 ? t('reservations.nextRdvTomorrow')
      : `${t('reservations.nextRdvIn')} ${diffDays} ${t('reservations.nextRdvDaysWord')}`;
    const moisAbbr = t(`reservations.monthAbbr.${d.getMonth()}` as TranslationKey);
    return {
      jour: String(d.getDate()).padStart(2, '0'),
      mois: moisAbbr,
      jourAbbr: t(`reservations.dayAbbr.${d.getDay()}` as TranslationKey),
      service: r.service_name,
      time: r.time.slice(0, 5),
      timeLabel: formatHmm(r.time),
      barbier: r.barber ?? 'Willo',
      dateLabel: `${d.getDate()} ${t(`step3.month.${d.getMonth()}` as TranslationKey)} ${d.getFullYear()}`,
      dateShort: `${d.getDate()} ${moisAbbr}`,
      daysLabel,
    };
  };

  const rdv = nextReservation ? rdvView(nextReservation) : null;

  // Solde à régler au salon = prix de la prestation − montant déjà payé en ligne
  // (acompte fixe si l'API ne renvoie pas de montant). 0 → ligne masquée.
  const balanceOf = (r: ApiReservation) =>
    Math.max(0, servicePrice(r) - (r.amount_paid != null ? Number(r.amount_paid) || 0 : ACOMPTE_FIXE));
  const balanceLabel = (amount: number) => t('reservations.balanceAtSalon').replace(
    '{amount}',
    language === 'en' ? `€${amount.toFixed(2)}` : `${amount.toFixed(2).replace('.', ',')} €`,
  );
  const nextRdvBalance = nextReservation ? balanceOf(nextReservation) : 0;
  const nextRdvBalanceLabel = balanceLabel(nextRdvBalance);

  // Historique des points : un gain par RDV non annulé (points attribués dès la
  // réservation, cf. core/loyalty.py). Les enfants d'un même groupe (même
  // prestation enfant, même jour) sont regroupés : « Coupe enfant × 3 · +30 pts ».
  const TRANSACTIONS: { id: string; date: string; reason: string; points: number; type: string }[] = (() => {
    const groups = new Map<string, { r: Reservation & { time: string }; count: number; points: number }>();
    [...allReservations]
      .filter((r) => !NOT_A_VISIT_STATUSES.includes(r.status))
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .forEach((r) => {
        const key = r.service_category === 'enfant' ? `kids:${r.date}:${r.service_name}` : `rdv:${r.id}`;
        const group = groups.get(key);
        if (group) {
          group.count += 1;
          group.points += r.loyalty_points ?? 0;
        } else {
          groups.set(key, { r, count: 1, points: r.loyalty_points ?? 0 });
        }
      });
    return [...groups.entries()].map(([key, { r, count, points }]) => {
      const d = parseApiDate(r.date);
      const date = `${d.getDate()} ${t(`reservations.monthAbbr.${d.getMonth()}` as TranslationKey)} ${d.getFullYear()}`;
      const isKids = r.service_category === 'enfant';
      return {
        id: key,
        date: isKids ? `${date} · ${t('reservations.tx.perChild')}` : date,
        reason: count > 1 ? `${r.service_name} × ${count}` : r.service_name,
        points,
        type: 'earn',
      };
    });
  })();

  const TIERS = TIERS_META.map(tier => ({
    ...tier,
    label: t(tier.labelKey),
    threshold: `${tier.threshold} ${t('reservations.pointsSuffix')}`,
  }));

  const HISTORIQUE = pastSorted.map(r => {
    const d = parseApiDate(r.date);
    return {
      jour: String(d.getDate()).padStart(2, '0'),
      mois: t(`reservations.monthAbbr.${d.getMonth()}` as TranslationKey),
      service: r.service_name,
      // Barbier réel du RDV (agenda par barbier) — c'est aussi lui qui
      // signe la réponse au commentaire du client.
      barbier: (r.barber || 'Willo').charAt(0),
      barbierNom: r.barber || 'Willo',
      couleur: BARBER_HIST_COLORS[r.barber] ?? '#C9A84C',
      prix: fmtPrice(PRICE_BY_SERVICE_NAME[r.service_name] ?? 0),
      annee: r.date.slice(0, 4),
      id: r.id as number | null,
      status: r.status as string | null,
      hidden: !!r.hidden_by_client,
    };
  });

  // Prestations les plus réservées parmi les visites honorées (à égalité de
  // count, la plus récente gagne). Les enfants d'un même groupe (même
  // prestation, même jour) comptent pour une seule visite.
  const FAVORIS = (() => {
    const byService = new Map<string, { visits: Set<string>; last: ApiReservation; barbers: Map<string, number> }>();
    [...visitList]
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .forEach((r) => {
        const fav = byService.get(r.service_name) ?? { visits: new Set<string>(), last: r, barbers: new Map<string, number>() };
        const visitKey = r.service_category === 'enfant' ? `kids:${r.date}` : `rdv:${r.id}`;
        if (!fav.visits.has(visitKey)) {
          fav.visits.add(visitKey);
          const barber = r.barber || 'Willo';
          fav.barbers.set(barber, (fav.barbers.get(barber) ?? 0) + 1);
        }
        byService.set(r.service_name, fav);
      });
    return [...byService.entries()]
      .map(([nom, { visits, last, barbers }]) => {
        const d = parseApiDate(last.date);
        // Barbier le plus associé à la prestation (Map remplie du plus récent au
        // plus ancien → à égalité, le barbier le plus récent gagne).
        const barbier = [...barbers.entries()].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
        return {
          nom,
          count: visits.size,
          lastKey: `${last.date}T${last.time}`,
          date: `${d.getDate()} ${t(`reservations.monthAbbr.${d.getMonth()}` as TranslationKey)}`,
          dur: SERVICES.find((s) => s.name === nom)?.dur ?? '',
          prix: fmtPrice(servicePrice(last)),
          barbier,
        };
      })
      .sort((a, b) => b.count - a.count || b.lastKey.localeCompare(a.lastKey))
      .slice(0, 2);
  })();
  // Section masquée tant que l'historique ne compte pas 2 prestations distinctes.
  const showFavoris = FAVORIS.length >= 2;
  // "Reprenez là où vous en étiez" = prestation favorite + son barbier habituel.
  const resumeFav = FAVORIS[0] ?? null;

  // Ouverture directe d'un RDV (toast / notification « Votre barbier vous a
  // répondu ») : /reservations?reservationId=X → panneau de détail (tablette)
  // ou modale du commentaire (téléphone).
  // `at` (horodatage) distingue deux ouvertures successives du même RDV.
  const { reservationId: linkedReservationId, at: linkedAt } = useLocalSearchParams<{ reservationId?: string; at?: string }>();
  const openedLinkRef = useRef<string | null>(null);
  // RDV ouvert depuis une notification : son commentaire s'affiche déplié.
  const [linkedOpenId, setLinkedOpenId] = useState<number | null>(null);
  useEffect(() => {
    const linkKey = `${linkedReservationId}:${linkedAt}`;
    if (!linkedReservationId || openedLinkRef.current === linkKey) return;
    const index = HISTORIQUE.findIndex((h) => String(h.id) === linkedReservationId);
    if (index === -1) return;
    openedLinkRef.current = linkKey;
    setHistFilter('Tous');
    histAccordion.setExpanded(true);
    if (isTablet) {
      setSelectedHistIndex(index);
      setLinkedOpenId(HISTORIQUE[index].id);
    }
    else setReviewModalTarget({ id: HISTORIQUE[index].id as number, service: HISTORIQUE[index].service });
  }, [linkedReservationId, linkedAt, HISTORIQUE, isTablet]);

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: getBarProgress(loyaltyPoints),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [loyaltyPoints]);

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 10, textAlign: 'center' }}>
          {t('reservations.notAuth.title')}
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          {t('reservations.notAuth.sub')}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#C9A84C', borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40 }}
          onPress={() => showLoginModal(undefined, t('reservations.notAuth.loginPrompt'))}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#1A1208', fontWeight: '700', fontSize: 15 }}>{t('common.login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const username = user?.first_name || user?.username || 'Client';
  const nextTarget  = getNextTarget(loyaltyPoints);
  const ptsRestants = nextTarget - loyaltyPoints;

  const mainTabsRow = (
    <View style={styles.mainTabsRow}>
      <Pressable
        style={[styles.mainTabPill, mainTab === 'apercu' && styles.mainTabPillActive]}
        onPress={() => setMainTab('apercu')}
      >
        <Text style={[styles.mainTabText, mainTab === 'apercu' && styles.mainTabTextActive]}>{t('reservations.tabs.apercu')}</Text>
      </Pressable>
      <Pressable
        style={[styles.mainTabPill, mainTab === 'coupes' && styles.mainTabPillActive]}
        onPress={() => setMainTab('coupes')}
      >
        <Text style={[styles.mainTabText, mainTab === 'coupes' && styles.mainTabTextActive]}>✂️ {t('reservations.tabs.coupes')}</Text>
      </Pressable>
    </View>
  );

  const mesCoupesGallery = (
    <View style={{ marginTop: 8, overflow: 'visible' }}>
      <Text style={styles.sectionTitle}>{t('reservations.tabs.coupes')}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, marginTop: -6, marginBottom: 16 }}>
        {t('reservations.coupes.subtitle')}
      </Text>
      <ClientMediaGrid
        media={myMedia}
        isLoading={myMediaLoading}
        emptyLabel={t('reservations.coupes.empty')}
        mutedColor="rgba(255,255,255,0.5)"
      />
    </View>
  );

  const filteredHist = histFilter === 'Tous'
    ? HISTORIQUE
    : HISTORIQUE.filter(h => h.annee === histFilter);

  const visibleHist = histAccordion.expanded ? filteredHist : filteredHist.slice(0, HISTORY_PREVIEW_COUNT);
  const visibleTransactions = pointsAccordion.expanded ? TRANSACTIONS : TRANSACTIONS.slice(0, HISTORY_PREVIEW_COUNT);
  const renderTransaction = (tx: (typeof TRANSACTIONS)[number]) => {
    const isSpend = tx.type === 'spend';
    const isBonus = tx.type === 'bonus';
    const iconColor = isSpend ? '#E53935' : isBonus ? '#64B5F6' : '#C9A84C';
    const ptColor   = isSpend ? '#E53935' : isBonus ? '#64B5F6' : '#4CAF50';
    const ptPrefix  = isSpend ? '' : '+';
    const iconChar  = isSpend ? '−' : isBonus ? '+' : '★';
    return (
      <View key={tx.id} style={styles.txRow}>
        <View style={[styles.txIconCircle, { backgroundColor: iconColor + '22', borderColor: iconColor + '55' }]}>
          <Text style={{ color: iconColor, fontSize: 14 }}>{iconChar}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txReason}>{tx.reason}</Text>
          <Text style={styles.txDate}>{tx.date}</Text>
        </View>
        <Text style={[styles.txPoints, { color: ptColor }]}>
          {ptPrefix}{Math.abs(tx.points)} pts
        </Text>
      </View>
    );
  };

  const histToggle = filteredHist.length > HISTORY_PREVIEW_COUNT && (
    <HistoryToggleButton
      expanded={histAccordion.expanded}
      hiddenCount={filteredHist.length - HISTORY_PREVIEW_COUNT}
      unit={t('reservations.rdvCountWord')}
      onPress={histAccordion.toggle}
      testID="btn-toggle-rdv-history"
    />
  );
  // Masquer (après confirmation) ou réafficher une coupe. La carte masquée
  // s'efface en fondu une fois le PATCH confirmé, puis quitte la liste : les
  // stats (dérivées du store) se recomptent d'elles-mêmes.
  const applyHidden = async (id: number, hidden: boolean) => {
    const fades = hidden && !showHidden;
    await setHidden(id, hidden, fades
      ? () => new Promise<void>((resolve) => { fadeDoneRef.current = resolve; setFadingId(id); })
      : undefined);
    setFadingId(null);
    setSelectedHistIndex(null);
    setToast({ message: t(hidden ? 'history.coupeHidden' : 'history.coupeUnhidden'), testID: 'coupe-hidden-toast' });
  };

  const handleConfirmHide = async () => {
    if (hideTarget == null) return;
    setHiding(true);
    try {
      const id = hideTarget;
      setHideTarget(null);
      await applyHidden(id, true);
    } catch {
      setFadingId(null);
      setToast({ message: t('history.hideError'), color: '#C0392B' });
    } finally {
      setHiding(false);
    }
  };

  const handleHidePress = (h: (typeof HISTORIQUE)[number]) => {
    if (h.id == null) return;
    if (!h.hidden) {
      setHideTarget(h.id);
      return;
    }
    applyHidden(h.id, false).catch(() => setToast({ message: t('history.hideError'), color: '#C0392B' }));
  };

  const hiddenToggle = (hiddenCount > 0 || showHidden) && !loadFailed && (
    <TouchableOpacity
      testID="btn-toggle-hidden-coupes"
      style={styles.hiddenToggle}
      onPress={() => { setShowHidden((v) => !v); setSelectedHistIndex(null); }}
      activeOpacity={0.7}
    >
      <Text style={styles.hiddenToggleText}>
        {showHidden
          ? t('history.hideHiddenCoupes')
          : t('history.showHiddenCoupes').replace('{n}', String(hiddenCount))}
      </Text>
    </TouchableOpacity>
  );

  const pointsToggle = TRANSACTIONS.length > HISTORY_PREVIEW_COUNT && (
    <HistoryToggleButton
      expanded={pointsAccordion.expanded}
      hiddenCount={TRANSACTIONS.length - HISTORY_PREVIEW_COUNT}
      unit={t('reservations.operationsCountWord')}
      onPress={pointsAccordion.toggle}
      testID="btn-toggle-points-history"
    />
  );

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    if (cancelTarget.id == null) {
      console.log('[ANNULATION] cancelTarget.id manquant — cancelTarget:', JSON.stringify(cancelTarget));
      const msg = t('reservations.cancelInvalidError');
      if (Platform.OS === 'web') window.alert(`${t('common.error')} : ${msg}`);
      else Alert.alert(t('common.error'), msg);
      return;
    }
    setCancelling(true);
    try {
      console.log(`[ANNULATION] POST /reservations/${cancelTarget.id}/cancel/ — reason:`, reason);
      await cancel(cancelTarget.id, reason);
      setCancelTarget(null);
      setToast({ message: t('reservations.cancelledToast'), color: '#C0392B', testID: 'rdv-cancelled-toast' });
      // L'annulation retire les points gagnés à la réservation.
      refreshUser().catch(() => {});
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.log('[ANNULATION] échec —', status, JSON.stringify(data));
      const serverMessage: string | undefined = data?.error || data?.detail || data?.message;
      const displayMessage = serverMessage
        ? `${serverMessage}${status ? ` (${status})` : ''}`
        : t('reservations.cancelError');
      if (Platform.OS === 'web') {
        window.alert(`${t('common.error')} : ${displayMessage}`);
      } else {
        Alert.alert(t('common.error'), displayMessage);
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleAddToCalendar = async (r: ApiReservation) => {
    const v = rdvView(r);
    const startDate = `${r.date.replace(/-/g, '')}T${r.time.replace(/:/g, '').slice(0, 6)}`;
    if (Platform.OS === 'web') {
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `${v.service} — WilloBarber`,
        dates: `${startDate}/${startDate}`,
        details: `${t('reservations.calendarAlert.barberLabel')} ${v.barbier}\n${SALON_ADDRESS}`,
        location: SALON_ADDRESS,
      });
      window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank');
      return;
    }
    try {
      const calendarUrl = Platform.OS === 'ios' ? 'calshow://' : 'content://com.android.calendar/time/';
      const canOpen = await Linking.canOpenURL(calendarUrl);
      if (!canOpen) throw new Error('calendar-unavailable');
      await Linking.openURL(calendarUrl);
    } catch {
      Alert.alert(
        t('reservations.calendarAlert.title'),
        `${v.service}\n\n📅  ${v.dateLabel} ${t('reservations.cancelNextAlert.confirmWebMid')} ${v.time}\n${t('reservations.calendarAlert.barberLabel')} ${v.barbier}\n📍  ${SALON_ADDRESS}`,
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleReprogrammer = (r: ApiReservation) => {
    const goDateTime = () => router.push({
      pathname: '/(tabs)/book',
      params: {
        reschedule: 'true',
        reservationId: String(r.id),
        serviceId: String(r.service),
        // Même barbier : la reprogrammation ne change que la date/l'heure
        // (ids de BARBERS = prénom en minuscules).
        barberId: (r.barber ?? 'Willo').toLowerCase(),
      },
    });
    const goService = () => router.push('/(tabs)/book');

    if (Platform.OS === 'web') {
      // window.confirm ne propose que 2 choix — Alert.alert est un no-op sur
      // web (react-native-web) donc on enchaîne deux confirmations.
      if (window.confirm(t('reservations.rescheduleAlert.dateTimeOption'))) {
        goDateTime();
        return;
      }
      if (window.confirm(t('reservations.rescheduleAlert.serviceOption'))) {
        goService();
      }
      return;
    }

    Alert.alert(
      t('reservations.rescheduleAlert.title'),
      undefined,
      [
        { text: t('reservations.rescheduleAlert.dateTimeOption'), onPress: goDateTime },
        { text: t('reservations.rescheduleAlert.serviceOption'), onPress: goService },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleRedeemLoyalty = () => {
    const doRedeem = async () => {
      try {
        const result = await loyaltyApi.redeem();
        setLoyaltyPoints(result.loyalty_points);
        // Garde user.loyalty_points (contexte auth) aligné sur le nouveau solde.
        refreshUser();
      } catch (e: any) {
        if (e?.response?.status === 400) {
          // Solde insuffisant côté backend
          const msg = e.response.data?.error ?? 'Solde insuffisant.';
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Rachat impossible', msg);
          return;
        }
        // Pas de connexion backend : fallback local pour la démo
        setLoyaltyPoints((prev) => Math.max(0, prev - 1000));
      }
      if (Platform.OS === 'web') {
        window.alert(t('reservations.loyalty.redeemSuccess'));
      } else {
        Alert.alert(t('reservations.loyalty.redeemSuccessTitle'), t('reservations.loyalty.redeemSuccess'));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('reservations.loyalty.redeemConfirm'))) {
        doRedeem();
      }
      return;
    }
    Alert.alert(
      t('reservations.loyalty.redeemConfirmTitle'),
      t('reservations.loyalty.redeemConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: doRedeem },
      ]
    );
  };

  // Mode "reprise rapide" (skip l'étape 1, prestation déjà connue) : "Reprendre
  // la même coupe" verrouille aussi le barbier (une seule étape restante, la
  // date), tandis que "Adapter" laisse le barbier modifiable (étape 2 barbier
  // puis étape 3 date) — cf. book.tsx (isFastbook / fastbookStartStep).
  const handleResumeSameCut = () => router.push({
    pathname: '/(tabs)/book',
    params: {
      fastbook: 'true',
      prestation: resumeFav?.nom ?? '',
      barbier: resumeFav?.barbier ?? '',
    },
  });

  const handleAdapter = () => router.push({
    pathname: '/(tabs)/book',
    params: {
      fastbook: 'true',
      prestation: resumeFav?.nom ?? '',
    },
  });

  const handleRebook = (h: typeof HISTORIQUE[number]) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${t('reservations.rebookTitle')} ${h.service} ${t('reservations.rebookWith')} ${h.barbierNom} ?`);
      if (confirmed) {
        router.push('/(tabs)/book');
      }
      return;
    }
    // Le wizard (/(tabs)/book) ne lit pas encore de params de prestation/barbier :
    // on informe l'utilisateur avant de le rediriger vers la réservation.
    Alert.alert(
      `${t('reservations.rebookTitle')} ${h.service} ${t('reservations.rebookWith')} ${h.barbierNom}`,
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reservations.rebookGo'), onPress: () => router.push('/(tabs)/book') },
      ]
    );
  };

  const handleReceipt = (h: typeof HISTORIQUE[number], index: number) => {
    const message = `${h.service}\n${h.jour} ${h.mois} · ${h.barbierNom} · ${h.prix}\nN° WB-${h.annee}-${String(index + 1).padStart(5, '0')}`;
    if (Platform.OS === 'web') {
      window.alert(`${t('reservations.receiptTitle')}\n\n${message}`);
      return;
    }
    Alert.alert(t('reservations.receiptTitle'), message, [{ text: t('common.close') }]);
  };

  // Action lancée depuis la modale détail : on la ferme d'abord (iOS n'affiche
  // pas une seconde Modal tant que la première n'a pas fini de se fermer).
  const fromDetail = (action: () => void) => {
    setDetailTarget(null);
    if (Platform.OS === 'ios') setTimeout(action, 350);
    else action();
  };

  // ── Mes autres RDV à venir : tous les RDV à venir sauf le prochain (hero) ──
  const visibleOtherUpcoming = upcomingAccordion.expanded
    ? otherUpcoming
    : otherUpcoming.slice(0, HISTORY_PREVIEW_COUNT);
  const upcomingOthersSection = !showInitialLoader && otherUpcoming.length > 0 && (
    <View testID="upcoming-others">
      <Text style={styles.sectionTitle}>{t('reservations.upcomingOthers')}</Text>
      <View onLayout={upcomingAccordion.onListLayout}>
        {visibleOtherUpcoming.map((r) => {
          const v = rdvView(r);
          return (
            <Pressable
              key={r.id}
              testID={`upcoming-card-${r.id}`}
              style={styles.miniCard}
              onPress={() => setDetailTarget(r)}
              accessibilityRole="button"
              accessibilityLabel={`${v.dateShort} · ${v.timeLabel} — ${v.service} · ${v.barbier}`}
            >
              <Ionicons name="calendar-outline" size={20} color="#C9A84C" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.miniCardDate}>{v.dateShort} · {v.timeLabel}</Text>
                <Text style={styles.miniCardInfo} numberOfLines={2}>
                  {v.service} · {v.barbier} · {fmtPrice(servicePrice(r))}
                </Text>
              </View>
              {/* Pas de bouton dans la carte (déjà un bouton → <button> imbriqué
                  sur web) : l'annulation se fait depuis la modale détail. */}
              <Ionicons name="chevron-forward" size={18} color="rgba(201,168,76,0.7)" />
            </Pressable>
          );
        })}
      </View>
      {otherUpcoming.length > HISTORY_PREVIEW_COUNT && (
        <HistoryToggleButton
          expanded={upcomingAccordion.expanded}
          hiddenCount={otherUpcoming.length - HISTORY_PREVIEW_COUNT}
          unit={t('reservations.rdvCountWord')}
          collapsedLabel={t('reservations.viewAllUpcoming').replace('{n}', String(otherUpcoming.length))}
          expandedLabel={t('reservations.hideUpcoming')}
          onPress={upcomingAccordion.toggle}
          testID="btn-toggle-upcoming"
        />
      )}
    </View>
  );

  const detailView = detailTarget ? rdvView(detailTarget) : null;
  const detailBalance = detailTarget ? balanceOf(detailTarget) : 0;

  return (
    <View style={styles.root}>
      {/* Sticky top bar */}
      {!isTablet && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLogo}>{'{w}'}</Text>
            <Text style={styles.headerBrand}>willobarber</Text>
          </View>
          <View style={[styles.avatar, { width: 32, height: 32, borderRadius: 16 }]}>
            <Text style={[styles.avatarText, { fontSize: 12 }]}>
              {(username[0] ?? 'U').toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      {isTablet ? (
        <View style={styles.tabletContainer}>
          {/* ── HEADER (pleine largeur, au-dessus des 2 colonnes) ────── */}
          <Text style={styles.kicker}>{t('reservations.greetingPrefix')} {username.toUpperCase()}</Text>
          <Text style={styles.pageTitle}>
            {t('reservations.pageTitle1')} <GoldItalic>{t('reservations.pageTitleGold')}</GoldItalic>
          </Text>
          <TouchableOpacity style={styles.newRdvBtn} onPress={() => router.push('/(tabs)/book')} activeOpacity={0.85}>
            <Text style={styles.newRdvBtnText}>{t('reservations.newRdvBtn')}</Text>
          </TouchableOpacity>

          {mainTabsRow}

          {mainTab === 'coupes' && (
            // marginHorizontal négatif + paddingHorizontal égal sur le contenu : rend l'inset
            // gauche/droit local à ce ScrollView plutôt que hérité de tabletContainer, pour
            // qu'il ne dépende pas de la propagation du padding parent sur le web.
            <ScrollView
              style={{ flex: 1, marginHorizontal: -TABLET_CONTAINER_PADDING_H }}
              contentContainerStyle={{ paddingHorizontal: TABLET_CONTAINER_PADDING_H, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {mesCoupesGallery}
            </ScrollView>
          )}

          {mainTab === 'apercu' && (
          <View style={styles.tabletRow}>
            {/* ═══ COLONNE GAUCHE (40%) ═══════════════════════════════ */}
            <ScrollView
              ref={leftColScroll.ref}
              onScroll={leftColScroll.onScroll}
              scrollEventThrottle={16}
              style={styles.tabletLeftCol}
              contentContainerStyle={styles.tabletColContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Stats */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text testID="stat-visits" style={styles.statNum}>{visitList.length}</Text>
                  <Text style={styles.statLabel}>{t('reservations.stats.visits')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text testID="stat-last-visit" style={styles.statText} numberOfLines={2} adjustsFontSizeToFit>{lastVisitLabel}</Text>
                  <Text style={styles.statLabel}>{t('reservations.stats.lastVisit')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNum, { color: '#C9A84C' }]}>{loyaltyPoints}</Text>
                  <Text style={styles.statNumSub}>/ 1000</Text>
                  <Text style={styles.statLabel}>{t('reservations.stats.loyaltyPoints')}</Text>
                </View>
              </View>

              {/* Prochain rendez-vous */}
              {showInitialLoader && (
                <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
              )}
              {!showInitialLoader && loadFailed && (
                <HistoryErrorBanner onRetry={refetch} testID="next-rdv-error-banner" />
              )}
              {!showInitialLoader && rdv && nextReservation && (
                <>
                  <View style={styles.nextRdvBadgeWrap}>
                    <View style={styles.nextRdvBadge}>
                      <Text style={styles.nextRdvBadgeText}>{t('reservations.nextRdvPrefix')} · {rdv.daysLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.mockRdvCard}>
                    <View style={styles.mockRdvInner}>
                      <View style={styles.mockDateBox}>
                        <Text style={styles.mockDateNum}>{rdv.jour}</Text>
                        <Text style={styles.mockDateMon}>{rdv.mois}</Text>
                        <Text style={styles.mockDateDay}>{rdv.jourAbbr}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mockRdvService}>
                          <GoldItalic>{rdv.service}</GoldItalic>
                        </Text>
                        <View style={styles.mockRdvInfoRow}>
                          <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.time')}</Text>
                          <Text style={styles.mockRdvVal}>{rdv.time}</Text>
                        </View>
                        <View style={styles.mockRdvInfoRow}>
                          <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.barber')}</Text>
                          <Text style={styles.mockRdvVal}>{rdv.barbier}</Text>
                        </View>
                        <View style={styles.mockRdvInfoRow}>
                          <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.address')}</Text>
                          <Text style={styles.mockRdvVal}>Rue Auguste Van Zande 78</Text>
                        </View>
                      </View>
                    </View>

                    {nextRdvBalance > 0 && (
                      <View testID="next-rdv-balance" style={styles.soldePill}>
                        <Text style={styles.soldeText}>{nextRdvBalanceLabel}</Text>
                      </View>
                    )}

                    <RdvActions
                      onReschedule={() => handleReprogrammer(nextReservation)}
                      onCancel={() => setCancelTarget(nextReservation)}
                      onQr={nextReservation.qr_code ? () => setQrTarget(nextReservation) : undefined}
                      onCalendar={() => handleAddToCalendar(nextReservation)}
                    />
                  </View>
                </>
              )}

              {/* Mes autres RDV à venir */}
              {upcomingOthersSection}

              {/* Resume card — masqué pour un nouveau client sans historique */}
              {resumeFav && !loadFailed && (
                <>
                  <Text style={styles.sectionTitle}>{t('reservations.resumeTitle')}</Text>

                  <View style={styles.resumeCard}>
                    <View style={styles.resumeBadge}>
                      <Text style={styles.resumeBadgeText}>{t('reservations.resumeBadge').replace('{n}', String(resumeFav.count))}</Text>
                    </View>
                    <View style={styles.resumeRow}>
                      <View style={styles.scissorsBox}>
                        <Text style={{ fontSize: 22 }}>✂️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resumeServiceName}>{resumeFav.nom}</Text>
                        <Text style={styles.resumeServiceMeta}>
                  {t('reservations.resumeServiceMeta')
                    .replace('{dur}', resumeFav.dur)
                    .replace('{barber}', resumeFav.barbier)
                    .replace('{price}', resumeFav.prix)}
                </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <TouchableOpacity
                        style={[styles.btnPrimary, { flex: 1 }]}
                        onPress={handleResumeSameCut}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.btnPrimaryText}>{t('reservations.resumeCta')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={handleAdapter} activeOpacity={0.85}>
                        <Text style={styles.btnOutlineText}>{t('reservations.adaptBtn')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Vos favoris — masqué tant que l'historique n'a pas 2 prestations distinctes */}
              {showFavoris && (
              <>
              <Text style={styles.sectionTitle}>{t('reservations.favoritesTitle')}</Text>

              <View style={styles.favGrid}>
                {FAVORIS.map((fav) => (
                  <View key={fav.nom} testID="fav-card" style={[styles.favCard, styles.favCardTablet]}>
                    <Text style={styles.favStar}>★</Text>
                    <Text style={styles.favName}>{fav.nom}</Text>
                    <Text style={styles.favMeta}>
                      {fav.dur ? `${fav.dur} · ` : ''}<Text style={{ color: '#C9A84C' }}>{fav.prix}</Text>
                    </Text>
                    <View style={styles.favDivider} />
                    <Text style={styles.favCount}>{fav.count}× · {t('reservations.favLastPrefix')} {fav.date}</Text>
                  </View>
                ))}
              </View>
              </>
              )}
            </ScrollView>

            {/* ═══ COLONNE DROITE (60%) ═══════════════════════════════ */}
            <ScrollView
              ref={historyScroll.ref}
              onScroll={historyScroll.onScroll}
              scrollEventThrottle={16}
              style={styles.tabletRightCol}
              contentContainerStyle={styles.tabletColContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#C9A84C" />}
            >
              {/* Historique des réservations */}
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>{t('reservations.historyTitle')}</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 14 }}
              >
                {['Tous', '2026', '2025'].map(yr => (
                  <Pressable
                    key={yr}
                    onPress={() => { setHistFilter(yr); setSelectedHistIndex(null); histAccordion.setExpanded(false); }}
                    style={[styles.filterChip, histFilter === yr && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, histFilter === yr && styles.filterChipTextActive]}>{yr === 'Tous' ? t('reservations.filter.all') : yr}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {showInitialLoader ? (
                <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
              ) : loadFailed ? (
                <HistoryErrorBanner onRetry={refetch} />
              ) : filteredHist.length === 0 ? (
                <Text style={styles.emptyHist}>{t('reservations.emptyHistory')}</Text>
              ) : (
                <View style={styles.histSplit}>
                  <View style={styles.histSplitList}>
                    <View onLayout={histAccordion.onListLayout}>
                    {visibleHist.map((h, i) => {
                      const isSelected = selectedHistIndex === i;
                      return (
                        <FadeOut key={h.id ?? i} active={fadingId === h.id} onDone={() => fadeDoneRef.current?.()}>
                          {/* ✕ à côté de la ligne (pas dedans) : la ligne est déjà un bouton. */}
                          <View testID={`hist-card-${h.id}`}>
                            <Pressable
                              testID={`hist-row-${i}`}
                              onPress={() => setSelectedHistIndex(i)}
                              style={[styles.histListRow, styles.histWithHide, isSelected && styles.histListRowActive, h.hidden && styles.histHidden]}
                            >
                              <View style={styles.histDateBox}>
                                <Text style={styles.histDateNum}>{h.jour}</Text>
                                <Text style={styles.histDateMon}>{h.mois}</Text>
                              </View>
                              <View style={{ flex: 1, gap: 3 }}>
                                <Text style={styles.histService} numberOfLines={1}>{h.service}</Text>
                                <Text style={styles.histMeta}>{h.barbierNom} · {h.prix}</Text>
                              </View>
                            </Pressable>
                            {h.id != null && (
                              <HideCoupeButton hidden={h.hidden} onPress={() => handleHidePress(h)} testID={`btn-hide-coupe-${h.id}`} />
                            )}
                          </View>
                        </FadeOut>
                      );
                    })}
                    </View>
                    {histToggle}
                    {hiddenToggle}
                  </View>
                  {selectedHistIndex === null ? (
                    <View style={styles.histSplitDetail}>
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#888', fontSize: 16 }}>
                          {t('reservations.selectRdvPlaceholder')}
                        </Text>
                      </View>
                    </View>
                  ) : (() => {
                    const i = Math.min(selectedHistIndex, filteredHist.length - 1);
                    const h = filteredHist[i];
                    return (
                      <View style={styles.histSplitDetail}>
                        <View style={styles.histDetailHeader}>
                          <View style={[styles.histDateBox, { backgroundColor: '#2A2520' }]}>
                            <Text style={styles.histDateNum}>{h.jour}</Text>
                            <Text style={styles.histDateMon}>{h.mois}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.histDetailService}>{h.service}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                              <View style={[
                                styles.avatar,
                                { width: 30, height: 30, borderRadius: 15, backgroundColor: h.couleur + '33', borderColor: h.couleur },
                              ]}>
                                <Text style={[styles.avatarText, { fontSize: 12, color: h.couleur }]}>{h.barbier}</Text>
                              </View>
                              <Text style={styles.histMeta}>{h.barbierNom}</Text>
                              <Text style={{ color: '#C9A84C', fontSize: 14, fontWeight: '700' }}>{h.prix}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.histDetailRef}>N° WB-{h.annee}-{String(i + 1).padStart(5, '0')}</Text>
                        <View style={{ flexDirection: 'column', gap: 10, marginTop: 18 }}>
                          <TouchableOpacity testID={`btn-rebook-${i}`} style={[styles.btnPrimary, { width: '100%' }]} onPress={() => handleRebook(h)} activeOpacity={0.85}>
                            <Text style={styles.btnPrimaryText}>{t('reservations.rebook')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID={`btn-receipt-${i}`} style={[styles.btnOutline, { width: '100%' }]} onPress={() => handleReceipt(h, i)} activeOpacity={0.85}>
                            <Text style={styles.btnOutlineText}>{t('reservations.receipt')}</Text>
                          </TouchableOpacity>
                        </View>
                        {isCommentable(h) && (
                          <View style={{ marginTop: 18 }}>
                            <ReservationComment
                              key={`${h.id}:${linkedOpenId === h.id}`}
                              defaultExpanded={linkedOpenId === h.id}
                              reservationId={h.id as number}
                              review={reviewForReservation(h.id as number)}
                              onChange={handleCommentChange}
                            />
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Programme fidélité */}
              <Text style={[styles.sectionKicker, { marginTop: 28 }]}>{t('reservations.loyalty.programTitle')}</Text>
              <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyHeader}>
                  <View>
                    <Text style={styles.loyaltyBrandLogo}>{'{w}'} willobarber</Text>
                    <Text style={styles.loyaltyBrandSub}>{t('reservations.loyalty.brandSub')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loyaltyPoints}>{loyaltyPoints}</Text>
                    <Text style={styles.loyaltyPtsSuffix}>pts</Text>
                  </View>
                </View>

                <Text style={styles.loyaltyProgressLabel}>{t('reservations.loyalty.progressLabel')}</Text>
                <View
                  style={styles.loyaltyBarBg}
                  onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                >
                  <Animated.View
                    style={[
                      styles.loyaltyBarFill,
                      {
                        transform: [
                          { translateX: Animated.multiply(Animated.subtract(barAnim, 1), barWidth) },
                        ],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.loyaltyBarCaption}>
                  {ptsRestants} {t('reservations.loyalty.barCaptionSuffix')}
                </Text>

                <View style={styles.loyaltyTiersRow}>
                  {TIERS.map((tier, i) => {
                    const reached  = loyaltyPoints >= tier.min;
                    const nextTier = TIERS[i + 1];
                    const isActive  = reached && (!nextTier || loyaltyPoints < nextTier.min);
                    const isDepasse = reached && !isActive;
                    return (
                      <View key={tier.label} style={styles.tierBadgeWrap}>
                        <View
                          style={[
                            styles.tierBadge,
                            isActive  && { backgroundColor: tier.color },
                            isDepasse && { backgroundColor: '#2A2520', borderWidth: 1, borderColor: tier.color },
                            !reached  && { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tierBadgeText,
                              isActive  && { color: '#1A1208' },
                              isDepasse && { color: tier.color },
                              !reached  && { color: 'rgba(255,255,255,0.35)' },
                            ]}
                          >
                            {tier.label}
                          </Text>
                        </View>
                        <Text style={styles.tierThreshold}>{tier.threshold}</Text>
                      </View>
                    );
                  })}
                </View>

                {loyaltyPoints >= 1000 ? (
                  <>
                    <TouchableOpacity style={styles.loyaltyCta} activeOpacity={0.85} onPress={handleRedeemLoyalty}>
                      <Text style={styles.loyaltyCtaText}>{t('reservations.loyalty.ctaText')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.loyaltyCtaNote}>{t('reservations.loyalty.ctaNote')}</Text>
                  </>
                ) : (
                  <Text style={styles.loyaltyCtaDisabled}>
                    1000 {t('reservations.loyalty.pointsRequired')} ({1000 - loyaltyPoints} {t('reservations.loyalty.ctaDisabledSuffix')}
                  </Text>
                )}
              </View>

              {/* Historique des points */}
              <Text style={[styles.sectionKicker, { marginTop: 24 }]}>{t('reservations.pointsHistoryTitle')}</Text>
              {showInitialLoader ? (
                <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
              ) : loadFailed ? (
                <HistoryErrorBanner onRetry={refetch} testID="points-error-banner" />
              ) : TRANSACTIONS.length === 0 ? (
                <Text style={styles.emptyHist}>{t('reservations.transactionsEmpty')}</Text>
              ) : (
                <>
                  <View onLayout={pointsAccordion.onListLayout}>{visibleTransactions.map(renderTransaction)}</View>
                  {pointsToggle}
                </>
              )}

              {/* Mes alertes (liste d'attente par créneau) */}
              <WaitlistAlerts titleStyle={[styles.sectionKicker, { marginTop: 28 }]} />
            </ScrollView>
          </View>
          )}
        </View>
      ) : (
      <ScrollView
        ref={historyScroll.ref}
        onScroll={historyScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#C9A84C" />}
      >

        {/* ── 1. HEADER ─────────────────────────────────────────────── */}
        <Text style={styles.kicker}>{t('reservations.greetingPrefix')} {username.toUpperCase()}</Text>
        <Text style={styles.pageTitle}>
          {t('reservations.pageTitle1')} <GoldItalic>{t('reservations.pageTitleGold')}</GoldItalic>
        </Text>
        <TouchableOpacity style={styles.newRdvBtn} onPress={() => router.push('/(tabs)/book')} activeOpacity={0.85}>
          <Text style={styles.newRdvBtnText}>{t('reservations.newRdvBtn')}</Text>
        </TouchableOpacity>

        {mainTabsRow}

        {mainTab === 'coupes' && mesCoupesGallery}

        {mainTab === 'apercu' && (
        <>
        {/* ── 2. GRILLE STATS ───────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text testID="stat-visits" style={styles.statNum}>{visitList.length}</Text>
            <Text style={styles.statLabel}>{t('reservations.stats.visits')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text testID="stat-last-visit" style={styles.statText} numberOfLines={2} adjustsFontSizeToFit>{lastVisitLabel}</Text>
            <Text style={styles.statLabel}>{t('reservations.stats.lastVisit')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#C9A84C' }]}>{loyaltyPoints}</Text>
            <Text style={styles.statNumSub}>/ 1000</Text>
            <Text style={styles.statLabel}>{t('reservations.stats.loyaltyPoints')}</Text>
          </View>
        </View>

        {/* ── 3. PROCHAIN RENDEZ-VOUS ───────────────────────────────── */}
        {showInitialLoader && (
          <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
        )}
        {!showInitialLoader && loadFailed && (
          <HistoryErrorBanner onRetry={refetch} testID="next-rdv-error-banner" />
        )}
        {!showInitialLoader && rdv && nextReservation && (
          <>
            <View style={styles.nextRdvBadgeWrap}>
              <View style={styles.nextRdvBadge}>
                <Text style={styles.nextRdvBadgeText}>{t('reservations.nextRdvPrefix')} · {rdv.daysLabel}</Text>
              </View>
            </View>

            <View style={styles.mockRdvCard}>
              <View style={styles.mockRdvInner}>
                <View style={styles.mockDateBox}>
                  <Text style={styles.mockDateNum}>{rdv.jour}</Text>
                  <Text style={styles.mockDateMon}>{rdv.mois}</Text>
                  <Text style={styles.mockDateDay}>{rdv.jourAbbr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mockRdvService}>
                    <GoldItalic>{rdv.service}</GoldItalic>
                  </Text>
                  <View style={styles.mockRdvInfoRow}>
                    <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.time')}</Text>
                    <Text style={styles.mockRdvVal}>{rdv.time}</Text>
                  </View>
                  <View style={styles.mockRdvInfoRow}>
                    <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.barber')}</Text>
                    <Text style={styles.mockRdvVal}>{rdv.barbier}</Text>
                  </View>
                  <View style={styles.mockRdvInfoRow}>
                    <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.address')}</Text>
                    <Text style={styles.mockRdvVal}>Rue Auguste Van Zande 78</Text>
                  </View>
                </View>
              </View>

              {nextRdvBalance > 0 && (
                <View testID="next-rdv-balance" style={styles.soldePill}>
                  <Text style={styles.soldeText}>{nextRdvBalanceLabel}</Text>
                </View>
              )}

              <RdvActions
                onReschedule={() => handleReprogrammer(nextReservation)}
                onCancel={() => setCancelTarget(nextReservation)}
                onQr={nextReservation.qr_code ? () => setQrTarget(nextReservation) : undefined}
                onCalendar={() => handleAddToCalendar(nextReservation)}
              />
            </View>
          </>
        )}

        {/* ── 3b. MES AUTRES RDV À VENIR ───────────────────────────────── */}
        {upcomingOthersSection}

        {/* ── 4. REPRENEZ LÀ OÙ VOUS EN ÉTIEZ ── masqué pour un nouveau client sans historique */}
        {resumeFav && !loadFailed && (
          <>
            <Text style={styles.sectionTitle}>{t('reservations.resumeTitle')}</Text>

            <View style={styles.resumeCard}>
              <View style={styles.resumeBadge}>
                <Text style={styles.resumeBadgeText}>{t('reservations.resumeBadge').replace('{n}', String(resumeFav.count))}</Text>
              </View>
              <View style={styles.resumeRow}>
                <View style={styles.scissorsBox}>
                  <Text style={{ fontSize: 22 }}>✂️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeServiceName}>{resumeFav.nom}</Text>
                  <Text style={styles.resumeServiceMeta}>
                  {t('reservations.resumeServiceMeta')
                    .replace('{dur}', resumeFav.dur)
                    .replace('{barber}', resumeFav.barbier)
                    .replace('{price}', resumeFav.prix)}
                </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity
                  style={[styles.btnPrimary, { flex: 1 }]}
                  onPress={handleResumeSameCut}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnPrimaryText}>{t('reservations.resumeCta')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={handleAdapter} activeOpacity={0.85}>
                  <Text style={styles.btnOutlineText}>{t('reservations.adaptBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── 5. VOS FAVORIS ── masqué tant que l'historique n'a pas 2 prestations distinctes */}
        {showFavoris && (
          <Text style={styles.sectionTitle}>{t('reservations.favoritesTitle')}</Text>
        )}

        {!showFavoris ? null : isTablet ? (
          <View style={styles.favGrid}>
            {FAVORIS.map((fav) => (
              <View key={fav.nom} testID="fav-card" style={[styles.favCard, styles.favCardTablet]}>
                <Text style={styles.favStar}>★</Text>
                <Text style={styles.favName}>{fav.nom}</Text>
                <Text style={styles.favMeta}>
                  {fav.dur ? `${fav.dur} · ` : ''}<Text style={{ color: '#C9A84C' }}>{fav.prix}</Text>
                </Text>
                <View style={styles.favDivider} />
                <Text style={styles.favCount}>{fav.count}× · {t('reservations.favLastPrefix')} {fav.date}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 4, marginBottom: 24 }}
          >
            {FAVORIS.map((fav) => (
              <View key={fav.nom} testID="fav-card" style={styles.favCard}>
                <Text style={styles.favStar}>★</Text>
                <Text style={styles.favName}>{fav.nom}</Text>
                <Text style={styles.favMeta}>
                  {fav.dur ? `${fav.dur} · ` : ''}<Text style={{ color: '#C9A84C' }}>{fav.prix}</Text>
                </Text>
                <View style={styles.favDivider} />
                <Text style={styles.favCount}>{fav.count}× · {t('reservations.favLastPrefix')} {fav.date}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── 6. HISTORIQUE DES RÉSERVATIONS ────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('reservations.historyTitle')}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 14 }}
        >
          {['Tous', '2026', '2025'].map(yr => (
            <Pressable
              key={yr}
              onPress={() => { setHistFilter(yr); setSelectedHistIndex(null); histAccordion.setExpanded(false); }}
              style={[styles.filterChip, histFilter === yr && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, histFilter === yr && styles.filterChipTextActive]}>{yr === 'Tous' ? t('reservations.filter.all') : yr}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {showInitialLoader ? (
          <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
        ) : loadFailed ? (
          <HistoryErrorBanner onRetry={refetch} />
        ) : filteredHist.length === 0 ? (
          <Text style={styles.emptyHist}>{t('reservations.emptyHistory')}</Text>
        ) : (
          <View onLayout={histAccordion.onListLayout}>
          {visibleHist.map((h, i) => (
            <FadeOut key={h.id ?? i} active={fadingId === h.id} onDone={() => fadeDoneRef.current?.()}>
              <View testID={`hist-card-${h.id}`} style={[styles.histCard, styles.histWithHide, h.hidden && styles.histHidden]}>
                <View style={styles.histDateBox}>
                  <Text style={styles.histDateNum}>{h.jour}</Text>
                  <Text style={styles.histDateMon}>{h.mois}</Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.histService}>{h.service}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={[
                      styles.avatar,
                      { width: 28, height: 28, borderRadius: 14, backgroundColor: h.couleur + '33', borderColor: h.couleur },
                    ]}>
                      <Text style={[styles.avatarText, { fontSize: 11, color: h.couleur }]}>{h.barbier}</Text>
                    </View>
                    <Text style={styles.histMeta}>{h.barbierNom}</Text>
                    <Text style={{ color: '#C9A84C', fontSize: 13, fontWeight: '600' }}>{h.prix}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity testID={`btn-rebook-${i}`} style={styles.iconBtn} onPress={() => handleRebook(h)}>
                    <Text style={{ color: '#C9A84C', fontSize: 15 }}>↺</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`btn-receipt-${i}`} style={styles.iconBtn} onPress={() => handleReceipt(h, i)}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>↓</Text>
                  </TouchableOpacity>
                </View>
                {h.id != null && (
                  <HideCoupeButton hidden={h.hidden} onPress={() => handleHidePress(h)} testID={`btn-hide-coupe-${h.id}`} />
                )}
              </View>
              {isCommentable(h) && (
                <View style={styles.histComment}>
                  <ReservationComment
                    reservationId={h.id as number}
                    review={reviewForReservation(h.id as number)}
                    onChange={handleCommentChange}
                  />
                </View>
              )}
            </FadeOut>
          ))}
          </View>
        )}
        {histToggle}
        {hiddenToggle}

        {/* ── 7. PROGRAMME FIDÉLITÉ ─────────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 28 }]}>{t('reservations.loyalty.programTitle')}</Text>
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <View>
              <Text style={styles.loyaltyBrandLogo}>{'{w}'} willobarber</Text>
              <Text style={styles.loyaltyBrandSub}>{t('reservations.loyalty.brandSub')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.loyaltyPoints}>{loyaltyPoints}</Text>
              <Text style={styles.loyaltyPtsSuffix}>pts</Text>
            </View>
          </View>

          <Text style={styles.loyaltyProgressLabel}>{t('reservations.loyalty.progressLabel')}</Text>
          <View
            style={styles.loyaltyBarBg}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.loyaltyBarFill,
                {
                  transform: [
                    { translateX: Animated.multiply(Animated.subtract(barAnim, 1), barWidth) },
                  ],
                },
              ]}
            />
          </View>
          <Text style={styles.loyaltyBarCaption}>
            {ptsRestants} {t('reservations.loyalty.barCaptionSuffix')}
          </Text>

          <View style={styles.loyaltyTiersRow}>
            {TIERS.map((tier, i) => {
              const reached  = loyaltyPoints >= tier.min;
              const nextTier = TIERS[i + 1];
              const isActive  = reached && (!nextTier || loyaltyPoints < nextTier.min);
              const isDepasse = reached && !isActive;
              return (
                <View key={tier.label} style={styles.tierBadgeWrap}>
                  <View
                    style={[
                      styles.tierBadge,
                      isActive  && { backgroundColor: tier.color },
                      isDepasse && { backgroundColor: '#2A2520', borderWidth: 1, borderColor: tier.color },
                      !reached  && { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierBadgeText,
                        isActive  && { color: '#1A1208' },
                        isDepasse && { color: tier.color },
                        !reached  && { color: 'rgba(255,255,255,0.35)' },
                      ]}
                    >
                      {tier.label}
                    </Text>
                  </View>
                  <Text style={styles.tierThreshold}>{tier.threshold}</Text>
                </View>
              );
            })}
          </View>

          {loyaltyPoints >= 1000 ? (
            <>
              <TouchableOpacity style={styles.loyaltyCta} activeOpacity={0.85} onPress={handleRedeemLoyalty}>
                <Text style={styles.loyaltyCtaText}>{t('reservations.loyalty.ctaText')}</Text>
              </TouchableOpacity>
              <Text style={styles.loyaltyCtaNote}>{t('reservations.loyalty.ctaNote')}</Text>
            </>
          ) : (
            <Text style={styles.loyaltyCtaDisabled}>
              1000 {t('reservations.loyalty.pointsRequired')} ({1000 - loyaltyPoints} {t('reservations.loyalty.ctaDisabledSuffix')}
            </Text>
          )}
        </View>

        {/* ── 8. HISTORIQUE DES POINTS ──────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 24 }]}>{t('reservations.pointsHistoryTitle')}</Text>
        {showInitialLoader ? (
          <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
        ) : loadFailed ? (
          <HistoryErrorBanner onRetry={refetch} testID="points-error-banner" />
        ) : TRANSACTIONS.length === 0 ? (
          <Text style={styles.emptyHist}>{t('reservations.transactionsEmpty')}</Text>
        ) : (
          <>
            <View onLayout={pointsAccordion.onListLayout}>{visibleTransactions.map(renderTransaction)}</View>
            {pointsToggle}
          </>
        )}

        {/* ── 9. MES ALERTES (liste d'attente par créneau) ───────────────── */}
        <WaitlistAlerts titleStyle={[styles.sectionKicker, { marginTop: 28 }]} />
        </>
        )}
      </ScrollView>
      )}

      <CancelModal
        visible={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelling}
      />

      <QrCodeModal
        reservation={qrTarget}
        onClose={() => setQrTarget(null)}
      />

      <ReviewModal
        target={reviewModalTarget}
        review={reviewModalTarget ? reviewForReservation(reviewModalTarget.id) : null}
        onClose={() => setReviewModalTarget(null)}
        onChange={handleCommentChange}
      />

      {/* Détail d'un RDV à venir (tap sur une mini-carte) */}
      <Modal visible={!!detailTarget} transparent animationType="fade" onRequestClose={() => setDetailTarget(null)}>
        <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
          <View testID="upcoming-detail-modal" style={[styles.modalBox, isTablet && styles.modalBoxTablet]}>
            {detailTarget && detailView && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.nextRdvBadgeWrap}>
                  <View style={styles.nextRdvBadge}>
                    <Text style={styles.nextRdvBadgeText}>{detailView.jourAbbr} {detailView.dateShort} · {detailView.daysLabel}</Text>
                  </View>
                </View>
                <Text style={styles.mockRdvService}>
                  <GoldItalic>{detailView.service}</GoldItalic>
                </Text>
                <View style={styles.mockRdvInfoRow}>
                  <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.time')}</Text>
                  <Text style={styles.mockRdvVal}>{detailView.dateLabel} · {detailView.time}</Text>
                </View>
                <View style={styles.mockRdvInfoRow}>
                  <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.barber')}</Text>
                  <Text style={styles.mockRdvVal}>{detailView.barbier}</Text>
                </View>
                <View style={[styles.mockRdvInfoRow, { marginBottom: 14 }]}>
                  <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.address')}</Text>
                  <Text style={styles.mockRdvVal}>{SALON_ADDRESS}</Text>
                </View>
                {detailBalance > 0 && (
                  <View style={styles.soldePill}>
                    <Text style={styles.soldeText}>{balanceLabel(detailBalance)}</Text>
                  </View>
                )}
                <RdvActions
                  idPrefix="detail-"
                  onReschedule={() => fromDetail(() => handleReprogrammer(detailTarget))}
                  onCancel={() => fromDetail(() => setCancelTarget(detailTarget))}
                  onQr={detailTarget.qr_code ? () => fromDetail(() => setQrTarget(detailTarget)) : undefined}
                  onCalendar={() => handleAddToCalendar(detailTarget)}
                />
              </ScrollView>
            )}
            <TouchableOpacity onPress={() => setDetailTarget(null)} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <HideCoupeModal
        visible={hideTarget != null}
        onClose={() => setHideTarget(null)}
        onConfirm={handleConfirmHide}
        loading={hiding}
      />

      <NotificationToast toast={toast} onHide={hideToast} />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 0),
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerLogo:  { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#C9A84C' },
  headerBrand: { fontFamily: Fonts.semiBold, fontSize: 19, fontWeight: '600', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 56 },

  mainTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  mainTabPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  mainTabPillActive: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  mainTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  mainTabTextActive: {
    color: '#1A1208',
  },

  // ── iPad — layout 2 colonnes ────────────────────────────────────────────────
  tabletContainer: {
    flex: 1,
    paddingHorizontal: TABLET_CONTAINER_PADDING_H,
    paddingTop: 40,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  tabletLeftCol: {
    flex: 2,
  },
  tabletRightCol: {
    flex: 3,
  },
  tabletColContent: {
    paddingBottom: 56,
  },

  kicker:    { fontSize: 11, fontWeight: '600', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontFamily: Fonts.bold, fontSize: 34, fontWeight: '700', color: '#fff', lineHeight: 40, marginBottom: 8 },

  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
    marginTop: 24,
  },

  // Bouton principal
  newRdvBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  newRdvBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },

  // ── Stats grid ──────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1814',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: Fonts.bold,
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 40,
  },
  // Valeur texte (« Il y a 3 mois ») : plus petite que statNum pour tenir dans la carte.
  statText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 24,
    textAlign: 'center',
    minHeight: 40,
    textAlignVertical: 'center',
  },
  statNumSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    marginTop: 1,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'center',
  },

  // ── Prochain RDV badge ──────────────────────────────────────────────────────
  nextRdvBadgeWrap: { marginBottom: 10 },
  nextRdvBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2D6A4F',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nextRdvBadgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3, color: '#fff' },

  // ── Mock RDV card ──────────────────────────────────────────────────────────
  mockRdvCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  mockRdvInner: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  mockDateBox: {
    backgroundColor: '#2A2520',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexShrink: 0,
  },
  mockDateNum: { fontFamily: Fonts.bold, fontSize: 32, fontWeight: '700', color: '#C9A84C', lineHeight: 34 },
  mockDateMon: { fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', marginTop: 3, textTransform: 'uppercase' },
  mockDateDay: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  mockRdvService: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 8, lineHeight: 26 },
  mockRdvInfoRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  mockRdvKey:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 52 },
  mockRdvVal:     { fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1 },

  soldePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  soldeText: { fontSize: 12, color: '#C9A84C', fontWeight: '500' },

  // ── Resume card ──────────────────────────────────────────────────────────────
  resumeCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  resumeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  resumeBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#C9A84C', letterSpacing: 0.5 },
  resumeRow:       { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  scissorsBox: {
    width: 48,
    height: 48,
    backgroundColor: '#2A2520',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resumeServiceName: { fontFamily: Fonts.bold, fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  resumeServiceMeta: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  // ── Favoris ──────────────────────────────────────────────────────────────────
  favCard: {
    backgroundColor: '#1A1814',
    borderRadius: 14,
    padding: 16,
    width: 200,
  },
  favStar:    { fontSize: 18, color: '#C9A84C', marginBottom: 8 },
  favName:    { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  favMeta:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  favDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 8 },
  favCount:   { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  favGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  favCardTablet: { width: '48%' },

  // ── Historique — vue iPad master/detail ─────────────────────────────────────
  histSplit:       { flexDirection: 'row', gap: 16, marginBottom: 20 },
  histSplitList:   { width: '40%', gap: 8 },
  histSplitDetail: { flex: 1, backgroundColor: '#1A1814', borderRadius: 16, padding: 20 },
  histListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  histListRowActive: { borderColor: '#C9A84C' },
  histDetailHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  histDetailService: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff' },
  histDetailRef:     { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 16, fontFamily: 'monospace' },

  // ── Historique réservations ───────────────────────────────────────────────────
  filterChip:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, backgroundColor: '#1A1814', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive:     { backgroundColor: '#C9A84C', borderColor: '#C9A84C' },
  filterChipText:       { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  filterChipTextActive: { color: '#1A1208' },
  emptyHist:            { fontSize: 13.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 10, marginBottom: 20 },

  histCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  histDateBox: { width: 42, alignItems: 'center', flexShrink: 0 },
  // Place réservée à droite pour la ✕ (hors des icônes ↺ / ↓).
  histWithHide: { paddingRight: 34 },
  histHidden:   { opacity: 0.5 },
  hideBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  hiddenToggle:     { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 8, marginTop: 4 },
  hiddenToggleText: { color: 'rgba(255,255,255,0.45)', fontSize: 12.5, textDecorationLine: 'underline' },
  histDateNum: { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#fff', lineHeight: 25 },
  histDateMon: { fontSize: 11, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)', marginTop: 1, textTransform: 'uppercase' },
  histService: { fontSize: 15, fontWeight: '500', color: '#fff' },
  histMeta:    { fontSize: 11.5, color: 'rgba(255,255,255,0.5)' },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  histComment: {
    marginTop: -4,
    marginBottom: 10,
  },

  // ── Actions d'un RDV à venir (2 × 2) ─────────────────────────────────────────
  rdvActions:    { gap: 10 },
  rdvActionsRow: { flexDirection: 'row', gap: 10 },
  rdvActionBtn:  { flex: 1, paddingHorizontal: 10, justifyContent: 'center' },
  // Libellés longs (« 📅 Ajouter au calendrier ») : retour à la ligne plutôt que tronqués.
  rdvActionText: { textAlign: 'center' },

  // ── Mes autres RDV à venir ───────────────────────────────────────────────────
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111',
    borderWidth: 0.5,
    borderColor: '#C9A84C',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  miniCardDate: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  miniCardInfo: {
    color: '#C9A84C',
    fontFamily: Fonts.italic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 20,
  },

  // Avatar
  avatar:     { backgroundColor: 'rgba(201,168,76,0.2)', borderWidth: 1.5, borderColor: '#C9A84C', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#C9A84C', fontFamily: Fonts.semiBold, fontWeight: '600' },

  // Buttons
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 14.5 },
  btnOutline: {
    borderRadius: 100,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { color: 'rgba(255,255,255,0.8)', fontWeight: '500', fontSize: 13.5 },
  btnDanger: {
    flex: 1,
    backgroundColor: '#FDECEA',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnDangerText:   { color: '#C0392B', fontWeight: '600', fontSize: 14.5 },
  btnDangerSm:     { backgroundColor: '#FDECEA', borderRadius: 100, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnDangerSmText: { color: '#C0392B', fontWeight: '600', fontSize: 13.5 },

  // ── Loyalty card ──────────────────────────────────────────────────────────────
  loyaltyCard: {
    backgroundColor: '#1A1814',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  loyaltyHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  loyaltyBrandLogo: { fontFamily: Fonts.bold, fontSize: 16, fontWeight: '700', color: '#C9A84C' },
  loyaltyBrandSub:  { fontSize: 12, color: '#fff', marginTop: 2 },
  loyaltyPoints:    { fontFamily: Fonts.bold, fontSize: 32, fontWeight: '700', color: '#C9A84C', lineHeight: 34 },
  loyaltyPtsSuffix: { fontSize: 13, color: '#fff', textAlign: 'right', marginTop: 2 },

  loyaltyProgressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  loyaltyBarBg:         { height: 8, borderRadius: 4, backgroundColor: '#2A2520', marginBottom: 8, overflow: 'hidden' },
  loyaltyBarFill:       { height: 8, width: '100%', borderRadius: 4, backgroundColor: '#C9A84C' },
  loyaltyBarCaption:    { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 16 },

  loyaltyTiersRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tierBadgeWrap:   { flex: 1, alignItems: 'center', gap: 6 },
  tierBadge: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 100,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tierThreshold: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  loyaltyCta: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 8,
  },
  loyaltyCtaText:     { fontFamily: Fonts.semiBold, color: '#1A1208', fontWeight: '600', fontSize: 14 },
  loyaltyCtaNote:     { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  loyaltyCtaDisabled: { fontSize: 12.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // ── Transaction history ────────────────────────────────────────────────────────
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txReason: { fontSize: 15, color: '#fff', marginBottom: 2 },
  txDate:   { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  txPoints: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700' },

  // Cancel modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayTablet: { justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: '#1A1814',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalBoxTablet: {
    borderRadius: 24,
    width: '90%',
    maxWidth: 480,
    paddingBottom: 24,
  },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 8 },
  modalSub:   { fontSize: 13.5, color: 'rgba(255,255,255,0.5)', marginBottom: 18, lineHeight: 19 },
  qrModalBox:     { alignItems: 'center' },
  qrModalImage:   { width: 250, height: 250, marginBottom: 18 },
  qrModalCaption: { fontSize: 13, color: '#888', marginBottom: 20 },
  qrModalCloseBtn: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#C9A84C',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#252018',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  btnKeep: {
    flex: 1,
    borderRadius: 100,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnKeepText: { color: '#fff', fontWeight: '600', fontSize: 14.5 },
  btnHideConfirm: {
    flex: 1,
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnHideConfirmText: { color: '#1A1208', fontWeight: '700', fontSize: 14.5 },
});
