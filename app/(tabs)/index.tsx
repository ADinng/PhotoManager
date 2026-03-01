import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    if (permission?.granted) {
      loadPhotos();
    }
  }, [permission]);

  async function loadPhotos() {
    setLoading(true);
    let allAssets = [];
    let hasMore = true;
    let after = null;

    while (hasMore) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        first: 100,
        after: after,
      });
      allAssets = [...allAssets, ...result.assets];
      hasMore = result.hasNextPage;
      after = result.endCursor;
    }

    // 按年月分组
    const groups = {};
    for (const asset of allAssets) {
      const date = new Date(asset.creationTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    }

    setGrouped(groups);
    setLoading(false);
  }

  // 没有权限
  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>📷 需要访问你的相册</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>授权访问</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 加载中
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>正在读取图片...</Text>
      </View>
    );
  }

  // 按时间排序的月份列表
  const monthList = Object.keys(grouped)
    .sort((a, b) => b.localeCompare(a))
    .map(key => {
      const [year, month] = key.split('-');
      return {
        key,
        count: grouped[key].length,
        label: `${year}年${parseInt(month)}月`,
      };
    });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>我的照片</Text>
      <FlatList
        data={monthList}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row}>
            <Text style={styles.monthLabel}>{item.label}</Text>
            <Text style={styles.count}>{item.count} 张</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  header: { fontSize: 28, fontWeight: 'bold', padding: 20 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', marginHorizontal: 16, marginVertical: 4,
    padding: 16, borderRadius: 12,
  },
  monthLabel: { fontSize: 18, fontWeight: '600' },
  count: { fontSize: 14, color: '#888', backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  title: { fontSize: 22, fontWeight: 'bold' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 16 },
});