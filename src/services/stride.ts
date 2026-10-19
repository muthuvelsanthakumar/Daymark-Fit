import { getPreference } from './db';

/** User-configured height-based estimate. This is an estimate, not a measured stride. */
export function strideMetersForHeight(heightCm: number | null | undefined): number {
  const h = Number(heightCm);
  if (!Number.isFinite(h) || h <= 0) return 0.65;
  if (h < 150) return 0.55;
  if (h < 165) return 0.60;
  if (h < 170) return 0.65; // 165 cm reference estimate
  if (h < 180) return 0.70; // 175 cm reference estimate
  return 0.80; // 180 cm+ reference estimate
}

export async function getSavedStrideMeters(): Promise<number> {
  const raw = await getPreference('heightCm');
  return strideMetersForHeight(raw ? Number(raw) : null);
}
