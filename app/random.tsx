import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { loadFavorites, loadPendingDelete, saveFavorites, savePendingDelete, type AssetRef } from '@/lib/library-state';
import { theme } from '@/lib/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const SESSION_SIZES = [20, 50, 100] as const;

function formatAssetDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function sampleAssets<T>(items: T[], size: number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}

function SwipeablePhoto({ asset, onDelete, onKeep, onFavorite, onUriLoaded }) {
  const [uri, setUri] = useState<string | null>(null);
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
      const nextUri = info.localUri || info.uri;
      setUri(nextUri);
      onUriLoaded(asset.id, nextUri);
    });
  }, [asset, onUriLoaded, opacity, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .activeOffsetY([-10, 10])
    .onUpdate(event => {
      if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
        translateY.value = event.translationY;
      } else {
        translateX.value = event.translationX;
      }
    })
    .onEnd(event => {
      if (Math.abs(event.translationY) > Math.abs(event.translationX) && event.translationY < -SWIPE_THRESHOLD) {
        translateY.value = withTiming(-SH, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onFavorite)(asset, uri);
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onDelete)(asset, uri);
      } else if (event.translationX > SWIPE_THRESHOLD) {
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
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Image source={{ uri }} style={styles.cardImage} resizeMode="contain" />
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{formatAssetDate(asset.creationTime)}</Text>
        </View>
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

export default function RandomScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleted, setDeleted] = useState<AssetRef[]>([]);
  const [favorites, setFavorites] = useState<AssetRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionSize, setSessionSize] = useState<(typeof SESSION_SIZES)[number]>(50);
  const [lastDeleted, setLastDeleted] = useState(0);
  const uriCacheRef = useRef<Record<string, string>>({});
  const pendingDeleteReadyRef = useRef(false);

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

  async function fetchAllPhotos() {
    let allAssets: any[] = [];
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

    return allAssets;
  }

  const loadRandomPhotos = useCallback(async (size: number) => {
    setLoading(true);
    setCurrentIndex(0);
    setLastDeleted(0);
    uriCacheRef.current = {};

    try {
      const allAssets = await fetchAllPhotos();
      setPhotos(sampleAssets(allAssets, Math.min(size, allAssets.length)));
    } catch (error) {
      console.log('加载随机照片失败', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRandomPhotos(sessionSize);
  }, [loadRandomPhotos, sessionSize]);

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

  function handleKeep() {
    setCurrentIndex(prev => prev + 1);
  }

  async function handleFavorite(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    const existing = await loadFavorites();

    if (!existing.some((item: { id: string }) => item.id === asset.id)) {
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
    const previousPhoto = photos[currentIndex - 1];
    updateDeleted(deleted.filter(item => item.id !== previousPhoto.id));
    setCurrentIndex(prev => prev - 1);
  }

  const current = photos[currentIndex];
  const remaining = Math.max(photos.length - currentIndex - 1, 0);
  const currentDeleted = current ? isDeleted(current.id) : false;
  const currentFavorited = current ? isFavorited(current.id) : false;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.header}>随机发现</Text>
          <Text style={styles.headerSub}>轻松翻一组不同时间的旧照片</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => void loadRandomPhotos(sessionSize)}>
          <Text style={styles.refreshText}>换一组</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>
        {SESSION_SIZES.map(size => (
          <TouchableOpacity
            key={size}
            style={[styles.sizeBtn, sessionSize === size && styles.sizeBtnActive]}
            onPress={() => setSessionSize(size)}
          >
            <Text style={[styles.sizeBtnText, sessionSize === size && styles.sizeBtnTextActive]}>{size} 张</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>本轮 {photos.length} 张</Text>
          <Text style={styles.summarySub}>
            {photos.length === 0 ? '没抽到可用照片，换一组试试。' : `已经看过 ${Math.min(currentIndex, photos.length)} 张，还剩 ${remaining} 张。`}
          </Text>
        </View>
      ) : null}

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{photos.length === 0 ? 0 : Math.min(currentIndex + 1, photos.length)}/{photos.length}</Text>
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>正在准备随机照片...</Text>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.doneText}>这次没有抽到可用照片</Text>
          <Text style={styles.doneSubText}>换一组，看看有没有更适合整理的回忆</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, styles.secondaryBtn]}
            onPress={() => void loadRandomPhotos(sessionSize)}
          >
            <Text style={styles.confirmText}>换一组</Text>
          </TouchableOpacity>
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
              onUriLoaded={(id, uri) => {
                uriCacheRef.current[id] = uri;
              }}
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
            <TouchableOpacity style={[styles.btn, styles.btnKeep]} onPress={handleKeep}>
              <Text style={styles.btnText}>✓ 保存</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.doneText}>✅ 本轮随机回顾完成</Text>
          <Text style={styles.doneSubText}>
            {deleted.length > 0 ? `待删除 ${deleted.length} 张` : lastDeleted > 0 ? `已删除 ${lastDeleted} 张` : '可以刷新再来一组'}
          </Text>
          {deleted.length > 0 ? (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={async () => {
                await savePendingDelete(deleted);
                router.navigate('/(tabs)/trash');
              }}
            >
              <Text style={styles.confirmText}>确认删除 ({deleted.length}张)</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.confirmBtn, styles.secondaryBtn]}
            onPress={() => void loadRandomPhotos(sessionSize)}
          >
            <Text style={styles.confirmText}>再来一组</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBg, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  headerBtn: { backgroundColor: theme.colors.darkSurfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  back: { color: '#F5D0C2', fontSize: 15, fontWeight: '700' },
  headerCenter: { flex: 1 },
  header: { color: theme.colors.darkText, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: theme.colors.darkMuted, fontSize: 13, marginTop: 4 },
  refreshBtn: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 },
  refreshText: { color: theme.colors.accentDeep, fontWeight: '700' },
  controlsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  sizeBtn: { backgroundColor: theme.colors.darkSurface, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  sizeBtnActive: { backgroundColor: theme.colors.secondary },
  sizeBtnText: { color: theme.colors.darkMuted, fontWeight: '600' },
  sizeBtnTextActive: { color: theme.colors.white },
  summaryCard: { backgroundColor: theme.colors.darkSurface, borderRadius: 20, marginHorizontal: 16, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#40352E' },
  summaryTitle: { color: theme.colors.darkText, fontSize: 17, fontWeight: '700' },
  summarySub: { color: theme.colors.darkMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  progressText: { color: theme.colors.darkText, fontSize: 14, fontWeight: 'bold' },
  trashBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.darkSurfaceAlt },
  trashText: { color: theme.colors.darkText, fontWeight: 'bold', fontSize: 13 },
  cardArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: SW - 64,
    height: SH * 0.7,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: theme.colors.darkSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#40352E',
  },
  cardImage: { width: '100%', height: '100%' },
  dateBadge: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(30,24,21,0.82)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateBadgeText: { color: theme.colors.darkText, fontSize: 14, fontWeight: '700' },
  hintBadge: { position: 'absolute', top: 30, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 3 },
  hintLeft: { right: 20, borderColor: '#ff3b30', backgroundColor: 'rgba(255,59,48,0.8)' },
  hintRight: { left: 20, borderColor: '#34c759', backgroundColor: 'rgba(52,199,89,0.8)' },
  hintTop: { top: 70, alignSelf: 'center', borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.8)' },
  hintText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, padding: 30 },
  btn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  btnUndo: { backgroundColor: '#6F655D' },
  btnDelete: { backgroundColor: theme.colors.accent },
  btnFavorite: { backgroundColor: theme.colors.gold },
  btnKeep: { backgroundColor: theme.colors.secondary },
  btnDeleteActive: { borderWidth: 3, borderColor: '#ffd5d1', transform: [{ scale: 1.06 }] },
  btnFavoriteActive: { borderWidth: 3, borderColor: '#fff4c2', transform: [{ scale: 1.06 }] },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  loadingText: { color: theme.colors.darkMuted, fontSize: 15 },
  doneText: { color: theme.colors.darkText, fontSize: 24, fontWeight: 'bold' },
  doneSubText: { color: theme.colors.darkMuted, fontSize: 16, textAlign: 'center' },
  confirmBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 16, marginTop: 20 },
  secondaryBtn: { backgroundColor: theme.colors.darkSurfaceAlt, marginTop: 12 },
  confirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
