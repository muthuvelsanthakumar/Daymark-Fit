package com.daymark.steps

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DaymarkStepTrackerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DaymarkStepTracker")

    AsyncFunction("isAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.getSystemService(Context.SENSOR_SERVICE)?.let { service ->
        val manager = service as android.hardware.SensorManager
        manager.getDefaultSensor(android.hardware.Sensor.TYPE_STEP_COUNTER) != null ||
          manager.getDefaultSensor(android.hardware.Sensor.TYPE_STEP_DETECTOR) != null
      } ?: false
    }

    AsyncFunction("hasPermission") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("start") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Activity recognition permission is required")
      }
      val intent = Intent(context, DaymarkStepService::class.java).setAction(DaymarkStepService.ACTION_START)
      ContextCompat.startForegroundService(context, intent)
      true
    }

    AsyncFunction("getSnapshot") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val prefs = context.getSharedPreferences(DaymarkStepService.PREFS, Context.MODE_PRIVATE)
      val today = DaymarkStepService.todayKey()
      mapOf(
        "day" to today,
        "steps" to prefs.getInt("steps_$today", 0),
        "lastUpdate" to prefs.getLong("last_update", 0L),
        "tracking" to prefs.getBoolean("tracking", false),
        "sensor" to prefs.getString("sensor", "unknown")
      )
    }
  }
}
