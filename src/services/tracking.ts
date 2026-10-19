import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { setPreference, appendActiveRoutePoint, getLastActiveRoutePoint, clearActiveRoutePoints } from './db';

export type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
  altitude: number | null;
  speed?: number | null;
};
export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike' | 'meditation';
export type TrackingSession = {
  startedAt: string;
  startedMs: number;
  points: RoutePoint[];
  stepStart: number;
  steps: number;
  type: ActivityType;
  paused: boolean;
  subscription?: Location.LocationSubscription;
  pedometerSub?: { remove: () => void };
};

const BACKGROUND_TASK = 'DAYMARK_FIT_BACKGROUND_LOCATION';
const MAX_ACCURACY_METERS = 50;
let session: TrackingSession | null = null;
let pendingPointWrites: Promise<void> = Promise.resolve();

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371000, toRad = (v: number) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isUsablePoint(point: RoutePoint, previous?: RoutePoint | null) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  if (point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) return false;
  if (point.accuracy != null && point.accuracy > MAX_ACCURACY_METERS) return false;
  if (!previous) return true;
  const dt = point.timestamp - previous.timestamp;
  if (dt < 800) return false;
  const meters = haversine(previous.latitude, previous.longitude, point.latitude, point.longitude);
  if (meters < 2) return false;
  // Reject implausible GPS jumps while allowing fast running; do not treat speed alone as activity proof.
  const speed = meters / (dt / 1000);
  if (dt > 0 && speed > 9.5) return false;
  return true;
}

async function persistPoint(point: RoutePoint) {
  // Append-only SQLite journal: each accepted point is one small durable write, not a rewrite
  // of the entire route on every GPS callback.
  const previous = await getLastActiveRoutePoint();
  if (previous && Math.abs(previous.timestamp - point.timestamp) < 1000 && haversine(previous.latitude, previous.longitude, point.latitude, point.longitude) < 3) return;
  await appendActiveRoutePoint(point);
}

if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
    try {
      const last = await getLastActiveRoutePoint();
      let previous: RoutePoint | undefined = last ?? undefined;
      for (const loc of locations) {
        const c = loc.coords;
        const point: RoutePoint = { latitude: c.latitude, longitude: c.longitude, timestamp: loc.timestamp, accuracy: c.accuracy, altitude: c.altitude, speed: c.speed };
        if (isUsablePoint(point, previous)) {
          await appendActiveRoutePoint(point);
          previous = point;
        }
      }
    } catch (e) {
      // The foreground UI reports status; task errors must not crash the app process.
    }
  });
}

export async function isPedometerAvailable() {
  try { return await Pedometer.isAvailableAsync(); } catch { return false; }
}
export async function getStepPermission() {
  try { const p = await Pedometer.requestPermissionsAsync(); return p.granted; } catch { return Platform.OS === 'ios'; }
}

async function startLocationSubscription(target: TrackingSession, onPoint: (p: RoutePoint) => void) {
  target.subscription = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 3,
    mayShowUserSettingsDialog: true,
  }, loc => {
    if (!session || session !== target || target.paused) return;
    const c = loc.coords;
    const point: RoutePoint = { latitude: c.latitude, longitude: c.longitude, timestamp: loc.timestamp, accuracy: c.accuracy, altitude: c.altitude, speed: c.speed };
    const previous = target.points[target.points.length - 1];
    if (!isUsablePoint(point, previous)) return;
    target.points.push(point);
    onPoint(point);
    // Persist asynchronously per accepted point. This is intentionally independent of network.
    pendingPointWrites = pendingPointWrites.then(() => persistPoint(point)).catch(() => undefined);
  });
}

async function startBackgroundLocationIfAllowed() {
  try {
    const permission = await Location.getBackgroundPermissionsAsync();
    if (!permission.granted) return;
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) return;
    await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 4,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Daymark Fit is recording',
        notificationBody: 'Your route is being saved on this device.',
        notificationColor: '#8BE0B2',
      },
    });
  } catch { /* Device policy / permission may prevent background updates. */ }
}

