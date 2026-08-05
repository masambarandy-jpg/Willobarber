import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi, recommendationsApi, TokenStorage } from '@/services/api';
import { Fonts } from '@/constants';
import { useIsTablet } from '@/components/client/useIsTablet';


function LoadingDots() {
  const [count, setCount] = useState(1);
  const { t } = useLanguage();

  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);

  return <Text style={styles.aiLoadingText}>{t('profile.aiLoadingPrefix')}{'.'.repeat(count)}</Text>;
}


function Avatar({ initial, size = 72 }: { initial: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function SettingRow({ icon, label, value, onPress, rightElement, destructive }: {
  icon?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.settingRow, pressed && onPress && { opacity: 0.7 }]} onPress={onPress} disabled={!onPress && !rightElement}>
      {icon && <Text style={styles.settingIcon}>{icon}</Text>}
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, destructive && { color: '#C0392B' }]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement ?? (onPress && <Text style={styles.settingArrow}>›</Text>)}
    </Pressable>
  );
}

function ModalField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'phone-pad' | 'email-address';
}) {
  return (
    <View style={styles.mfWrap}>
      <Text style={styles.mfLabel}>{label}</Text>
      <TextInput
        style={styles.mfInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const TERMS_TEXT = `1. Objet de l'application

WilloBarber est une application de réservation en ligne permettant à ses utilisateurs de prendre rendez-vous auprès du salon de coiffure WilloBarber, situé Rue Auguste Van Zande 78 à Bruxelles. L'utilisation de l'application implique l'acceptation pleine et entière des présentes conditions d'utilisation.

2. Accès et inscription

L'accès à certaines fonctionnalités (réservation, historique, recommandations) nécessite la création d'un compte utilisateur. L'utilisateur s'engage à fournir des informations exactes et à jour et est responsable de la confidentialité de ses identifiants. Toute utilisation du compte est présumée effectuée par son titulaire.

3. Réservations

La réservation d'un rendez-vous via l'application est confirmée dès réception d'une notification de confirmation. WilloBarber se réserve le droit de demander un acompte lors de la prise de rendez-vous pour certaines prestations ; cet acompte est déduit du montant total dû en salon. Toute annulation doit intervenir au moins 24 heures avant l'heure du rendez-vous. Une annulation tardive ou une absence non signalée (« no-show ») peut entraîner la perte de l'acompte versé et être comptabilisée parmi les annulations tardives du compte client, pouvant restreindre l'accès à la réservation en ligne en cas de récidive.

4. Responsabilités

WilloBarber s'engage à assurer la disponibilité de l'application dans la mesure du possible, sans garantie d'absence d'interruption ou d'erreur technique. WilloBarber ne saurait être tenu responsable des dommages indirects résultant de l'utilisation de l'application. Le client s'engage à utiliser l'application conformément à sa destination et à ne pas porter atteinte à son bon fonctionnement.

5. Propriété intellectuelle

L'ensemble des éléments de l'application (textes, logos, identité visuelle, structure, code source) est la propriété exclusive de WilloBarber ou de ses concédants et est protégé par le droit belge et international de la propriété intellectuelle. Toute reproduction, représentation ou exploitation non autorisée est interdite.

6. Droit applicable et juridiction compétente

Les présentes conditions d'utilisation sont régies par le droit belge. En cas de litige relatif à leur interprétation ou leur exécution, et à défaut de résolution amiable, les tribunaux de l'arrondissement judiciaire de Bruxelles seront seuls compétents.`;

const PRIVACY_TEXT = `1. Responsable du traitement

WilloBarber, dont le siège est établi Rue Auguste Van Zande 78, 1000 Bruxelles, est responsable du traitement des données à caractère personnel collectées via la présente application, conformément au Règlement (UE) 2016/679 (RGPD).

2. Données collectées

Dans le cadre de l'utilisation de l'application, WilloBarber collecte : le nom et prénom, l'adresse e-mail, le numéro de téléphone, l'historique des rendez-vous et prestations réservées, ainsi que les points de fidélité associés au compte client.

3. Finalités et bases juridiques

Ces données sont traitées pour les finalités suivantes :
— l'exécution du contrat de prestation de services (gestion des réservations, du compte client et du programme de fidélité), sur la base de l'article 6.1.b du RGPD ;
— l'envoi de recommandations personnalisées et de communications facultatives, sur la base du consentement de l'utilisateur (article 6.1.a du RGPD), révocable à tout moment ;
— l'amélioration du service et la prévention des abus (annulations tardives répétées), sur la base de l'intérêt légitime de WilloBarber (article 6.1.f du RGPD).

4. Durée de conservation

Les données liées au compte utilisateur sont conservées pendant une durée de 2 ans à compter de la dernière activité du compte. Les données à caractère comptable (factures, preuves de paiement) sont conservées 7 ans, conformément aux obligations légales belges en matière de comptabilité.

5. Droits des utilisateurs

Conformément au RGPD, chaque utilisateur dispose d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition concernant ses données à caractère personnel. Ces droits peuvent être exercés directement depuis l'application ou en contactant le délégué à la protection des données.

6. Contact du délégué à la protection des données (DPO)

Pour toute question relative au traitement de vos données ou pour exercer vos droits, vous pouvez contacter notre DPO à l'adresse : privacy@willobarber.be

7. Droit de réclamation

Si vous estimez que le traitement de vos données ne respecte pas la réglementation applicable, vous disposez du droit d'introduire une réclamation auprès de l'Autorité de Protection des Données (APD) belge, Rue de la Presse 35, 1000 Bruxelles — www.autoriteprotectiondonnees.be`;

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const { showLoginModal } = useAuthModal();
  const { t } = useLanguage();
  const router = useRouter();
  const isTablet = useIsTablet();
  const [editModal, setEditModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [aiRec, setAiRec] = useState(user?.ai_recommendations ?? true);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const [showAiCard, setShowAiCard] = useState(false);
  const aiCardOpacity = useRef(new Animated.Value(0)).current;
  const aiPatchRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !aiRec) {
      console.log('[AI Recommandations] Désactivé ou non authentifié — pas de fetch.');
      setAiText(null);
      setShowAiCard(false);
      aiCardOpacity.setValue(0);
      return;
    }
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const pendingPatch = aiPatchRef.current;

    setAiLoading(true);
    setShowAiCard(false);
    aiCardOpacity.setValue(0);

    const reveal = (text: string | null) => {
      if (cancelled) return;
      setAiText(text);
      setAiGeneratedAt(new Date().toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }));
      if (!text) return;
      setShowAiCard(true);
      Animated.timing(aiCardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      hideTimer = setTimeout(() => {
        Animated.timing(aiCardOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          if (!cancelled) {
            setShowAiCard(false);
            setAiText(null);
          }
        });
      }, 8000);
    };

    (async () => {
      if (pendingPatch) {
        console.log('[AI Recommandations] PATCH /auth/me/ en cours — attente avant de fetch /recommendations/...');
        await pendingPatch;
        if (aiPatchRef.current === pendingPatch) aiPatchRef.current = null;
      }
      if (cancelled) return;

      console.log('[AI Recommandations] Toggle actif, appel de /recommendations/...');
      const startTime = Date.now();
      try {
        const data = await recommendationsApi.get();
        console.log('[AI Recommandations] Réponse backend:', JSON.stringify(data));
        const elapsed = Date.now() - startTime;
        await new Promise((r) => setTimeout(r, Math.max(0, 1500 - elapsed)));
        if (cancelled) return;
        setAiLoading(false);
        reveal(data.ai_text ?? null);
      } catch (err: any) {
        console.log('[AI Recommandations] Erreur:', err?.response?.status, JSON.stringify(err?.response?.data ?? err?.message));
        const elapsed = Date.now() - startTime;
        await new Promise((r) => setTimeout(r, Math.max(0, 1500 - elapsed)));
        if (cancelled) return;
        setAiLoading(false);
        reveal(null);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(hideTimer);
    };
  }, [isAuthenticated, aiRec]);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPhone(user.phone ?? '');
      setAiRec(user.ai_recommendations ?? true);
    }
  }, [user]);

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 10, textAlign: 'center' }}>
          {t('profile.notAuth.title')}
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          {t('profile.notAuth.sub')}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#C9A84C', borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40 }}
          onPress={() => showLoginModal(undefined, t('profile.notAuth.loginPrompt'))}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#1A1208', fontWeight: '700', fontSize: 15 }}>{t('common.login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nameParts = [user.first_name, user.last_name].filter(Boolean);
  const fullName = nameParts.length > 0 ? nameParts.join(' ') : (user.username || user.email || '');
  const initial = (user.first_name?.[0] ?? user.username?.[0] ?? 'U').toUpperCase();

  const rawJoinDate = (user as any)?.date_joined ?? user?.created_at;
  const parsedJoinDate = rawJoinDate ? new Date(rawJoinDate) : null;
  const memberSince = parsedJoinDate && !isNaN(parsedJoinDate.getTime())
    ? parsedJoinDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : 'Juin 2025';

  const loyaltyPoints = user.loyalty_points ?? 316;
  const lateCancellations = user.late_cancellations ?? 0;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || undefined, ai_recommendations: aiRec });
      await refreshUser();
      setEditModal(false);
    } catch {
      Alert.alert(t('common.error'), t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !newPw2) { Alert.alert(t('common.error'), t('profile.pwModal.errorRequired')); return; }
    if (newPw !== newPw2) { Alert.alert(t('common.error'), t('profile.pwModal.errorMismatch')); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ old_password: oldPw, new_password: newPw, new_password2: newPw2 });
      setPwModal(false);
      setOldPw(''); setNewPw(''); setNewPw2('');
      Alert.alert(t('profile.pwModal.success'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const detail = msg ? Object.values(msg).flat().join('\n') : t('profile.pwModal.genericError');
      Alert.alert(t('common.error'), detail);
    } finally {
      setSaving(false);
    }
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('profile.logoutConfirm.message'))) {
        performLogout();
      }
      return;
    }
    Alert.alert(t('profile.logoutConfirm.title'), t('profile.logoutConfirm.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: performLogout },
    ]);
  };

  const aiBlock = (
    <>
      {aiRec && aiLoading && (
        <View style={styles.aiCard}>
          <LoadingDots />
        </View>
      )}

      {aiRec && showAiCard && aiText && (
        <Animated.View style={[styles.aiCard, { opacity: aiCardOpacity }]}>
          <Text style={styles.aiCardBadge}>{t('profile.aiCardBadge')}</Text>
          <Text style={styles.aiCardText}>{aiText}</Text>
          <TouchableOpacity
            style={styles.aiCardButton}
            onPress={() => router.push('/(tabs)/book')}
            activeOpacity={0.85}
          >
            <Text style={styles.aiCardButtonText}>{t('common.bookNow')}</Text>
          </TouchableOpacity>
          {aiGeneratedAt && <Text style={styles.aiCardTimestamp}>{aiGeneratedAt}</Text>}
        </Animated.View>
      )}
    </>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, isTablet && styles.contentTablet]} showsVerticalScrollIndicator={false}>

        <View style={isTablet ? styles.profileRowTablet : undefined}>
          {/* Hero section */}
          <View style={[styles.hero, isTablet && styles.heroTablet]}>
            {/* Dark bg with subtle gradient */}
            <View style={styles.heroBg} />
            <Avatar initial={initial} size={80} />
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{(user.role ?? 'client').toUpperCase()}</Text>
            </View>
            <Text style={styles.heroName}>{fullName}</Text>
            <Text style={styles.heroEmail}>{user.email}</Text>
            {user.phone && <Text style={styles.heroPhone}>{user.phone}</Text>}
          </View>

          <View style={isTablet ? styles.profileColRight : undefined}>
            {/* Stats row */}
            <View style={[styles.statsRow, isTablet && styles.statsRowTablet]}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{loyaltyPoints}</Text>
                <Text style={styles.statLabel}>{t('profile.stats.loyaltyPointsLine1')}{'\n'}{t('profile.stats.loyaltyPointsLine2')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, lateCancellations > 0 && { color: '#C0392B' }]}>{lateCancellations}</Text>
                <Text style={styles.statLabel}>{t('profile.stats.lateCancellationsLine1')}{'\n'}{t('profile.stats.lateCancellationsLine2')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{memberSince}</Text>
                <Text style={styles.statLabel}>{t('profile.stats.memberSinceLine1')}{'\n'}{t('profile.stats.memberSinceLine2')}</Text>
              </View>
            </View>

            {/* Account settings */}
            <View style={[styles.settingCard, isTablet && styles.settingCardTablet]}>
              <SectionTitle label={t('profile.account.title')} />
              <View style={styles.settingDivider} />
              <SettingRow icon="✏️" label={t('profile.account.editProfile')} onPress={() => { setFirstName(user.first_name); setLastName(user.last_name); setPhone(user.phone ?? ''); setAiRec(user.ai_recommendations); setEditModal(true); }} />
              <View style={styles.settingDivider} />
              <SettingRow icon="🔑" label={t('profile.account.changePassword')} onPress={() => setPwModal(true)} />
              <View style={styles.settingDivider} />
              <SettingRow
                icon="🤖"
                label={t('profile.account.aiRecommendations')}
                rightElement={
                  <Switch
                    value={aiRec}
                    onValueChange={async v => {
                      console.log('[IA] token (TokenStorage.getAccess):', await TokenStorage.getAccess());
                      console.log('[IA] aiRec avant toggle:', aiRec, '-> nouvelle valeur:', v);
                      console.log('[IA] PATCH payload:', { ai_recommendations: v });

                      // Le PATCH démarre et sa promesse est enregistrée AVANT setAiRec(v),
                      // pour que l'effet déclenché par le changement de aiRec puisse l'attendre
                      // et ne fetch /recommendations/ qu'une fois le backend à jour.
                      const patchPromise = (async () => {
                        try {
                          const res = await authApi.updateProfile({ ai_recommendations: v });
                          console.log('[IA] PATCH response:', res);
                          await refreshUser();
                        } catch (e) {
                          console.log('[IA] PATCH erreur (sauvegarde locale suffisante):', e);
                        }
                      })();
                      aiPatchRef.current = patchPromise;

                      setAiRec(v);
                      await AsyncStorage.setItem('ai_recommendations', JSON.stringify(v));
                      await patchPromise;

                      if (!v) {
                        Alert.alert(t('profile.aiDisabledTitle'), t('profile.aiDisabledMsg'));
                      }
                    }}
                    trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(201,168,76,0.4)' }}
                    thumbColor={aiRec ? '#C9A84C' : 'rgba(255,255,255,0.5)'}
                  />
                }
              />

              {!isTablet && aiBlock}
            </View>
          </View>
        </View>

        {/* Recommandations IA — pleine largeur sur iPad */}
        {isTablet && !!(aiRec && (aiLoading || (showAiCard && aiText))) && (
          <View style={styles.settingCard}>
            <SectionTitle label={t('profile.account.aiRecommendations')} />
            <View style={styles.settingDivider} />
            {aiBlock}
          </View>
        )}

        {/* Info */}
        <View style={styles.settingCard}>
          <SectionTitle label={t('profile.info.title')} />
          <View style={styles.settingDivider} />
          {isTablet ? (
            <View style={styles.legalRowTablet}>
              <View style={{ flex: 1 }}>
                <SettingRow icon="📄" label={t('profile.info.terms')} onPress={() => setLegalModal('terms')} />
              </View>
              <View style={{ flex: 1 }}>
                <SettingRow icon="🔒" label={t('profile.info.privacy')} onPress={() => setLegalModal('privacy')} />
              </View>
            </View>
          ) : (
            <>
              <SettingRow icon="📄" label={t('profile.info.terms')} onPress={() => setLegalModal('terms')} />
              <View style={styles.settingDivider} />
              <SettingRow icon="🔒" label={t('profile.info.privacy')} onPress={() => setLegalModal('privacy')} />
            </>
          )}
          <View style={styles.settingDivider} />
          <SettingRow icon="📍" label={t('profile.info.address')} value="Rue Auguste Van Zande 78, Bruxelles" />
        </View>

        {/* Logout */}
        {Platform.OS === 'android' ? (
          <View style={[styles.logoutBtn, { overflow: 'hidden', paddingVertical: 0 }]}>
            <TouchableNativeFeedback
              onPress={handleLogout}
              disabled={loggingOut}
              background={TouchableNativeFeedback.Ripple('rgba(192,57,43,0.15)', false)}
            >
              <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                <Text style={styles.logoutBtnText}>{loggingOut ? t('common.loggingOut') : t('common.logout')}</Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutBtnText}>{loggingOut ? t('common.loggingOut') : t('common.logout')}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.version}>WilloBarber v1.0.0 · TFE 2025-2026</Text>
      </ScrollView>

      {/* Edit profile modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={[styles.overlay, isTablet && styles.overlayTablet]}>
          <View style={[styles.modal, isTablet && styles.modalTablet]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.editModal.title')}</Text>
              <Pressable onPress={() => setEditModal(false)}><Text style={styles.modalClose}>✕</Text></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ModalField label={t('profile.editModal.firstName')} value={firstName} onChangeText={setFirstName} placeholder="Jean" />
              <ModalField label={t('profile.editModal.lastName')} value={lastName} onChangeText={setLastName} placeholder="Dupont" />
              <ModalField label={t('profile.editModal.phone')} value={phone} onChangeText={setPhone} placeholder="+32 470 …" keyboardType="phone-pad" />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('profile.editModal.aiToggleLabel')}</Text>
                <Switch value={aiRec} onValueChange={setAiRec} trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(201,168,76,0.4)' }} thumbColor={aiRec ? '#C9A84C' : 'rgba(255,255,255,0.5)'} />
              </View>
              {Platform.OS === 'android' ? (
                <View style={[styles.btnPrimary, saving && { opacity: 0.7 }, { overflow: 'hidden', paddingVertical: 0 }]}>
                  <TouchableNativeFeedback onPress={handleSaveProfile} disabled={saving} background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}>
                    <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                      <Text style={styles.btnPrimaryText}>{saving ? t('common.saving') : t('common.save')}</Text>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity style={[styles.btnPrimary, saving && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>{saving ? t('common.saving') : t('common.save')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => setPwModal(false)}>
        <View style={[styles.overlay, isTablet && styles.overlayTablet]}>
          <View style={[styles.modal, isTablet && styles.modalTablet]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.pwModal.title')}</Text>
              <Pressable onPress={() => setPwModal(false)}><Text style={styles.modalClose}>✕</Text></Pressable>
            </View>
            <ModalField label={t('profile.pwModal.oldPw')} value={oldPw} onChangeText={setOldPw} placeholder="••••••••" secureTextEntry />
            <ModalField label={t('profile.pwModal.newPw')} value={newPw} onChangeText={setNewPw} placeholder="••••••••" secureTextEntry />
            <ModalField label={t('profile.pwModal.confirmPw')} value={newPw2} onChangeText={setNewPw2} placeholder="••••••••" secureTextEntry />
            {Platform.OS === 'android' ? (
              <View style={[styles.btnPrimary, saving && { opacity: 0.7 }, { overflow: 'hidden', paddingVertical: 0 }]}>
                <TouchableNativeFeedback onPress={handleChangePassword} disabled={saving} background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}>
                  <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                    <Text style={styles.btnPrimaryText}>{saving ? t('profile.pwModal.submitting') : t('profile.pwModal.submit')}</Text>
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity style={[styles.btnPrimary, saving && { opacity: 0.7 }]} onPress={handleChangePassword} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>{saving ? t('profile.pwModal.submitting') : t('profile.pwModal.submit')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Legal texts modal (terms / privacy) */}
      <Modal visible={legalModal !== null} transparent animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <View style={[styles.legalOverlay, isTablet && styles.overlayTablet]}>
          <View style={[styles.legalModalBox, isTablet && styles.legalModalBoxTablet]}>
            <View style={styles.modalHeader}>
              <Text style={styles.legalTitle}>
                {legalModal === 'terms' ? t('profile.info.terms') : t('profile.info.privacy')}
              </Text>
              <Pressable onPress={() => setLegalModal(null)}><Text style={styles.legalClose}>✕</Text></Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.legalBodyText}>
                {legalModal === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.legalCloseBtn} onPress={() => setLegalModal(null)} activeOpacity={0.85}>
              <Text style={styles.legalCloseBtnText}>{t('profile.legalModal.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },
  content: { paddingBottom: 40 },
  contentTablet: { maxWidth: 1100, alignSelf: 'center', width: '100%', paddingTop: 24 },

  profileRowTablet: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
    paddingHorizontal: 22,
    marginBottom: 4,
  },
  profileColRight: { flex: 1.3 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 0) + 10,
    paddingBottom: 28,
    paddingHorizontal: 22,
    backgroundColor: '#1A1814',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  heroTablet: {
    flex: 1,
    justifyContent: 'center',
    borderRadius: 20,
    borderBottomWidth: 0,
    paddingVertical: 40,
    overflow: 'hidden',
  },
  heroBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1A1814' },
  avatar: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 2,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  avatarText: { color: '#C9A84C', fontFamily: Fonts.semiBold, fontWeight: '600' },
  rolePill: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#C9A84C',
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 4,
  },
  roleText: { fontSize: 9.5, color: '#C9A84C', fontWeight: '700', letterSpacing: 1 },
  heroName: { fontFamily: Fonts.semiBold, fontSize: 26, fontWeight: '600', color: '#fff', textAlign: 'center' },
  heroEmail: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  heroPhone: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1814',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 22 },
  statLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 3, lineHeight: 13 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  statsRowTablet: {
    borderRadius: 16,
    borderBottomWidth: 0,
    marginHorizontal: 0,
  },

  // Settings card
  settingCard: {
    backgroundColor: '#1A1814',
    marginHorizontal: 22,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  settingCardTablet: { marginHorizontal: 0 },
  legalRowTablet: { flexDirection: 'row', gap: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12 },
  settingDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 0 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  settingIcon: { fontSize: 18, width: 26 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14.5, color: '#fff' },
  settingValue: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  settingArrow: { fontSize: 20, color: 'rgba(255,255,255,0.35)' },

  // AI recommendation card
  aiCard: {
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: '#C9A84C',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  aiLoadingText: { fontSize: 13.5, color: '#6B6560', fontStyle: 'italic' },
  aiCardBadge: { fontSize: 12, fontWeight: '700', color: '#C9A84C', marginBottom: 8 },
  aiCardText: { fontSize: 13.5, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 14 },
  aiCardButton: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
  },
  aiCardButtonText: { color: '#1A1208', fontWeight: '700', fontSize: 14 },
  aiCardTimestamp: { fontSize: 11, color: '#6B6560', textAlign: 'right', marginTop: 8 },

  // Logout
  logoutBtn: {
    backgroundColor: '#FDECEA',
    borderRadius: 100,
    marginHorizontal: 22,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutBtnText: { color: '#C0392B', fontWeight: '700', fontSize: 14.5 },

  version: { fontSize: 11.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 8 },

  // Buttons
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
    marginTop: 8,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  overlayTablet: { justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: '#1A1814',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTablet: {
    borderRadius: 24,
    width: '90%',
    maxWidth: 480,
    paddingBottom: 24,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff' },
  modalClose: { fontSize: 18, color: 'rgba(255,255,255,0.45)', padding: 4 },

  mfWrap: { marginBottom: 14 },
  mfLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 7 },
  mfInput: {
    backgroundColor: '#252018',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 13,
    fontSize: 14,
    color: '#fff',
    minHeight: 46,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 8 },
  switchLabel: { fontSize: 14.5, color: '#fff' },

  // Legal texts modal
  legalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  legalModalBox: {
    backgroundColor: '#0D0C0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    // Hauteur fixe plutôt que maxHeight : le ScrollView enfant (flex: 1) a
    // besoin d'une base de calcul non ambiguë. maxHeight seul (sans height ni
    // flex sur ce conteneur) laisse Yoga résoudre la dépendance circulaire
    // "hauteur du parent dépend du flex:1 de l'enfant" en hauteur 0 sur iOS —
    // le texte (bien réel) du modal Conditions/Politique s'affichait "vide".
    height: '70%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  legalModalBoxTablet: {
    borderRadius: 24,
    width: '90%',
    maxWidth: 620,
    height: '80%',
    paddingBottom: 24,
  },
  legalTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#FFFFFF', flex: 1, paddingRight: 12 },
  legalClose: { fontSize: 18, color: 'rgba(255,255,255,0.45)', padding: 4 },
  legalBodyText: { fontSize: 14, lineHeight: 22, color: '#FFFFFF', paddingBottom: 8 },
  legalCloseBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  legalCloseBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },
});
