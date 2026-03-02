import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const IMG_SIZE = (Dimensions.get('window').width - 4) / 3;

function PhotoThumb({ asset }) {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    MediaLibrary.getAssetInfoAsync(asset).then(info => {
      setUri(info.localUri || info.uri);
    });
  }, [asset.id]);

  if (!uri) return <View style={styles.img} />;
  return <Image source={{ uri }} style={styles.img} />;
}

export default function MonthScreen() {
  const { key, label } = useLocalSearchParams();
  const router = useRouter();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthPhotos();
  }, []);

  async function loadMonthPhotos() {
    const [year, month] = (key as string).split('-').map(Number);
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();

    let all = [];
    let hasMore = true;
    let after = null;

    while (hasMore) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        createdAfter: start,
        createdBefore: end,
        first: 100,
        after,
      });
      all = [...all, ...result.assets];
      hasMore = result.hasNextPage;
      after = result.endCursor;
    }

    setPhotos(all);
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white' }}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.header}>{label} · {photos.length}张</Text>
      </View>
      <FlatList
        data={photos}
        keyExtractor={item => item.id}
        numColumns={3}
        renderItem={({ item }) => <PhotoThumb asset={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  back: { color: '#007AFF', fontSize: 16 },
  header: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  img: { width: IMG_SIZE, height: IMG_SIZE, margin: 1, backgroundColor: '#222' },
});