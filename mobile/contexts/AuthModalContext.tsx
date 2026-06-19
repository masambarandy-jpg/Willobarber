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
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { appointmentsApi, authApi, TokenStorage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Fonts } from '@/constants';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_MAX_HEIGHT = SCREEN_H * 0.75;

type Step = 'idle' | 'exists' | 'new';

type AuthModalContextType = {
  showLoginModal: (onSuccess?: () => void, message?: string) => void;
  hideLoginModal: () => void;
};

const AuthModalContext = createContext<AuthModalContextType>({
  showLoginModal: () => {},
  hideLoginModal: () => {},
});

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const { refreshUser } = useAuth();

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

  const [identifier, setIdentifierState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [existingFirstName, setExistingFirstName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const panelAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showLoginModal = (onSuccess?: () => void, msg?: string) => {
    if (Platform.OS === 'web') {
      router.push('/(auth)/login');
      return;
    }
    setOnSuccessCallback(() => onSuccess ?? null);
    setMessage(msg);
    setIdentifierState('');
    setError('');
    setStep('idle');
    setFirstName('');
    setLastName('');
    slideAnim.setValue(-20);
    opacityAnim.setValue(0);
    panelAnim.setValue(SCREEN_H);
    overlayAnim.setValue(0);
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
        Animated.timing(panelAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (callback?: () => void) => {
    if (loading) return;
    Animated.parallel([
      Animated.timing(panelAnim, {
        toValue: SCREEN_H,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 250,
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

  const animateNewStep = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const resetToIdle = (text: string) => {
    setIdentifierState(text);
    setStep('idle');
    setError('');
    slideAnim.setValue(-20);
    opacityAnim.setValue(0);
  };

  const handleContinue = async () => {
    if (!identifier.trim()) {
      setError('Veuillez saisir un e-mail ou numéro de téléphone.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await appointmentsApi.checkClient(identifier.trim());
      if (res.status === 'exists') {
        setExistingFirstName(res.first_name ?? '');
        setStep('exists');
      } else {
        setStep('new');
        animateNewStep();
      }
    } catch {
      setError('Vérification impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const { access, refresh } = await authApi.passwordlessLogin(identifier.trim());
      await TokenStorage.save(access, refresh);
      await refreshUser();
      handleSuccess();
    } catch {
      setError('Connexion impossible. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Prénom et nom requis.');
      return;
    }
    handleSuccess();
  };

  return (
    <AuthModalContext.Provider value={{ showLoginModal, hideLoginModal }}>
      <View style={{ flex: 1 }}>
        {children}

        {visible && (
          <View style={styles.container} pointerEvents="box-none">
            {/* Dark overlay */}
            <Animated.View
              style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: overlayAnim }]}
              pointerEvents="auto"
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={handleClose}
                activeOpacity={1}
              />
            </Animated.View>

            {/* Bottom sheet panel */}
            <Animated.View style={[styles.panel, { transform: [{ translateY: panelAnim }] }]}>
              <View style={styles.dragHandle} />

              {!!message && <Text style={styles.contextMessage}>{message}</Text>}

              <View style={styles.headerRow}>
                <View style={styles.logoRow}>
                  <Text style={styles.logoMark}>{'{w}'}</Text>
                  <Text style={styles.logoText}>willobarber</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formContent}
              >
                <Text style={styles.formTitle}>
                  {step === 'exists' ? `Ravi de vous revoir,\n${existingFirstName} !` : 'Bon retour.'}
                </Text>
                <Text style={styles.formSubtitle}>
                  {step === 'exists'
                    ? 'Votre profil a été retrouvé. Confirmez pour continuer.'
                    : 'Entrez votre e-mail ou téléphone pour accéder à votre espace.'}
                </Text>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TextInput
                  style={[styles.input, step !== 'idle' && styles.inputLocked]}
                  value={identifier}
                  onChangeText={resetToIdle}
                  placeholder="E-mail ou numéro de téléphone"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  editable={step === 'idle'}
                  returnKeyType="done"
                  onSubmitEditing={step === 'idle' ? handleContinue : undefined}
                />

                {step === 'new' && (
                  <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>PREMIÈRE VISITE</Text>
                    </View>
                    <Text style={styles.newTitle}>
                      Bienvenue !{' '}
                      <Text style={styles.newTitleGold}>Créons votre profil.</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Prénom"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                    <TextInput
                      style={styles.input}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Nom"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateAccount}
                    />
                  </Animated.View>
                )}

                {step === 'idle' && (
                  <TouchableOpacity
                    style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                    onPress={handleContinue}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#1A1208" size="small" />
                      : <Text style={styles.btnPrimaryText}>Continuer  →</Text>
                    }
                  </TouchableOpacity>
                )}

                {step === 'exists' && (
                  <TouchableOpacity
                    style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                    onPress={handleConfirm}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#1A1208" size="small" />
                      : <Text style={styles.btnPrimaryText}>Confirmer  →</Text>
                    }
                  </TouchableOpacity>
                )}

                {step === 'new' && (
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateAccount} activeOpacity={0.85}>
                    <Text style={styles.btnPrimaryText}>Créer mon compte & continuer  →</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
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
  },
  overlay: {
    backgroundColor: Platform.OS === 'web' ? '#0D0C0A' : 'rgba(0,0,0,0.7)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1814',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: PANEL_MAX_HEIGHT,
    zIndex: 10000,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  contextMessage: {
    fontFamily: Fonts.italic,
    fontStyle: 'italic',
    fontSize: 18,
    color: '#C9A84C',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    fontWeight: '700',
    color: '#C9A84C',
    letterSpacing: 1,
  },
  logoText: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 14 },
  formContent: { paddingBottom: 8 },
  formTitle: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  formSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 22,
    lineHeight: 20,
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
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14.5,
    color: '#fff',
    marginBottom: 16,
  },
  inputLocked: { opacity: 0.55, borderColor: 'rgba(200,169,126,0.3)' },
  newBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  newBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#C9A84C' },
  newTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 18,
    lineHeight: 24,
  },
  newTitleGold: { color: '#C9A84C', fontStyle: 'italic' },
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 20,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.2 },
});
