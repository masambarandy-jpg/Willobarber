import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, StyleProp, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface AddMediaButtonProps {
  label: string;
  busy?: boolean;
  onPick: (file: { uri: string; name: string; type: string }) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function AddMediaButton({ label, busy, onPick, style, textStyle }: AddMediaButtonProps) {
  const handlePress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const name = asset.fileName || `media-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
    const type = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

    await onPick({ uri: asset.uri, name, type });
  };

  return (
    <TouchableOpacity style={style} onPress={handlePress} disabled={busy} activeOpacity={0.85}>
      {busy ? <ActivityIndicator size="small" color="#1a1208" /> : <Text style={textStyle}>{label}</Text>}
    </TouchableOpacity>
  );
}
