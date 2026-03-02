import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const IMG_SIZE = (Dimensions.get('window').width - 8) / 3;

export default function TrashScreen() {
  const { ids } = useLocalSearchParams();
  const router = useRouter();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    const idList = JSON.parse(ids as string);
    const result = [];
    for (const id of idList) {
      const info = await MediaLibrary.getAssetInfoAsync(id);
      result.push(info);
    }
    setAssets(result);
    setLoading(false);
  }

  // 恢复单张
  function handleRestore(asset) {
    setAssets(prev => prev.filter(a => a.id !== asset.id));
  }

  // 确认全部删除
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
            await MediaLibrary.deleteAssetsAsync(assets.map(a => a.id));
            Alert.alert('完成', '已删除所有照片');
            router.back();
          },
        },
      ]
    );
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
                  source={{ uri: item.localUri || item.uri }}
                  style={styles.img}
                />
                <View style={styles.overlay} />
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  back: { color: '#007AFF', fontSize: 16 },
  header: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  tip: { color: '#888', textAlign: 'center', fontSize: 13, marginBottom: 8 },
  img: { width: IMG_SIZE, height: IMG_SIZE, margin: 1 },
  overlay: { position: 'absolute', top: 1, left: 1, width: IMG_SIZE, height: IMG_SIZE, backgroundColor: 'rgba(255,0,0,0.15)' },
  footer: { padding: 20 },
  deleteBtn: { backgroundColor: '#ff3b30', padding: 16, borderRadius: 12, alignItems: 'center' },
  deleteBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  emptyText: { color: '#888', fontSize: 16 },
});