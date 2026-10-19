package com.daymark.steps

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.ArrayDeque
import kotlin.math.sqrt

class DaymarkStepService : Service(), SensorEventListener {
  companion object {
    const val ACTION_START = "com.daymark.steps.START"
    const val PREFS = "daymark_step_tracker"
    private const val CHANNEL_ID = "daymark_steps"
    private const val NOTIFICATION_ID = 4917
    fun todayKey(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
  }

  private lateinit var sensorManager: SensorManager
  private var stepDetector: Sensor? = null
  private var accelerometer: Sensor? = null
  private var lastAcceptedDetectorAt = 0L
  private val accelMagnitudes = ArrayDeque<Pair<Long, Float>>()
  private val prefs by lazy { getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    createChannel()
    startForeground(NOTIFICATION_ID, buildNotification(0))
    registerSensor()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_START) {
      prefs.edit().putBoolean("tracking", true).apply()
      registerSensor()
    }
    return START_STICKY
  }

  private fun registerSensor() {
    sensorManager.unregisterListener(this)
    accelMagnitudes.clear()
    // Prefer per-step detector events so each event can be checked against motion cadence.
    // The cumulative hardware counter cannot be filtered step-by-step.
    val detector = stepDetector
    if (detector != null && accelerometer != null) {
      prefs.edit().putString("sensor", "TYPE_STEP_DETECTOR_MOTION_FILTERED").apply()
      sensorManager.registerListener(this, detector, SensorManager.SENSOR_DELAY_UI)
      sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI)
    } else {
      // Do not silently fall back to an unfiltered cumulative counter: that would reintroduce
      // the vehicle false-positive problem this filter is designed to reduce.
      prefs.edit().putString("sensor", "filtered_detector_unavailable").putBoolean("tracking", false).apply()
      stopSelf()
    }
  }

  private fun motionVariation(nowNanos: Long): Float {
    val cutoff = nowNanos - 1_500_000_000L
    while (accelMagnitudes.isNotEmpty() && accelMagnitudes.peekFirst().first < cutoff) accelMagnitudes.removeFirst()
    if (accelMagnitudes.size < 8) return 0f
    val values = accelMagnitudes.map { it.second }
    val mean = values.average().toFloat()
    val variance = values.map { (it - mean) * (it - mean) }.average().toFloat()
    return sqrt(variance.coerceAtLeast(0f))
  }

  private fun acceptDetectedStep(eventNanos: Long): Boolean {
    val variation = motionVariation(eventNanos)
    val previousAccepted = lastAcceptedDetectorAt
    val intervalMs = if (previousAccepted == 0L) 0L else (eventNanos - previousAccepted) / 1_000_000L
    // Require enough recent accelerometer evidence. Accept a first step only when body motion
    // is present; thereafter reject vibration-like cadence and isolated events. This is a
    // conservative heuristic, not guaranteed vehicle detection.
    val motionOkay = variation in 0.35f..5.0f
    val cadenceOkay = previousAccepted == 0L || intervalMs in 280L..1800L
    val accepted = motionOkay && cadenceOkay
    if (accepted) lastAcceptedDetectorAt = eventNanos
    return accepted
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
      val x = event.values.getOrNull(0) ?: return
      val y = event.values.getOrNull(1) ?: return
      val z = event.values.getOrNull(2) ?: return
      val magnitude = sqrt(x*x + y*y + z*z)
      accelMagnitudes.addLast(event.timestamp to magnitude)
      val cutoff = event.timestamp - 2_000_000_000L
      while (accelMagnitudes.isNotEmpty() && accelMagnitudes.peekFirst().first < cutoff) accelMagnitudes.removeFirst()
      return
    }
    if (event.sensor.type != Sensor.TYPE_STEP_DETECTOR) return
    val day = todayKey()
    if (acceptDetectedStep(event.timestamp)) {
      val current = prefs.getInt("steps_$day", 0)
      prefs.edit().putInt("steps_$day", (current + 1).coerceAtLeast(0)).putLong("last_update", System.currentTimeMillis()).putBoolean("tracking", true).apply()
      updateNotification(current + 1)
    } else {
      prefs.edit().putLong("last_update", System.currentTimeMillis()).putBoolean("tracking", true).apply()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    sensorManager.unregisterListener(this)
    // Android may restart this sticky service; keep persisted state for the UI.
    super.onDestroy()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Step tracking", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows that Daymark Fit is collecting steps from your phone sensor"
      }
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(steps: Int): Notification = NotificationCompat.Builder(this, CHANNEL_ID)
    .setSmallIcon(android.R.drawable.ic_menu_compass)
    .setContentTitle("Daymark Fit step tracking")
    .setContentText("Automatic step tracking is active · ${steps} steps today")
    .setOngoing(true)
    .setOnlyAlertOnce(true)
    .build()

  private fun updateNotification(steps: Int) {
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, buildNotification(steps))
  }
}
