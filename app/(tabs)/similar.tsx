import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { loadPendingDelete, savePendingDelete, type AssetRef } from '@/lib/library-state';
import { theme } from '@/lib/theme';

type DuplicateGroup = {
  key: string;
  items: (MediaLibrary.Asset & { previewUri: string })[];
};

function normalizeFilename(filename?: string) {
  return (filename || '')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/\s*copy$/, '');
}

function getGroupKey(asset: MediaLibrary.Asset, fileSize: number) {
  return [
    normalizeFilename((asset as MediaLibrary.Asset & { filename?: string }).filename),
    asset.width,
    asset.height,
    fileSize,
  ].join(':');
}

export default function SimilarScreen() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDuplicateGroups = useCallback(async () => {
    setLoading(true);
    let allAssets: MediaLibrary.Asset[] = [];
    let hasMore = true;
    let after: string | null = null;

    while (hasMore) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        first: 300,
        after,
      });
      allAssets = [...allAssets, ...result.assets];
      hasMore = result.hasNextPage;
      after = result.endCursor;
    }

    const grouped = new Map<string, DuplicateGroup['items']>();

    for (const asset of allAssets) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const key = getGroupKey(asset, typeof info.fileSize === 'number' ? info.fileSize : 0);
        const previewUri = info.localUri || info.uri;
        const existing = grouped.get(key) ?? [];
        existing.push({ ...asset, previewUri });
        grouped.set(key, existing);
      } catch {}
    }

    const nextGroups = Array.from(grouped.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        items: [...items].sort((a, b) => b.creationTime - a.creationTime),
      }))
      .sort((a, b) => b.items.length - a.items.length);

    setGroups(nextGroups);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDuplicateGroups();
    }, [loadDuplicateGroups])
  );

  async function keepNewest(group: DuplicateGroup) {
    const pendingDelete = await loadPendingDelete();
    const newest = group.items[0];
    const toDelete: AssetRef[] = group.items
      .filter(item => item.id !== newest.id)
      .map(item => ({ id: item.id, uri: item.previewUri }));
    const merged = [...pendingDelete, ...toDelete];
    await savePendingDelete(merged);
    Alert.alert('已加入垃圾桶', `已保留最新 1 张，其余 ${toDelete.length} 张已加入垃圾桶。`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>正在查找可能的重复照片...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>相似照片</Text>
      <Text style={styles.subtitle}>按“类似 iOS Duplicates”的方式，先找高可信度的重复项。</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>发现重复组</Text>
        <Text style={styles.heroValue}>{groups.length}</Text>
        <Text style={styles.heroSub}>{groups.reduce((sum, group) => sum + group.items.length, 0)} 张照片参与分组</Text>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>暂时没有找到明显重复</Text>
          <Text style={styles.emptySub}>这版先按文件名、尺寸和文件大小做高可信度匹配，误判会少一些。</Text>
        </View>
      ) : (
        groups.map(group => (
          <View key={group.key} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <View>
                <Text style={styles.groupTitle}>{group.items.length} 张疑似重复</Text>
                <Text style={styles.groupSub}>默认保留最新一张，其他加入垃圾桶</Text>
              </View>
              <TouchableOpacity style={styles.groupAction} onPress={() => { void keepNewest(group); }}>
                <Text style={styles.groupActionText}>保留最新</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewRow}>
              {group.items.slice(0, 4).map(item => (
                <Image key={item.id} source={{ uri: item.previewUri }} style={styles.previewImage} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 36 },
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
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: { color: theme.colors.text, fontSize: 20, fontWeight: 'bold' },
  emptySub: { color: theme.colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  groupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  groupTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  groupSub: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  groupAction: { backgroundColor: theme.colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  groupActionText: { color: theme.colors.white, fontSize: 14, fontWeight: '700' },
  previewRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  previewImage: { width: 72, height: 72, borderRadius: 14, backgroundColor: theme.colors.surfaceMuted },
});
