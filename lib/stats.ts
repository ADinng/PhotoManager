import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_STATS_KEY = 'storageStats_v1';

export type StorageStats = {
  deletedCount: number;
  savedBytes: number;
};

const DEFAULT_STATS: StorageStats = {
  deletedCount: 0,
  savedBytes: 0,
};

export async function loadStorageStats(): Promise<StorageStats> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_STATS_KEY);
    if (!stored) {
      return DEFAULT_STATS;
    }

    const parsed = JSON.parse(stored);
    return {
      deletedCount: typeof parsed.deletedCount === 'number' ? parsed.deletedCount : 0,
      savedBytes: typeof parsed.savedBytes === 'number' ? parsed.savedBytes : 0,
    };
  } catch {
    return DEFAULT_STATS;
  }
}

export async function saveStorageStats(stats: StorageStats): Promise<void> {
  await AsyncStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
}

export async function recordDeletedAssets(count: number, bytes: number): Promise<void> {
  const current = await loadStorageStats();
  await saveStorageStats({
    deletedCount: current.deletedCount + count,
    savedBytes: current.savedBytes + bytes,
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
