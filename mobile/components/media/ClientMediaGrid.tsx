import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ClientMedia } from '@/services/api';

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      // moduleSuffixes ("web" before "") makes tsc resolve expo-video's internal
      // `useVideoPlayer` re-export through VideoPlayer.web.d.ts, so the inferred
      // player type mismatches VideoView's expected prop type — runtime is fine.
      player={player as any}
      style={styles.videoTile}
      nativeControls
      contentFit="cover"
    />
  );
}

interface ClientMediaGridProps {
  media: ClientMedia[];
  isLoading?: boolean;
  emptyLabel: string;
  mutedColor: string;
}

export default function ClientMediaGrid({ media, isLoading, emptyLabel, mutedColor }: ClientMediaGridProps) {
  if (isLoading && media.length === 0) {
    return <ActivityIndicator color="#C9A84C" style={{ marginVertical: 24 }} />;
  }

  if (media.length === 0) {
    return <Text style={{ color: mutedColor, fontSize: 13.5, textAlign: 'center', marginVertical: 20 }}>{emptyLabel}</Text>;
  }

  const photos = media.filter((m) => m.media_type === 'photo');
  const videos = media.filter((m) => m.media_type === 'video');

  return (
    <View style={{ gap: 16 }}>
      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((item) => (
            <Image key={item.id} source={{ uri: item.cloudinary_url }} style={styles.photoTile} />
          ))}
        </View>
      )}
      {videos.map((item) => (
        <VideoThumb key={item.id} uri={item.cloudinary_url} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '2%',
  },
  photoTile: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#0002',
  },
  videoTile: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: '#000',
  },
});
