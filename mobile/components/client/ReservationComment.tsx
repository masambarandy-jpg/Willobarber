import { useState } from 'react';
import axios from 'axios';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StarRating } from '@/components/ui/StarRating';
import { useLanguage } from '@/contexts/LanguageContext';
import { commentsApi } from '@/services/api';
import type { Review } from '@/types';

const GOLD = '#C9A84C';
const MAX_LENGTH = 500;
const DATE_LOCALES = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' } as const;

interface Props {
  reservationId: number;
  // Commentaire déjà laissé sur ce RDV (null = pas encore commenté).
  review: Review | null;
  // Création/édition → le commentaire à jour ; suppression → null.
  onChange: (reservationId: number, review: Review | null) => void;
}

// « Un mot pour votre barbier ? » sous le détail d'un RDV passé : commentaire
// (note facultative), modifiable/supprimable, et réponse éventuelle du barbier.
export default function ReservationComment({ reservationId, review, onChange }: Props) {
  const { t, language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(DATE_LOCALES[language], { day: 'numeric', month: 'short', year: 'numeric' });

  const run = async (action: () => Promise<Review | null>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(reservationId, await action());
      setEditing(false);
      setConfirmDelete(false);
    } catch (err) {
      const server = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setError(server || t('comment.error'));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const payload = { text: trimmed, rating: rating || null };
    run(() => (review ? commentsApi.update(reservationId, payload) : commentsApi.create(reservationId, payload)));
  };

  const startEdit = () => {
    setText(review?.comment ?? '');
    setRating(review?.rating ?? 0);
    setEditing(true);
  };

  if (review && !editing) {
    const edited = new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 60_000;
    return (
      <View style={styles.card} testID="reservation-comment">
        <Text style={styles.label}>{t('comment.label')}</Text>
        {!!review.rating && <StarRating rating={review.rating} size={16} />}
        <Text style={styles.commentText}>« {review.comment} »</Text>
        <Text style={styles.meta}>
          {t('comment.sentOn')} {formatDate(review.created_at)}{edited ? ` · ${t('comment.edited')}` : ''}
        </Text>

        {!!review.reply && (
          <View style={styles.reply} testID="reservation-comment-reply">
            <View style={styles.replyHeader}>
              <View style={styles.barberAvatar}>
                <Text style={styles.barberAvatarText}>{review.barber_name.charAt(0)}</Text>
              </View>
              <Text style={styles.replyAuthor}>{t('comment.replyFrom')} {review.barber_name}</Text>
            </View>
            <Text style={styles.replyText}>{review.reply}</Text>
          </View>
        )}

        {confirmDelete ? (
          <View style={styles.actions}>
            <Text style={styles.confirmText}>{t('comment.deleteConfirm')}</Text>
            <TouchableOpacity onPress={() => setConfirmDelete(false)} disabled={busy}>
              <Text style={styles.actionText}>{t('comment.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => run(async () => { await commentsApi.remove(reservationId); return null; })}
              disabled={busy}
              testID="btn-comment-delete-confirm"
            >
              {busy ? <ActivityIndicator color="#E57373" size="small" /> : <Text style={styles.deleteText}>{t('comment.delete')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity onPress={startEdit} testID="btn-comment-edit">
              <Text style={styles.actionText}>✏️ {t('comment.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmDelete(true)} testID="btn-comment-delete">
              <Text style={styles.actionText}>🗑️ {t('comment.delete')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.card} testID="reservation-comment-form">
      <Text style={styles.label}>{t('comment.label')}</Text>
      <Text style={styles.ratingHint}>{t('comment.ratingOptional')}</Text>
      <StarRating rating={rating} size={24} interactive onRate={(r) => setRating(r === rating ? 0 : r)} />
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={t('comment.placeholder')}
        placeholderTextColor="rgba(255,255,255,0.3)"
        maxLength={MAX_LENGTH}
        multiline
        testID="input-comment"
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.formButtons}>
        {editing && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} disabled={busy}>
            <Text style={styles.cancelBtnText}>{t('comment.cancel')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={submit}
          disabled={!text.trim() || busy}
          activeOpacity={0.85}
          testID="btn-comment-send"
        >
          {busy
            ? <ActivityIndicator color="#1A1208" size="small" />
            : <Text style={styles.sendBtnText}>{editing ? t('comment.save') : t('comment.send')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1A1814', borderRadius: 16, padding: 18, gap: 10 },
  label: { fontSize: 15, fontWeight: '600', color: '#fff' },
  ratingHint: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  input: {
    backgroundColor: '#2A2520',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    fontSize: 13.5,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: { flexDirection: 'row', gap: 10 },
  sendBtn: { flex: 1, backgroundColor: GOLD, borderRadius: 100, paddingVertical: 13, alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(201,168,76,0.3)' },
  sendBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 14.5 },
  cancelBtn: {
    flex: 1,
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14.5 },
  commentText: { fontSize: 14, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  meta: { fontSize: 11.5, color: 'rgba(255,255,255,0.35)' },
  reply: {
    marginTop: 4,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.07)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barberAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barberAvatarText: { color: GOLD, fontSize: 11, fontWeight: '700' },
  replyAuthor: { color: GOLD, fontSize: 12.5, fontWeight: '600' },
  replyText: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 2 },
  actionText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  confirmText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  deleteText: { color: '#E57373', fontSize: 13, fontWeight: '600' },
  error: { fontSize: 12.5, color: '#E57373' },
});
