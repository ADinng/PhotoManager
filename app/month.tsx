import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { loadFavorites, loadPendingDelete, saveFavorites, savePendingDelete, type AssetRef } from '@/lib/library-state';
import { getMonthKeyForTimestamp, markAssetReviewed, unmarkAssetReviewed } from '@/lib/review-progress';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const FILTER_OPTIONS = ['all', 'screenshots', 'live', 'videos', 'burst'] as const;

type FilterType = (typeof FILTER_OPTIONS)[number];

function getFilterLabel(filter: FilterType) {
  switch (filter) {
    case 'screenshots':
      return '截图';
    case 'live':
      return 'Live';
    case 'videos':
      return '视频';
    case 'burst':
      return '连拍';
    default:
      return '全部';
  }
}

function matchesFilter(asset: any, filter: FilterType) {
  const subtypes = asset.mediaSubtypes || [];

  switch (filter) {
    case 'screenshots':
      return subtypes.includes('screenshot');
    case 'live':
      return subtypes.includes('livePhoto');
    case 'videos':
      return asset.mediaType === 'video';
    case 'burst':
      return subtypes.includes('burst');
    default:
      return true;
  }
}

function sortAssets(assets: any[], sortAsc: boolean) {
  return [...assets].sort((a, b) => (
    sortAsc ? a.creationTime - b.creationTime : b.creationTime - a.creationTime
  ));
}

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
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
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
      // 上滑收藏
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
        {asset.mediaType === 'video' ? (
          <View style={styles.videoCard}>
            <Text style={styles.videoIcon}>🎬</Text>
            <Text style={styles.videoTitle}>视频文件</Text>
            <Text style={styles.videoSub}>当前可继续执行保留、删除、收藏操作</Text>
          </View>
        ) : (
          <Image source={{ uri }} style={styles.cardImage} resizeMode="contain" />
        )}
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

export default function MonthScreen() {
  const { key, label, start, end } = useLocalSearchParams();
  const router = useRouter();
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleted, setDeleted] = useState<AssetRef[]>([]);
  const [favorites, setFavorites] = useState<AssetRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCounts, setFilterCounts] = useState<Record<FilterType, number>>({
    all: 0,
    screenshots: 0,
    live: 0,
    videos: 0,
    burst: 0,
  });
  const [sortAsc, setSortAsc] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const uriCacheRef = useRef<Record<string, string>>({});
  const sessionReviewedRef = useRef(new Map<string, string>());
  const pendingDeleteReadyRef = useRef(false);
  const [lastDeleted, setLastDeleted] = useState(0);

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
    if (allAssets.length === 0) {
      return;
    }

    const filteredAssets = sortAssets(
      allAssets.filter(asset => matchesFilter(asset, filterType)),
      sortAsc
    );

    setPhotos(filteredAssets);
    setTotalCount(filteredAssets.length);
    setCurrentIndex(0);
    uriCacheRef.current = {};
    sessionReviewedRef.current = new Map<string, string>();
  }, [allAssets, filterType, sortAsc]);

  useEffect(() => {
    if (!loading) {
      setCurrentIndex(0);
      uriCacheRef.current = {};
      sessionReviewedRef.current = new Map<string, string>();
    }
  }, [loading]);

  const loadMonthPhotos = useCallback(async () => {
    setLoading(true);
    const queryStart = typeof start === 'string' ? Number(start) : NaN;
    const queryEnd = typeof end === 'string' ? Number(end) : NaN;
    const hasCustomRange = Number.isFinite(queryStart) && Number.isFinite(queryEnd);
    const [year, month] = typeof key === 'string' ? key.split('-').map(Number) : [NaN, NaN];
    const rangeStart = hasCustomRange ? queryStart : new Date(year, month - 1, 1).getTime();
    const rangeEnd = hasCustomRange ? queryEnd : new Date(year, month, 0, 23, 59, 59).getTime();
    let allMonthAssets: any[] = [];
    let hasMore = true;
    let after: string | null = null;

    while (hasMore) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo', 'video'],
        createdAfter: rangeStart,
        createdBefore: rangeEnd,
        first: 500,
        after,
      });

      allMonthAssets = [...allMonthAssets, ...result.assets];
      hasMore = result.hasNextPage;
      after = result.endCursor;
    }

    const counts: Record<FilterType, number> = {
      all: allMonthAssets.length,
      screenshots: allMonthAssets.filter(asset => matchesFilter(asset, 'screenshots')).length,
      live: allMonthAssets.filter(asset => matchesFilter(asset, 'live')).length,
      videos: allMonthAssets.filter(asset => matchesFilter(asset, 'videos')).length,
      burst: allMonthAssets.filter(asset => matchesFilter(asset, 'burst')).length,
    };

    const filteredAssets = sortAssets(
      allMonthAssets.filter(asset => matchesFilter(asset, filterType)),
      sortAsc
    );

    setAllAssets(allMonthAssets);
    setFilterCounts(counts);
    setPhotos(filteredAssets);
    setTotalCount(filteredAssets.length);
    setLoading(false);
  }, [end, filterType, key, sortAsc, start]);

  useEffect(() => {
    void loadMonthPhotos();
  }, [loadMonthPhotos]);

  async function markReviewed(asset) {
    const monthKey = getMonthKeyForTimestamp(asset.creationTime);
    if (!monthKey) return;

    const added = await markAssetReviewed(monthKey, asset.id);
    if (added) {
      sessionReviewedRef.current.set(asset.id, monthKey);
    }
  }

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

  async function handleDelete(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    const nextItems = [...deleted, { id: asset.id, uri: finalUri }];
    updateDeleted(nextItems);
    await markReviewed(asset);
    setCurrentIndex(prev => prev + 1);
  }

  function unselectDelete(assetId: string) {
    updateDeleted(deleted.filter(item => item.id !== assetId));
  }

  async function handleKeep(asset, uri?: string) {
    await markReviewed(asset);
    setCurrentIndex(prev => prev + 1);
  }

