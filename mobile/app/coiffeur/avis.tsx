import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { StarIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF, AvatarKey } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';
import { useCoiffeurProfile } from '@/contexts/CoiffeurProfileContext';

type Badge = 'Vérifié' | 'Sans réponse' | 'Nouveau client';

type Reply = { author: string; role: string; when: string; text: string };

type Review = {
  letter: AvatarKey;
  name: string;
  badge: Badge;
  when: string;
  service: string;
  barber: string;
  rating: number;
  text: string;
  reply: Reply | null;
};

const REVIEWS: Review[] = [
  {
    letter: 'T',
    name: 'Thomas Leroy',
    badge: 'Vérifié',
    when: 'il y a 2 jours',
    service: 'Signature',
    barber: 'Willo',
    rating: 5,
    text: 'Le meilleur barbier de Bruxelles. Willo prend le temps, écoute, et le résultat est toujours impeccable.',
    reply: {
      author: 'Willo D.',
      role: 'Gérant',
      when: 'répondu il y a 1 jour',
      text: 'Merci Thomas, toujours un plaisir de vous recevoir au salon !',
    },
  },
  {
    letter: 'K',
    name: 'Karim Benali',
    badge: 'Sans réponse',
    when: 'il y a 4 jours',
    service: 'Taille & rasage',
    barber: 'Malik',
    rating: 5,
    text: 'Un vrai moment de détente. La serviette chaude et le rasoir droit, c’est autre chose.',
    reply: null,
  },
  {
    letter: 'L',
    name: 'Léo Martin',
    badge: 'Nouveau client',
    when: 'il y a 6 jours',
    service: 'Le Rituel',
    barber: 'Willo',
    rating: 4,
    text: 'Première visite très réussie. Je reviendrai sans hésiter, juste un peu d’attente à l’arrivée.',
    reply: null,
  },
  {
    letter: 'N',
    name: 'Noé Vasseur',
    badge: 'Vérifié',
    when: 'il y a 1 sem.',
    service: 'Camouflage gris',
    barber: 'Idris',
    rating: 5,
    text: 'Coloration discrète et naturelle, exactement ce que je cherchais. Idris est un orfèvre.',
    reply: {
      author: 'Willo D.',
      role: 'Gérant',
      when: 'répondu il y a 3 jours',
      text: 'Ravi que la couleur vous plaise, à très vite !',
    },
  },
];

const DISTRIBUTION = [
  { stars: 5, count: 182 },
  { stars: 4, count: 41 },
  { stars: 3, count: 14 },
  { stars: 2, count: 7 },
  { stars: 1, count: 4 },
];
const MAX_COUNT = Math.max(...DISTRIBUTION.map((d) => d.count));

const TABS = ['Tous', '5★', '4★', '3★ et -', 'Sans réponse'] as const;

function badgeStyle(badge: Badge) {
  if (badge === 'Sans réponse') return { bg: CC.errorBg, text: CC.errorText };
  return { bg: CC.successBg, text: CC.successText };
}

