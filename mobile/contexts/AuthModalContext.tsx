import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { appointmentsApi, authApi, TokenStorage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Fonts } from '@/constants';

// Ferme le navigateur d'authentification et renvoie le contrôle à l'app une
// fois l'utilisateur redirigé — doit être appelé au niveau module (une fois).
WebBrowser.maybeCompleteAuthSession();

type AuthModalContextType = {
  showLoginModal: (onSuccess?: () => void, message?: string) => void;
  hideLoginModal: () => void;
};

const isPhone = (value: string) => /^[+]?[0-9\s\-]{8,}$/.test(value.trim());
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// À renseigner après création des apps OAuth dans Google Cloud Console et
// Microsoft Entra (Azure AD) — voir mobile/README ou la doc du projet pour
// les redirect URIs à y déclarer (exp://... en dev, le scheme "willobarber"
// en build natif). Tant que ces valeurs sont vides, les boutons Gmail/Outlook
// affichent un message d'indisponibilité plutôt que de planter.
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? '';
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ?? '';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? '';
const MICROSOFT_CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '';
// Google.useAuthRequest() plante si aucun client ID n'est fourni : on ne
// l'appelle donc que si au moins un des trois est configuré (constante de
// module, jamais réévaluée entre deux rendus — respecte les règles des hooks).
const hasGoogleConfig = !!(GOOGLE_CLIENT_ID_IOS || GOOGLE_CLIENT_ID_ANDROID || GOOGLE_CLIENT_ID_WEB);

const MICROSOFT_DISCOVERY = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

