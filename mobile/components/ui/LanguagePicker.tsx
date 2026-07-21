import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Fonts } from '@/constants';
import type { Language } from '@/i18n/translations';

const GOLD = '#C9A84C';

const LANGUAGES: { code: Language; short: string; labelKey: 'language.fr' | 'language.nl' | 'language.en' }[] = [
  { code: 'fr', short: 'FR', labelKey: 'language.fr' },
  { code: 'nl', short: 'NL', labelKey: 'language.nl' },
  { code: 'en', short: 'EN', labelKey: 'language.en' },
];

export function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const anchorRef = useRef<View>(null);

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  const openMenu = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPos({ top: y + height + 8, right: windowWidth - (x + width) });
      setVisible(true);
    });
  };

  const selectLanguage = (code: Language) => {
    setLanguage(code);
    setVisible(false);
  };

  return (
    <View ref={anchorRef} collapsable={false}>
      <TouchableOpacity style={styles.trigger} onPress={openMenu} hitSlop={8} activeOpacity={0.7}>
        <Text style={styles.triggerText}>{current.short} ▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
        <View style={[styles.menu, { top: menuPos.top, right: menuPos.right }]}>
          {LANGUAGES.map(lang => {
            const isActive = lang.code === language;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.item, isActive && styles.itemActive]}
                onPress={() => selectLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.itemShort, isActive && styles.itemShortActive]}>{lang.short}</Text>
                <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{t(lang.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  triggerText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(201,168,76,0.85)',
    letterSpacing: 0.3,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    position: 'absolute',
    minWidth: 190,
    backgroundColor: '#111111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9A84C',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  itemActive: {
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  itemShort: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    width: 22,
  },
  itemShortActive: {
    color: GOLD,
  },
  itemLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  itemLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