export default function CoiffeurAvisScreen() {
  const isTablet = useIsTablet();
  const { profile } = useCoiffeurProfile();
  const avatarLetter = (profile.firstName ?? '').charAt(0).toUpperCase() || 'W';
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Tous');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [reviews, setReviews] = useState<Review[]>(REVIEWS);

  const filtered = reviews.filter((r) => {
    if (activeTab === 'Tous') return true;
    if (activeTab === '5★') return r.rating === 5;
    if (activeTab === '4★') return r.rating === 4;
    if (activeTab === '3★ et -') return r.rating <= 3;
    if (activeTab === 'Sans réponse') return !r.reply;
    return true;
  });

  const submitReply = (name: string) => {
    if (!draft.trim()) return;
    setReviews((prev) =>
      prev.map((r) =>
        r.name === name
          ? {
              ...r,
              badge: 'Vérifié',
              reply: {
                author: `${profile.firstName} ${(profile.lastName ?? '').charAt(0)}.`,
                role: profile.role,
                when: 'répondu à l’instant',
                text: draft.trim(),
              },
            }
          : r
      )
    );
    setDraft('');
    setReplyingTo(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setDraft('');
  };

  return (
    <CoiffeurScreen active="avis">
      <Text style={styles.title}>Avis clients</Text>

      <View style={isTablet && styles.tabletRow}>
      <View style={isTablet ? styles.summaryColTablet : undefined}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={styles.ratingBig}>4,8</Text>
            <View style={styles.starsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon key={i} filled />
              ))}
            </View>
            <Text style={styles.reviewCount}>248 avis</Text>
          </View>

          <View style={styles.summaryRight}>
            {DISTRIBUTION.map((d) => (
              <View key={d.stars} style={styles.distRow}>
                <Text style={styles.distLabel}>{d.stars}★</Text>
                <View style={styles.distTrack}>
                  <View style={[styles.distFill, { width: `${(d.count / MAX_COUNT) * 100}%` }]} />
                </View>
                <Text style={styles.distCount}>{d.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.summaryDivider} />
        <Text style={styles.newReviewsText}>
          <Text style={styles.newReviewsBold}>12 nouveaux</Text> ce mois
        </Text>
      </View>
      </View>

      <View style={isTablet ? styles.listColTablet : undefined}>
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filtered.map((r) => {
        const bs = badgeStyle(r.badge);
        const isReplying = replyingTo === r.name;
        return (
          <View key={r.name} style={styles.reviewCard}>
            <View style={styles.reviewTopRow}>
              <Avatar letter={r.letter} size={38} />
              <View style={styles.reviewIdentity}>
                <Text style={styles.reviewName}>{r.name}</Text>
                <Text style={styles.reviewMeta}>
                  {r.when} · {r.service} · {r.barber}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: bs.bg }]}>
                <Text style={[styles.badgeText, { color: bs.text }]}>{r.badge}</Text>
              </View>
            </View>

            <View style={styles.starsRow}>
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon key={i} filled={i < r.rating} />
              ))}
            </View>

            <Text style={styles.reviewText}>{r.text}</Text>

            {r.reply ? (
              <View style={styles.replyBlock}>
                <View style={styles.replyTopRow}>
                  <Avatar letter={avatarLetter} size={26} />
                  <Text style={styles.replyAuthor}>
                    {r.reply.author} · {r.reply.role} · {r.reply.when}
                  </Text>
                </View>
                <Text style={styles.replyText}>{r.reply.text}</Text>
              </View>
            ) : isReplying ? (
              <View style={styles.replyForm}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Votre réponse..."
                  placeholderTextColor={CC.textSecondary}
                  style={styles.replyInput}
                  multiline
                />
                <View style={styles.replyActionsRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelReply}>
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
                    onPress={() => submitReply(r.name)}
                  >
                    <Text style={[styles.sendBtnText, !draft.trim() && styles.sendBtnTextDisabled]}>Envoyer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyingTo(r.name)}>
                <Text style={styles.replyBtnText}>← Répondre</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      </View>
      </View>
    </CoiffeurScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
    marginBottom: 18,
  },
  tabletRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  summaryColTablet: {
    width: '34%',
  },
  listColTablet: {
    flex: 1,
    minWidth: 0,
  },
  summaryCard: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 20,
  },
  summaryLeft: {
    alignItems: 'flex-start',
  },
  ratingBig: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 52,
    color: CC.black,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    marginBottom: 8,
  },
  reviewCount: {
    fontSize: 11,
    color: CC.textSecondary,
  },
  summaryRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distLabel: {
    fontSize: 11,
    color: CC.textSecondary,
    width: 20,
  },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.trackBg,
  },
  distFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.gold,
  },
  distCount: {
    fontSize: 11,
    color: CC.textSecondary,
    width: 26,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: CC.border,
    marginVertical: 14,
  },
  newReviewsText: {
    fontSize: 13,
    color: CC.textSecondary,
  },
  newReviewsBold: {
    fontWeight: '700',
    color: CC.goldDark,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: CC.black,
    borderColor: CC.black,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.textSecondary,
  },
  tabTextActive: {
    color: CC.white,
  },
  reviewCard: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewIdentity: {
    flex: 1,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  reviewMeta: {
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: 1,
  },
  badge: {
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  reviewText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: CC.black,
    marginTop: 8,
    marginBottom: 12,
  },
  replyBlock: {
    backgroundColor: CC.cream,
    borderRadius: 12,
    padding: 12,
  },
  replyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: CC.black,
  },
  replyText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: CC.black,
  },
  replyBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  replyBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.black,
  },
  replyForm: {
    gap: 8,
  },
  replyInput: {
    backgroundColor: CC.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    padding: 10,
    fontSize: 13,
    color: CC.black,
    minHeight: 44,
  },
  replyActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.black,
  },
  sendBtn: {
    flex: 1,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: CC.barTrackBg,
  },
  sendBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: CC.black,
  },
  sendBtnTextDisabled: {
    color: '#a89f93',
  },
});
