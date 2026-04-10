package com.solar_project

import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class BatteryModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BatteryModule"

  @ReactMethod
  fun getBatteryInfo(promise: Promise) {
    try {
      val intent = reactContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

      if (intent == null) {
        promise.reject("BATTERY_UNAVAILABLE", "Battery information is unavailable")
        return
      }

      val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
      val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
      val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
      val isCharging =
        status == BatteryManager.BATTERY_STATUS_CHARGING ||
          status == BatteryManager.BATTERY_STATUS_FULL

      if (level < 0 || scale <= 0) {
        promise.reject("BATTERY_UNAVAILABLE", "Battery percentage is unavailable")
        return
      }

      val result = WritableNativeMap()
      result.putInt("percentage", Math.round(level * 100f / scale))
      result.putBoolean("isCharging", isCharging)
      result.putString("deviceInfo", android.os.Build.MODEL ?: "Android")
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("BATTERY_ERROR", error.message, error)
    }
  }
}