export async function startTracking(type: ActivityType, onPoint: (p: RoutePoint) => void, onSteps: (steps: number) => void) {
  if (session) throw new Error('A workout is already active. Resume or finish it before starting another.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission is required to record a GPS route.');
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new Error('Turn on device Location services and try again.');

  let stepStart = 0;
  const available = await isPedometerAvailable();
  if (available) {
    try {
      const granted = await getStepPermission();
      if (granted) {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        stepStart = (await Pedometer.getStepCountAsync(midnight, now)).steps;
      }
    } catch { /* Step counting is optional; GPS workout recording can still start. */ }
  }

  const startedAt = new Date().toISOString();
  session = { startedAt, startedMs: Date.now(), points: [], stepStart, steps: 0, type, paused: false };
  await clearActiveRoutePoints();
  await setPreference('activeWorkout', JSON.stringify({ startedAt, type, paused: false }));
  try {
    await startLocationSubscription(session, onPoint);
  } catch (e) {
    session = null;
    await setPreference('activeWorkout', '');
    throw e;
  }

  // Ask only after the user starts an activity; background access is optional and OS-dependent.
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.granted) await startBackgroundLocationIfAllowed();
  } catch { /* Do not fail foreground tracking if background permission is denied. */ }

  if (available) {
    try {
      session.pedometerSub = Pedometer.watchStepCount(result => {
        if (!session || session.paused) return;
        session.steps = Math.max(0, result.steps);
        onSteps(session.steps);
      });
    } catch { /* Sensor unavailable on this device. */ }
  }
  return session;
}

export async function pauseTracking() {
  if (!session || session.paused) return;
  session.paused = true;
  session.subscription?.remove(); session.subscription = undefined;
  session.pedometerSub?.remove(); session.pedometerSub = undefined;
  try { if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) await Location.stopLocationUpdatesAsync(BACKGROUND_TASK); } catch {}
  await setPreference('activeWorkout', JSON.stringify({ startedAt: session.startedAt, type: session.type, paused: true }));
}

export async function resumeTracking(onPoint: (p: RoutePoint) => void, onSteps: (steps: number) => void) {
  if (!session || !session.paused) return;
  session.paused = false;
  await startLocationSubscription(session, onPoint);
  await startBackgroundLocationIfAllowed();
  if (await isPedometerAvailable()) {
    try { session.pedometerSub = Pedometer.watchStepCount(result => { if (session && !session.paused) { session.steps = Math.max(0, result.steps); onSteps(session.steps); } }); } catch {}
  }
  await setPreference('activeWorkout', JSON.stringify({ startedAt: session.startedAt, type: session.type, paused: false }));
}

export function currentSession() { return session; }
export async function flushPendingRouteWrites() { await pendingPointWrites; }
export async function stopTracking() {
  if (session?.subscription) session.subscription.remove();
  if (session?.pedometerSub) session.pedometerSub.remove();
  try { if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) await Location.stopLocationUpdatesAsync(BACKGROUND_TASK); } catch {}
  const old = session;
  session = null;
  // Keep the recovery marker until the caller has successfully saved or explicitly discarded the route.
  return old;
}

export function routeDistance(points: RoutePoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dt = (b.timestamp - a.timestamp) / 1000;
    // Do not bridge long GPS outages or implausible jumps. They are gaps, not known distance.
    if (dt <= 0 || dt > 30) continue;
    const meters = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
    if (meters / dt > 12 || meters < 2) continue;
    total += meters;
  }
  return total;
}

export function estimateCalories(type: ActivityType, distanceMeters: number, weightKg = 69) {
  const km = Math.max(0, distanceMeters / 1000);
  const factor = type === 'run' ? 1 : type === 'cycle' ? 0.45 : type === 'hike' ? 0.72 : type === 'meditation' ? 0 : 0.5;
  return Math.round(km * weightKg * factor);
}
