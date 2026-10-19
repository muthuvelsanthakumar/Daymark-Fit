import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { requireNativeModule } from 'expo';
import { getTodayStepTotal, setDailySteps } from './db';

export type StepStatus = 'starting' | 'tracking' | 'permission-denied' | 'unavailable' | 'error';
type Listener = (steps: number, status: StepStatus, lastUpdateMs: number) => void;
type NativeTracker = { isAvailable(): Promise<boolean>; hasPermission(): Promise<boolean>; start(): Promise<boolean>; getSnapshot(): Promise<{ day: string; steps: number; lastUpdate: number; tracking: boolean; sensor: string }> };
const listeners = new Set<Listener>();
let subscription: { remove: () => void } | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
let status: StepStatus = 'starting';
let todaySteps = 0;
let lastUpdateMs = 0;
let starting: Promise<void> | null = null;
const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function notify() { for (const listener of listeners) listener(todaySteps, status, lastUpdateMs); }
function nativeTracker(): NativeTracker | null {
  if (Platform.OS !== 'android') return null;
  try { return requireNativeModule<NativeTracker>('DaymarkStepTracker'); } catch { return null; }
}
export function subscribeSteps(listener: Listener) { listeners.add(listener); listener(todaySteps, status, lastUpdateMs); return () => { listeners.delete(listener); }; }
export function getStepTrackerSnapshot() { return { steps: todaySteps, status, lastUpdateMs }; }

async function syncNativeSnapshot(tracker: NativeTracker) {
  const snapshot = await tracker.getSnapshot();
  const today = dayKey();
  if (snapshot.day === today) {
    todaySteps = Math.max(0, Math.floor(snapshot.steps || 0));
    lastUpdateMs = Math.max(0, Number(snapshot.lastUpdate || 0));
    await setDailySteps(today, todaySteps);
    status = snapshot.tracking ? 'tracking' : (['unavailable', 'filtered_detector_unavailable'].includes(snapshot.sensor) ? 'unavailable' : 'starting');
  } else {
    todaySteps = await getTodayStepTotal(today);
  }
  notify();
}

export async function startStepTracking() {
  if (starting) return starting;
  starting = (async () => {
    try {
      const today = dayKey();
      todaySteps = await getTodayStepTotal(today);
      if (Platform.OS === 'android') {
        const tracker = nativeTracker();
        if (!tracker) { status = 'error'; notify(); return; }
        if (!(await tracker.isAvailable())) { status = 'unavailable'; notify(); return; }
        if (!(await tracker.hasPermission())) {
          Alert.alert('Enable automatic step tracking', 'Daymark Fit needs Physical activity permission to read your phone step sensor. Steps are stored locally; GPS and location are not used.', [{ text: 'Not now', style: 'cancel', onPress: () => { status = 'permission-denied'; notify(); } }, { text: 'Continue', onPress: () => { void (async () => { const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION, { title: 'Physical activity permission', message: 'Allow Daymark Fit to count steps using your phone motion sensor. No location is collected.', buttonPositive: 'Allow', buttonNegative: 'Not now' }); if (result !== PermissionsAndroid.RESULTS.GRANTED) { status = 'permission-denied'; notify(); return; } await startStepTracking(); })().catch(() => { status = 'error'; notify(); }); } }]);
          return;
        }
        await tracker.start();
        await syncNativeSnapshot(tracker);
        if (pollId) clearInterval(pollId);
        pollId = setInterval(() => { void syncNativeSnapshot(tracker).catch(() => { status = 'error'; notify(); }); }, 1000);
        return;
      }
      // iOS fallback: Expo Pedometer delivers updates only while the app is active.
      const available = await Pedometer.isAvailableAsync();
      if (!available) { status = 'unavailable'; notify(); return; }
      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) { status = 'permission-denied'; notify(); return; }
      status = 'tracking'; notify();
      subscription?.remove();
      subscription = Pedometer.watchStepCount(result => {
        todaySteps = Math.max(0, Math.floor(result.steps));
        lastUpdateMs = Date.now();
        void setDailySteps(dayKey(), todaySteps).then(notify).catch(() => { status = 'error'; notify(); });
      });
    } catch { status = 'error'; notify(); }
  })().finally(() => { starting = null; });
  return starting;
}
