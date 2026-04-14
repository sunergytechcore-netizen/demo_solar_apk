package com.solar_project

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.roundToInt

class BackgroundLocationService : Service() {

  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private lateinit var locationCallback: LocationCallback
  private val executor: ExecutorService = Executors.newSingleThreadExecutor()

  private var apiBaseUrl: String? = null
  private var token: String? = null
  private var lastSentLocation: Location? = null
  private var isUpdatingLocation = false

  override fun onCreate() {
    super.onCreate()
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    createNotificationChannel()
    try {
      startForeground(NOTIFICATION_ID, buildNotification("Tracking movement after punch in"))
    } catch (error: Exception) {
      Log.e(TAG, "Unable to start foreground notification", error)
      stopSelf()
      return
    }
    setupLocationCallback()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_START -> {
        apiBaseUrl = intent.getStringExtra(EXTRA_API_BASE_URL)?.trimEnd('/')
        token = intent.getStringExtra(EXTRA_TOKEN)
        runCatching { flushQueuedLocationPoints() }
          .onFailure { Log.w(TAG, "Failed to flush queued points on start", it) }
        runCatching { startLocationUpdates() }
          .onFailure {
            Log.e(TAG, "Unable to start location updates", it)
            stopSelf()
          }
      }
      else -> {
        if (!isUpdatingLocation) {
          runCatching { startLocationUpdates() }
            .onFailure {
              Log.e(TAG, "Unable to restart location updates", it)
              stopSelf()
            }
        }
      }
    }

