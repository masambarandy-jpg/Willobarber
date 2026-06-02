import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

// Icon paths for each tab — using SVG path strings rendered as Text approximations
// since no vector-icons package is installed
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  home:         { active: '⌂', inactive: '⌂' },
  book:         { active: '✂', inactive: '✂' },
  reservations: { active: '☰', inactive: '☰' },
  profile:      { active: '◯', inactive: '◯' },
};

// Emoji alternatives that look better in practice
const TAB_EMOJI: Record<string, string> = {
  home: '🏠',
  book: '✂️',
  reservations: '📋',
  profile: '👤',
};

const GOLD = '#C9A84C';
const INACTIVE = 'rgba(255,255,255,0.38)';

function TabIcon({ id, label, focused }: { id: string; label: string; focused: boolean }) {
  return (
    <View style={tabStyles.item}>
      <Text style={[tabStyles.emoji, { opacity: focused ? 1 : 0.45 }]}>{TAB_EMOJI[id]}</Text>
      <Text style={[tabStyles.label, focused ? tabStyles.labelActive : tabStyles.labelInactive]}>
        {label}
      </Text>
      {focused && <View style={tabStyles.activeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: INACTIVE,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon id="home" label="Accueil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon id="book" label="Réserver" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon id="reservations" label="Mon espace" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon id="profile" label="Profil" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#0a0907',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    height: Platform.OS === 'ios' ? 82 : 70,
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    paddingTop: 6,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 2,
  },
  emoji: {
    fontSize: 21,
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  labelActive: {
    color: GOLD,
    fontWeight: '600',
  },
  labelInactive: {
    color: INACTIVE,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginTop: 1,
  },
});
