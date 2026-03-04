import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

function SwipeablePhoto({ asset, onDelete, onKeep }) {
  const [uri, setUri] = useState(null);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -30 ? Math.min((-translateX.value - 30) / 50, 1) : 0,
  }));

  const keepHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 30 ? Math.min((translateX.value - 30) / 50, 1) : 0,
  }));

  useEffect(() => {
    translateX.value = 0;
    opacity.value = 1;
    MediaLibrary.getAssetInfoAsync(asset).then(info => {
      setUri(info.localUri || info.uri);
    });
  }, [asset.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onDelete)(asset);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onKeep)(asset);
      } else {
        translateX.value = withSpring(0, { damping: 15 });
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
  const cursorRef = useRef<string | null>(null);           
  const allLoadedRef = useRef(false);    

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

  // 每次deleted变化自动保存
  useEffect(() => {
    if (deleted.length > 0) {
      AsyncStorage.setItem('pendingDelete', JSON.stringify(deleted));
    }
  }, [deleted]);

  // 快用完时自动加载更多
  useEffect(() => {
    if (!allLoadedRef.current && photos.length - currentIndex < 10) {
      loadMore();
    }
  }, [currentIndex]);
  
//   async function loadMonthPhotos() {
//     const [year, month] = (key as string).split('-').map(Number);
//     const start = new Date(year, month - 1, 1).getTime();
//     const end = new Date(year, month, 0, 23, 59, 59).getTime();

//     let all = [];
//     let hasMore = true;
//     let after = null;

//     while (hasMore) {
//       const result = await MediaLibrary.getAssetsAsync({
//         mediaType: 'photo',
//         sortBy: [['creationTime', false]],
//         createdAfter: start,
//         createdBefore: end,
//         first: 100,
//         after,
//       });
//       all = [...all, ...result.assets];
//       hasMore = result.hasNextPage;
//       after = result.endCursor;
//     }

//     setPhotos(all);
//     setLoading(false);

//     // 记录进度
//     const existing = JSON.parse((await AsyncStorage.getItem('reviewedData')) || '{}');
//     existing[key as string] = all.length;
//     await AsyncStorage.setItem('reviewedData', JSON.stringify(existing));
//   }

  async function loadMonthPhotos() {
    const [year, month] = (key as string).split('-').map(Number);
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();

    const result = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      sortBy: [['creationTime', false]],
      createdAfter: start,
      createdBefore: end,
      first: 30,
    });

    cursorRef.current = result.endCursor;
    allLoadedRef.current = !result.hasNextPage;
    setPhotos(result.assets);
    setLoading(false);

    // 后台统计总数
    let count = result.assets.length;
    let hasMore = result.hasNextPage;
    let after = result.endCursor;
    while (hasMore) {
      const r = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
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
      sortBy: [['creationTime', false]],
      createdAfter: start,
      createdBefore: end,
      first: 30,
      after: cursorRef.current,
    });

    cursorRef.current = result.endCursor;
    allLoadedRef.current = !result.hasNextPage;
    setPhotos(prev => [...prev, ...result.assets]);
  }

  async function handleDelete(asset) {
    const info = await MediaLibrary.getAssetInfoAsync(asset);
    const uri = info.localUri || info.uri;
    setDeleted(prev => [...prev, { id: asset.id, uri }]);
    setCurrentIndex(prev => prev + 1);
  }

  function handleKeep(asset) {
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
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        {/* <Text style={styles.header}>{label}  {Math.min(currentIndex + 1, photos.length)}/{photos.length}</Text> */}
        <Text style={styles.header}>{label}  {currentIndex + 1}/{totalCount || photos.length}</Text>
        {deleted.length > 0 && (
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={async () => {
              await AsyncStorage.setItem('pendingDelete', JSON.stringify(deleted));
              router.push('/trash');
            }}
          >
            <Text style={styles.trashText}>🗑 {deleted.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      {current ? (
        <>
          <View style={styles.cardArea}>
            <SwipeablePhoto
              key={current.id}
              asset={current}
              onDelete={handleDelete}
              onKeep={handleKeep}
            />
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnUndo]} onPress={handleUndo}>
              <Text style={styles.btnText}>↩ 返回</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => handleDelete(current)}>
              <Text style={styles.btnText}>🗑 删除</Text>
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
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  back: { color: '#007AFF', fontSize: 16 },
  header: { color: 'white', fontSize: 16, fontWeight: 'bold', flex: 1 },
  trashBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  trashText: { color: 'white', fontWeight: 'bold' },
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
  hintText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, padding: 30 },
  btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  btnDelete: { backgroundColor: '#ff3b30' },
  btnKeep: { backgroundColor: '#34c759' },
  btnUndo: { backgroundColor: '#888' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  doneText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  doneSubText: { color: '#888', fontSize: 16 },
  confirmBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  confirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});