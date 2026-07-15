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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { EyeIcon, EyeOffIcon, CheckIcon, GoogleIcon, ArrowRightIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';

export default function CoiffeurLoginScreen() {
  const [email, setEmail] = useState('willo@willobarber.fr');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#2a2010', '#1a140a', '#0D0C0A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.topSection}
      >
        <Text style={styles.logo}>
          {'{w}'} <Text style={styles.logoBrand}>willobarber</Text>
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ESPACE GÉRANT</Text>
        </View>
        <Text style={styles.heroTitle}>Votre salon, maîtrisé au rasoir près.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>2 412</Text>
            <Text style={styles.statLabel}>clients fidèles</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4,8 ★</Text>
            <Text style={styles.statLabel}>note moyenne</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>386</Text>
            <Text style={styles.statLabel}>RDV ce mois</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.bottomSection} contentContainerStyle={styles.bottomContent}>
        <Text style={styles.welcomeTitle}>Bon retour, Willo.</Text>
        <Text style={styles.welcomeSubtitle}>Connectez-vous pour gérer votre salon.</Text>

        <Text style={styles.label}>ADRESSE EMAIL</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={CC.textSecondary}
        />

        <Text style={styles.label}>MOT DE PASSE</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            placeholderTextColor={CC.textSecondary}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember((v) => !v)}>
            <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
              {remember && <CheckIcon color={CC.white} size={11} />}
            </View>
            <Text style={styles.rememberText}>Se souvenir de moi</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/coiffeur/dashboard')}>
          <Text style={styles.loginBtnText}>Se connecter</Text>
          <ArrowRightIcon color={CC.black} size={16} />
        </TouchableOpacity>

        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>— ou —</Text>
          <View style={styles.separatorLine} />
        </View>

        <TouchableOpacity style={styles.googleBtn}>
          <GoogleIcon size={18} />
          <Text style={styles.googleBtnText}>Continuer avec Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerLink}>
          <Text style={styles.footerLinkText}>Pas encore de salon ? Créer un compte</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CC.cream,
  },
  topSection: {
    height: '42%',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 40 : 60,
    paddingBottom: 20,
    justifyContent: 'flex-start',
  },
  logo: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.gold,
    marginBottom: 22,
  },
  logoBrand: {
    fontFamily: SERIF,
    fontWeight: '700',
    color: CC.white,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  badgeText: {
    color: CC.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.white,
    lineHeight: 36,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.gold,
  },
  statLabel: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  bottomSection: {
    flex: 1,
  },
  bottomContent: {
    padding: 24,
    paddingBottom: 48,
  },
  welcomeTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 32,
    color: CC.black,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: CC.textSecondary,
    marginBottom: 26,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    color: CC.black,
    marginBottom: 18,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 12,
    marginBottom: 18,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 14,
    color: CC.black,
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
    borderColor: CC.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CC.white,
  },
  checkboxChecked: {
    backgroundColor: CC.gold,
    borderColor: CC.gold,
  },
  rememberText: {
    fontSize: 13,
    color: CC.black,
  },
  forgotText: {
    fontSize: 13,
    color: CC.goldDark,
    fontWeight: '600',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 16,
    marginBottom: 22,
  },
  loginBtnText: {
    color: CC.black,
    fontWeight: '700',
    fontSize: 15,
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
    backgroundColor: CC.border,
  },
  separatorText: {
    fontSize: 12,
    color: CC.textSecondary,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 100,
    paddingVertical: 15,
    marginBottom: 26,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  footerLink: {
    alignItems: 'center',
  },
  footerLinkText: {
    fontSize: 13,
    color: CC.goldDark,
    fontWeight: '600',
  },
});
