import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes, loadStorageStats, type StorageStats } from '@/lib/stats';
import { theme } from '@/lib/theme';

type OverviewStats = StorageStats & {
  favoritesCount: number;
  pendingDeleteCount: number;
};

export default function StatsScreen() {
  const [stats, setStats] = useState<OverviewStats>({
    deletedCount: 0,
    savedBytes: 0,
    favoritesCount: 0,
    pendingDeleteCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);

    const [storageStats, favoritesRaw, pendingDeleteRaw] = await Promise.all([
      loadStorageStats(),
      AsyncStorage.getItem('favorites'),
      AsyncStorage.getItem('pendingDelete'),
    ]);

    const favorites = favoritesRaw ? JSON.parse(favoritesRaw) : [];
    const pendingDelete = pendingDeleteRaw ? JSON.parse(pendingDeleteRaw) : [];

    setStats({
      ...storageStats,
      favoritesCount: favorites.length,
      pendingDeleteCount: pendingDelete.length,
    });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>正在统计照片整理结果...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>统计</Text>
      <Text style={styles.subtitle}>看看这次照片整理已经帮你省下了多少负担。</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>累计释放空间</Text>
        <Text style={styles.heroValue}>{formatBytes(stats.savedBytes)}</Text>
        <Text style={styles.heroSub}>已永久删除 {stats.deletedCount} 张照片</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>已删除照片</Text>
          <Text style={styles.statValue}>{stats.deletedCount}</Text>
          <Text style={styles.statSub}>累计确认删除</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>待删除</Text>
          <Text style={styles.statValue}>{stats.pendingDeleteCount}</Text>
          <Text style={styles.statSub}>还在垃圾桶里</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>已收藏</Text>
          <Text style={styles.statValue}>{stats.favoritesCount}</Text>
          <Text style={styles.statSub}>保留下来的照片</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>平均单张体积</Text>
          <Text style={styles.statValue}>
            {stats.deletedCount === 0 ? '0 B' : formatBytes(Math.round(stats.savedBytes / stats.deletedCount))}
          </Text>
          <Text style={styles.statSub}>按已删除照片估算</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: theme.colors.background },
  loadingText: { color: theme.colors.muted, fontSize: 15 },
  title: { fontSize: 32, fontWeight: 'bold', color: theme.colors.text },
  subtitle: { color: theme.colors.muted, fontSize: 15, marginTop: 6, marginBottom: 18, lineHeight: 22 },
  heroCard: {
    backgroundColor: theme.colors.darkSurface,
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
  },
  heroLabel: { color: '#F7C6B2', fontSize: 15, fontWeight: '700' },
  heroValue: { color: theme.colors.darkText, fontSize: 40, fontWeight: 'bold', marginTop: 10 },
  heroSub: { color: theme.colors.darkMuted, fontSize: 15, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  statLabel: { color: theme.colors.muted, fontSize: 14, fontWeight: '600' },
  statValue: { color: theme.colors.text, fontSize: 28, fontWeight: 'bold', marginTop: 12 },
  statSub: { color: theme.colors.muted, fontSize: 13, marginTop: 8, lineHeight: 18 },
});
