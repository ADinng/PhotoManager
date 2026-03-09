import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const IMG_SIZE = (Dimensions.get('window').width - 8) / 3;

export default function TrashScreen() {
  const router = useRouter();
  const [assets, setAssets] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('pendingDelete').then(val => {
      if (val) setAssets(JSON.parse(val));
    });
  }, []);

  function handleRestore(asset) {
    setAssets(prev => prev.filter(a => a.id !== asset.id));
  }

  async function handleConfirmDelete() {
    Alert.alert(
      '确认删除',
      `将永久删除 ${assets.length} 张照片，无法恢复`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const ids = assets.map(a => a.id);
              const batchSize = 10; // 每批10张，更安全
              for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                await MediaLibrary.deleteAssetsAsync(batch);
                setDeleteProgress(Math.min(i + batchSize, ids.length));
                // 每批之间稍微等一下，让内存释放
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              await AsyncStorage.removeItem('pendingDelete');
              setDeleting(false);
              Alert.alert('完成', `已删除 ${assets.length} 张照片`, [
                { text: '确定', onPress: () => router.back() }
              ]);
            } catch (e) {
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
        <ActivityIndicator size="large" color="#ff3b30" />
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.header}>🗑 待删除 · {assets.length}张</Text>
      </View>

      {assets.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>没有待删除的照片</Text>
        </View>
      ) : (
        <>
          <Text style={styles.tip}>长按图片可以恢复</Text>
          <FlatList
            data={assets}
            keyExtractor={item => item.id}
            numColumns={3}
            removeClippedSubviews={true}
            maxToRenderPerBatch={12}
            windowSize={5}
            initialNumToRender={12}
            renderItem={({ item }) => (
              <TouchableOpacity
                onLongPress={() => {
                  Alert.alert('恢复照片', '要把这张照片从删除列表中移除吗？', [
                    { text: '取消', style: 'cancel' },
                    { text: '恢复', onPress: () => handleRestore(item) },
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
            <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirmDelete}>
              <Text style={styles.deleteBtnText}>🗑 确认全部删除 ({assets.length}张)</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  back: { color: '#007AFF', fontSize: 16 },
  header: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  tip: { color: '#888', textAlign: 'center', fontSize: 13, marginBottom: 8 },
  img: { width: IMG_SIZE, height: IMG_SIZE, margin: 1 },
  footer: { padding: 20 },
  deleteBtn: { backgroundColor: '#ff3b30', padding: 16, borderRadius: 12, alignItems: 'center' },
  deleteBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  emptyText: { color: '#888', fontSize: 16 },
  progressText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  progressBarBg: { width: '70%', height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#ff3b30', borderRadius: 4 },
});