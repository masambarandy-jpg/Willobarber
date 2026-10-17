import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CoiffeurApiError, coiffeurCheckinApi, type CheckinResponse } from '@/services/api';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/i18n/translations';
import Avatar from './Avatar';
import { CloseIcon } from './Icons';
import { CC, SERIF } from './theme';

type Props = { visible: boolean; onClose: () => void };

const LOCALES: Record<Language, string> = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' };
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const TOAST_MS = 2600;

// 'YYYY-MM-DD' parsé en date locale : new Date('2026-10-17') serait en UTC
// et pourrait afficher la veille selon le fuseau.
function parseDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function ClientScanModal({ visible, onClose }: Props) {
  const { t, language } = useLanguage();
  const locale = LOCALES[language];
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  // onBarcodeScanned se déclenche à chaque frame : verrou synchrone pour
  // n'envoyer qu'une requête par QR présenté.
  const scanLock = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setResult(null);
    setQrCode(null);
    setManualInput('');
    scanLock.current = false;
  }, [visible]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const errorMessage = (error: unknown) => {
    const statusCode = error instanceof CoiffeurApiError ? error.status : undefined;
    if (statusCode === 404) return t('coiffeur.scan.invalid');
    if (statusCode === 403) return t('coiffeur.scan.forbidden');
    return t('coiffeur.scan.error');
  };

  const lookup = async (raw: string) => {
    const uuid = raw.match(UUID_RE)?.[0];
    if (!uuid) {
      showToast(t('coiffeur.scan.invalid'), true);
      scanLock.current = false;
      return;
    }
    setLoading(true);
    try {
      const data = await coiffeurCheckinApi.preview(uuid);
      setQrCode(uuid);
      setResult(data);
      Haptics.selectionAsync().catch(() => {});
    } catch (error) {
      showToast(errorMessage(error), true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      // Laisse le temps de retirer le mauvais QR avant de rescanner.
      setTimeout(() => { scanLock.current = false; }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanLock.current) return;
    scanLock.current = true;
    lookup(data);
  };

  const confirmArrival = async () => {
    if (!qrCode) return;
    setConfirming(true);
    try {
      const data = await coiffeurCheckinApi.checkIn(qrCode);
      setResult(data);
      const name = data.client_profile.first_name || data.client_name;
      showToast(t('coiffeur.clientSheet.welcome').replace('{name}', name));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      showToast(errorMessage(error), true);
    } finally {
      setConfirming(false);
    }
  };

  const scanAnother = () => {
    setResult(null);
    setQrCode(null);
    setManualInput('');
    scanLock.current = false;
  };

  const openHistory = () => {
    if (!result) return;
    onClose();
    router.push({ pathname: '/coiffeur/clients', params: { clientId: String(result.client_profile.id) } });
  };

  const formatDay = (value: string, opts: Intl.DateTimeFormatOptions) =>
    parseDay(value).toLocaleDateString(locale, opts);
  const formatClock = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const renderScanner = () => (
    <ScrollView contentContainerStyle={styles.scanBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('coiffeur.scanClient')}</Text>
      <View style={styles.cameraFrame}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={result || loading ? undefined : onBarcodeScanned}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>{t('coiffeur.scan.permission')}</Text>
            <TouchableOpacity style={styles.goldBtn} onPress={requestPermission} testID="btn-allow-camera">
              <Text style={styles.goldBtnText}>{t('coiffeur.scan.allowCamera')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {loading && (
          <View style={styles.cameraLoading}>
            <ActivityIndicator color={CC.gold} size="large" />
          </View>
        )}
      </View>
      <Text style={styles.hint}>{t('coiffeur.scan.hint')}</Text>

      <Text style={styles.manualLabel}>{t('coiffeur.scan.manualLabel')}</Text>
      <View style={styles.manualRow}>
        <TextInput
          style={styles.manualInput}
          value={manualInput}
          onChangeText={setManualInput}
          placeholder={t('coiffeur.scan.manualPlaceholder')}
          placeholderTextColor="#6f6a62"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => lookup(manualInput)}
          testID="input-qr-manual"
        />
        <TouchableOpacity
          style={[styles.goldBtn, styles.manualBtn]}
          onPress={() => lookup(manualInput)}
          disabled={loading || !manualInput.trim()}
        >
          <Text style={styles.goldBtnText}>{t('coiffeur.scan.validate')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderSheet = (data: CheckinResponse) => {
    const profile = data.client_profile;
    const reservation = data.reservation;
    const fullName = `${profile.first_name} ${profile.last_name}`.trim() || data.client_name;
    const isNew = profile.total_visits <= 1;
    return (
      <ScrollView contentContainerStyle={styles.sheetBody} testID="client-sheet">
        <Text style={styles.sheetKicker}>{t('coiffeur.clientSheet.title')}</Text>
        <View style={styles.identity}>
          <Avatar letter={fullName.charAt(0)} size={72} photoUri={profile.profile_picture ?? undefined} />
          <Text style={styles.name}>{fullName}</Text>
          <View style={[styles.badge, isNew && styles.badgeNew]}>
            <Text style={[styles.badgeText, isNew && styles.badgeTextNew]}>
              {isNew
                ? t('coiffeur.loyaltyBadge.new')
                : t('coiffeur.loyaltyBadge.returning').replace('{count}', String(profile.total_visits))}
            </Text>
          </View>
        </View>

        <View style={styles.pointsBox}>
          <Text style={styles.points}>{profile.loyalty_points.toLocaleString(locale)}</Text>
          <Text style={styles.pointsLabel}>{t('coiffeur.clientSheet.points')}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('coiffeur.clientSheet.today')}</Text>
          <Text style={styles.rowValue}>
            {reservation.service_name} · {formatDay(reservation.date, { day: 'numeric', month: 'short' })} {reservation.time.slice(0, 5)}
          </Text>
        </View>

        {profile.favorite_services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.rowLabel}>{t('coiffeur.clientSheet.favoriteServices')}</Text>
            <View style={styles.chips}>
              {profile.favorite_services.map((name) => (
                <View key={name} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('coiffeur.clientSheet.favoriteBarber')}</Text>
          <Text style={styles.rowValue}>{profile.favorite_barber ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('coiffeur.clientSheet.lastVisit')}</Text>
          <Text style={styles.rowValue}>
            {profile.last_visit ? formatDay(profile.last_visit, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('coiffeur.clientSheet.memberSince')}</Text>
          <Text style={styles.rowValue}>
            {formatDay(profile.member_since, { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {reservation.checked_in && reservation.checked_in_at ? (
          <View style={styles.arrivedBox} testID="already-arrived">
            <Text style={styles.arrivedText}>
              {t('coiffeur.clientSheet.alreadyArrived').replace('{time}', formatClock(reservation.checked_in_at))}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.goldBtn, styles.bigBtn]}
            onPress={confirmArrival}
            disabled={confirming}
            testID="btn-confirm-arrival"
          >
            {confirming
              ? <ActivityIndicator color={CC.black} />
              : <Text style={styles.bigBtnText}>{t('coiffeur.clientSheet.confirmArrival')}</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.outlineBtn} onPress={openHistory} testID="btn-client-history">
          <Text style={styles.outlineBtnText}>{t('coiffeur.clientSheet.history')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={scanAnother}>
          <Text style={styles.linkBtnText}>{t('coiffeur.clientSheet.scanAnother')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.root}>
        <View style={styles.inner}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel={t('common.close')}>
            <CloseIcon color={CC.white} size={22} />
          </TouchableOpacity>
          {result ? renderSheet(result) : renderScanner()}
        </View>
        {toast && (
          <View style={[styles.toast, toast.error && styles.toastError]} pointerEvents="none">
            <Text style={[styles.toastText, toast.error && styles.toastTextError]}>{toast.message}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CC.cardBlack },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
  },
  closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 20, right: 20, zIndex: 2, padding: 6 },
  title: { fontFamily: SERIF, fontSize: 28, fontWeight: '600', color: CC.white, marginBottom: 20 },
  scanBody: { paddingHorizontal: 20, paddingBottom: 40 },
  cameraFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: CC.gold,
    backgroundColor: '#1b1914',
  },
  cameraLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permissionText: { color: '#d8d2c6', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  hint: { color: '#a59f94', fontSize: 13, textAlign: 'center', marginTop: 14 },
  manualLabel: { color: '#a59f94', fontSize: 12, fontWeight: '600', marginTop: 28, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3a362e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: CC.white,
    fontSize: 14,
  },
  manualBtn: { paddingHorizontal: 18 },
  goldBtn: {
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBtnText: { color: CC.black, fontWeight: '700', fontSize: 14 },

  sheetBody: { paddingHorizontal: 20, paddingBottom: 40 },
  sheetKicker: { color: CC.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  identity: { alignItems: 'center', marginTop: 18, gap: 10 },
  name: { fontFamily: SERIF, fontSize: 28, fontWeight: '600', color: CC.white, textAlign: 'center' },
  badge: { borderRadius: 100, borderWidth: 1, borderColor: CC.gold, paddingVertical: 5, paddingHorizontal: 14 },
  badgeNew: { backgroundColor: CC.gold },
  badgeText: { color: CC.gold, fontWeight: '700', fontSize: 13 },
  badgeTextNew: { color: CC.black },
  pointsBox: { alignItems: 'center', marginVertical: 24 },
  points: { fontFamily: SERIF, fontSize: 56, fontWeight: '700', color: CC.gold, lineHeight: 62 },
  pointsLabel: { color: '#a59f94', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2e2b25',
  },
  section: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2e2b25', gap: 10 },
  rowLabel: { color: '#a59f94', fontSize: 13 },
  rowValue: { color: CC.white, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#25221c', borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { color: '#efe9dc', fontSize: 13 },
  arrivedBox: { marginTop: 24, borderRadius: 14, backgroundColor: CC.successBg, padding: 14, alignItems: 'center' },
  arrivedText: { color: CC.successText, fontWeight: '700', fontSize: 15 },
  bigBtn: { marginTop: 24, paddingVertical: 16 },
  bigBtnText: { color: CC.black, fontWeight: '800', fontSize: 16 },
  outlineBtn: {
    marginTop: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.gold,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { color: CC.gold, fontWeight: '700', fontSize: 15 },
  linkBtn: { marginTop: 14, alignItems: 'center', padding: 8 },
  linkBtnText: { color: '#a59f94', fontSize: 14, textDecorationLine: 'underline' },

  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 36,
    alignSelf: 'center',
    maxWidth: 480,
    backgroundColor: CC.gold,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  toastError: { backgroundColor: CC.errorBg },
  toastText: { color: CC.black, fontWeight: '700', textAlign: 'center', fontSize: 15 },
  toastTextError: { color: CC.errorText },
});
