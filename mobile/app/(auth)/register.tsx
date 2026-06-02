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

const { height: SCREEN_H } = Dimensions.get('window');
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface FormErrors {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  password?: string;
  password2?: string;
  general?: string;
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function FieldInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  returnKeyType,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
  error?: string;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
}) {
  return (
    <>
      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#b8afa2"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!firstName.trim()) e.first_name = 'Prénom requis';
    if (!lastName.trim()) e.last_name = 'Nom requis';
    if (!username.trim()) e.username = "Nom d'utilisateur requis";
    if (!email.trim()) e.email = 'Email requis';
    if (!password) e.password = 'Mot de passe requis (min. 8 caractères)';
    else if (password.length < 8) e.password = 'Min. 8 caractères';
    if (password !== password2) e.password2 = 'Les mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        password2,
      });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (data) {
        const mapped: FormErrors = {};
        if (data.first_name) mapped.first_name = data.first_name[0];
        if (data.last_name) mapped.last_name = data.last_name[0];
        if (data.username) mapped.username = data.username[0];
        if (data.email) mapped.email = data.email[0];
        if (data.password) mapped.password = data.password[0];
        if (data.non_field_errors) mapped.general = data.non_field_errors[0];
        setErrors(mapped);
      } else {
        setErrors({ general: "Erreur lors de l'inscription." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Dark top panel */}
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
        <Text style={styles.kicker}>CRÉER UN COMPTE</Text>
        <Text style={styles.heroTitle}>
          Rejoignez{'\n'}
          <Text style={styles.heroTitleGold}>2 400+ clients{'\n'}qui nous font confiance.</Text>
        </Text>
        <Text style={styles.heroSub}>Réservation rapide · Rappel SMS · Acompte sécurisé.</Text>
      </LinearGradient>

      {/* Cream form panel */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.creamPanel}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>Créer un compte.</Text>
          <Text style={styles.formSubtitle}>Remplissez les informations ci-dessous.</Text>

          {!!errors.general && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          )}

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Prénom" />
              <FieldInput value={firstName} onChangeText={setFirstName} placeholder="Jean" autoCapitalize="words" error={errors.first_name} returnKeyType="next" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Nom" />
              <FieldInput value={lastName} onChangeText={setLastName} placeholder="Dupont" autoCapitalize="words" error={errors.last_name} returnKeyType="next" />
            </View>
          </View>

          <FieldLabel label="Nom d'utilisateur" />
          <FieldInput value={username} onChangeText={setUsername} placeholder="jean.dupont" error={errors.username} returnKeyType="next" />

          <FieldLabel label="Adresse email" />
          <FieldInput value={email} onChangeText={setEmail} placeholder="jean@email.com" keyboardType="email-address" error={errors.email} returnKeyType="next" />

          <FieldLabel label="Téléphone (optionnel)" />
          <FieldInput value={phone} onChangeText={setPhone} placeholder="+32 470 …" keyboardType="phone-pad" returnKeyType="next" />

          <FieldLabel label="Mot de passe" />
          <FieldInput value={password} onChangeText={setPassword} placeholder="Min. 8 caractères" secureTextEntry error={errors.password} returnKeyType="next" />

          <FieldLabel label="Confirmer le mot de passe" />
          <FieldInput value={password2} onChangeText={setPassword2} placeholder="Confirmez le mot de passe" secureTextEntry error={errors.password2} returnKeyType="done" onSubmitEditing={handleRegister} />

          <TouchableOpacity
            style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>{loading ? 'Inscription…' : 'Créer mon compte  →'}</Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.loginLink}> Se connecter</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>En créant un compte vous acceptez nos conditions d'utilisation.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0E8' },

  darkPanel: {
    height: SCREEN_H * 0.36,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 24,
    paddingBottom: 22,
    justifyContent: 'space-between',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoMark: { fontFamily: SERIF, fontSize: 22, fontWeight: '700', color: '#C9A84C', letterSpacing: 1 },
  logoText: { fontFamily: SERIF, fontSize: 20, fontWeight: '600', color: '#fff' },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 2.5, color: '#C9A84C', textTransform: 'uppercase' },
  heroTitle: { fontFamily: SERIF, fontSize: 27, fontWeight: '600', color: '#fff', lineHeight: 33 },
  heroTitleGold: { color: '#C9A84C', fontStyle: 'italic' },
  heroSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 19 },

  creamPanel: { flex: 1, backgroundColor: '#F5F0E8' },
  formContent: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 32 },

  formTitle: { fontFamily: SERIF, fontSize: 30, fontWeight: '700', color: '#1A1208', marginBottom: 6 },
  formSubtitle: { fontSize: 14, color: '#6B6560', marginBottom: 20, lineHeight: 20 },

  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, borderWidth: 1, borderColor: '#C0392B', padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#C0392B' },

  row2: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 7 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0D9CE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 14,
  },
  inputError: { borderColor: '#C0392B' },
  fieldError: { fontSize: 12, color: '#C0392B', marginTop: -10, marginBottom: 10 },

  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  loginText: { fontSize: 13.5, color: '#6B6560' },
  loginLink: { fontSize: 13.5, fontWeight: '600', color: '#8B6914' },

  legal: { fontSize: 11.5, color: '#a89f93', textAlign: 'center', lineHeight: 17 },
});
