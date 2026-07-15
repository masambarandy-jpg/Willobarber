import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import CoiffeurTopBar from './CoiffeurTopBar';
import CoiffeurDrawer, { CoiffeurRoute } from './CoiffeurDrawer';
import { CC } from './theme';

type Props = {
  active: CoiffeurRoute;
  children: React.ReactNode;
};

export default function CoiffeurScreen({ active, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View style={styles.root}>
      <CoiffeurTopBar onMenuPress={() => setDrawerOpen(true)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <CoiffeurDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} active={active} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CC.cream,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
});
