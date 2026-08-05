import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants';

export default function CoiffeurLoginScreen() {
  const { width } = useWindowDimensions();
  const cardMaxWidth = width > 600 ? 460 : 400;

  const [email, setEmail] = useState('willo@willobarber.fr');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        'https://willobarber-production-6951.up.railway.app/api/auth/login/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'willo', password }),
        }
      );
      const data = await response.json();
      if (response.ok && data.access) {
        await AsyncStorage.setItem('coiffeur_token', data.access);
        await AsyncStorage.setItem('coiffeur_refresh', data.refresh);
        router.push('/coiffeur/dashboard');
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    } catch (e) {
      setError('Erreur de connexion. Vérifiez votre internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.kicker}>— ESPACE GÉRANT</Text>
        <Text style={styles.title}>Connexion</Text>
        <Text style={styles.subtitle}>Connectez-vous pour gérer votre salon.</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>EMAIL</Text>
        <View style={styles.inputWrap}>
          <Feather name="user" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
        </View>

        <Text style={styles.label}>MOT DE PASSE</Text>
        <View style={styles.passwordWrap}>
          <Feather name="lock" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={[
              styles.passwordInput,
              Platform.OS === 'web' && ({
                backgroundColor: 'transparent',
                background: 'none',
                WebkitBoxShadow: '0 0 0 1000px #1A1814 inset',
                WebkitTextFillColor: '#FFFFFF',
                caretColor: '#FFFFFF',
              } as any),
            ]}
            secureTextEntry={!showPassword}
            placeholderTextColor="rgba(255,255,255,0.35)"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>{loading ? 'Connexion...' : 'Se connecter →'}</Text>
        </TouchableOpacity>

        <View style={styles.gerantSeparator} />
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.6} style={styles.gerantBtn}>
          <Text style={styles.gerantBtnText}>← Retour espace client</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 40 : 70,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#1A1814',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    alignSelf: 'center',
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
    width: '100%',
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
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: '#1A1814',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 48,
    paddingVertical: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 8,
  },
  passwordInput: {
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
  btnPrimary: {
    width: '100%',
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
});
