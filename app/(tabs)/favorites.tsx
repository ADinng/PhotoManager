import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { loadFavorites as loadFavoriteItems, saveFavorites } from '@/lib/library-state';
import { theme } from '@/lib/theme';

const IMG_SIZE = (Dimensions.get('window').width - 8) / 3;

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);

  const refreshFavorites = useCallback(async () => {
    setFavorites(await loadFavoriteItems());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshFavorites();
    }, [refreshFavorites])
  );

  useEffect(() => {
    void refreshFavorites();
  }, [refreshFavorites]);

  async function handleRemove(item) {
    Alert.alert('取消收藏', '要把这张照片从收藏中移除吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除', onPress: async () => {
          const updated = favorites.filter(f => f.id !== item.id);
          setFavorites(updated);
          if (selectedUri === item.uri) {
            setSelectedUri(null);
          }
          await saveFavorites(updated);
        }
      }
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.header}>收藏</Text>
          <Text style={styles.headerSub}>留下来、不想再删掉的照片都会在这里</Text>
        </View>
      </View>
      {favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>还没有收藏任何照片</Text>
          <Text style={styles.emptySubText}>浏览照片时上滑可以收藏</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.emptyBtnText}>去看看照片</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedUri(item.uri)} onLongPress={() => handleRemove(item)} >
              <Image source={{ uri: item.uri }} style={styles.img} />
            </TouchableOpacity>
          )}
        />
      )}

        {selectedUri && (
                <TouchableOpacity
                style={styles.fullscreenOverlay}
                onPress={() => setSelectedUri(null)}
                activeOpacity={1}
                >
                <Image
                    source={{ uri: selectedUri }}
                    style={styles.fullscreenImage}
                    resizeMode="contain"
                />
                <Text style={styles.fullscreenHint}>点击任意处关闭</Text>
                </TouchableOpacity>
            )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  headerBtn: { backgroundColor: theme.colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  back: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
  headerCopy: { flex: 1 },
  header: { color: theme.colors.text, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  grid: { paddingHorizontal: 8, paddingBottom: 24 },
  img: { width: IMG_SIZE, height: IMG_SIZE, margin: 3, borderRadius: 18, backgroundColor: theme.colors.surfaceMuted },
  emptyText: { color: theme.colors.text, fontSize: 22, fontWeight: 'bold' },
  emptySubText: { color: theme.colors.muted, fontSize: 14 },
  emptyBtn: { marginTop: 10, backgroundColor: theme.colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  emptyBtnText: { color: theme.colors.white, fontSize: 14, fontWeight: '700' },
  fullscreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  fullscreenImage: { width: '100%', height: '90%' },
  fullscreenHint: { color: '#555', fontSize: 13, marginTop: 12 },
});