async function handleFavorite(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    const newFav = { id: asset.id, uri: finalUri };
    
    const existing = await loadFavorites();
    if (existing.some((f: any) => f.id === asset.id)) {
        setCurrentIndex(prev => prev + 1);
        return;
    }
    
    existing.push(newFav);
    await saveFavorites(existing);
    setFavorites(existing);
    // 同步到 iOS 系统相册收藏
    try {
      await MediaLibrary.addAssetsToAlbumAsync(
        [asset.id],
        'Favorites',
        false
      );
    } catch (e) {
      console.log('同步系统收藏失败', e);
    }

    await markReviewed(asset);
    setCurrentIndex(prev => prev + 1);
  }

  async function unselectFavorite(assetId: string) {
    const updated = favorites.filter(item => item.id !== assetId);
    setFavorites(updated);
    await saveFavorites(updated);
  }
  async function handleUndo() {
    if (currentIndex === 0) return;
    const prevPhoto = photos[currentIndex - 1];
    updateDeleted(deleted.filter(item => item.id !== prevPhoto.id));

    const monthKey = sessionReviewedRef.current.get(prevPhoto.id);
    if (monthKey) {
      await unmarkAssetReviewed(monthKey, prevPhoto.id);
      sessionReviewedRef.current.delete(prevPhoto.id);
    }

    setCurrentIndex(prev => prev - 1);
  }

  const current = photos[currentIndex];
  const currentDeleted = current ? isDeleted(current.id) : false;
  const currentFavorited = current ? isFavorited(current.id) : false;

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
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.back}>← 返回</Text>
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.monthTitle} numberOfLines={1}>{label}</Text>
            <Text style={styles.monthSub}>按月份整理你的照片</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortAsc(prev => !prev)}
          >
            <Text style={styles.sortText}>{sortAsc ? '旧 → 新' : '新 → 旧'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.jumpBtnTrigger} onPress={() => setShowJump(true)}>
            <Text style={styles.jumpTriggerText}>{currentIndex + 1}/{totalCount || photos.length} ✎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.trashBtn, deleted.length > 0 && styles.trashBtnActive]}
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

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map(option => {
          const active = filterType === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilterType(option)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {getFilterLabel(option)} · {filterCounts[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {current ? (
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
                void handleDelete(current);
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
            <Text style={styles.doneText}>
              {filterCounts[filterType] === 0
                ? `暂无${getFilterLabel(filterType)}内容`
                : lastDeleted > 0 && deleted.length === 0
                  ? '🎉 全部处理完毕！'
                  : '✅ 全部选择完毕！'}
            </Text>
            <Text style={styles.doneSubText}>
            {filterCounts[filterType] === 0
              ? '切换上方筛选可以查看别的类型'
              : deleted.length > 0
                ? `待删除 ${deleted.length} 张`
                : lastDeleted > 0
                  ? `已删除 ${lastDeleted} 张`
                  : ''}
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
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: '#555', marginTop: 12 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.confirmText}>返回</Text>
          </TouchableOpacity>
        </View>
      )}

        {showJump && (
        <View style={styles.jumpOverlay}>
            <View style={styles.jumpBox}>
            <Text style={styles.jumpTitle}>跳转到第几张？</Text>
            <Text style={styles.jumpSub}>共 {totalCount || photos.length} 张</Text>
            <TextInput
                style={styles.jumpInput}
                keyboardType="number-pad"
                placeholder="输入数字"
                placeholderTextColor="#666"
                value={jumpInput}
                onChangeText={setJumpInput}
                autoFocus
            />
            <View style={styles.jumpBtns}>
                <TouchableOpacity
                style={[styles.jumpBtn, { backgroundColor: '#555' }]}
                onPress={() => { setShowJump(false); setJumpInput(''); }}
                >
                <Text style={styles.jumpBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                style={[styles.jumpBtn, { backgroundColor: '#007AFF' }]}
                onPress={async () => {
                    const num = parseInt(jumpInput);
                    const max = totalCount || photos.length;
                    if (!isNaN(num) && num >= 1 && num <= max) {
                      const targetIndex = num - 1;
                      // 如果目标位置超过已加载的照片，先加载到那个位置
                      if (targetIndex >= photos.length) {
                        const filteredAssets = sortAssets(
                          allAssets.filter(asset => matchesFilter(asset, filterType)),
                          sortAsc
                        );
                        setPhotos(filteredAssets);
                      }
                      setCurrentIndex(targetIndex);
                    }
                    setShowJump(false);
                    setJumpInput('');
                  }}
                >
                <Text style={styles.jumpBtnText}>跳转</Text>
                </TouchableOpacity>
            </View>
            </View>
        </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  headerRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, alignSelf: 'flex-start' },
  back: { color: '#80B3FF', fontSize: 14, fontWeight: '700' },
  titleWrap: { flex: 1, minWidth: 0 },
  monthTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  monthSub: { color: '#777', fontSize: 12, marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sortBtn: { backgroundColor: '#2A2A2A', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 999 },
  sortText: { color: '#D8D8D8', fontSize: 13, fontWeight: '600' },
  jumpBtnTrigger: { backgroundColor: '#2A2A2A', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 999 },
  jumpTriggerText: { color: 'white', fontSize: 13, fontWeight: '700' },
  trashBtn: { backgroundColor: '#2A2A2A', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 999 },
  trashBtnActive: { backgroundColor: '#ff3b30' },
  trashText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  filterScroll: { flexGrow: 0, maxHeight: 52 },
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: 'center' },
  filterChip: { backgroundColor: '#222', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { backgroundColor: '#007AFF' },
  filterChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: 'white' },

  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progress: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  cardArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: SW - 64, height: SH * 0.7,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
  },
  cardImage: { width: '100%', height: '100%' },
  videoCard: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 32,
  },
  videoIcon: { fontSize: 48 },
  videoTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  videoSub: { color: '#999', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  hintBadge: {
    position: 'absolute', top: 30,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8, borderWidth: 3,
  },
  hintLeft: { right: 20, borderColor: '#ff3b30', backgroundColor: 'rgba(255,59,48,0.8)' },
  hintRight: { left: 20, borderColor: '#34c759', backgroundColor: 'rgba(52,199,89,0.8)' },
  hintTop: { top: 20, alignSelf: 'center', left: '35%', borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.8)' },
  hintText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, padding: 30 },
  btn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  btnDelete: { backgroundColor: '#ff3b30' },
  btnFavorite: { backgroundColor: '#FFD700' },
  btnKeep: { backgroundColor: '#34c759' },
  btnUndo: { backgroundColor: '#888' },
  btnDeleteActive: { borderWidth: 3, borderColor: '#ffd5d1', transform: [{ scale: 1.06 }] },
  btnFavoriteActive: { borderWidth: 3, borderColor: '#fff4c2', transform: [{ scale: 1.06 }] },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  doneText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  doneSubText: { color: '#888', fontSize: 16 },
  confirmBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  confirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  jumpOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  jumpBox: { backgroundColor: '#222', borderRadius: 16, padding: 24, width: '80%', alignItems: 'center', gap: 12 },
  jumpTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  jumpSub: { color: '#888', fontSize: 14 },
  jumpInput: { width: '100%', backgroundColor: '#333', color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', padding: 12, borderRadius: 10 },
  jumpBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  jumpBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  jumpBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
