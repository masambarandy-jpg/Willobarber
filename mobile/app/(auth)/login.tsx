import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appointmentsApi, authApi, TokenStorage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Fonts } from '@/constants';

type Step = 'idle' | 'exists' | 'new';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [existingFirstName, setExistingFirstName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const animateNewStep = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const resetToIdle = (text: string) => {
    setIdentifier(text);
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
      router.replace('/(tabs)');
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
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Text style={styles.logoMark}>{'{w}'}</Text>
          <Text style={styles.logoText}>willobarber</Text>
        </View>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>ESPACE CLIENT</Text>
          </View>
          <Text style={styles.heroTitle}>
            {step === 'exists' ? `Ravi de vous revoir,\n${existingFirstName} !` : 'Bon retour.'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {step === 'exists'
              ? 'Votre profil a été retrouvé. Confirmez pour continuer.'
              : 'Entrez votre e-mail ou téléphone pour accéder à votre espace.'}
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>E-MAIL OU TÉLÉPHONE</Text>
          <TextInput
            style={[styles.input, step !== 'idle' && styles.inputLocked]}
            value={identifier}
            onChangeText={resetToIdle}
            placeholder="exemple@email.com ou +32 470 …"
            placeholderTextColor="rgba(255,255,255,0.3)"
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
              <Text style={styles.fieldLabel}>PRÉNOM</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jean"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCorrect={false}
                returnKeyType="next"
              />
              <Text style={styles.fieldLabel}>NOM</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Dupont"
                placeholderTextColor="rgba(255,255,255,0.3)"
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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>accès sécurisé sans mot de passe</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.securityNote}>
            Connexion passwordless · Vos données restent privées
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>{'{w}'} willobarber</Text>
          <Text style={styles.footerAddress}>Rue Auguste Van Zande 78 · Bruxelles</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  backBtnPlaceholder: {
    width: 72,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
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

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  hero: {
    width: '100%',
    maxWidth: 480,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'flex-start',
  },
  heroBadge: {
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 18,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
  },
  heroTitle: {
    fontFamily: Fonts.bold,
    fontSize: 38,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
    lineHeight: 44,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
  },

  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1A1814',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },

  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: '#fff',
    marginBottom: 20,
  },
  inputLocked: {
    opacity: 0.5,
    borderColor: 'rgba(200,169,126,0.25)',
  },

  errorBox: {
    backgroundColor: 'rgba(192,57,43,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C0392B',
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13.5,
    color: '#FF6B6B',
    lineHeight: 19,
  },

  newBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
  },
  newTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    lineHeight: 24,
  },
  newTitleGold: {
    color: '#C9A84C',
    fontStyle: 'italic',
  },

  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 24,
  },
  btnPrimaryText: {
    color: '#1A1208',
    fontWeight: '700',
    fontSize: 15.5,
    letterSpacing: 0.2,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  securityNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 18,
  },

  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 6,
  },
  footerLogo: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(201,168,76,0.6)',
    letterSpacing: 0.5,
  },
  footerAddress: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
});
