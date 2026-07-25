import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import type { ClientMedia } from '@/services/api';

function formatMediaDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';
  return format(date, 'd MMMM yyyy', { locale: fr });
}

async function downloadMedia(item: ClientMedia, showToast: (message: string) => void) {
  const label = item.media_type === 'video' ? 'Vidéo' : 'Photo';

  if (Platform.OS === 'web') {
    window.open(item.cloudinary_url, '_blank');
    showToast(`${label} sauvegardée !`);
    return;
  }

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      showToast("Accès à la galerie refusé.");
      return;
    }
    // File.downloadFileAsync is attached at runtime (expo-file-system/src/FileSystem.ts)
    // but missing from this SDK version's exported type declarations.
    const downloaded = await (File as any).downloadFileAsync(item.cloudinary_url, Paths.cache);
    await MediaLibrary.saveToLibraryAsync(downloaded.uri);
    showToast(`${label} sauvegardée !`);
  } catch (e) {
    console.log('[MEDIA] download error', e);
    showToast('Erreur lors du téléchargement.');
  }
}

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
  // Fournis uniquement côté fiche client coiffeur (clients.tsx) — absent
  // côté "Mes coupes" client, où le bouton de partage n'a pas de sens.
  onShare?: (item: ClientMedia) => void;
  sharingId?: number | null;
}

export default function ClientMediaGrid({ media, isLoading, emptyLabel, mutedColor, onShare, sharingId }: ClientMediaGridProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2500);
  };

  if (isLoading && media.length === 0) {
    return <ActivityIndicator color="#C9A84C" style={{ marginVertical: 24 }} />;
  }

  if (media.length === 0) {
    return <Text style={{ color: mutedColor, fontSize: 13.5, textAlign: 'center', marginVertical: 20 }}>{emptyLabel}</Text>;
  }

  const photos = media.filter((m) => m.media_type === 'photo');
  const videos = media.filter((m) => m.media_type === 'video');

  return (
    <View style={{ gap: 16, position: 'relative' }}>
      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((item) => (
            <View key={item.id} style={styles.photoCell}>
              <Image source={{ uri: item.cloudinary_url }} style={styles.photoTile} resizeMode="cover" />
              <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>
                {formatMediaDate(item.created_at)}
              </Text>

              <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadMedia(item, showToast)}>
                <Text style={styles.downloadBtnText}>⬇️ Télécharger</Text>
              </TouchableOpacity>

              {onShare && (
                <TouchableOpacity
                  style={[styles.shareBtn, item.shared_with_client && styles.shareBtnSent]}
                  disabled={item.shared_with_client || sharingId === item.id}
                  onPress={() => onShare(item)}
                >
                  <Text style={[styles.shareBtnText, item.shared_with_client && styles.shareBtnTextSent]}>
                    {item.shared_with_client
                      ? '✅ Envoyé'
                      : sharingId === item.id
                        ? 'Envoi…'
                        : '📤 Envoyer au client'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {videos.map((item) => (
        <View key={item.id} style={{ gap: 4 }}>
          <VideoThumb uri={item.cloudinary_url} />
          <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadMedia(item, showToast)}>
            <Text style={styles.downloadBtnText}>⬇️ Télécharger</Text>
          </TouchableOpacity>
        </View>
      ))}

      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '2%',
  },
  photoCell: {
    width: '32%',
    marginBottom: 8,
  },
  photoTile: {
    width: '100%',
    aspectRatio: 1,
    minHeight: Platform.OS === 'web' ? 200 : undefined,
    borderRadius: 10,
    backgroundColor: '#0002',
  },
  videoTile: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  downloadBtn: {
    backgroundColor: '#ECE9E3',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    alignItems: 'center',
  },
  downloadBtnText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4A4640',
  },
  shareBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    alignItems: 'center',
  },
  shareBtnSent: {
    backgroundColor: '#D4EDDA',
  },
  shareBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareBtnTextSent: {
    color: '#1E7045',
  },
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -8,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: '#161512',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: '90%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
});
