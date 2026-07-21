import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  PersonIcon,
  LockIcon,
  MailIcon,
} from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

export default function CoiffeurLoginScreen() {
  const [email, setEmail] = useState('willo@willobarber.fr');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.kicker}>— ESPACE GÉRANT</Text>
        <Text style={styles.title}>Connexion</Text>
        <Text style={styles.subtitle}>Connectez-vous pour gérer votre salon.</Text>

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
            <Text style={styles.socialGmailIcon}>G</Text>
            <Text style={styles.socialBtnText}>Gmail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
            <MailIcon color="#4A9EFF" size={16} />
            <Text style={styles.socialBtnText}>Outlook</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
            <PersonIcon color="rgba(255,255,255,0.7)" size={16} />
            <Text style={styles.socialBtnText}>Autre</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>— ou —</Text>
          <View style={styles.separatorLine} />
        </View>

        <Text style={styles.label}>EMAIL</Text>
        <View style={styles.inputWrap}>
          <PersonIcon color="rgba(255,255,255,0.4)" size={16} />
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
          <LockIcon color="rgba(255,255,255,0.4)" size={16} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
            {showPassword ? <EyeOffIcon color="rgba(255,255,255,0.4)" /> : <EyeIcon color="rgba(255,255,255,0.4)" />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.loginBtnText}>{loading ? 'Connexion...' : 'Se connecter →'}</Text>
        </TouchableOpacity>

        {error !== '' && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.row}>
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember((v) => !v)}>
            <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
              {remember && <CheckIcon color={CC.black} size={11} />}
            </View>
            <Text style={styles.rememberText}>Se souvenir de moi</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink} activeOpacity={0.7}>
          <Text style={styles.backLinkText}>← Retour espace client</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
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
    backgroundColor: '#222016',
    borderRadius: 20,
    padding: 24,
    maxWidth: 480,
    width: '92%',
    alignSelf: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 34,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 26,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  socialGmailIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA4335',
  },
  socialBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  separatorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
    backgroundColor: 'transparent',
  },
  loginBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    marginBottom: 12,
  },
  loginBtnText: {
    color: '#1a1208',
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    color: '#E53935',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1814',
  },
  checkboxChecked: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  rememberText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  forgotText: {
    fontSize: 13,
    color: '#C9A84C',
    fontWeight: '600',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  backLinkText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
