import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants';

export default function CatalogueScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>NOS PRESTATIONS</Text>
      <Text style={styles.title}>Services</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#C9A84C',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 32,
    color: '#FFFFFF',
  },
});
