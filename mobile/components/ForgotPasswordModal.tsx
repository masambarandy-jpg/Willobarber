import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { authApi } from '@/services/api';
import { Fonts } from '@/constants';

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function ForgotPasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setEmail('');
    setLoading(false);
    setSent(false);
    setError('');
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleSend = async () => {
    if (!isEmail(email)) {
      setError('Merci de renseigner un email valide.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError('Une erreur est survenue. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {sent ? (
            <>
              <Text style={styles.kicker}>MOT DE PASSE OUBLIÉ</Text>
              <Text style={styles.title}>Email envoyé ✂️</Text>
              <Text style={styles.subtitle}>Un email de réinitialisation a été envoyé.</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>OK</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.kicker}>MOT DE PASSE OUBLIÉ</Text>
              <Text style={styles.title}>Réinitialisation</Text>
              <Text style={styles.subtitle}>
                Entrez votre email, nous vous enverrons un lien pour choisir un nouveau mot de passe.
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={16} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (error) setError('');
                  }}
                  placeholder="vous@email.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSend}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#1A1208" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Envoyer le lien</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10001,
  },
  card: {
    backgroundColor: '#1A1814',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxWidth: 420,
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
    fontSize: 26,
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
    ...(Platform.OS === 'web' ? ({ outline: 'none' } as any) : {}),
  },
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
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
});
