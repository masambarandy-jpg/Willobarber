import { useRef } from 'react';
import { ActivityIndicator, StyleProp, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface AddMediaButtonProps {
  label: string;
  busy?: boolean;
  onPick: (file: File) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function AddMediaButton({ label, busy, onPick, style, textStyle }: AddMediaButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await onPick(file);
  };

  return (
    <>
      <TouchableOpacity style={style} onPress={() => inputRef.current?.click()} disabled={busy} activeOpacity={0.85}>
        {busy ? <ActivityIndicator size="small" color="#1a1208" /> : <Text style={textStyle}>{label}</Text>}
      </TouchableOpacity>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </>
  );
}
