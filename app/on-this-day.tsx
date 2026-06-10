import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '@/lib/theme';

type OnThisDayGroup = {
  year: number;
  count: number;
  start: number;
  end: number;
  label: string;
};

const ON_THIS_DAY_CACHE_KEY = 'onThisDayCache_v1';

function formatDateLabel(date: Date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function getCacheKey(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isValidDateForYear(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day;
}

function getDayRange(year: number, monthIndex: number, day: number) {
  const start = new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
  const end = new Date(year, monthIndex, day, 23, 59, 59, 999).getTime();
  return { start, end };
}

function parseYearsParam(yearsParam: string | string[] | undefined) {
  const raw = Array.isArray(yearsParam) ? yearsParam[0] : yearsParam;
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map(value => Number(value))
    .filter(value => Number.isFinite(value))
    .sort((a, b) => b - a);
}

export default function OnThisDayScreen() {
  const router = useRouter();
  const { years: yearsParam } = useLocalSearchParams();
  const availableYears = useMemo(() => parseYearsParam(yearsParam), [yearsParam]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [groups, setGroups] = useState<OnThisDayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const readCachedGroups = useCallback(async (date: Date) => {
    try {
      const stored = await AsyncStorage.getItem(ON_THIS_DAY_CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      return Array.isArray(cache[getCacheKey(date)]) ? cache[getCacheKey(date)] as OnThisDayGroup[] : null;
    } catch {
      return null;
    }
  }, []);

  const writeCachedGroups = useCallback(async (date: Date, nextGroups: OnThisDayGroup[]) => {
    try {
      const stored = await AsyncStorage.getItem(ON_THIS_DAY_CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      cache[getCacheKey(date)] = nextGroups;
      await AsyncStorage.setItem(ON_THIS_DAY_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }, []);

  const queryGroups = useCallback(async (date: Date) => {
    const monthIndex = date.getMonth();
    const day = date.getDate();
    const nextGroups: OnThisDayGroup[] = [];

    for (const year of availableYears) {
      if (!isValidDateForYear(year, monthIndex, day)) {
        continue;
      }

      const { start, end } = getDayRange(year, monthIndex, day);
      let count = 0;
      let hasMore = true;
      let after: string | null = null;

      while (hasMore) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          sortBy: [['creationTime', false]],
          createdAfter: start,
          createdBefore: end,
          first: 100,
          after,
        });

        count += result.assets.length;
        hasMore = result.hasNextPage;
        after = result.endCursor;
      }

      if (count > 0) {
        nextGroups.push({
          year,
          count,
          start,
          end,
          label: `${year}/${monthIndex + 1}/${day}`,
        });
      }
    }

    return nextGroups;
  }, [availableYears]);

  const loadGroups = useCallback(async (date: Date) => {
    setLoading(true);

    const cached = await readCachedGroups(date);
    if (cached) {
      setGroups(cached);
      setLoading(false);
      setRefreshing(true);
    }

    const nextGroups = await queryGroups(date);
    setGroups(nextGroups);
    await writeCachedGroups(date, nextGroups);
    setLoading(false);
    setRefreshing(false);
  }, [queryGroups, readCachedGroups, writeCachedGroups]);

  useEffect(() => {
    void loadGroups(selectedDate);
  }, [loadGroups, selectedDate]);

  function shiftDate(days: number) {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + days);
      return next;
    });
  }

  function jumpToToday() {
    setSelectedDate(new Date());
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.header}>当年今日</Text>
          <Text style={styles.headerSub}>翻翻同一天留下来的回忆</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={jumpToToday}>
          <Text style={styles.todayText}>今天</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftDate(-1)}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>{formatDateLabel(selectedDate)}</Text>
          {refreshing ? <Text style={styles.refreshText}>正在刷新缓存...</Text> : null}
        </View>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftDate(1)}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {!loading ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{formatDateLabel(selectedDate)}</Text>
          <Text style={styles.summarySub}>
            {groups.length === 0 ? '这一天暂时没有找到可回看的照片' : `一共找到了 ${groups.length} 个年份分组`}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>正在查找这一天的回忆...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{formatDateLabel(selectedDate)} 没有找到照片</Text>
          <Text style={styles.emptySubText}>试试切换前后一天，或者点右上角回到今天</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {groups.map(group => (
            <TouchableOpacity
              key={`${group.year}-${group.start}`}
              style={styles.groupCard}
              onPress={() =>
                router.push({
                  pathname: '/month',
                  params: {
                    label: group.label,
                    start: String(group.start),
                    end: String(group.end),
                  },
                })
              }
            >
              <View>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupCount}>{group.count} 张 · 点进去继续整理</Text>
              </View>
              <Text style={styles.groupArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 56, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16 },
  headerBtn: { backgroundColor: theme.colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  back: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
  todayText: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
  headerCenter: { flex: 1 },
  header: { color: theme.colors.text, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { color: theme.colors.accentDeep, fontSize: 28, lineHeight: 30 },
  dateCenter: { alignItems: 'center', flex: 1 },
  dateText: { color: theme.colors.text, fontSize: 24, fontWeight: 'bold' },
  refreshText: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  summaryCard: { backgroundColor: theme.colors.darkSurface, borderRadius: 20, padding: 18, marginBottom: 16 },
  summaryTitle: { color: theme.colors.darkText, fontSize: 18, fontWeight: '700' },
  summarySub: { color: theme.colors.darkMuted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: theme.colors.muted, fontSize: 15 },
  emptyText: { color: theme.colors.text, fontSize: 20, fontWeight: 'bold' },
  emptySubText: { color: theme.colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  list: { flex: 1 },
  listContent: { gap: 12, paddingBottom: 20 },
  groupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },
  groupTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  groupCount: { color: theme.colors.muted, fontSize: 14, marginTop: 4 },
  groupArrow: { color: theme.colors.accent, fontSize: 24, fontWeight: 'bold' },
});
