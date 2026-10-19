import * as SQLite from 'expo-sqlite';

export type ActivityRecord = {
  id: string; type: 'run'|'walk'|'meditation'; startedAt: string; endedAt: string;
  durationSeconds: number; distanceMeters: number; calories: number;
  steps: number; routeJson: string; avgPaceSecondsPerKm: number | null;
};
export type DailyRecord = { day: string; steps: number; distanceMeters: number; activeSeconds: number; calories: number };
let database: SQLite.SQLiteDatabase | null = null;
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
  if (database) return database;
  if (!databasePromise) {
    databasePromise = (async () => {
      const opened = await SQLite.openDatabaseAsync('daymark-fit.db');
      await opened.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, startedAt TEXT NOT NULL,
        endedAt TEXT NOT NULL, durationSeconds INTEGER NOT NULL,
        distanceMeters REAL NOT NULL, calories REAL NOT NULL DEFAULT 0,
        steps INTEGER NOT NULL DEFAULT 0, routeJson TEXT NOT NULL DEFAULT '[]',
        avgPaceSecondsPerKm REAL
      );
      CREATE INDEX IF NOT EXISTS activities_startedAt_idx ON activities(startedAt);
      CREATE TABLE IF NOT EXISTS daily_totals (
        day TEXT PRIMARY KEY NOT NULL, steps INTEGER NOT NULL DEFAULT 0,
        distanceMeters REAL NOT NULL DEFAULT 0, activeSeconds INTEGER NOT NULL DEFAULT 0,
        calories REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS planner_tasks (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS active_route_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT, latitude REAL NOT NULL, longitude REAL NOT NULL,
        timestamp INTEGER NOT NULL, accuracy REAL, altitude REAL, speed REAL
      );
      CREATE INDEX IF NOT EXISTS active_route_points_timestamp_idx ON active_route_points(timestamp);
      `);
      database = opened;
      return opened;
    })().catch((error) => { databasePromise = null; database = null; throw error; });
  }
  return databasePromise!;
}
export async function saveActivity(a: ActivityRecord) {
  const db = await getDb();
  const day = a.startedAt.slice(0, 10);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO activities (id,type,startedAt,endedAt,durationSeconds,distanceMeters,calories,steps,routeJson,avgPaceSecondsPerKm)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      a.id, a.type, a.startedAt, a.endedAt, a.durationSeconds, a.distanceMeters, a.calories, a.steps, a.routeJson, a.avgPaceSecondsPerKm
    );
    // Rebuild this day's aggregate from source records. This avoids double-counting if an activity is replaced.
    const totals = await db.getFirstAsync<{ steps: number; distanceMeters: number; activeSeconds: number; calories: number }>(
      `SELECT COALESCE(SUM(steps),0) AS steps, COALESCE(SUM(distanceMeters),0) AS distanceMeters,
       COALESCE(SUM(durationSeconds),0) AS activeSeconds, COALESCE(SUM(calories),0) AS calories
       FROM activities WHERE substr(startedAt,1,10)=?`, day
    );
    // Preserve the all-day phone-sensor step total. Activity-session metrics update only
    // their own aggregate columns; workout steps must never overwrite sensor totals.
    await db.runAsync(
      `INSERT INTO daily_totals(day,steps,distanceMeters,activeSeconds,calories) VALUES(?,0,?,?,?)
       ON CONFLICT(day) DO UPDATE SET distanceMeters=excluded.distanceMeters, activeSeconds=excluded.activeSeconds, calories=excluded.calories`,
      day, totals?.distanceMeters ?? 0, totals?.activeSeconds ?? 0, totals?.calories ?? 0
    );
  });
}

export type StoredRoutePoint = { latitude: number; longitude: number; timestamp: number; accuracy: number | null; altitude: number | null; speed?: number | null };
export async function appendActiveRoutePoint(point: StoredRoutePoint) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO active_route_points(latitude,longitude,timestamp,accuracy,altitude,speed) VALUES(?,?,?,?,?,?)',
    point.latitude, point.longitude, point.timestamp, point.accuracy, point.altitude, point.speed ?? null
  );
}
export async function listActiveRoutePoints() {
  const db = await getDb();
  return db.getAllAsync<StoredRoutePoint>('SELECT latitude,longitude,timestamp,accuracy,altitude,speed FROM active_route_points ORDER BY timestamp ASC');
}
export async function getLastActiveRoutePoint() {
  const db = await getDb();
  return db.getFirstAsync<StoredRoutePoint>('SELECT latitude,longitude,timestamp,accuracy,altitude,speed FROM active_route_points ORDER BY id DESC LIMIT 1');
}
export async function clearActiveRoutePoints() {
  const db = await getDb();
  await db.runAsync('DELETE FROM active_route_points');
}

export async function listActivities(limit=100) {
  const db=await getDb();
  return db.getAllAsync<ActivityRecord>('SELECT * FROM activities ORDER BY startedAt DESC LIMIT ?',limit);
}
export async function getDailyTotals(startDay: string, endDay: string) {
  const db=await getDb();
  return db.getAllAsync<DailyRecord>('SELECT * FROM daily_totals WHERE day>=? AND day<=? ORDER BY day ASC',startDay,endDay);
}
export async function upsertTask(task:{id:string;title:string;detail:string;category:string;done:boolean;day:string}) {
  const db=await getDb();
  await db.runAsync('INSERT OR REPLACE INTO planner_tasks(id,title,detail,category,done,day) VALUES(?,?,?,?,?,?)',task.id,task.title,task.detail,task.category,task.done?1:0,task.day);
}
export async function listTasks(day:string) {
  const db=await getDb();
  return db.getAllAsync<{id:string;title:string;detail:string;category:string;done:number;day:string}>('SELECT * FROM planner_tasks WHERE day=? ORDER BY category,title',day);
}
export async function setPreference(key:string,value:string) {
 const db=await getDb(); await db.runAsync('INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?)',key,value);
}
export async function getPreference(key:string) {
 const db=await getDb(); const row=await db.getFirstAsync<{value:string}>('SELECT value FROM preferences WHERE key=?',key); return row?.value ?? null;
}
export async function exportData() {
 const db=await getDb();
 const activities=await db.getAllAsync<ActivityRecord>('SELECT * FROM activities ORDER BY startedAt');
 const totals=await db.getAllAsync<DailyRecord>('SELECT * FROM daily_totals ORDER BY day');
 const tasks=await db.getAllAsync('SELECT * FROM planner_tasks ORDER BY day');
 return {format:'daymark-fit-backup',version:1,exportedAt:new Date().toISOString(),activities,totals,tasks};
}


export type PlannerTaskRow = {id:string;title:string;detail:string;category:string;done:number;day:string};
export async function listTasksBetween(startDay:string,endDay:string) {
 const db=await getDb();
 return db.getAllAsync<PlannerTaskRow>('SELECT * FROM planner_tasks WHERE day>=? AND day<=? ORDER BY day ASC, category ASC, title ASC',startDay,endDay);
}
export async function deleteTask(id:string) {
 const db=await getDb(); await db.runAsync('DELETE FROM planner_tasks WHERE id=?',id);
}

export async function incrementDailySteps(day: string, delta: number) {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO daily_totals(day,steps,distanceMeters,activeSeconds,calories) VALUES(?,?,0,0,0)
     ON CONFLICT(day) DO UPDATE SET steps=steps+excluded.steps`,
    day, Math.floor(delta)
  );
}
export async function getTodayStepTotal(day: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{steps:number}>('SELECT steps FROM daily_totals WHERE day=?', day);
  return Math.max(0, row?.steps ?? 0);
}


export async function setDailySteps(day: string, steps: number) {
  const safeSteps = Math.max(0, Math.floor(Number.isFinite(steps) ? steps : 0));
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO daily_totals(day,steps,distanceMeters,activeSeconds,calories) VALUES(?,?,0,0,0)
     ON CONFLICT(day) DO UPDATE SET steps=excluded.steps`,
    day, safeSteps
  );
}
