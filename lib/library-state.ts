import AsyncStorage from '@react-native-async-storage/async-storage';

export type AssetRef = {
  id: string;
  uri: string;
};

const FAVORITES_KEY = 'favorites';
const PENDING_DELETE_KEY = 'pendingDelete';

function dedupeAssets(items: AssetRef[]): AssetRef[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export async function loadFavorites(): Promise<AssetRef[]> {
  const stored = await AsyncStorage.getItem(FAVORITES_KEY);
  return stored ? dedupeAssets(JSON.parse(stored)) : [];
}

export async function saveFavorites(items: AssetRef[]): Promise<void> {
  const deduped = dedupeAssets(items);
  if (deduped.length === 0) {
    await AsyncStorage.removeItem(FAVORITES_KEY);
    return;
  }
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(deduped));
}

export async function loadPendingDelete(): Promise<AssetRef[]> {
  const stored = await AsyncStorage.getItem(PENDING_DELETE_KEY);
  return stored ? dedupeAssets(JSON.parse(stored)) : [];
}

export async function savePendingDelete(items: AssetRef[]): Promise<void> {
  const deduped = dedupeAssets(items);
  if (deduped.length === 0) {
    await AsyncStorage.removeItem(PENDING_DELETE_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(deduped));
}
