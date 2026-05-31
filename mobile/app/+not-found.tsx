import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.title}>Page introuvable</Text>
        <Text style={styles.subtitle}>La page que vous cherchez n'existe pas.</Text>
        <Button label="Retour à l'accueil" onPress={() => router.replace('/')} fullWidth={false} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  icon: { fontSize: 56 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
});
