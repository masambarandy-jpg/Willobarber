import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

const GOLD = '#C9A84C';

type Props = {
  onRetry: () => void;
  testID?: string;
};

// Échec de chargement des réservations : affiché à la place des données au lieu
// de montrer silencieusement des RDV fictifs. Pendant le rechargement, l'écran
// remplace le bandeau par son loader de section.
export function HistoryErrorBanner({ onRetry, testID = 'history-error-banner' }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.banner} testID={testID}>
      <Text style={styles.title}>⚠️ {t('reservations.loadErrorTitle')}</Text>
      <Text style={styles.subtitle}>{t('reservations.loadErrorSubtitle')}</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={onRetry}
        activeOpacity={0.85}
        accessibilityRole="button"
        testID={`${testID}-retry`}
      >
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 },
  retryBtn: {
    alignSelf: 'flex-start',
    minWidth: 120,
    alignItems: 'center',
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  retryText: { color: '#1A1208', fontWeight: '700', fontSize: 14 },
});
