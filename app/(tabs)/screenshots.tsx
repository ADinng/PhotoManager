import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { loadFavorites, loadPendingDelete, saveFavorites, savePendingDelete, type AssetRef } from '@/lib/library-state';
import { formatBytes } from '@/lib/stats';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

function SwipeablePhoto({ asset, onDelete, onKeep, onFavorite, onUriLoaded }) {
  const [uri, setUri] = useState(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -30 ? Math.min((-translateX.value - 30) / 50, 1) : 0,
  }));
  const keepHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 30 ? Math.min((translateX.value - 30) / 50, 1) : 0,
  }));
  const favoriteHintStyle = useAnimatedStyle(() => ({
    opacity: translateY.value < -30 ? Math.min((-translateY.value - 30) / 50, 1) : 0,
  }));

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    opacity.value = 1;
    MediaLibrary.getAssetInfoAsync(asset).then(info => {
      const u = info.localUri || info.uri;
      setUri(u);
      onUriLoaded(asset.id, u);
    });
  }, [asset, onUriLoaded, opacity, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      if (Math.abs(e.translationY) > Math.abs(e.translationX)) {
        translateY.value = e.translationY;
      } else {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > Math.abs(e.translationX) && e.translationY < -SWIPE_THRESHOLD) {
        translateY.value = withTiming(-SH, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onFavorite)(asset, uri);
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onDelete)(asset, uri);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onKeep)(asset, uri);
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  if (!uri) {
    return (
      <View style={styles.card}>
        <Text style={{ color: 'white' }}>加载中...</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Image source={{ uri }} style={styles.cardImage} resizeMode="contain" />
        <Animated.View style={[styles.hintBadge, styles.hintLeft, deleteHintStyle]}>
          <Text style={styles.hintText}>🗑 删除</Text>
        </Animated.View>
        <Animated.View style={[styles.hintBadge, styles.hintRight, keepHintStyle]}>
          <Text style={styles.hintText}>✓ 保存</Text>
        </Animated.View>
        <Animated.View style={[styles.hintBadge, styles.hintTop, favoriteHintStyle]}>
          <Text style={styles.hintText}>⭐ 收藏</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function ScreenshotsScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<any[]>([]);
  const [allScreenshots, setAllScreenshots] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleted, setDeleted] = useState<AssetRef[]>([]);
  const [favorites, setFavorites] = useState<AssetRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [lastDeleted, setLastDeleted] = useState(0);
  const uriCacheRef = useRef<Record<string, string>>({});
  const pendingDeleteReadyRef = useRef(false);

  const loadScreenshots = useCallback(async () => {
    try {
      let screenshots: any[] = [];
      let hasMore = true;
      let after: string | null = null;
      let bytes = 0;

      while (hasMore) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          sortBy: [['creationTime', false]],
          first: 500,
          after,
        });

        const batchScreenshots = result.assets.filter(asset =>
          asset.mediaSubtypes?.includes('screenshot')
        );

        screenshots = [...screenshots, ...batchScreenshots];
        bytes += batchScreenshots.reduce((sum, asset) => sum + (typeof asset.fileSize === 'number' ? asset.fileSize : 0), 0);
        hasMore = result.hasNextPage;
        after = result.endCursor;
      }

      setAllScreenshots(screenshots);
      setTotalCount(screenshots.length);
      setTotalBytes(bytes);
      setLoading(false);
    } catch (e) {
      console.log('加载截图失败', e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScreenshots();
  }, [loadScreenshots]);

  useFocusEffect(
    useCallback(() => {
      pendingDeleteReadyRef.current = false;
      Promise.all([loadPendingDelete(), loadFavorites()]).then(([pendingDelete, favoriteItems]) => {
        if (pendingDelete.length === 0 && deleted.length > 0) {
          setLastDeleted(deleted.length);
        }
        setDeleted(pendingDelete);
        setFavorites(favoriteItems);
        pendingDeleteReadyRef.current = true;
      });
    }, [deleted.length])
  );

  useEffect(() => {
    if (!pendingDeleteReadyRef.current) {
      return;
    }

    if (deleted.length > 0) {
      void savePendingDelete(deleted);
    } else {
      void savePendingDelete([]);
    }
  }, [deleted]);

  useEffect(() => {
    const nextPhotos = allScreenshots.filter(asset => !deleted.some(item => item.id === asset.id));
    setPhotos(nextPhotos);
    if (nextPhotos.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= nextPhotos.length) {
      setCurrentIndex(nextPhotos.length - 1);
    }
  }, [allScreenshots, currentIndex, deleted]);

  function isDeleted(assetId: string) {
    return deleted.some(item => item.id === assetId);
  }

  function isFavorited(assetId: string) {
    return favorites.some(item => item.id === assetId);
  }

  function updateDeleted(nextItems: AssetRef[]) {
    setDeleted(nextItems);
    void savePendingDelete(nextItems);
  }

  function handleDelete(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    updateDeleted([...deleted, { id: asset.id, uri: finalUri }]);
    setCurrentIndex(prev => prev + 1);
  }

  function handleKeep(asset) {
    setCurrentIndex(prev => prev + 1);
  }

  async function handleFavorite(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    const existing = await loadFavorites();
    if (!existing.some((f: any) => f.id === asset.id)) {
      existing.push({ id: asset.id, uri: finalUri });
      await saveFavorites(existing);
      setFavorites(existing);
    }
    setCurrentIndex(prev => prev + 1);
  }

  function unselectDelete(assetId: string) {
    updateDeleted(deleted.filter(item => item.id !== assetId));
  }

  async function unselectFavorite(assetId: string) {
    const updated = favorites.filter(item => item.id !== assetId);
    setFavorites(updated);
    await saveFavorites(updated);
  }

  function handleUndo() {
    if (currentIndex === 0) return;
    const prevPhoto = photos[currentIndex - 1];
    updateDeleted(deleted.filter(item => item.id !== prevPhoto.id));
    setCurrentIndex(prev => prev - 1);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ color: '#888', marginTop: 12 }}>读取截图中...</Text>
      </View>
    );
  }

  const current = photos[currentIndex];
  const currentDeleted = current ? isDeleted(current.id) : false;
  const currentFavorited = current ? isFavorited(current.id) : false;

  return (
    <View style={styles.container}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.title}>📱 屏幕截图</Text>
          <Text style={styles.metaText}>{totalCount} 张 · 约 {formatBytes(totalBytes)}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.progress}>
            {Math.min(currentIndex + 1, totalCount)}/{totalCount}
          </Text>
          <TouchableOpacity
            style={[styles.trashBtn, { backgroundColor: deleted.length > 0 ? '#ff3b30' : '#333' }]}
            onPress={async () => {
              if (deleted.length === 0) return;
              await savePendingDelete(deleted);
              router.navigate('/(tabs)/trash');
            }}
          >
            <Text style={styles.trashText}>🗑 {deleted.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {allScreenshots.length > 0 ? (
        <View style={styles.bulkRow}>
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={async () => {
              const merged = [
                ...deleted,
                ...allScreenshots
                  .filter(asset => !deleted.some(item => item.id === asset.id))
                  .map(asset => ({
                    id: asset.id,
                    uri: uriCacheRef.current[asset.id] || asset.uri,
                  })),
              ];
              setDeleted(merged);
              await savePendingDelete(merged);
              router.navigate('/(tabs)/trash');
            }}
          >
            <Text style={styles.bulkBtnText}>🗑 全部加入垃圾桶</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>没有找到截图</Text>
        </View>
      ) : current ? (
        <>
          <View style={styles.cardArea}>
            <SwipeablePhoto
              key={current.id}
              asset={current}
              onDelete={handleDelete}
              onKeep={handleKeep}
              onFavorite={handleFavorite}
              onUriLoaded={(id, uri) => { uriCacheRef.current[id] = uri; }}
            />
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnUndo]} onPress={handleUndo}>
                <Text style={styles.btnText}>↩ 返回</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnDelete, currentDeleted && styles.btnDeleteActive]}
              onPress={() => {
                if (currentDeleted) {
                  unselectDelete(current.id);
                  return;
                }
                handleDelete(current);
              }}
            >
                <Text style={styles.btnText}>🗑 删除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnFavorite, currentFavorited && styles.btnFavoriteActive]}
              onPress={() => {
                if (currentFavorited) {
                  void unselectFavorite(current.id);
                  return;
                }
                void handleFavorite(current);
              }}
            >
                <Text style={styles.btnText}>⭐ 收藏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnKeep]} onPress={() => handleKeep(current)}>
                <Text style={styles.btnText}>✓ 保存</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.doneText}>✅ 截图清理完毕！</Text>
          <Text style={styles.doneSubText}>
            {deleted.length > 0 ? `待删除 ${deleted.length} 张` : lastDeleted > 0 ? `已删除 ${lastDeleted} 张` : ''}
          </Text>
          {deleted.length > 0 && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={async () => {
                await savePendingDelete(deleted);
                router.navigate('/(tabs)/trash');
              }}
            >
              <Text style={styles.confirmText}>确认删除 ({deleted.length}张)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111', paddingTop: 60 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    metaText: { color: '#888', fontSize: 13, marginTop: 4 },
    progress: { color: 'white', fontSize: 13, fontWeight: 'bold' },
    trashBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    trashText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    bulkRow: { paddingHorizontal: 16, paddingBottom: 8 },
    bulkBtn: { backgroundColor: '#2A2A2A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
    bulkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    cardArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { width: SW - 64, height: SH * 0.65, borderRadius: 24, overflow: 'hidden', backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
    cardImage: { width: '100%', height: '100%', resizeMode: 'contain' },
    hintBadge: { position: 'absolute', top: 30, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 3 },
    hintLeft: { right: 20, borderColor: '#ff3b30', backgroundColor: 'rgba(255,59,48,0.8)' },
    hintRight: { left: 20, borderColor: '#34c759', backgroundColor: 'rgba(52,199,89,0.8)' },
    hintTop: { top: 20, alignSelf: 'center', left: '35%', borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.8)' },
    hintText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    btnRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, padding: 20 },
    btn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    btnDelete: { backgroundColor: '#ff3b30' },
    btnFavorite: { backgroundColor: '#FFD700' },
    btnKeep: { backgroundColor: '#34c759' },
    btnUndo: { backgroundColor: '#888' },
    btnDeleteActive: { borderWidth: 3, borderColor: '#ffd5d1', transform: [{ scale: 1.06 }] },
    btnFavoriteActive: { borderWidth: 3, borderColor: '#fff4c2', transform: [{ scale: 1.06 }] },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    doneSubText: { color: '#888', fontSize: 16 },
    emptyText: { color: '#888', fontSize: 16 },
    confirmBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
    confirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
