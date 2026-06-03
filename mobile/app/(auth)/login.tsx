import React, { useState } from 'react';
import {
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
import { useAuth } from '@/hooks/useAuth';
import { Fonts } from '@/constants';

const { height: SCREEN_H } = Dimensions.get('window');

const STATS = [
  { num: '2 412', label: 'clients fidèles' },
  { num: '4,8 ★', label: 'note moyenne' },
  { num: '386', label: 'RDV ce mois' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Identifiant et mot de passe requis.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('PAYLOAD:', { username: email.trim(), password });
      console.log('BASE URL:', process.env.EXPO_PUBLIC_API_URL);
      await login({ username: email.trim(), password });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
      const msg = data?.detail ?? data?.error ?? 'Identifiants invalides.';
      setError(msg);
    } finally {
      setLoading(false);
    }
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
        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoMark}>{'{w}'}</Text>
          <Text style={styles.logoText}>willobarber</Text>
        </View>
        {/* Kicker */}
        <Text style={styles.kicker}>ESPACE CLIENT</Text>
        {/* Title */}
        <Text style={styles.heroTitle}>
          Votre style,{'\n'}
          <Text style={styles.heroTitleGold}>entre de bonnes{'\n'}mains.</Text>
        </Text>
        {/* Stats */}
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
          <Text style={styles.formTitle}>Bon retour.</Text>
          <Text style={styles.formSubtitle}>Connectez-vous pour réserver votre prochain rendez-vous.</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Username */}
          <Text style={styles.fieldLabel}>Nom d'utilisateur</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="votre_username"
            placeholderTextColor="#b8afa2"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="next"
          />

          {/* Password */}
          <Text style={styles.fieldLabel}>Mot de passe</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.inputPasswordField]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#b8afa2"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          <View style={styles.forgotRow}>
            <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>{loading ? 'Connexion…' : 'Se connecter  →'}</Text>
          </TouchableOpacity>

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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
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
  inputWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  inputPasswordField: {
    marginBottom: 0,
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 22,
    marginTop: 6,
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B6914',
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
