import type { ActivityRecord } from './db';

export type VerificationStatus = 'Verified' | 'Needs Review' | 'Low Confidence';
export type ActivityVerification = {
  status: VerificationStatus;
  reasons: string[];
  routePointCount: number;
  paceSecondsPerKm: number | null;
  averageSpeedMps: number | null;
};

/** Conservative consistency checks only. This cannot prove that a workout was genuine. */
export function verifyActivity(activity: Pick<ActivityRecord,
  'type' | 'durationSeconds' | 'distanceMeters' | 'steps' | 'routeJson' | 'avgPaceSecondsPerKm'>): ActivityVerification {
  const duration = Number(activity.durationSeconds);
  const distance = Number(activity.distanceMeters);
  const steps = Number(activity.steps);
  let routePointCount = 0;
  try {
    const parsed: unknown = JSON.parse(activity.routeJson || '[]');
    routePointCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch { routePointCount = 0; }

  const reasons: string[] = [];
  const pace = distance > 0 && duration > 0 ? duration / (distance / 1000) : null;
  const speed = duration > 0 && distance > 0 ? distance / duration : null;
  if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(distance) || distance < 0 || !Number.isFinite(steps) || steps < 0) {
    reasons.push('Invalid or negative metrics');
  }
  if (duration < 60 && activity.type !== 'meditation') reasons.push('Workout shorter than 60 seconds');
  // Flag only extreme values; do not reject fast runners based on a low speed ceiling.
  if (activity.type !== 'meditation' && speed !== null && speed > 9.5) reasons.push('Average speed is unusually high');
  if (activity.type !== 'meditation' && distance > 0 && pace !== null && pace < 105) reasons.push('Pace is unusually fast');
  if (activity.type !== 'meditation' && distance > 0 && duration > 0 && routePointCount < 2) reasons.push('Insufficient route points to corroborate GPS distance');
  if (activity.type !== 'meditation' && distance === 0 && routePointCount < 2) reasons.push('No GPS distance or route evidence');
  if (activity.type === 'run' && steps > 0 && distance > 0 && steps / (distance / 1000) > 3000) reasons.push('Step count is unusually high for distance');

  const status: VerificationStatus = reasons.some(r => r.includes('Invalid') || r.includes('unusually'))
    ? 'Needs Review'
    : reasons.length > 0 ? 'Low Confidence' : 'Verified';
  return { status, reasons, routePointCount, paceSecondsPerKm: pace, averageSpeedMps: speed };
}