const AuthModalContext = createContext<AuthModalContextType>({
  showLoginModal: () => {},
  hideLoginModal: () => {},
});

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const { refreshUser } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  // Distingue "la modale ferme (animation de fondu en cours)" de "la modale
  // est ouverte" : le backdrop plein-écran ne doit plus intercepter les clics
  // dès que la fermeture démarre, sinon il reste cliquable pendant les ~200ms
  // de fondu et bloque le premier clic de l'utilisateur sur ce qu'il y a en-dessous.
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

  const [firstName, setFirstName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthLoading, setOauthLoading] = useState<'google' | 'microsoft' | null>(null);

  const [isGerant, setIsGerant] = useState(false);
  const [gerantEmail, setGerantEmail] = useState('willo@willobarber.fr');
  const [gerantPassword, setGerantPassword] = useState('');
  const [showGerantPassword, setShowGerantPassword] = useState(false);
  const [gerantLoading, setGerantLoading] = useState(false);
  const [gerantError, setGerantError] = useState('');

  const identifierInputRef = useRef<TextInput>(null);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.92)).current;
  const identifierHighlightAnim = useRef(new Animated.Value(0)).current;

  const showLoginModal = (onSuccess?: () => void, msg?: string) => {
    setOnSuccessCallback(() => onSuccess ?? null);
    setMessage(msg);
    setFirstName('');
    setIdentifier('');
    setError('');
    setIsGerant(false);
    setGerantPassword('');
    setGerantError('');
    overlayAnim.setValue(0);
    cardAnim.setValue(0.92);
    setVisible(true);
  };

  const hideLoginModal = () => {
    setVisible(false);
    setOnSuccessCallback(null);
    setMessage(undefined);
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (callback?: () => void) => {
    if (loading) return;
    setClosing(true);
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setClosing(false);
      callback?.();
    });
  };

  const handleClose = () => dismiss(hideLoginModal);

  const handleGerantAccess = () => setIsGerant(true);

  const handleBackToClient = () => {
    setIsGerant(false);
    setGerantError('');
  };

  const handleGerantLogin = async () => {
    setGerantLoading(true);
    setGerantError('');
    try {
      const response = await fetch(
        'https://willobarber-production-6951.up.railway.app/api/auth/login/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'willo', password: gerantPassword }),
        }
      );
      const data = await response.json();
      if (response.ok && data.access) {
        await AsyncStorage.setItem('coiffeur_token', data.access);
        await AsyncStorage.setItem('coiffeur_refresh', data.refresh);
        dismiss(() => {
          hideLoginModal();
          router.push('/coiffeur/dashboard');
        });
      } else {
        setGerantError(t('gerant.errorInvalid'));
      }
    } catch (e) {
      setGerantError(t('gerant.errorNetwork'));
    } finally {
      setGerantLoading(false);
    }
  };

  const handleSuccess = () => {
    const cb = onSuccessCallback;
    dismiss(() => {
      setOnSuccessCallback(null);
      setMessage(undefined);
      cb?.();
    });
  };

  const handleAccess = async () => {
    const value = identifier.trim();
    if (!value) {
      setError(t('authModal.errorEmpty'));
      return;
    }
    if (!isEmail(value) && !isPhone(value)) {
      setError(t('authModal.errorInvalid'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await appointmentsApi.checkClient(value);
      if (res.status !== 'exists') {
        setError(t('authModal.errorNotFound'));
        return;
      }
      const { access, refresh } = await authApi.passwordlessLogin(value);
      await TokenStorage.save(access, refresh);
      await refreshUser();
      handleSuccess();
    } catch (error: any) {
      console.log('Login error:', error?.response?.data || error?.message);
      setError(t('authModal.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const focusIdentifier = () => identifierInputRef.current?.focus();

  const triggerIdentifierHighlight = () => {
    identifierHighlightAnim.setValue(1);
    Animated.timing(identifierHighlightAnim, {
      toValue: 0,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  // Connexion/inscription via le profil OAuth vérifié par Google ou Microsoft
  // (cf. useEffect ci-dessous) : crée le compte s'il n'existe pas encore
  // (voir OAuthLoginView côté backend) puis connecte l'utilisateur.
  const completeOAuthLogin = async (email?: string, first?: string, last?: string) => {
    if (!email) {
      setError(t('authModal.errorGeneric'));
      setOauthLoading(null);
      return;
    }
    setError('');
    try {
      const { access, refresh } = await authApi.oauthLogin(email, first, last);
      await TokenStorage.save(access, refresh);
      await refreshUser();
      handleSuccess();
    } catch (err: any) {
      console.log('OAuth login error:', err?.response?.data || err?.message);
      setError(t('authModal.errorGeneric'));
    } finally {
      setOauthLoading(null);
    }
  };

  const oauthRedirectUri = AuthSession.makeRedirectUri({ scheme: 'willobarber' });

  const [googleRequest, googleResponse, googlePromptAsync] = hasGoogleConfig
    ? Google.useAuthRequest({
        iosClientId: GOOGLE_CLIENT_ID_IOS || undefined,
        androidClientId: GOOGLE_CLIENT_ID_ANDROID || undefined,
        webClientId: GOOGLE_CLIENT_ID_WEB || undefined,
        redirectUri: oauthRedirectUri,
      })
    : [null, null, async () => {}];

  const [msRequest, msResponse, msPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MICROSOFT_CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: oauthRedirectUri,
    },
    MICROSOFT_DISCOVERY
  );

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    (async () => {
      try {
        const accessToken =
          googleResponse.authentication?.accessToken ?? (googleResponse.params as any)?.access_token;
        if (!accessToken) throw new Error('no-access-token');
        const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        await completeOAuthLogin(profile.email, profile.given_name, profile.family_name);
      } catch (err) {
        console.log('Google OAuth error:', err);
        setError(t('authModal.errorGeneric'));
        setOauthLoading(null);
      }
    })();
  }, [googleResponse]);

  useEffect(() => {
    const codeVerifier = msRequest?.codeVerifier;
    if (msResponse?.type !== 'success' || !codeVerifier) return;
    (async () => {
      try {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: MICROSOFT_CLIENT_ID,
            code: (msResponse.params as any).code,
            redirectUri: oauthRedirectUri,
            extraParams: { code_verifier: codeVerifier },
          },
          MICROSOFT_DISCOVERY
        );
        const profile = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
        }).then((r) => r.json());
        await completeOAuthLogin(profile.mail || profile.userPrincipalName, profile.givenName, profile.surname);
      } catch (err) {
        console.log('Microsoft OAuth error:', err);
        setError(t('authModal.errorGeneric'));
        setOauthLoading(null);
      }
    })();
  }, [msResponse]);

  const handleGooglePress = async () => {
    if (!hasGoogleConfig || !googleRequest) {
      Alert.alert('Google OAuth non configuré');
      return;
    }
    setError('');
    setOauthLoading('google');
    const result = await googlePromptAsync();
    if (result.type !== 'success') setOauthLoading(null);
  };

  const handleMicrosoftPress = async () => {
    if (!MICROSOFT_CLIENT_ID || !msRequest) {
      setError('Connexion Outlook indisponible pour le moment.');
      return;
    }
    setError('');
    setOauthLoading('microsoft');
    const result = await msPromptAsync();
    if (result.type !== 'success') setOauthLoading(null);
  };

  const handleOtherProvider = () => {
    focusIdentifier();
    triggerIdentifierHighlight();
  };

  const identifierBorderColor = identifierHighlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.12)', '#C9A84C'],
  });

  return (
    <AuthModalContext.Provider value={{ showLoginModal, hideLoginModal }}>
      <View style={{ flex: 1 }}>
        {children}

        {visible && (
          <KeyboardAvoidingView
            style={styles.container}
            pointerEvents="box-none"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Fond flou */}
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { opacity: overlayAnim }]}
              pointerEvents={closing ? 'none' : 'auto'}
            >
              <View style={[StyleSheet.absoluteFillObject, styles.overlayTint]} />
              {Platform.OS !== 'web' && (
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              )}
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={handleClose}
                activeOpacity={1}
              />
            </Animated.View>

            {/* Carte modale centrée */}
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: overlayAnim,
                  transform: [{ scale: cardAnim }],
                },
              ]}
            >
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>

              {!isGerant ? (
                <>
                  <Text style={styles.kicker}>{t('authModal.kicker')}</Text>
                  <Text style={styles.title}>{t('authModal.title')}</Text>
                  <Text style={styles.subtitle}>
                    {message || t('authModal.subtitleDefault')}
                  </Text>

                  <View style={styles.quickRow}>
                    <TouchableOpacity
                      style={styles.quickPill}
                      onPress={handleGooglePress}
                      disabled={oauthLoading !== null}
                      activeOpacity={0.75}
                    >
                      {oauthLoading === 'google'
                        ? <ActivityIndicator color="#EA4335" size="small" />
                        : <>
                            <Text style={styles.quickPillGmailIcon}>G</Text>
                            <Text style={styles.quickPillText}>{t('authModal.gmail')}</Text>
                          </>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickPill}
                      onPress={handleMicrosoftPress}
                      disabled={oauthLoading !== null}
                      activeOpacity={0.75}
                    >
                      {oauthLoading === 'microsoft'
                        ? <ActivityIndicator color="#4A9EFF" size="small" />
                        : <>
                            <Feather name="mail" size={14} color="#4A9EFF" />
                            <Text style={styles.quickPillText}>{t('authModal.outlook')}</Text>
                          </>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickPill} onPress={handleOtherProvider} activeOpacity={0.75}>
                      <Feather name="user" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.quickPillText}>{t('authModal.other')}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.separatorRow}>
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>{t('authModal.separator')}</Text>
                    <View style={styles.separatorLine} />
                  </View>

                  {!!error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <Text style={styles.label}>{t('authModal.firstNameLabel')}</Text>
                  <View style={styles.inputWrap}>
                    <Feather name="user" size={16} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={styles.input}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Antoine"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={focusIdentifier}
                    />
                    <Feather name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
                  </View>

                  <Text style={styles.label}>{t('authModal.identifierLabel')}</Text>
                  <Animated.View style={[styles.inputWrap, { borderColor: identifierBorderColor }]}>
                    <Feather name={isPhone(identifier) ? 'phone' : 'mail'} size={16} color="rgba(255,255,255,0.4)" />
                    <View style={styles.identifierInner}>
                      <TextInput
                        ref={identifierInputRef}
                        style={styles.input}
                        value={identifier}
                        onChangeText={(t) => {
                          setIdentifier(t);
                          if (error) setError('');
                        }}
                        placeholder={t('authModal.identifierPlaceholder')}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        keyboardType="default"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                        returnKeyType="done"
                        onSubmitEditing={handleAccess}
                      />
                    </View>
                  </Animated.View>

                  <TouchableOpacity
                    style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                    onPress={handleAccess}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#1A1208" size="small" />
                      : <Text style={styles.btnPrimaryText}>{t('authModal.submit')}</Text>
                    }
                  </TouchableOpacity>

                  <View style={styles.gerantSeparator} />
                  <TouchableOpacity onPress={handleGerantAccess} activeOpacity={0.6} style={styles.gerantBtn}>
                    <Text style={styles.gerantBtnText}>⚙ Espace gérant →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.kicker}>{t('gerant.kicker')}</Text>
                  <Text style={styles.title}>{t('gerant.title')}</Text>
                  <Text style={styles.subtitle}>{t('gerant.subtitle')}</Text>

                  {!!gerantError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{gerantError}</Text>
                    </View>
                  )}

                  <Text style={styles.label}>{t('gerant.emailLabel')}</Text>
                  <View style={styles.inputWrap}>
                    <Feather name="user" size={16} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={styles.input}
                      value={gerantEmail}
                      onChangeText={setGerantEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                    />
                  </View>

                  <Text style={styles.label}>{t('gerant.passwordLabel')}</Text>
                  <View style={styles.gerantPasswordWrap}>
                    <Feather name="lock" size={16} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={[
                        styles.gerantPasswordInput,
                        Platform.OS === 'web' && ({
                          backgroundColor: 'transparent',
                          background: 'none',
                          WebkitBoxShadow: '0 0 0 1000px #1A1814 inset',
                          WebkitTextFillColor: '#FFFFFF',
                          caretColor: '#FFFFFF',
                        } as any),
                      ]}
                      value={gerantPassword}
                      onChangeText={setGerantPassword}
                      secureTextEntry={!showGerantPassword}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      onSubmitEditing={handleGerantLogin}
                    />
                    <TouchableOpacity onPress={() => setShowGerantPassword((v) => !v)} hitSlop={10}>
                      <Feather name={showGerantPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.btnPrimary, gerantLoading && { opacity: 0.7 }]}
                    onPress={handleGerantLogin}
                    disabled={gerantLoading}
                    activeOpacity={0.85}
                  >
                    {gerantLoading
                      ? <ActivityIndicator color="#1A1208" size="small" />
                      : <Text style={styles.btnPrimaryText}>{t('gerant.submitBtn')} →</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleBackToClient} activeOpacity={0.7} style={[styles.gerantBtn, { marginTop: 16 }]}>
                    <Text style={styles.backToClientText}>{t('gerant.backToClient')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        )}
      </View>
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => useContext(AuthModalContext);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as any)
      : {}),
  },
  card: {
    backgroundColor: '#1A1814',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxWidth: 420,
    zIndex: 10000,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeBtnText: { color: '#fff', fontSize: 14 },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
    marginBottom: 22,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quickPillGmailIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA4335',
  },
  quickPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  separatorText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  errorBox: {
    backgroundColor: 'rgba(192,57,43,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C0392B',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#FF6B6B', lineHeight: 18 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: '#fff',
    padding: 0,
  },
  identifierInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },
  btnPrimaryText: {
    fontFamily: Fonts.semiBold,
    color: '#1A1208',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  gerantSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 20,
    marginBottom: 12,
  },
  gerantBtn: {
    alignItems: 'center',
  },
  gerantBtnText: {
    fontSize: 12,
    color: 'rgba(201,168,76,0.5)',
  },
  gerantPasswordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1814',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gerantPasswordInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#FFFFFF',
    padding: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          backgroundColor: 'transparent',
          outline: 'none',
          WebkitAppearance: 'none',
        } as any)
      : {}),
  },
  backToClientText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
});
