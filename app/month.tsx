import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    opacity.value = 1;
    MediaLibrary.getAssetInfoAsync(asset).then(info => {
      const u = info.localUri || info.uri;
      setUri(u);
      onUriLoaded(asset.id, u);
    });
  }, [asset.id]);


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

export default function MonthScreen() {
  const { key, label } = useLocalSearchParams();
  const router = useRouter();
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleted, setDeleted] = useState<{id: string, uri: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [sortAsc, setSortAsc] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [favorited, setFavorited] = useState<{id: string, uri: string}[]>([]);
  const cursorRef = useRef<string | null>(null);
  const allLoadedRef = useRef(false);
  const uriCacheRef = useRef<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('pendingDelete').then(val => {
        if (!val) setDeleted([]);
      });
    }, [])
  );

  useEffect(() => {
    loadMonthPhotos();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('favorites').then(val => {
      if (val) setFavorited(JSON.parse(val));
    });
  }, []);

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

  useEffect(() => {
    if (!loading) {
      setPhotos([]);
      setCurrentIndex(0);
      cursorRef.current = null;
      allLoadedRef.current = false;
      uriCacheRef.current = {};
      loadMonthPhotos();
    }
  }, [sortAsc]);

  async function loadMonthPhotos() {
    const [year, month] = (key as string).split('-').map(Number);
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();

    const result = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      sortBy: [['creationTime', sortAsc]],
      createdAfter: start,
      createdBefore: end,
      first: 30,
    });

    cursorRef.current = result.endCursor;
    allLoadedRef.current = !result.hasNextPage;
    setPhotos(result.assets);
    setLoading(false);

    let count = result.assets.length;
    let hasMore = result.hasNextPage;
    let after = result.endCursor;
    while (hasMore) {
      const r = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', sortAsc]],
        createdAfter: start,
        createdBefore: end,
        first: 100,
        after,
      });
      count += r.assets.length;
      hasMore = r.hasNextPage;
      after = r.endCursor;
    }
    setTotalCount(count);

    const existing = JSON.parse((await AsyncStorage.getItem('reviewedData')) || '{}');
    existing[key as string] = count;
    await AsyncStorage.setItem('reviewedData', JSON.stringify(existing));
  }

  async function loadMore() {
    if (allLoadedRef.current || !cursorRef.current) return;
    const [year, month] = (key as string).split('-').map(Number);
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();

    const result = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      sortBy: [['creationTime', sortAsc]],
      createdAfter: start,
      createdBefore: end,
      first: 30,
      after: cursorRef.current,
    });

    cursorRef.current = result.endCursor;
    allLoadedRef.current = !result.hasNextPage;
    setPhotos(prev => [...prev, ...result.assets]);
  }

  function handleDelete(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    setDeleted(prev => [...prev, { id: asset.id, uri: finalUri }]);
    setCurrentIndex(prev => prev + 1);
  }

  function handleKeep(asset, uri?: string) {
    setCurrentIndex(prev => prev + 1);
  }

  async function handleFavorite(asset, uri?: string) {
    const finalUri = uri || uriCacheRef.current[asset.id] || asset.uri;
    const newFav = { id: asset.id, uri: finalUri };
    setFavorited(prev => [...prev, newFav]);
    // 保存到 AsyncStorage
    const existing = JSON.parse((await AsyncStorage.getItem('favorites')) || '[]');
    existing.push(newFav);
    await AsyncStorage.setItem('favorites', JSON.stringify(existing));
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
        <Text style={{ color: 'white' }}>加载中...</Text>
      </View>
    );
  }

  const current = photos[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← {label}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSortAsc(prev => !prev)}
        >
          <Text style={styles.sortText}>{sortAsc ? 'Oldest' : 'Newest'}</Text>
        </TouchableOpacity>
        {/* <Text style={styles.header}>{label}  {currentIndex + 1}/{totalCount || photos.length}</Text> */}
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowJump(true)}>
            <Text style={styles.header}>{currentIndex + 1}/{totalCount || photos.length} ✎</Text>
        </TouchableOpacity>
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
            <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => handleDelete(current)}>
              <Text style={styles.btnText}>🗑 删除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnFavorite]} onPress={() => handleFavorite(current)}>
                <Text style={styles.btnText}>⭐ 收藏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnKeep]} onPress={() => handleKeep(current)}>
              <Text style={styles.btnText}>✓ 保存</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.doneText}>🎉 全部处理完毕！</Text>
          <Text style={styles.doneSubText}>删除了 {deleted.length} 张</Text>
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
                        const [year, month] = (key as string).split('-').map(Number);
                        const start = new Date(year, month - 1, 1).getTime();
                        const end = new Date(year, month, 0, 23, 59, 59).getTime();
                        let all = [...photos];
                        while (all.length <= targetIndex && !allLoadedRef.current) {
                          const result = await MediaLibrary.getAssetsAsync({
                            mediaType: 'photo',
                            sortBy: [['creationTime', sortAsc]],
                            createdAfter: start,
                            createdBefore: end,
                            first: 30,
                            after: cursorRef.current,
                          });
                          cursorRef.current = result.endCursor;
                          allLoadedRef.current = !result.hasNextPage;
                          all = [...all, ...result.assets];
                        }
                        setPhotos(all);
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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  back: { color: '#007AFF', fontSize: 13 },
  sortBtn: { backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  sortText: { color: '#aaa', fontSize: 13 },
  header: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  trashBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  trashText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

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
  hintBadge: {
    position: 'absolute', top: 30,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8, borderWidth: 3,
  },
  hintLeft: { right: 20, borderColor: '#ff3b30', backgroundColor: 'rgba(255,59,48,0.8)' },
  hintRight: { left: 20, borderColor: '#34c759', backgroundColor: 'rgba(52,199,89,0.8)' },
  hintTop: { top: 20, alignSelf: 'center', left: '35%', borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.8)' },
  hintText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, padding: 30 },
  btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  btnDelete: { backgroundColor: '#ff3b30' },
  btnFavorite: { backgroundColor: '#FFD700' },
  btnKeep: { backgroundColor: '#34c759' },
  btnUndo: { backgroundColor: '#888' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
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