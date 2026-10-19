import React from 'react';
import { useRouter } from 'expo-router';
import RunTrackerScreen from '../src/screens/RunTrackerScreen';
import { saveActivity } from '../src/services/db';

export default function RunTrackerRoute() {
  const router = useRouter();
  return <RunTrackerScreen onSaveWorkout={async workout => {
    const durationSeconds = Math.max(0, Math.round((workout.endedAt - workout.startedAt) / 1000));
    const startedAt = new Date(workout.startedAt).toISOString();
    const endedAt = new Date(workout.endedAt).toISOString();
    const distanceMeters = Math.max(0, workout.distanceMeters);
    await saveActivity({
      id: `run-${workout.startedAt}`,
      type: 'run',
      startedAt,
      endedAt,
      durationSeconds,
      distanceMeters,
      calories: Math.round((durationSeconds / 60) * 9),
      steps: 0,
      routeJson: JSON.stringify(workout.points),
      avgPaceSecondsPerKm: distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000) : null,
    });
    router.back();
  }} />;
}
