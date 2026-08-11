import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';

const GOLD = '#C9A84C';
const LABEL_KEYS = ['bookingStepper.service', 'bookingStepper.barber', 'bookingStepper.dateTime', 'bookingStepper.payment'] as const;

interface Props {
  currentStep: number;
}

export function BookingStepper({ currentStep }: Props) {
  const { t } = useLanguage();
  const LABELS = LABEL_KEYS.map(t);
  return (
    <View style={styles.container}>
      {LABELS.map((label, i) => {
        const n      = i + 1;
        const isActive = n === currentStep;
        const isDone   = n < currentStep;

        return (
          <React.Fragment key={n}>
            <View style={styles.stepItem}>
              <View style={[
                styles.circle,
                isActive && styles.circleActive,
                isDone   && styles.circleDone,
              ]}>
                <Text style={[
                  styles.circleNum,
                  isActive && styles.circleNumActive,
                  isDone   && styles.circleNumDone,
                ]}>
                  {isDone ? '✓' : n}
                </Text>
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {label}
              </Text>
            </View>

            {n < 4 && (
              <View style={[styles.line, isDone && styles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0D0C0A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },

  stepItem: {
    alignItems: 'center',
    gap: 6,
    width: 62,
  },

  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'transparent',
  },
  circleActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  circleDone: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },

  circleNum: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  circleNumActive: {
    color: '#1a1208',
    fontWeight: '700',
  },
  circleNumDone: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  label: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  labelActive: {
    color: GOLD,
    fontWeight: '600',
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 13,
  },
  lineDone: {
    backgroundColor: GOLD,
  },
});
