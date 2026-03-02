import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

function SwipeablePhoto({ asset, onDelete, onKeep }) {
  const [uri, setUri] = useState(null);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateX.value = 0;
    rotate.value = 0;
    opacity.value = 1;
    MediaLibrary.getAssetInfoAsync(asset).then(info => {
      setUri(info.localUri || info.uri);
    });
  }, [asset.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
    //   { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -30 ? Math.min((-translateX.value - 30) / 50, 1) : 0,
  }));

  const keepHintStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 30 ? Math.min((translateX.value - 30) / 50, 1) : 0,
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    //   rotate.value = e.translationX / 15;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        // translateX.value = withSpring(-SW * 1.5);
        // opacity.value = withSpring(0);
        // 左滑
        translateX.value = withTiming(-SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onDelete)(asset);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        // translateX.value = withSpring(SW * 1.5);
        // opacity.value = withSpring(0);
        // 右滑
        translateX.value = withTiming(SW * 1.5, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
        runOnJS(onKeep)(asset);
      } else {
        //弹回
        // translateX.value = withSpring(0);
        // rotate.value = withSpring(0);
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
        {/* 左滑删除提示 */}
        <Animated.View style={[styles.hintBadge, styles.hintLeft, deleteHintStyle]}>
          <Text style={styles.hintText}>🗑 删除</Text>
        </Animated.View>
        {/* 右滑保存提示 */}
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
  const [deleted, setDeleted] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthPhotos();
  }, []);

  async function loadMonthPhotos() {
    const [year, month] = (key as string).split('-').map(Number);
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();

    let all = [];
    let hasMore = true;
    let after = null;

    while (hasMore) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
        createdAfter: start,
        createdBefore: end,
        first: 100,
        after,
      });
      all = [...all, ...result.assets];
      hasMore = result.hasNextPage;
      after = result.endCursor;
    }

    setPhotos(all);
    setLoading(false);

    const existing = JSON.parse((await AsyncStorage.getItem('reviewedData')) || '{}');
    existing[key as string] = all.length; // 直接记录总数，不累加
    await AsyncStorage.setItem('reviewedData', JSON.stringify(existing));
  }

  function handleDelete(asset) {
    setDeleted(prev => [...prev, asset]);
    setCurrentIndex(prev => prev + 1);
  }

  function handleKeep(asset) {
    setCurrentIndex(prev => prev + 1);
  }

  function handleUndo() {
    if (currentIndex === 0) return;
    // 如果上一张在deleted里，从deleted移除
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
  const progress = `${currentIndex + 1} / ${photos.length}`;

  return (
    <View style={styles.container}>
      {/* 顶部栏 */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        {/* <Text style={styles.header}>{label}</Text> */}
        <Text style={styles.header}>{label}  {currentIndex + 1}/{photos.length}</Text>
        {deleted.length > 0 && (
        //   <View style={styles.trashBtn}>
        //     <Text style={styles.trashText}>🗑 {deleted.length}</Text>
        //   </View>
            <TouchableOpacity
            style={styles.trashBtn}
            onPress={() => router.push({ pathname: '/trash', params: { ids: JSON.stringify(deleted.map(d => d.id)) } })}
            >
            <Text style={styles.trashText}>🗑 {deleted.length}</Text>
            </TouchableOpacity>
        )}
      </View>

      {/* 主体 */}
      {current ? (
        <>
          <Text style={styles.progress}>{progress}</Text>
          <View style={styles.cardArea}>
            <SwipeablePhoto
              key={current.id}
              asset={current}
              onDelete={handleDelete}
              onKeep={handleKeep}
            />
          </View>
          {/* 底部按钮 */}
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
        // 全部处理完了
        <View style={styles.center}>
          <Text style={styles.doneText}>🎉 全部处理完毕！</Text>
          <Text style={styles.doneSubText}>删除了 {deleted.length} 张</Text>
          {deleted.length > 0 && (
            // <TouchableOpacity style={styles.confirmBtn}>
            //   <Text style={styles.confirmText}>确认删除</Text>
            // </TouchableOpacity>
            <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => router.push({ pathname: '/trash', params: { ids: JSON.stringify(deleted.map(d => d.id)) } })}
                >
                <Text style={styles.confirmText}>确认删除 ({deleted.length}张)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#555', marginTop: 12 }]} onPress={() => router.back()}>
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
  progress: { color: '#888', textAlign: 'center', marginBottom: 8, display: 'none' },
  cardArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: SW - 80, height: SH * 0.7,
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
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  doneText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  doneSubText: { color: '#888', fontSize: 16 },
  confirmBtn: { backgroundColor: '#ff3b30', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  confirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  btnUndo: { backgroundColor: '#888' },
});