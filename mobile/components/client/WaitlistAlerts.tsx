import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { waitlistApi, type WaitlistEntry } from '@/services/api';

const GOLD = '#C9A84C';
const DATE_LOCALES = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' } as const;

type Props = { titleStyle?: StyleProp<TextStyle> };

// Section « Mes alertes » de Mon espace : créneaux suivis en liste d'attente
// (« 🔔 Me prévenir » à l'étape 3 du wizard). Rechargée à chaque retour sur
// l'onglet, puisqu'une alerte peut être posée ou satisfaite ailleurs.
export function WaitlistAlerts({ titleStyle }: Props) {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      waitlistApi.mine()
        .then((data) => { if (!cancelled) setEntries(data); })
        .catch(() => { if (!cancelled) setEntries((prev) => prev ?? []); });
      return () => { cancelled = true; };
    }, []),
  );

  const remove = async (entry: WaitlistEntry) => {
    setRemovingId(entry.id);
    setError(null);
    try {
      await waitlistApi.remove(entry.id);
      setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
    } catch {
      setError(t('waitlist.cancelError'));
    } finally {
      setRemovingId(null);
    }
  };

  const formatDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(DATE_LOCALES[language], {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  };

  return (
    <View testID="waitlist-alerts">
      <Text style={titleStyle}>{t('waitlist.myAlerts')}</Text>
      {entries === null ? (
        <ActivityIndicator color={GOLD} style={{ marginVertical: 20 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>{t('waitlist.myAlertsEmpty')}</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.card} testID={`waitlist-alert-${entry.id}`}>
            <Text style={styles.bell}>🔔</Text>
            <View style={styles.body}>
              <Text style={styles.title}>
                {entry.barber} · {formatDay(entry.date)} · {entry.time.slice(0, 5)}
              </Text>
              {!!entry.service_name && <Text style={styles.sub}>{entry.service_name}</Text>}
              {!!entry.notified_at && <Text style={styles.notified}>{t('waitlist.notified')}</Text>}
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => remove(entry)}
              disabled={removingId !== null}
              accessibilityRole="button"
              testID={`btn-cancel-alert-${entry.id}`}
            >
              {removingId === entry.id
                ? <ActivityIndicator color={GOLD} size="small" />
                : <Text style={styles.cancelText}>{t('waitlist.cancelAlert')}</Text>}
            </TouchableOpacity>
          </View>
        ))
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 10, marginBottom: 20, lineHeight: 19 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  bell: { fontSize: 18 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.55)' },
  notified: { fontSize: 12, fontWeight: '700', color: GOLD },
  cancelBtn: {
    minWidth: 76,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.5)',
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  cancelText: { fontSize: 12.5, fontWeight: '600', color: GOLD },
  error: { fontSize: 12.5, color: '#E57373', textAlign: 'center', marginBottom: 12 },
});
