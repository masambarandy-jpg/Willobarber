import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { appointmentsApi, authApi, TokenStorage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Fonts } from '@/constants';

type AuthModalContextType = {
  showLoginModal: (onSuccess?: () => void, message?: string) => void;
  hideLoginModal: () => void;
};

const isPhone = (value: string) => /^[+]?[0-9\s\-]{8,}$/.test(value.trim());
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const AuthModalContext = createContext<AuthModalContextType>({
  showLoginModal: () => {},
  hideLoginModal: () => {},
});

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const { refreshUser } = useAuth();

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

  const [firstName, setFirstName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const identifierInputRef = useRef<TextInput>(null);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.92)).current;

  const showLoginModal = (onSuccess?: () => void, msg?: string) => {
    setOnSuccessCallback(() => onSuccess ?? null);
    setMessage(msg);
    setFirstName('');
    setIdentifier('');
    setError('');
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
      callback?.();
    });
  };

  const handleClose = () => dismiss(hideLoginModal);

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
      setError('Veuillez saisir votre email ou numéro de téléphone.');
      return;
    }
    if (!isEmail(value) && !isPhone(value)) {
      setError('Veuillez saisir un email ou un numéro de téléphone valide.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await appointmentsApi.checkClient(value);
      if (res.status !== 'exists') {
        setError('Aucun compte trouvé pour cet email ou ce numéro.');
        return;
      }
      const { access, refresh } = await authApi.passwordlessLogin(value);
      await TokenStorage.save(access, refresh);
      await refreshUser();
      handleSuccess();
    } catch (error: any) {
      console.log('Login error:', error?.response?.data || error?.message);
      setError('Connexion impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const focusIdentifier = () => identifierInputRef.current?.focus();

  return (
    <AuthModalContext.Provider value={{ showLoginModal, hideLoginModal }}>
      <View style={{ flex: 1 }}>
        {children}

        {visible && (
          <View style={styles.container} pointerEvents="box-none">
            {/* Fond flou */}
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { opacity: overlayAnim }]}
              pointerEvents="auto"
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

              <Text style={styles.kicker}>— ESPACE CLIENT</Text>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.subtitle}>
                {message || 'Accédez à vos rendez-vous, votre historique et vos points fidélité.'}
              </Text>

              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickPill} onPress={focusIdentifier} activeOpacity={0.75}>
                  <Text style={styles.quickPillGmailIcon}>G</Text>
                  <Text style={styles.quickPillText}>Gmail</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickPill} onPress={focusIdentifier} activeOpacity={0.75}>
                  <Feather name="mail" size={14} color="#4A9EFF" />
                  <Text style={styles.quickPillText}>Outlook</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickPill} onPress={focusIdentifier} activeOpacity={0.75}>
                  <Feather name="user" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.quickPillText}>Autre</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.separatorRow}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>ou entrez votre email ou téléphone</Text>
                <View style={styles.separatorLine} />
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>PRÉNOM</Text>
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

              <Text style={styles.label}>E-MAIL OU TÉLÉPHONE</Text>
              <View style={styles.inputWrap}>
                <Feather name={isPhone(identifier) ? 'phone' : 'mail'} size={16} color="rgba(255,255,255,0.4)" />
                <TextInput
                  ref={identifierInputRef}
                  style={styles.input}
                  value={identifier}
                  onChangeText={(t) => {
                    setIdentifier(t);
                    if (error) setError('');
                  }}
                  placeholder="exemple@email.com ou +32 470 ..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="done"
                  onSubmitEditing={handleAccess}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                onPress={handleAccess}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#1A1208" size="small" />
                  : <Text style={styles.btnPrimaryText}>Accéder à mon espace  →</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          </View>
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
});
