import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { ChatIcon, EditIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF, AvatarKey } from '@/components/coiffeur/theme';

type SlotState = 'ferme' | 'reserve' | 'dispo';
type Status = 'Actif' | 'Absent';

type Member = {
  letter: AvatarKey;
  name: string;
  role: string;
  status: Status;
  tags: string[];
  stats: { value: string; label: string }[];
  am: SlotState[];
  pm: SlotState[];
};

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MEMBERS: Member[] = [
  {
    letter: 'W',
    name: 'Willo Diallo',
    role: 'Gérant · Barbier',
    status: 'Actif',
    tags: ['Fade', 'Texturé', 'Rasoir'],
    stats: [
      { value: '148', label: 'RDV/mois' },
      { value: '4,9', label: 'Note' },
      { value: '30 ans', label: 'Expérience' },
    ],
    am: ['ferme', 'reserve', 'reserve', 'dispo', 'reserve', 'reserve', 'dispo'],
    pm: ['ferme', 'dispo', 'ferme', 'reserve', 'dispo', 'ferme', 'reserve'],
  },
  {
    letter: 'M',
    name: 'Malik Haddad',
    role: 'Barbier',
    status: 'Actif',
    tags: ['Barbe', 'Rasage', 'Classique'],
    stats: [
      { value: '96', label: 'RDV/mois' },
      { value: '4,9', label: 'Note' },
      { value: '12 ans', label: 'Expérience' },
    ],
    am: ['ferme', 'dispo', 'reserve', 'reserve', 'dispo', 'reserve', 'reserve'],
    pm: ['ferme', 'reserve', 'dispo', 'ferme', 'reserve', 'dispo', 'ferme'],
  },
  {
    letter: 'I',
    name: 'Idris Camara',
    role: 'Barbier',
    status: 'Absent',
    tags: ['Color', 'Crop', 'Soin'],
    stats: [
      { value: '64', label: 'RDV/mois' },
      { value: '4,8', label: 'Note' },
      { value: '8 ans', label: 'Expérience' },
    ],
    am: ['ferme', 'reserve', 'dispo', 'reserve', 'reserve', 'dispo', 'ferme'],
    pm: ['dispo', 'ferme', 'reserve', 'dispo', 'ferme', 'reserve', 'dispo'],
  },
];

function slotColor(state: SlotState) {
  if (state === 'reserve') return { backgroundColor: CC.gold, borderWidth: 0 };
  if (state === 'ferme') return { backgroundColor: '#e5ddd0', borderWidth: 0 };
  return { backgroundColor: CC.white, borderWidth: 1, borderColor: CC.inputBorder };
}

export default function CoiffeurEquipeScreen() {
  return (
    <CoiffeurScreen active="equipe">
      <Text style={styles.title}>Équipe</Text>

      {MEMBERS.map((m) => (
        <View key={m.name} style={styles.card}>
          <View style={styles.topRow}>
            <Avatar letter={m.letter} size={56} />
            <View style={styles.identity}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.role}>{m.role}</Text>
            </View>
            <View style={[styles.statusBadge, m.status === 'Actif' ? styles.statusActif : styles.statusAbsent]}>
              <Text style={[styles.statusText, m.status === 'Actif' ? styles.statusActifText : styles.statusAbsentText]}>
                {m.status}
              </Text>
            </View>
          </View>

          <View style={styles.tagsRow}>
            {m.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            {m.stats.map((s) => (
              <View key={s.label} style={styles.statColumn}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.availLabel}>DISPONIBILITÉ — SEMAINE</Text>
          <View style={styles.availGrid}>
            {DAYS.map((day, i) => (
              <View key={i} style={styles.availCol}>
                <Text style={styles.availDayLabel}>{day}</Text>
                <View style={[styles.slot, slotColor(m.am[i])]} />
                <View style={[styles.slot, slotColor(m.pm[i])]} />
              </View>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.planningBtn} onPress={() => router.push('/coiffeur/planning')}>
              <Text style={styles.planningBtnText}>Planning</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn}>
              <ChatIcon size={16} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn}>
              <EditIcon size={15} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.legendCard}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: CC.white, borderWidth: 1, borderColor: CC.inputBorder }]} />
          <Text style={styles.legendText}>Disponible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: CC.gold }]} />
          <Text style={styles.legendText}>Réservé</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#e5ddd0' }]} />
          <Text style={styles.legendText}>Fermé</Text>
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
  card: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
  },
  role: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusActif: {
    backgroundColor: CC.successBg,
  },
  statusAbsent: {
    backgroundColor: CC.errorBg,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statusActifText: {
    color: CC.successText,
  },
  statusAbsentText: {
    color: CC.errorText,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: 'rgba(201,168,76,0.13)',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: CC.goldDark,
  },
  divider: {
    height: 1,
    backgroundColor: CC.border,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 20,
    color: CC.black,
  },
  statLabel: {
    fontSize: 10,
    color: CC.textSecondary,
    marginTop: 2,
  },
  availLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  availGrid: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 18,
  },
  availCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  availDayLabel: {
    fontSize: 10,
    color: CC.textSecondary,
    marginBottom: 2,
  },
  slot: {
    width: '100%',
    height: 16,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planningBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 11,
    alignItems: 'center',
  },
  planningBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: CC.black,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendCard: {
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12.5,
    color: CC.black,
  },
});
