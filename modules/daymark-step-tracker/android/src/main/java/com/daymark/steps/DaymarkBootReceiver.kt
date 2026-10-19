package com.daymark.steps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class DaymarkBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_BOOT_COMPLETED || intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      val hasPermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        context.checkSelfPermission(android.Manifest.permission.ACTIVITY_RECOGNITION) == android.content.pm.PackageManager.PERMISSION_GRANTED
      if (hasPermission) {
        val service = Intent(context, DaymarkStepService::class.java).setAction(DaymarkStepService.ACTION_START)
        try { ContextCompat.startForegroundService(context, service) } catch (_: Exception) { }
      }
    }
  }
}
