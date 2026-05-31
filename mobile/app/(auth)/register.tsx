import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { API_BASE_URL, Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants';

interface FormData {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  password2: string;
}

interface FormErrors extends Partial<FormData> {
  general?: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    password2: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const setField = (key: keyof FormData) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.first_name.trim()) e.first_name = 'Prénom requis';
    if (!form.last_name.trim()) e.last_name = 'Nom requis';
    if (!form.username.trim()) e.username = "Nom d'utilisateur requis";
    if (!form.email.trim()) e.email = 'Email requis';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email invalide';
    if (!form.password) e.password = 'Mot de passe requis';
    else if (form.password.length < 8) e.password = '8 caractères minimum';
    if (form.password !== form.password2) e.password2 = 'Les mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      console.log('API URL:', API_BASE_URL);
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      console.log('Données envoyées:', payload);

      // ── Diagnostic fetch natif ───────────────────────────────────────────────
      console.log('[fetch] Tentative vers:', `${API_BASE_URL}/auth/register/`);
      try {
        const fetchRes = await fetch(`${API_BASE_URL}/auth/register/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, password2: form.password2 }),
        });
        const fetchBody = await fetchRes.text();
        console.log('[fetch] Status:', fetchRes.status);
        console.log('[fetch] Body:', fetchBody);
      } catch (fetchErr) {
        console.error('[fetch] Échec réseau:', fetchErr);
      }
      // ────────────────────────────────────────────────────────────────────────

      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        password2: form.password2,
      });
    } catch (err: unknown) {
      console.error('[Register] Erreur complète:', err);
      const responseData = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (responseData) {
        console.error('[Register] Réponse serveur:', responseData);
        const fieldErrors: FormErrors = {};
        Object.entries(responseData).forEach(([key, msgs]) => {
          fieldErrors[key as keyof FormErrors] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: 'Une erreur est survenue. Veuillez réessayer.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Retour</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              Rejoignez WilloBarber et réservez facilement.
            </Text>
          </View>

          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errors.general}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Input
                  label="Prénom"
                  value={form.first_name}
                  onChangeText={setField('first_name')}
                  placeholder="Jean"
                  autoCapitalize="words"
                  error={errors.first_name}
                />
              </View>
              <View style={styles.flex}>
                <Input
                  label="Nom"
                  value={form.last_name}
                  onChangeText={setField('last_name')}
                  placeholder="Dupont"
                  autoCapitalize="words"
                  error={errors.last_name}
                />
              </View>
            </View>

            <Input
              label="Nom d'utilisateur"
              value={form.username}
              onChangeText={setField('username')}
              placeholder="jean.dupont"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.username}
            />

            <Input
              label="Email"
              value={form.email}
              onChangeText={setField('email')}
              placeholder="jean@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="Téléphone (optionnel)"
              value={form.phone}
              onChangeText={setField('phone')}
              placeholder="+32 470 12 34 56"
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <Input
              label="Mot de passe"
              value={form.password}
              onChangeText={setField('password')}
              placeholder="••••••••"
              secureTextEntry
              error={errors.password}
              hint="8 caractères minimum"
            />

            <Input
              label="Confirmer le mot de passe"
              value={form.password2}
              onChangeText={setField('password2')}
              placeholder="••••••••"
              secureTextEntry
              error={errors.password2}
            />

            <Button
              label="Créer mon compte"
              onPress={handleRegister}
              loading={loading}
              size="lg"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ?</Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}> Se connecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.xl, gap: Spacing.lg },
  backBtn: { paddingVertical: Spacing.sm },
  backText: { fontSize: FontSize.base, color: Colors.gold, fontWeight: FontWeight.medium },
  header: { gap: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary },
  errorBanner: {
    backgroundColor: Colors.errorSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: Spacing.md,
  },
  errorBannerText: { fontSize: FontSize.sm, color: Colors.error },
  form: { gap: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: Spacing.xl },
  footerText: { fontSize: FontSize.base, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.base, color: Colors.gold, fontWeight: FontWeight.semiBold },
});
