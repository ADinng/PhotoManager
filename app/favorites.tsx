import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const IMG_SIZE = (Dimensions.get('window').width - 8) / 3;

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem('favorites').then(val => {
      if (val) setFavorites(JSON.parse(val));
    });
  }, []);

  async function handleRemove(item) {
    Alert.alert('取消收藏', '要把这张照片从收藏中移除吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除', onPress: async () => {
          const updated = favorites.filter(f => f.id !== item.id);
          setFavorites(updated);
          await AsyncStorage.setItem('favorites', JSON.stringify(updated));
        }
      }
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.header}>⭐ 收藏 · {favorites.length}张</Text>
      </View>
      {favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>还没有收藏任何照片</Text>
          <Text style={styles.emptySubText}>浏览照片时上滑可以收藏</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={({ item }) => (
            <TouchableOpacity onLongPress={() => handleRemove(item)}>
              <Image source={{ uri: item.uri }} style={styles.img} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  back: { color: '#007AFF', fontSize: 16 },
  header: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  img: { width: IMG_SIZE, height: IMG_SIZE, margin: 1 },
  emptyText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#888', fontSize: 14 },
});