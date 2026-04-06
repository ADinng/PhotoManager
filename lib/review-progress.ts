import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEWED_ASSETS_KEY = 'reviewedAssetsByMonth';

export type ReviewedAssetsByMonth = Record<string, string[]>;
type AssetGroup = { id: string };

export function getMonthKeyForTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeReviewedAssets(raw: unknown): ReviewedAssetsByMonth {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const normalized: ReviewedAssetsByMonth = {};

  for (const [monthKey, assetIds] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(assetIds)) {
      continue;
    }

    normalized[monthKey] = Array.from(
      new Set(assetIds.filter((assetId): assetId is string => typeof assetId === 'string'))
    );
  }

  return normalized;
}

export async function loadReviewedAssetsMap(): Promise<ReviewedAssetsByMonth> {
  try {
    const stored = await AsyncStorage.getItem(REVIEWED_ASSETS_KEY);
    return normalizeReviewedAssets(stored ? JSON.parse(stored) : {});
  } catch {
    return {};
  }
}

export async function saveReviewedAssetsMap(reviewedAssets: ReviewedAssetsByMonth): Promise<void> {
  await AsyncStorage.setItem(REVIEWED_ASSETS_KEY, JSON.stringify(reviewedAssets));
}

export async function markAssetReviewed(monthKey: string, assetId: string): Promise<boolean> {
  const reviewedAssets = await loadReviewedAssetsMap();
  const monthAssetIds = new Set(reviewedAssets[monthKey] ?? []);

  if (monthAssetIds.has(assetId)) {
    return false;
  }

  monthAssetIds.add(assetId);
  reviewedAssets[monthKey] = Array.from(monthAssetIds);
  await saveReviewedAssetsMap(reviewedAssets);
  return true;
}

export async function unmarkAssetReviewed(monthKey: string, assetId: string): Promise<boolean> {
  const reviewedAssets = await loadReviewedAssetsMap();
  const monthAssetIds = new Set(reviewedAssets[monthKey] ?? []);

  if (!monthAssetIds.delete(assetId)) {
    return false;
  }

  if (monthAssetIds.size === 0) {
    delete reviewedAssets[monthKey];
  } else {
    reviewedAssets[monthKey] = Array.from(monthAssetIds);
  }

  await saveReviewedAssetsMap(reviewedAssets);
  return true;
}

export async function getReviewedCountsForGroups(
  groups: Record<string, AssetGroup[]>
): Promise<Record<string, number>> {
  const reviewedAssets = await loadReviewedAssetsMap();
  const counts: Record<string, number> = {};

  for (const [monthKey, assets] of Object.entries(groups)) {
    const monthAssetIds = new Set(reviewedAssets[monthKey] ?? []);
    counts[monthKey] = assets.reduce((count, asset) => count + (monthAssetIds.has(asset.id) ? 1 : 0), 0);
  }

  return counts;
}
