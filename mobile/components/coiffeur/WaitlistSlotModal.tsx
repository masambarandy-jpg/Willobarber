import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { coiffeurWaitlistApi, type SlotWaitlistEntry } from '@/services/api';
import { CloseIcon } from './Icons';
import { CC, SERIF } from './theme';

const DATE_LOCALES = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' } as const;

export const waitlistSlotKey = (barber: string, time: string) => `${barber}|${time.slice(0, 5)}`;

/** Inscrits en liste d'attente du jour, regroupés par créneau (barbier|HH:MM).
 *  Une seule requête par jour affiché ; rechargée avec le planning (version). */
export function useDayWaitlist(isoDate: string | null, version: number) {
  const [bySlot, setBySlot] = useState<Record<string, SlotWaitlistEntry[]>>({});

  useEffect(() => {
    if (!isoDate) {
      setBySlot({});
      return;
    }
    let cancelled = false;
    coiffeurWaitlistApi.forDay(isoDate)
      .then(({ entries }) => {
        if (cancelled) return;
        const grouped: Record<string, SlotWaitlistEntry[]> = {};
        entries.forEach((e) => {
          (grouped[waitlistSlotKey(e.barber, e.time)] ??= []).push(e);
        });
        setBySlot(grouped);
      })
      .catch(() => { if (!cancelled) setBySlot({}); });
    return () => { cancelled = true; };
  }, [isoDate, version]);

  return bySlot;
}

export function WaitlistBadge({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity style={styles.badge} onPress={onPress} activeOpacity={0.8} testID="waitlist-badge">
      <Text style={styles.badgeText}>🔔 {t('coiffeur.waitlistBadge').replace('{count}', String(count))}</Text>
    </TouchableOpacity>
  );
}

type Props = { entries: SlotWaitlistEntry[] | null; onClose: () => void };

export function WaitlistSlotModal({ entries, onClose }: Props) {
  const { t, language } = useLanguage();
  const first = entries?.[0];
  const locale = DATE_LOCALES[language];

  return (
    <Modal visible={!!entries?.length} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel={t('common.close')}>
            <CloseIcon color={CC.black} size={18} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('coiffeur.waitlistModal.title')}</Text>
          {first && (
            <Text style={styles.subtitle}>
              {t('coiffeur.waitlistModal.subtitle').replace('{barber}', first.barber).replace('{time}', first.time)}
            </Text>
          )}
          {entries?.map((entry, index) => (
            <View key={entry.id} style={styles.row}>
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{entry.client_name}</Text>
                <Text style={styles.joined}>
                  {t('coiffeur.waitlistModal.joinedAt').replace(
                    '{date}',
                    new Date(entry.created_at).toLocaleString(locale, {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    }),
                  )}
                </Text>
              </View>
              {!!entry.notified_at && (
                <Text style={styles.notified}>{t('coiffeur.waitlistModal.notified')}</Text>
              )}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  badgeText: { fontSize: 10.5, fontWeight: '800', color: CC.black },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 420, backgroundColor: CC.cream, borderRadius: 20, padding: 22 },
  close: { position: 'absolute', top: 16, right: 16, padding: 4, zIndex: 1 },
  title: { fontFamily: SERIF, fontSize: 24, fontWeight: '600', color: CC.black },
  subtitle: { fontSize: 13, color: CC.grayText, marginTop: 4, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CC.inputBorder,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
    backgroundColor: CC.gold,
    color: CC.black,
    fontWeight: '800',
    fontSize: 13,
    overflow: 'hidden',
  },
  name: { fontSize: 15, fontWeight: '700', color: CC.black },
  joined: { fontSize: 12, color: CC.grayText, marginTop: 2 },
  notified: { fontSize: 11.5, fontWeight: '700', color: CC.successText },
});
