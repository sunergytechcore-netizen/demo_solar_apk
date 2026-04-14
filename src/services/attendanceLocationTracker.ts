import {
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFreshLocation } from '../hooks/useGeo';

const TRACKING_INTERVAL_MS = 30_000;
const OFFLINE_TRACKING_QUEUE_KEY = 'attendance_tracking_offline_queue_v1';
const MAX_QUEUED_POINTS = 1000;

type FetchAPI = (endpoint: string, options?: any) => Promise<any>;
type TrackingConfig = {
  apiBaseUrl?: string | null;
  token?: string | null;
};
type StartTrackingOptions = {
  requestPermissions?: boolean;
  initialPoint?: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    speed?: number | null;
    time?: string;
  } | null;
};
type BatteryInfo = {
  percentage: number;
  isCharging: boolean;
  deviceInfo?: string;
};
type TrackingPoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  time?: string;
};

let timer: ReturnType<typeof setInterval> | null = null;
let active = false;
let inFlight = false;
let currentFetchAPI: FetchAPI | null = null;
let nativeServiceRunning = false;
let queueFlushInFlight = false;
let lastPostedPoint: {
  lat: number;
  lng: number;
  recordedAt: number;
} | null = null;

const BackgroundLocationModule = NativeModules.BackgroundLocationModule;

const isValidCoordinate = (lat: number | null | undefined, lng: number | null | undefined) =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

const MIN_POINT_DISTANCE_METERS = 5;

const distanceBetweenMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const shouldSkipPoint = (lat: number, lng: number, recordedAt: number) => {
  if (!lastPostedPoint) return false;

  const movedMeters = distanceBetweenMeters(
    lastPostedPoint.lat,
    lastPostedPoint.lng,
    lat,
    lng,
  );

  if (movedMeters >= MIN_POINT_DISTANCE_METERS) return false;

  return recordedAt - lastPostedPoint.recordedAt < TRACKING_INTERVAL_MS;
};

const rememberPostedPoint = (lat: number, lng: number, recordedAt: number) => {
  lastPostedPoint = { lat, lng, recordedAt };
};

const normalizeQueuedPoint = (point: TrackingPoint): TrackingPoint | null => {
  if (!isValidCoordinate(point?.lat, point?.lng)) return null;

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
    accuracy: Number(point.accuracy ?? 0),
    speed: Number(point.speed ?? 0),
    time: point.time || new Date().toISOString(),
  };
};

const readQueuedPoints = async (): Promise<TrackingPoint[]> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_TRACKING_QUEUE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeQueuedPoint)
      .filter((point): point is TrackingPoint => !!point);
  } catch (error) {
    console.warn('Failed to read queued tracking points:', error);
    return [];
  }
};

const writeQueuedPoints = async (points: TrackingPoint[]) => {
  const trimmed = points.slice(-MAX_QUEUED_POINTS);
  await AsyncStorage.setItem(OFFLINE_TRACKING_QUEUE_KEY, JSON.stringify(trimmed));
};

const queueTrackingPoint = async (point: TrackingPoint) => {
  const normalized = normalizeQueuedPoint(point);
  if (!normalized) return;

  const current = await readQueuedPoints();
  const lastQueued = current[current.length - 1];
  if (
    lastQueued &&
    lastQueued.time === normalized.time &&
    Math.abs(lastQueued.lat - normalized.lat) < 0.000001 &&
    Math.abs(lastQueued.lng - normalized.lng) < 0.000001
  ) {
    return;
  }

  current.push(normalized);
  await writeQueuedPoints(current);
};

const flushQueuedTrackingPoints = async (api: FetchAPI) => {
  if (queueFlushInFlight) return;

  queueFlushInFlight = true;
  try {
    const queued = await readQueuedPoints();
    if (!queued.length) return;

    const sorted = [...queued].sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return ta - tb;
    });

    await api('/location/track/bulk', {
      method: 'POST',
      body: JSON.stringify({ points: sorted }),
    });

    await AsyncStorage.removeItem(OFFLINE_TRACKING_QUEUE_KEY);

    const lastPoint = sorted[sorted.length - 1];
    if (lastPoint) {
      const recordedAt = lastPoint.time ? new Date(lastPoint.time).getTime() : Date.now();
      rememberPostedPoint(lastPoint.lat, lastPoint.lng, recordedAt);
    }
  } finally {
    queueFlushInFlight = false;
  }
};

const getBatteryInfo = async (): Promise<BatteryInfo | null> => {
  if (Platform.OS !== 'android' || !NativeModules.BatteryModule?.getBatteryInfo) {
    return null;
  }

  const info = await NativeModules.BatteryModule.getBatteryInfo();
  if (typeof info?.percentage !== 'number') return null;

  return {
    percentage: Math.max(0, Math.min(100, Math.round(info.percentage))),
    isCharging: !!info.isCharging,
    deviceInfo: info.deviceInfo || 'Android',
  };
};

export const ensureAndroidBackgroundTrackingPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
    return false;
  }

  if (
    Platform.Version >= 29 &&
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
  ) {
    const background = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Allow background location',
        message:
          'Enable "Allow all the time" so live tracking keeps updating after punch in, even when the app is minimized.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );

    if (background !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(
        'Background tracking is off',
        'Please allow location access all the time in Settings so the admin map keeps moving after punch in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }
  }

  if (
    Platform.Version >= 33 &&
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  ) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }

  return true;
};

const hasAndroidForegroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
};

const hasAndroidBackgroundTrackingPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const fineGranted = await hasAndroidForegroundLocationPermission();
  if (!fineGranted) return false;

  if (
    Platform.Version >= 29 &&
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
  ) {
    const backgroundGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    );
    if (!backgroundGranted) return false;
  }

  return true;
};

const postTrackingPoint = async (
  api: FetchAPI,
  point: TrackingPoint,
) => {
  const normalizedPoint = normalizeQueuedPoint(point);
  if (!normalizedPoint) return;

  const recordedAt = normalizedPoint.time ? new Date(normalizedPoint.time).getTime() : Date.now();

  if (shouldSkipPoint(normalizedPoint.lat, normalizedPoint.lng, recordedAt)) {
    await flushQueuedTrackingPoints(api);
    return;
  }

  await queueTrackingPoint(normalizedPoint);
  await flushQueuedTrackingPoints(api);
};

const sendTrackingPoint = async (pointOverride?: StartTrackingOptions['initialPoint']) => {
  const api = currentFetchAPI;
  if (!active || inFlight || !api) return;
  inFlight = true;

  try {
    if (
      pointOverride &&
      isValidCoordinate(pointOverride.lat, pointOverride.lng)
    ) {
      await postTrackingPoint(api, pointOverride);
    } else {
      const loc = await getFreshLocation(20000);
      const lat = loc.latitude;
      const lng = loc.longitude;

      if (active && isValidCoordinate(lat, lng)) {
        await postTrackingPoint(api, {
          lat,
          lng,
          accuracy: loc.accuracy ?? 0,
          speed: loc.speed ?? 0,
          time: new Date().toISOString(),
        });
      }
    }
  } catch (err: any) {
    const message = err?.message || String(err);
    console.warn('Location tracking update failed:', message);
    if (message.toLowerCase().includes('token') || message.toLowerCase().includes('authorization')) {
      stopAttendanceLocationTracking();
    }
  }

  try {
    if (!active) return;
    const battery = await getBatteryInfo();
    if (!battery) return;

    await api('/battery/log', {
      method: 'POST',
      body: JSON.stringify(battery),
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.warn('Battery tracking update failed:', message);
    if (message.toLowerCase().includes('token') || message.toLowerCase().includes('authorization')) {
      stopAttendanceLocationTracking();
    }
  } finally {
    inFlight = false;
  }
};

const startNativeTrackingService = async (config?: TrackingConfig) => {
  if (
    Platform.OS !== 'android' ||
    !BackgroundLocationModule?.startService ||
    !config?.apiBaseUrl ||
    !config?.token
  ) {
    return false;
  }

  await BackgroundLocationModule.startService(config.apiBaseUrl, config.token);
  nativeServiceRunning = true;
  return true;
};

export const startAttendanceLocationTracking = async (
  fetchAPI: FetchAPI,
  config?: TrackingConfig,
  options: StartTrackingOptions = {},
) => {
  currentFetchAPI = fetchAPI;
  active = true;
  const shouldRequestPermissions = options.requestPermissions ?? false;

  try {
    const hasForegroundPermission = shouldRequestPermissions
      ? await ensureAndroidBackgroundTrackingPermissions()
      : await hasAndroidForegroundLocationPermission();

    if (!hasForegroundPermission) {
      active = false;
      return;
    }

    const hasBackgroundPermission =
      Platform.OS !== 'android' || await hasAndroidBackgroundTrackingPermissions();

    if (hasBackgroundPermission) {
      const nativeStarted = await startNativeTrackingService(config);
      if (nativeStarted) {
        await sendTrackingPoint(options.initialPoint);
      }
    }
  } catch (error) {
    console.warn('Native background tracking start failed:', error);
  }

  if (timer) return;

  await sendTrackingPoint(options.initialPoint);
  timer = setInterval(sendTrackingPoint, TRACKING_INTERVAL_MS);
};

export const stopAttendanceLocationTracking = async () => {
  active = false;
  currentFetchAPI = null;
  inFlight = false;

  if (nativeServiceRunning && BackgroundLocationModule?.stopService) {
    try {
      await BackgroundLocationModule.stopService();
    } catch (error) {
      console.warn('Native background tracking stop failed:', error);
    } finally {
      nativeServiceRunning = false;
    }
  }

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  lastPostedPoint = null;
};
