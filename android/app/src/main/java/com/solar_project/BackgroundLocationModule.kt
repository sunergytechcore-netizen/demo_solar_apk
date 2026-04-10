package com.solar_project

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BackgroundLocationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BackgroundLocationModule"

  @ReactMethod
  fun startService(apiBaseUrl: String, token: String, promise: Promise) {
    try {
      val intent = Intent(reactContext, BackgroundLocationService::class.java).apply {
        action = BackgroundLocationService.ACTION_START
        putExtra(BackgroundLocationService.EXTRA_API_BASE_URL, apiBaseUrl)
        putExtra(BackgroundLocationService.EXTRA_TOKEN, token)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(reactContext, intent)
      } else {
        reactContext.startService(intent)
      }

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("BG_LOCATION_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopService(promise: Promise) {
    try {
      val intent = Intent(reactContext, BackgroundLocationService::class.java)
      reactContext.stopService(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("BG_LOCATION_STOP_FAILED", error.message, error)
    }
  }
}
