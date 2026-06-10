import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { loadPendingDelete as loadPendingDeleteItems, savePendingDelete } from '@/lib/library-state';
import { recordDeletedAssets } from '@/lib/stats';
import { theme } from '@/lib/theme';

const IMG_SIZE = (Dimensions.get('window').width - 8) / 3;

export default function TrashScreen() {
  const router = useRouter();
  const [assets, setAssets] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);

  const refreshPendingDelete = useCallback(async () => {
    setAssets(await loadPendingDeleteItems());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPendingDelete();
    }, [refreshPendingDelete])
  );

  useEffect(() => {
    void refreshPendingDelete();
  }, [refreshPendingDelete]);

  async function handleRestore(asset) {
    const updated = assets.filter(a => a.id !== asset.id);
    setAssets(updated);
    await savePendingDelete(updated);
  }

  async function handleConfirmDelete() {
    const total = assets.length;
    Alert.alert(
      '确认删除',
      `将永久删除 ${total} 张照片，无法恢复`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const ids = assets.map(a => a.id);
              let deletedBytes = 0;
              for (const id of ids) {
                try {
                  const info = await MediaLibrary.getAssetInfoAsync(id);
                  deletedBytes += typeof info.fileSize === 'number' ? info.fileSize : 0;
                } catch {}
              }
              const batchSize = 10;
              for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                await MediaLibrary.deleteAssetsAsync(batch);
                setDeleteProgress(Math.min(i + batchSize, ids.length));
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              await recordDeletedAssets(total, deletedBytes);
              await savePendingDelete([]);
              setDeleting(false);
              setDeleteProgress(0);
              Alert.alert('完成', `已删除 ${total} 张照片`, [
                { 
                  text: '确定',     
                  onPress: () => {
                    setAssets([]);
                    router.back();
                  } 
                }
              ]);
            } catch {
              setDeleting(false);
              Alert.alert('错误', '部分删除失败，请重试');
            }
          },
        },
      ]
    );
  }

  // 删除中显示进度
  if (deleting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.progressText}>正在删除... {deleteProgress}/{assets.length}</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, {
            width: `${assets.length > 0 ? (deleteProgress / assets.length) * 100 : 0}%`
          }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.header}>垃圾桶</Text>
          <Text style={styles.headerSub}>确认后才会永久删除，长按可以恢复</Text>
        </View>
      </View>

      {assets.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>没有待删除的照片</Text>
        </View>
      ) : (
        <>
          <Text style={styles.tip}>当前有 {assets.length} 张照片等待你最终确认</Text>
          <FlatList
            data={assets}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            removeClippedSubviews={true}
            maxToRenderPerBatch={12}
            windowSize={5}
            initialNumToRender={12}
            renderItem={({ item }) => (
              <TouchableOpacity
                onLongPress={() => {
                  Alert.alert('恢复照片', '要把这张照片从删除列表中移除吗？', [
                    { text: '取消', style: 'cancel' },
                    { text: '恢复', onPress: () => { void handleRestore(item); } },
                  ]);
                }}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={styles.img}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />
          <View style={styles.footer}>
          <TouchableOpacity 
                style={[styles.deleteBtn, assets.length === 0 && { backgroundColor: '#888' }]} 
                onPress={handleConfirmDelete}
                disabled={assets.length === 0}
          >
          <Text style={styles.deleteBtnText}>🗑 确认全部删除 ({assets.length}张)</Text>
          </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  headerBtn: { backgroundColor: theme.colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  headerCopy: { flex: 1 },
  back: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
  header: { color: theme.colors.text, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  tip: { color: theme.colors.muted, textAlign: 'center', fontSize: 13, marginBottom: 10, paddingHorizontal: 16 },
  grid: { paddingHorizontal: 8, paddingBottom: 20 },
  img: { width: IMG_SIZE, height: IMG_SIZE, margin: 3, borderRadius: 18, backgroundColor: theme.colors.surfaceMuted },
  footer: { padding: 20 },
  deleteBtn: { backgroundColor: theme.colors.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
  deleteBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  emptyText: { color: theme.colors.muted, fontSize: 16 },
  progressText: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold' },
  progressBarBg: { width: '70%', height: 10, backgroundColor: theme.colors.surfaceMuted, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: 10, backgroundColor: theme.colors.accent, borderRadius: 999 },
});
