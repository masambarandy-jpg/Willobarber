import { useState } from 'react';
import axios from 'axios';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StarRating } from '@/components/ui/StarRating';
import { Fonts } from '@/constants';
import { reviewsApi } from '@/services/api';
import type { Review } from '@/types';

interface ReviewCardProps {
  reservationId: number;
  serviceName: string;
  existingReview: Review | null;
  onSubmitted: (review: Review) => void;
}

export default function ReviewCard({ reservationId, serviceName, existingReview, onSubmitted }: ReviewCardProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingReview) {
    return (
      <View style={styles.card}>
        <Text style={styles.thanksTitle}>Merci pour votre avis !</Text>
        <StarRating rating={existingReview.rating} size={20} />
        {!!existingReview.comment && (
          <Text style={styles.commentDisplay}>{existingReview.comment}</Text>
        )}
      </View>
    );
  }

  const handleSubmit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await reviewsApi.create({ reservation: reservationId, rating, comment: comment.trim() });
      onSubmitted(review);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.log('[REVIEW] Échec envoi avis — status:', err.response?.status, 'data:', JSON.stringify(err.response?.data), 'url:', err.config?.url);
      } else {
        console.log('[REVIEW] Échec envoi avis — erreur inattendue:', err);
      }
      const serverMessage = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setError(serverMessage || "Impossible d'envoyer votre avis pour le moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Laisser un avis</Text>
      <Text style={styles.subtitle}>Comment s'est passée votre visite « {serviceName} » ?</Text>

      <View style={styles.starsRow}>
        <StarRating rating={rating} size={30} interactive onRate={setRating} />
      </View>

      <TextInput
        style={styles.input}
        value={comment}
        onChangeText={setComment}
        placeholder="Votre commentaire (facultatif)"
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitBtn, rating < 1 && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={rating < 1 || submitting}
        activeOpacity={0.85}
      >
        {submitting
          ? <ActivityIndicator color="#1A1208" size="small" />
          : <Text style={styles.submitBtnText}>Envoyer</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 14,
  },
  starsRow: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#2A2520',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    fontSize: 13.5,
    color: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  error: {
    fontSize: 12.5,
    color: '#E57373',
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(201,168,76,0.3)',
  },
  submitBtnText: {
    color: '#1A1208',
    fontWeight: '700',
    fontSize: 14.5,
  },
  thanksTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  commentDisplay: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
  },
});
