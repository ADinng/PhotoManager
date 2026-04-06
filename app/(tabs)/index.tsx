import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Circle, Svg } from 'react-native-svg';

import { getReviewedCountsForGroups } from '@/lib/review-progress';
import { theme } from '@/lib/theme';

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
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.surfaceMuted} strokeWidth={5} fill="none" />
        {/* 进度圆环 */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={percent === 1 ? theme.colors.secondary : theme.colors.accent}
          strokeWidth={5} fill="none"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* 中间文字 */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: percent === 1 ? theme.colors.secondary : theme.colors.accent }}>
          {Math.round(percent * 100)}%
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [grouped, setGrouped] = useState<Record<string, MediaLibrary.Asset[]>>({});
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [reviewedData, setReviewedData] = useState<Record<string, number>>({});
  const loadedRef = useRef(false);

  const correctReviewedData = useCallback(async (groups: Record<string, MediaLibrary.Asset[]>) => {
    try {
      const corrected = await getReviewedCountsForGroups(groups);
      setReviewedData(corrected);
    } catch {}
  }, []);

  const fetchAllGrouped = useCallback(async () => {
    let allAssets: MediaLibrary.Asset[] = [];
    let hasMore = true;
    let after: string | null = null;
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

    const groups: Record<string, MediaLibrary.Asset[]> = {};
    for (const asset of allAssets) {
      const date = new Date(asset.creationTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    }
    return groups;
  }, []);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    loadedRef.current = true;
    const cleaned = await AsyncStorage.getItem('dataCleared_v1');
    if (!cleaned) {
      await AsyncStorage.removeItem('reviewedData');
      await AsyncStorage.setItem('dataCleared_v1', 'true');
    }

    const groups = await fetchAllGrouped();
    setGrouped(groups);
    await correctReviewedData(groups);
    setLoading(false);
  }, [correctReviewedData, fetchAllGrouped]);

  const refreshCounts = useCallback(async () => {
    const groups = await fetchAllGrouped();
    setGrouped(groups);
    await correctReviewedData(groups);
  }, [correctReviewedData, fetchAllGrouped]);

  useEffect(() => {
    if (permission?.granted && !loadedRef.current) {
      void loadPhotos();
    }
  }, [loadPhotos, permission?.granted]);

  useFocusEffect(
    useCallback(() => {
      if (permission?.granted && loadedRef.current) {
        void refreshCounts();
      }
    }, [permission?.granted, refreshCounts])
  );

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
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>正在读取图片...</Text>
      </View>
    );
  }

  const totalReviewed = Object.values(reviewedData).reduce((a: number, b: number) => a + b, 0);
  const totalAssets = Object.values(grouped).reduce((a: number, b) => a + b.length, 0);

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
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.memoryBtn}
            onPress={() => router.push({ pathname: '/on-this-day', params: { years: years.join(',') } })}
          >
            <Text style={styles.memoryBtnText}>🕰 当年今日</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.randomBtn}
            onPress={() => router.push('/random')}
          >
            <Text style={styles.randomBtnText}>🎲 随机发现</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.favBtn}
            onPress={() => router.push('/favorites')}
          >
            <Text style={styles.favBtnText}>⭐ 收藏</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.totalProgress}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>总进度</Text>
            <Text style={styles.totalCount}>
              {totalReviewed} / {totalAssets} 张
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: `${Math.min(totalAssets === 0 ? 0 : totalReviewed / totalAssets * 100, 100)}%`
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
                  onPress={() => router.push({ pathname: '/month', params: { key: item.key, label: `${year}/${item.label}` } })}
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
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  header: { fontSize: 32, fontWeight: 'bold', color: theme.colors.text, paddingBottom: 8 },
  yearBlock: { marginHorizontal: 16, marginBottom: 24 },
  yearLabel: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCard: {
    width: '31%', backgroundColor: theme.colors.surface,
    borderRadius: 20, padding: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  monthCardDone: { backgroundColor: theme.colors.secondarySoft, borderColor: '#C4D6CD' },
  monthNum: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 6 },
  monthNumDone: { color: theme.colors.secondary },
  monthCount: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  monthCountDone: { color: theme.colors.secondary },
  title: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text },
  button: { backgroundColor: theme.colors.accent, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingText: { marginTop: 12, color: theme.colors.muted, fontSize: 16 },

  topBar: { paddingHorizontal: 20, paddingBottom: 18 },
  totalProgress: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  totalCount: { fontSize: 13, color: theme.colors.muted },
  progressBarBg: { height: 10, backgroundColor: theme.colors.surfaceMuted, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: 10, backgroundColor: theme.colors.accent, borderRadius: 999 },

  favBtn: { backgroundColor: theme.colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  favBtnText: { color: theme.colors.gold, fontWeight: 'bold' },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  memoryBtn: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  memoryBtnText: { color: theme.colors.accentDeep, fontWeight: 'bold' },
  randomBtn: { backgroundColor: theme.colors.secondarySoft, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  randomBtnText: { color: theme.colors.secondary, fontWeight: 'bold' },
});
