import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { appendActiveRoutePoint, clearActiveRoutePoints, listActiveRoutePoints, type StoredRoutePoint } from './db';

export const GPS_TASK_NAME = 'DAYMARK_FIT_GPS_SESSION';
export type GpsStatus = 'idle' | 'tracking' | 'permission-denied' | 'unavailable' | 'error';
export type GpsSnapshot = { status: GpsStatus; distanceMeters: number; paceSecondsPerKm: number | null; points: StoredRoutePoint[]; accuracy: number | null };
let foregroundSubscription: Location.LocationSubscription | null = null;

function distanceBetween(a: StoredRoutePoint, b: StoredRoutePoint) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude), lat2 = rad(b.latitude);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}
export function calculateRouteDistance(points: StoredRoutePoint[]) {
  let total = 0;
  for (let i=1;i<points.length;i++) {
    const a=points[i-1], b=points[i];
    if ((a.accuracy ?? 999) > 35 || (b.accuracy ?? 999) > 35) continue;
    const d=distanceBetween(a,b);
    const dt=Math.max(1,(b.timestamp-a.timestamp)/1000);
    // Filter GPS jumps and stationary jitter; allow faster running while rejecting extreme GPS spikes.
    if (d >= 2.5 && d/dt <= 9.5) total += d;
  }
  return total;
}

if (!TaskManager.isTaskDefined(GPS_TASK_NAME)) {
  TaskManager.defineTask(GPS_TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    for (const loc of locations) {
      const c = loc.coords;
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
      try {
        await appendActiveRoutePoint({ latitude:c.latitude, longitude:c.longitude, timestamp:loc.timestamp, accuracy:c.accuracy, altitude:c.altitude, speed:c.speed });
      } catch { /* The next location can retry; never crash the task. */ }
    }
  });
}

export async function startGpsSession(clearRoute = true): Promise<GpsStatus> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const services = await Location.hasServicesEnabledAsync();
    if (!services) return 'unavailable';
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return 'permission-denied';
    // Background access is requested only after the user explicitly starts a GPS workout.
    let background = await Location.getBackgroundPermissionsAsync();
    if (background.status !== 'granted') background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
      // Foreground-only tracking is still useful when the user declines background access.
      if (clearRoute) await clearActiveRoutePoints();
      foregroundSubscription?.remove();
      foregroundSubscription = await Location.watchPositionAsync({ accuracy:Location.Accuracy.High, timeInterval:1000, distanceInterval:2 }, async loc => {
        const c=loc.coords;
        try { await appendActiveRoutePoint({latitude:c.latitude,longitude:c.longitude,timestamp:loc.timestamp,accuracy:c.accuracy,altitude:c.altitude,speed:c.speed}); } catch {}
      });
      return 'tracking';
    }
    if (clearRoute) await clearActiveRoutePoints();
    const running = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
    if (running) await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
    await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      distanceInterval: 2,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle:'Daymark Fit is recording your workout', notificationBody:'GPS distance and pace are being recorded for your active session.', killServiceOnDestroy:false },
    });
    return 'tracking';
  } catch { return 'error'; }
}
export async function stopGpsSession() {
  foregroundSubscription?.remove(); foregroundSubscription = null;
  try { if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME)) await Location.stopLocationUpdatesAsync(GPS_TASK_NAME); } catch {}
}
export async function getGpsSnapshot(elapsedSeconds = 0): Promise<GpsSnapshot> {
  try {
    const points = await listActiveRoutePoints();
    const distanceMeters = calculateRouteDistance(points);
    const accuracy = points.length ? points[points.length-1].accuracy : null;
    return { status:points.length?'tracking':'idle', distanceMeters, paceSecondsPerKm:distanceMeters>0 && elapsedSeconds>0 ? elapsedSeconds/(distanceMeters/1000) : null, points, accuracy };
  } catch { return {status:'error',distanceMeters:0,paceSecondsPerKm:null,points:[],accuracy:null}; }
}
