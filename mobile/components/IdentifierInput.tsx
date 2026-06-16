import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appointmentsApi } from '@/services/api';
import { Fonts } from '@/constants';

const GOLD = '#C8A97E';
const BG = '#1A1614';
const INPUT_BG = '#231F1C';
const BORDER = 'rgba(200,169,126,0.22)';

export interface ClientInfo {
  status: 'exists' | 'new';
  firstName?: string;
  lastName?: string;
  identifier: string;
}

interface Props {
  onComplete: (info: ClientInfo) => void;
}

export function IdentifierInput({ onComplete }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ status: 'exists' | 'new'; first_name?: string } | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const animateNewFields = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const handleCheck = async () => {
    if (!identifier.trim()) {
      setError('Veuillez saisir un e-mail ou numéro de téléphone.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await appointmentsApi.checkClient(identifier.trim());
      setResult(res);
      if (res.status === 'new') animateNewFields();
    } catch {
      setError('Vérification impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExisting = () => {
    onComplete({
      status: 'exists',
      firstName: result?.first_name,
      identifier: identifier.trim(),
    });
  };

  const handleCreateNew = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Prénom et nom requis.');
      return;
    }
    onComplete({
      status: 'new',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      identifier: identifier.trim(),
    });
  };

  const resetResult = (text: string) => {
    setIdentifier(text);
    setResult(null);
    setError('');
    slideAnim.setValue(-20);
    opacityAnim.setValue(0);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoMark}>{'{w}'}</Text>
          <Text style={styles.logoBrand}>willobarber</Text>
        </View>

        {/* Headline */}
        <Text style={styles.kicker}>IDENTIFICATION CLIENT</Text>
        <Text style={styles.title}>
          {'Votre prochaine\n'}
          <Text style={styles.titleGold}>coupe commence ici.</Text>
        </Text>
        <Text style={styles.sub}>
          Entrez votre e-mail ou téléphone. Pas de mot de passe — c'est tout.
        </Text>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Identifier field */}
        <Text style={styles.fieldLabel}>E-mail ou numéro de téléphone</Text>
        <TextInput
          style={[styles.input, !!result && styles.inputLocked]}
          value={identifier}
          onChangeText={resetResult}
          placeholder="sophie@email.com  ou  0477 123 456"
          placeholderTextColor="rgba(255,255,255,0.25)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!result}
          returnKeyType="done"
          onSubmitEditing={!result ? handleCheck : undefined}
        />

        {/* Existing client feedback */}
        {result?.status === 'exists' && (
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeIcon}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText}>
                Ravi de vous revoir,{' '}
                <Text style={styles.welcomeName}>
                  {result.first_name || 'cher client'} !
                </Text>
              </Text>
              <Text style={styles.welcomeSub}>
                Votre profil a été retrouvé. Confirmez pour continuer.
              </Text>
            </View>
          </View>
        )}

        {/* New client — slide-down reveal */}
        {result?.status === 'new' && (
          <Animated.View
            style={[
              styles.newFieldsWrap,
              { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>PREMIÈRE VISITE</Text>
            </View>
            <Text style={styles.newTitle}>
              Bienvenue !{' '}
              <Text style={styles.newTitleGold}>Créons votre profil.</Text>
            </Text>

            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Sophie"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Nom</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Lebrun"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleCreateNew}
            />
          </Animated.View>
        )}

        {/* CTA */}
        <View style={styles.btnWrap}>
          {!result ? (
            <TouchableOpacity
              style={[styles.btnPill, loading && styles.btnLoading]}
              onPress={handleCheck}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#1A1208" size="small" />
              ) : (
                <Text style={styles.btnPillText}>Continuer  →</Text>
              )}
            </TouchableOpacity>
          ) : result.status === 'exists' ? (
            <TouchableOpacity style={styles.btnPill} onPress={handleConfirmExisting} activeOpacity={0.85}>
              <Text style={styles.btnPillText}>Confirmer le RDV  →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnPill} onPress={handleCreateNew} activeOpacity={0.85}>
              <Text style={styles.btnPillText}>Créer & réserver  →</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.privacy}>
          Aucun mot de passe · Aucun compte à créer · Juste votre rendez-vous.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 26,
    paddingTop: Platform.OS === 'ios' ? 64 : (StatusBar.currentHeight ?? 0) + 32,
    paddingBottom: 56,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 36,
  },
  logoMark: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1,
  },
  logoBrand: {
    fontFamily: Fonts.semiBold,
    fontSize: 19,
    fontWeight: '600',
    color: '#fff',
  },

  // Headline
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 40,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 46,
    marginBottom: 14,
  },
  titleGold: {
    fontFamily: Fonts.semiBoldItalic,
    color: GOLD,
    fontStyle: 'italic',
  },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 22,
    marginBottom: 30,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(192,57,43,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.5)',
    padding: 13,
    marginBottom: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#E74C3C',
    lineHeight: 18,
  },

  // Fields
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 15,
    color: '#fff',
    fontFamily: Fonts.regular,
    marginBottom: 22,
  },
  inputLocked: {
    opacity: 0.55,
    borderColor: 'rgba(200,169,126,0.08)',
  },

  // Welcome box (existing client)
  welcomeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(200,169,126,0.09)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,169,126,0.28)',
    padding: 18,
    marginBottom: 24,
  },
  welcomeIcon: {
    fontSize: 18,
    color: GOLD,
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Fonts.regular,
    lineHeight: 22,
    marginBottom: 4,
  },
  welcomeName: {
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    color: GOLD,
  },
  welcomeSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.38)',
    lineHeight: 18,
  },

  // New client fields
  newFieldsWrap: {
    marginBottom: 6,
  },
  newBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(200,169,126,0.35)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: GOLD,
  },
  newTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 22,
    lineHeight: 28,
  },
  newTitleGold: {
    fontFamily: Fonts.semiBoldItalic,
    color: GOLD,
    fontStyle: 'italic',
  },

  // CTA button
  btnWrap: {
    marginTop: 6,
    marginBottom: 20,
  },
  btnPill: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 5,
  },
  btnLoading: {
    opacity: 0.7,
  },
  btnPillText: {
    fontFamily: Fonts.semiBold,
    color: '#1A1208',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // Footer note
  privacy: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.22)',
    lineHeight: 18,
    letterSpacing: 0.3,
  },
});
