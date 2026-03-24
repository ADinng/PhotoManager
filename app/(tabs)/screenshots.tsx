import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

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
  }, [asset.id]);

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
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleted, setDeleted] = useState<{ id: string; uri: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [lastDeleted, setLastDeleted] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const allLoadedRef = useRef(false);
  const uriCacheRef = useRef<Record<string, string>>({});

  useEffect(() => { loadScreenshots(); }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('pendingDelete').then(val => {
        if (!val) {
          setDeleted([]);
          setLastDeleted(0);
          setCurrentIndex(0);
        } else{
            const parsed = JSON.parse(val);
            if (parsed.length > 0) setDeleted(parsed)
        }
      });
    }, [])
  );

  useEffect(() => {
    if (deleted.length > 0) {
      AsyncStorage.setItem('pendingDelete', JSON.stringify(deleted));
    }
  }, [deleted]);

  useEffect(() => {
    if (!allLoadedRef.current && photos.length - currentIndex < 10) {
      loadMore();
    }
  }, [currentIndex]);

  async function loadScreenshots() {
    try {
      let allScreenshots = [];
      let hasMore = true;
      let after = null;
      
      // 先加载第一批
      const firstResult = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        first: 30,
      });
  
      const firstScreenshots = firstResult.assets.filter(asset =>
        asset.mediaSubtypes?.includes('screenshot')
      );
  
      cursorRef.current = firstResult.endCursor;
      allLoadedRef.current = !firstResult.hasNextPage;
      setPhotos(firstScreenshots);
      setLoading(false);
  
      // 后台统计总数
      let count = firstScreenshots.length;
      hasMore = firstResult.hasNextPage;
      after = firstResult.endCursor;
  
      while (hasMore) {
        const r = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          sortBy: [['creationTime', false]],
          first: 100,
          after,
        });
        count += r.assets.filter(a => a.mediaSubtypes?.includes('screenshot')).length;
        hasMore = r.hasNextPage;
        after = r.endCursor;
      }
      setTotalCount(count);
    } catch (e) {
      console.log('加载截图失败', e);
      setLoading(false);
    }
  }

  async function loadMore() {
    if (allLoadedRef.current || !cursorRef.current) return;
  
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      sortBy: [['creationTime', false]],
      first: 30,
      after: cursorRef.current,
    });
  
    cursorRef.current = result.endCursor;
    allLoadedRef.current = !result.hasNextPage;
    const screenshots = result.assets.filter(asset =>
      asset.mediaSubtypes?.includes('screenshot')
    );
    setPhotos(prev => [...prev, ...screenshots]);
  }

  function handleDelete(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    setDeleted(prev => [...prev, { id: asset.id, uri: finalUri }]);
    setCurrentIndex(prev => prev + 1);
  }

  function handleKeep(asset) {
    setCurrentIndex(prev => prev + 1);
  }

  async function handleFavorite(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    const existing = JSON.parse((await AsyncStorage.getItem('favorites')) || '[]');
    if (!existing.some((f: any) => f.id === asset.id)) {
      existing.push({ id: asset.id, uri: finalUri });
      await AsyncStorage.setItem('favorites', JSON.stringify(existing));
    }
    setCurrentIndex(prev => prev + 1);
  }

  function handleUndo() {
    if (currentIndex === 0) return;
    const prevPhoto = photos[currentIndex - 1];
    setDeleted(prev => prev.filter(d => d.id !== prevPhoto.id));
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

  return (
    <View style={styles.container}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>📱 屏幕截图</Text>
        <View style={styles.headerRight}>
          <Text style={styles.progress}>
            {Math.min(currentIndex + 1, totalCount)}/{totalCount}
          </Text>
          <TouchableOpacity
            style={[styles.trashBtn, { backgroundColor: deleted.length > 0 ? '#ff3b30' : '#333' }]}
            onPress={async () => {
              if (deleted.length === 0) return;
              await AsyncStorage.setItem('pendingDelete', JSON.stringify(deleted));
              router.push('/trash');
            }}
          >
            <Text style={styles.trashText}>🗑 {deleted.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => handleDelete(current)}>
                <Text style={styles.btnText}>🗑 删除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#FFD700' }]} onPress={() => handleFavorite(current)}>
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
                await AsyncStorage.setItem('pendingDelete', JSON.stringify(deleted));
                router.push('/trash');
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
    progress: { color: 'white', fontSize: 13, fontWeight: 'bold' },
    trashBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    trashText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
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
    btnKeep: { backgroundColor: '#34c759' },
    btnUndo: { backgroundColor: '#888' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    doneSubText: { color: '#888', fontSize: 16 },
    emptyText: { color: '#888', fontSize: 16 },
    confirmBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
    confirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});