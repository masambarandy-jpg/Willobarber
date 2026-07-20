import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CC, SERIF } from './theme';
import { CloseIcon, MailIcon, PhoneIcon, ClockIcon, ZapIcon, EditIcon } from './Icons';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SUPPORT_INFO: { icon: (color: string) => React.ReactNode; label: string; value: string }[] = [
  { icon: (c) => <MailIcon color={c} size={18} />, label: 'Email', value: 'support@willobarber.fr' },
  { icon: (c) => <PhoneIcon color={c} size={18} />, label: 'Téléphone', value: '01 23 45 67 89' },
  { icon: (c) => <ClockIcon color={c} size={18} />, label: 'Disponibilité', value: 'Mar–Sam, 9h–18h' },
  { icon: (c) => <ZapIcon color={c} size={18} />, label: 'Temps de réponse', value: 'Moins de 2h' },
];

export default function SupportModal({ visible, onClose }: Props) {
  const [message, setMessage] = useState('');

  const fermer = () => {
    setMessage('');
    onClose();
  };

  const envoyer = () => {
    setMessage('');
    onClose();
  };

  const modifierInfos = () => {
    onClose();
    // Laisse l'animation de fermeture de la Modal se terminer avant de naviguer,
    // sinon le push peut être ignoré pendant la transition de fermeture (iOS).
    setTimeout(() => router.push('/coiffeur/parametres'), 300);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fermer}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Contacter le support</Text>
            <TouchableOpacity onPress={fermer} hitSlop={10}>
              <CloseIcon size={18} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoBlock}>
            {SUPPORT_INFO.map((item, i) => (
              <View key={item.label} style={[styles.infoRow, i < SUPPORT_INFO.length - 1 && styles.infoRowBorder]}>
                <View style={styles.infoIcon}>{item.icon(CC.goldDark)}</View>
                <View>
                  <Text style={styles.infoLabel}>{item.label.toUpperCase()}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.fieldLabel}>VOTRE MESSAGE</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            placeholder="Décrivez votre problème..."
            placeholderTextColor={CC.textSecondary}
            style={styles.input}
          />

          <TouchableOpacity style={styles.sendBtn} onPress={envoyer}>
            <Text style={styles.sendBtnText}>Envoyer le message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.editInfoBtn} onPress={modifierInfos}>
            <EditIcon size={14} color={CC.black} />
            <Text style={styles.editInfoBtnText}>Modifier mes informations</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    backgroundColor: CC.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 22,
    color: CC.black,
  },
  infoBlock: {
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: CC.trackBg,
  },
  infoIcon: {
    width: 28,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: CC.black,
    marginTop: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: CC.black,
    minHeight: 100,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: CC.gold,
    borderRadius: 100,
    padding: 15,
    alignItems: 'center',
  },
  sendBtnText: {
    fontWeight: '700',
    color: CC.black,
    fontSize: 15,
  },
  editInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    padding: 14,
    marginTop: 10,
  },
  editInfoBtnText: {
    fontWeight: '600',
    color: CC.black,
    fontSize: 14,
  },
});
