import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { appointmentsApi } from '@/services/api';
import { Fonts } from '@/constants';

const { height: SCREEN_H } = Dimensions.get('window');

const STATS = [
  { num: '2 412', label: 'clients fidèles' },
  { num: '4,8 ★', label: 'note moyenne' },
  { num: '386', label: 'RDV ce mois' },
];

type Step = 'idle' | 'exists' | 'new';

export default function LoginScreen() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [existingFirstName, setExistingFirstName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
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
        animateIn();
      }
    } catch {
      setError('Vérification impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    router.replace('/(tabs)');
  };

  const handleCreateAccount = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Prénom et nom requis.');
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.root}>
      {/* ── Dark top panel ── */}
      <LinearGradient
        colors={['#2e2313', '#1a1508', '#0D0C0A']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.darkPanel}
      >
        <View style={styles.logoRow}>
          <Text style={styles.logoMark}>{'{w}'}</Text>
          <Text style={styles.logoText}>willobarber</Text>
        </View>
        <Text style={styles.kicker}>ESPACE CLIENT</Text>
        <Text style={styles.heroTitle}>
          Votre style,{'\n'}
          <Text style={styles.heroTitleGold}>entre de bonnes{'\n'}mains.</Text>
        </Text>
        <View style={styles.statsRow}>
          {STATS.map(s => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statNum}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Cream form panel ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.creamPanel}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          {/* Identifier field */}
          <TextInput
            style={[styles.input, step !== 'idle' && styles.inputLocked]}
            value={identifier}
            onChangeText={resetToIdle}
            placeholder="E-mail ou numéro de téléphone"
            placeholderTextColor="#b8afa2"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            editable={step === 'idle'}
            returnKeyType="done"
            onSubmitEditing={step === 'idle' ? handleContinue : undefined}
          />

          {/* New client — slide-down reveal */}
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
                placeholderTextColor="#b8afa2"
                autoCorrect={false}
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Nom"
                placeholderTextColor="#b8afa2"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleCreateAccount}
              />
            </Animated.View>
          )}

          {/* CTA */}
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
            <TouchableOpacity style={styles.btnPrimary} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>Confirmer  →</Text>
            </TouchableOpacity>
          )}

          {step === 'new' && (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateAccount} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>Créer mon compte & continuer  →</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register link */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Pas encore de compte ?</Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.signupLink}> Créer un compte</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0E8' },

  // Dark panel
  darkPanel: {
    height: SCREEN_H * 0.42,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 24,
    paddingBottom: 22,
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logoMark: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: '#C9A84C',
    letterSpacing: 1,
  },
  logoText: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.5,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  heroTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 38,
    flex: 1,
    marginTop: 10,
  },
  heroTitleGold: {
    color: '#C9A84C',
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 4,
  },
  statItem: {},
  statNum: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: '#C9A84C',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
  },

  // Cream panel
  creamPanel: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    gap: 0,
  },
  formTitle: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1208',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6B6560',
    marginBottom: 22,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C0392B',
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#C0392B',
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0D9CE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14.5,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  inputLocked: {
    opacity: 0.55,
    borderColor: 'rgba(200,169,126,0.3)',
  },
  newBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(139,105,20,0.4)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#8B6914',
  },
  newTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1208',
    marginBottom: 18,
    lineHeight: 26,
  },
  newTitleGold: {
    color: '#8B6914',
    fontStyle: 'italic',
  },
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
  btnPrimaryText: {
    color: '#1A1208',
    fontWeight: '700',
    fontSize: 15.5,
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0D9CE',
  },
  dividerText: {
    fontSize: 12.5,
    color: '#a89f93',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 13.5,
    color: '#6B6560',
  },
  signupLink: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#8B6914',
  },
});
