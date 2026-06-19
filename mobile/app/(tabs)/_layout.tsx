import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

const GOLD     = '#C9A84C';
const INACTIVE = '#9A9490';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarShowLabel: true,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24 }}>
              <Svg width="22" height="22" viewBox="0 0 24 24"
                   fill="none" stroke={color} strokeWidth="1"
                   strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <Polyline points="9 22 9 12 15 12 15 22"/>
              </Svg>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: 'Services',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24 }}>
              <Svg width="22" height="22" viewBox="0 0 24 24"
                   fill="none" stroke={color} strokeWidth="1"
                   strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="6" cy="6" r="3"/>
                <Circle cx="6" cy="18" r="3"/>
                <Line x1="20" y1="4" x2="8.12" y2="15.88"/>
                <Line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <Line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </Svg>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Réserver',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24 }}>
              <Svg width="22" height="22" viewBox="0 0 24 24"
                   fill="none" stroke={color} strokeWidth="1"
                   strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <Line x1="16" y1="2" x2="16" y2="6"/>
                <Line x1="8" y1="2" x2="8" y2="6"/>
                <Line x1="3" y1="10" x2="21" y2="10"/>
                <Line x1="12" y1="14" x2="12" y2="18"/>
                <Line x1="10" y1="16" x2="14" y2="16"/>
              </Svg>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Mon espace',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24 }}>
              <Svg width="22" height="22" viewBox="0 0 24 24"
                   fill="none" stroke={color} strokeWidth="1"
                   strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="3" width="7" height="7"/>
                <Rect x="14" y="3" width="7" height="7"/>
                <Rect x="14" y="14" width="7" height="7"/>
                <Rect x="3" y="14" width="7" height="7"/>
              </Svg>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24 }}>
              <Svg width="22" height="22" viewBox="0 0 24 24"
                   fill="none" stroke={color} strokeWidth="1"
                   strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <Circle cx="12" cy="7" r="4"/>
              </Svg>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#0D0C0A',
    borderTopWidth: 0,
    height: 90,
    paddingBottom: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  icon: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
