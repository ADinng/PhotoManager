import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Circle, Svg } from 'react-native-svg';

// 圆环进度组件
function RingProgress({ total, reviewed, size = 56 }: { total: number; reviewed: number; size?: number }) {
  const percent = total === 0 ? 0 : reviewed / total;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = circumference * percent;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* 背景圆环 */}
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#e0e0e0" strokeWidth={5} fill="none" />
        {/* 进度圆环 */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={percent === 1 ? '#34c759' : '#007AFF'}
          strokeWidth={5} fill="none"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* 中间文字 */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: percent === 1 ? '#34c759' : '#007AFF' }}>
          {Math.round(percent * 100)}%
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [reviewedData, setReviewedData] = useState<Record<string, number>>({}); // key -> 已整理数量
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
      loadReviewedData();
    }, [permission])
  );

  // async function loadReviewedData() {
  //   try {
  //     const val = await AsyncStorage.getItem('reviewedData');
  //     if (val) setReviewedData(JSON.parse(val));
  //   } catch {}
  // }
  async function loadReviewedData() {
    try {
      const val = await AsyncStorage.getItem('reviewedData');
      const data = val ? JSON.parse(val) : {};
      
      // 修正超过实际数量的值
      const corrected = {};
      for (const key of Object.keys(data)) {
        const actual = grouped[key]?.length || 0;
        corrected[key] = actual > 0 ? Math.min(data[key], actual) : data[key];
      }
      setReviewedData(corrected);
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
  const byYear: Record<string, any[]> = {};
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
      {/* <Text style={styles.header}>我的照片</Text> */}
      <View style={styles.topBar}>
        <Text style={styles.header}>我的照片</Text>
        <View style={styles.totalProgress}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>总进度</Text>
            <Text style={styles.totalCount}>
              {Object.values(reviewedData).reduce((a: number, b: number) => a + b, 0)} / {Object.values(grouped).reduce((a: number, b: any) => a + b.length, 0)} 张
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: `${Math.min(
                Object.values(grouped).reduce((a: number, b: any) => a + b.length, 0) === 0 ? 0 :
                Object.values(reviewedData).reduce((a: number, b: number) => a + b, 0) /
                Object.values(grouped).reduce((a: number, b: any) => a + b.length, 0) * 100
              , 100)}%`
            }]} />
          </View>
        </View>
      </View>

      {years.map(year => (
        <View key={year} style={styles.yearBlock}>
          <Text style={styles.yearLabel}>{year} 年</Text>
          <View style={styles.monthGrid}>
            {byYear[year].map(item => {
              const reviewed = reviewedData[item.key] || 0;
              const total = item.count;
              const done = reviewed >= total;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.monthCard, done && styles.monthCardDone]}
                  onPress={() => router.push({ pathname: '/month', params: { key: item.key, label: `${year}年${item.label}` } })}
                >
                  <RingProgress total={total} reviewed={reviewed} size={56} />
                  <Text style={[styles.monthNum, done && styles.monthNumDone]}>{item.label}</Text>
                  <Text style={[styles.monthCount, done && styles.monthCountDone]}>{item.count} 张</Text>
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
    borderRadius: 16, padding: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  monthCardDone: { backgroundColor: '#e8f5e9' },
  monthNum: { fontSize: 15, fontWeight: '700', color: '#222', marginTop: 4 },
  monthNumDone: { color: '#2e7d32' },
  monthCount: { fontSize: 11, color: '#aaa', marginTop: 2 },
  monthCountDone: { color: '#66bb6a' },
  title: { fontSize: 22, fontWeight: 'bold' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 16 },

  topBar: { paddingHorizontal: 20, paddingBottom: 16 },
  totalProgress: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#222' },
  totalCount: { fontSize: 13, color: '#888' },
  progressBarBg: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#007AFF', borderRadius: 4 },
});