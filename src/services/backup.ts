import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportData, getDb } from './db';

const isObject = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

export async function exportBackup() {
  const data = await exportData();
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) throw new Error('Local file storage is unavailable on this device.');
  const uri = `${base}daymark-fit-backup-${new Date().toISOString().slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Daymark Fit backup' });
  return uri;
}

export async function importBackup() {
  const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json'], copyToCacheDirectory: true });
  if (pick.canceled || !pick.assets?.[0]?.uri) return { cancelled: true as const };
  let data: unknown;
  try { data = JSON.parse(await FileSystem.readAsStringAsync(pick.assets[0].uri)); }
  catch { throw new Error('The selected file is not valid JSON. No data was changed.'); }
  if (!isObject(data) || data.format !== 'daymark-fit-backup' || !Array.isArray(data.activities)) {
    throw new Error('This is not a supported Daymark Fit backup. No data was changed.');
  }

  // Validate the complete import before opening a write transaction.
  for (const [index, a] of data.activities.entries()) {
    if (!isObject(a) || typeof a.id !== 'string' || !['run', 'walk'].includes(a.type) ||
      typeof a.startedAt !== 'string' || typeof a.endedAt !== 'string' ||
      !finite(a.durationSeconds) || !finite(a.distanceMeters) || !finite(a.calories) || !finite(a.steps) || typeof a.routeJson !== 'string') {
      throw new Error(`Backup activity ${index + 1} has invalid fields. No data was changed.`);
    }
    try { if (!Array.isArray(JSON.parse(a.routeJson))) throw new Error(); }
    catch { throw new Error(`Backup activity ${index + 1} contains an invalid route. No data was changed.`); }
  }
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  for (const [index, t] of tasks.entries()) {
    if (!isObject(t) || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.day !== 'string' || typeof t.category !== 'string') {
      throw new Error(`Backup task ${index + 1} has invalid fields. No data was changed.`);
    }
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const a of data.activities) {
      await db.runAsync(
        'INSERT OR REPLACE INTO activities(id,type,startedAt,endedAt,durationSeconds,distanceMeters,calories,steps,routeJson,avgPaceSecondsPerKm) VALUES(?,?,?,?,?,?,?,?,?,?)',
        a.id, a.type, a.startedAt, a.endedAt, a.durationSeconds, a.distanceMeters, a.calories, a.steps, a.routeJson, finite(a.avgPaceSecondsPerKm) ? a.avgPaceSecondsPerKm : null
      );
    }
    for (const t of tasks) {
      await db.runAsync('INSERT OR REPLACE INTO planner_tasks(id,title,detail,category,done,day) VALUES(?,?,?,?,?,?)', t.id, t.title, typeof t.detail === 'string' ? t.detail : '', t.category, t.done ? 1 : 0, t.day);
    }
    // Recompute derived daily aggregates so a restored backup cannot leave stale totals behind.
    await db.runAsync('DELETE FROM daily_totals');
    await db.runAsync(`INSERT INTO daily_totals(day,steps,distanceMeters,activeSeconds,calories)
      SELECT substr(startedAt,1,10), COALESCE(SUM(steps),0), COALESCE(SUM(distanceMeters),0),
      COALESCE(SUM(durationSeconds),0), COALESCE(SUM(calories),0)
      FROM activities GROUP BY substr(startedAt,1,10)`);
  });
  return { cancelled: false as const, activities: data.activities.length };
}