    return START_STICKY
  }

  override fun onDestroy() {
    stopLocationUpdates()
    executor.shutdownNow()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun setupLocationCallback() {
    locationCallback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        for (location in result.locations) {
          handleLocation(location)
        }
      }
    }
  }

  private fun startLocationUpdates() {
    if (isUpdatingLocation) return
    if (!hasLocationPermission()) {
      Log.w(TAG, "Location permission missing. Stopping service.")
      stopSelf()
      return
    }

    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
      .setMinUpdateDistanceMeters(MIN_DISTANCE_METERS)
      .setWaitForAccurateLocation(false)
      .setMinUpdateIntervalMillis(10_000L)
      .build()

    fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    isUpdatingLocation = true

    fusedLocationClient.lastLocation.addOnSuccessListener { location ->
      if (location != null) handleLocation(location)
    }.addOnFailureListener { error ->
      Log.e(TAG, "Unable to read last known location", error)
    }
  }

  private fun stopLocationUpdates() {
    if (isUpdatingLocation) {
      runCatching { fusedLocationClient.removeLocationUpdates(locationCallback) }
        .onFailure { Log.w(TAG, "Failed to remove location updates", it) }
      isUpdatingLocation = false
    }

    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
    }.onFailure { Log.w(TAG, "Failed to stop foreground state", it) }
  }

  private fun handleLocation(location: Location) {
    if (location.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) return

    val previous = lastSentLocation
    if (previous != null && previous.distanceTo(location) < MIN_DISTANCE_METERS) return

    lastSentLocation = location
    updateNotification(location)

    executor.execute {
      runCatching { queueAndFlushLocationPoint(location) }
        .onFailure { Log.e(TAG, "Location upload failed", it) }
      runCatching { postBatteryStatus() }
        .onFailure { Log.e(TAG, "Battery upload failed", it) }
    }
  }

  private fun queueAndFlushLocationPoint(location: Location) {
    enqueueLocationPoint(location)
    flushQueuedLocationPoints()
  }

  private fun postBatteryStatus() {
    val intent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return
    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)

    if (level < 0 || scale <= 0) return

    val percentage = (level * 100f / scale).roundToInt()
    val isCharging =
      status == BatteryManager.BATTERY_STATUS_CHARGING ||
        status == BatteryManager.BATTERY_STATUS_FULL

    val payload = JSONObject().apply {
      put("percentage", percentage)
      put("isCharging", isCharging)
      put("deviceInfo", Build.MODEL ?: "Android")
    }

    postJson("/battery/log", payload)
  }

  private fun postJson(path: String, payload: JSONObject): Boolean {
    val baseUrl = apiBaseUrl ?: return false
    val bearerToken = token ?: return false

    var connection: HttpURLConnection? = null
    try {
      connection = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 15_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $bearerToken")
      }

      OutputStreamWriter(connection.outputStream).use { writer ->
        writer.write(payload.toString())
        writer.flush()
      }

      val code = connection.responseCode
      if (code !in 200..299) {
        Log.w(TAG, "Upload failed for $path with HTTP $code")
        return false
      }
      return true
    } catch (error: Exception) {
      Log.e(TAG, "Upload failed for $path", error)
      return false
    } finally {
      connection?.disconnect()
    }
  }

  private fun getQueuePrefs() =
    getSharedPreferences(QUEUE_PREFS_NAME, Context.MODE_PRIVATE)

  private fun readQueuedPoints(): JSONArray {
    val raw = getQueuePrefs().getString(QUEUE_KEY, null) ?: return JSONArray()
    return runCatching { JSONArray(raw) }.getOrElse { JSONArray() }
  }

  private fun writeQueuedPoints(points: JSONArray) {
    getQueuePrefs().edit().putString(QUEUE_KEY, points.toString()).apply()
  }

  private fun enqueueLocationPoint(location: Location) {
    val queue = readQueuedPoints()
    val point = JSONObject().apply {
      put("lat", location.latitude)
      put("lng", location.longitude)
      put("accuracy", location.accuracy.toDouble())
      put("speed", location.speed.toDouble())
      put("time", isoNow())
    }

    val lastQueued = if (queue.length() > 0) queue.optJSONObject(queue.length() - 1) else null
    val sameAsLast =
      lastQueued != null &&
        kotlin.math.abs(lastQueued.optDouble("lat") - point.optDouble("lat")) < 0.000001 &&
        kotlin.math.abs(lastQueued.optDouble("lng") - point.optDouble("lng")) < 0.000001 &&
        lastQueued.optString("time") == point.optString("time")

    if (!sameAsLast) {
      queue.put(point)
    }

    if (queue.length() > MAX_QUEUED_POINTS) {
      val trimmed = JSONArray()
      for (i in maxOf(0, queue.length() - MAX_QUEUED_POINTS) until queue.length()) {
        trimmed.put(queue.getJSONObject(i))
      }
      writeQueuedPoints(trimmed)
      return
    }

    writeQueuedPoints(queue)
  }

  private fun flushQueuedLocationPoints() {
    val queue = readQueuedPoints()
    if (queue.length() == 0) return

    val payload = JSONObject().apply {
      put("points", queue)
    }

    val uploaded = postJson("/location/track/bulk", payload)
    if (uploaded) {
      getQueuePrefs().edit().remove(QUEUE_KEY).apply()
    }
  }

  private fun hasLocationPermission(): Boolean {
    val fineGranted =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarseGranted =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

    return fineGranted || coarseGranted
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Attendance Tracking",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Keeps punch-in location tracking active while you are on duty."
    }

    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(contentText: String): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Attendance tracking active")
      .setContentText(contentText)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

  private fun updateNotification(location: Location) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(
      NOTIFICATION_ID,
      buildNotification(
        "Last update ${location.latitude.formatCoord()}, ${location.longitude.formatCoord()}"
      )
    )
  }

  private fun isoNow(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date())
  }

  private fun Double.formatCoord(): String = String.format(Locale.US, "%.5f", this)

  companion object {
    const val ACTION_START = "com.solar_project.location.START"
    const val ACTION_STOP = "com.solar_project.location.STOP"
    const val EXTRA_API_BASE_URL = "apiBaseUrl"
    const val EXTRA_TOKEN = "token"

    private const val TAG = "BgLocationService"
    private const val CHANNEL_ID = "attendance_tracking"
    private const val NOTIFICATION_ID = 3107
    private const val UPDATE_INTERVAL_MS = 30_000L
    private const val MIN_DISTANCE_METERS = 5f
    private const val MAX_ACCEPTABLE_ACCURACY_METERS = 150f
    private const val QUEUE_PREFS_NAME = "attendance_tracking_queue"
    private const val QUEUE_KEY = "pending_points"
    private const val MAX_QUEUED_POINTS = 1000
  }
}
