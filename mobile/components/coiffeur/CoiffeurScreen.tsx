import { forwardRef, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import CoiffeurTopBar from './CoiffeurTopBar';
import CoiffeurDrawer, { CoiffeurRoute } from './CoiffeurDrawer';
import { CC } from './theme';

type Props = {
  active: CoiffeurRoute;
  children: React.ReactNode;
};

const CoiffeurScreen = forwardRef<ScrollView, Props>(function CoiffeurScreen({ active, children }, ref) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View style={styles.root}>
      <CoiffeurTopBar onMenuPress={() => setDrawerOpen(true)} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={ref}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      <CoiffeurDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} active={active} />
    </View>
  );
});

export default CoiffeurScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CC.cream,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
});
