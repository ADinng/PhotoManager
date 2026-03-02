import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [reviewedMonths, setReviewedMonths] = useState<string[]>([]); // 已整理过的月份
  const loadedRef = useRef(false);

  useEffect(() => {
    if (permission?.granted && !loadedRef.current) {
      loadPhotos();
    }
  }, [permission]);

  useFocusEffect(
    useCallback(() => {
      if (permission?.granted && loadedRef.current) {
        refreshCounts();
      }
      loadReviewedMonths();
    }, [permission])
  );

  async function loadReviewedMonths() {
    try {
      const val = await AsyncStorage.getItem('reviewedMonths');
      if (val) setReviewedMonths(JSON.parse(val));
    } catch {}
  }

  async function loadPhotos() {
    setLoading(true);
    loadedRef.current = true;
    const groups = await fetchAllGrouped();
    setGrouped(groups);
    setLoading(false);
  }

  async function refreshCounts() {
    const groups = await fetchAllGrouped();
    setGrouped(groups);
  }

  async function fetchAllGrouped() {
    let allAssets = [];
    let hasMore = true;
    let after = null;
    while (hasMore) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        first: 500,
        after,
      });
      allAssets = [...allAssets, ...result.assets];
      hasMore = result.hasNextPage;
      after = result.endCursor;
    }
    const groups = {};
    for (const asset of allAssets) {
      const date = new Date(asset.creationTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    }
    return groups;
  }

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>正在读取图片...</Text>
      </View>
    );
  }

  // 按年分组
  const byYear: Record<string, { key: string; month: number; count: number; label: string }[]> = {};
  Object.keys(grouped)
    .sort((a, b) => b.localeCompare(a))
    .forEach(key => {
      const [year, month] = key.split('-');
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push({
        key,
        month: parseInt(month),
        count: grouped[key].length,
        label: `${parseInt(month)}月`,
      });
    });

  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>我的照片</Text>
      {years.map(year => (
        <View key={year} style={styles.yearBlock}>
          <Text style={styles.yearLabel}>{year} 年</Text>
          <View style={styles.monthGrid}>
            {byYear[year].map(item => {
              const reviewed = reviewedMonths.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.monthCard, reviewed && styles.monthCardReviewed]}
                  onPress={() => router.push({ pathname: '/month', params: { key: item.key, label: `${year}年${item.label}` } })}
                >
                  <Text style={[styles.monthNum, reviewed && styles.monthNumReviewed]}>{item.label}</Text>
                  <Text style={[styles.monthCount, reviewed && styles.monthCountReviewed]}>{item.count} 张</Text>
                  {reviewed && <Text style={styles.reviewedBadge}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  header: { fontSize: 28, fontWeight: 'bold', paddingHorizontal: 20, paddingBottom: 8 },
  yearBlock: { marginHorizontal: 16, marginBottom: 24 },
  yearLabel: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCard: {
    width: '30%', backgroundColor: 'white',
    borderRadius: 14, padding: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  monthCardReviewed: { backgroundColor: '#e8f5e9' },
  monthNum: { fontSize: 18, fontWeight: '700', color: '#222' },
  monthNumReviewed: { color: '#2e7d32' },
  monthCount: { fontSize: 12, color: '#888', marginTop: 4 },
  monthCountReviewed: { color: '#66bb6a' },
  reviewedBadge: { position: 'absolute', top: 6, right: 8, fontSize: 11, color: '#2e7d32' },
  title: { fontSize: 22, fontWeight: 'bold' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 16 },
});