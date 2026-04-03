// hooks/useGeo.ts
// Shared geo hook for AttendanceScreen and CreateVisitScreen
//
// ROOT CAUSE FIX:
//   RNLocation.getLatestLocation() returns the OS-cached last-known position.
//   If the cache is empty (emulator, fresh boot, first launch) it returns null
//   even when GPS is fully ON — our GPS-off guard then fires incorrectly.
//
//   Fix: use subscribeToLocationUpdates() wrapped in a Promise so we always
//   get a fresh GPS fix.  Configure the provider once at module load so the
//   native layer actually starts up before we ask for a position.

import { useState, useCallback } from 'react';
import { Platform, Linking, Alert } from 'react-native';
import RNLocation, { Location } from 'react-native-location';

// ── Configure once at module load ─────────────────────────────────────────────
// This arms the native provider.  Without it, getLatestLocation / subscribe
// may return nothing on some devices even with GPS on.
RNLocation.configure({
  distanceFilter:                   0,       // report every update
  desiredAccuracy: {
    ios:     'best',
    android: 'highAccuracy',
  },
  androidProvider:                  'auto',  // fused on Play devices, GPS elsewhere
  interval:                         500,     // ms between updates (Android)
  fastestInterval:                  100,
  maxWaitTime:                      1000,
  allowsBackgroundLocationUpdates:  false,
  pausesLocationUpdatesAutomatically: false,
});

export interface AddressObj {
  full:        string;
  short:       string;
  road:        string;
  houseNumber: string;
  city:        string;
  state:       string;
  country:     string;
  postcode:    string;
}

export interface GeoState {
  latitude:  number | null;
  longitude: number | null;
  accuracy:  number | null;
  address:   AddressObj | null;
  loading:   boolean;
  error:     string | null;
  gpsOff:    boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const openGpsSettings = () => {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  } else {
    Linking.openSettings();
  }
};

const showGpsOffAlert = () =>
  Alert.alert(
    '📍 GPS is Off',
    "Please turn on your phone's Location (GPS) to continue.",
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Turn On GPS', onPress: openGpsSettings },
    ]
  );

/**
 * Wraps subscribeToLocationUpdates in a Promise.
 *
 * Why not getLatestLocation?
 *   getLatestLocation returns the OS-cached last-known fix. On a fresh boot,
 *   first launch, or emulator it can be null even when GPS is enabled — that
 *   caused the false "GPS is Off" alerts.  subscribeToLocationUpdates triggers
 *   an active fix request and resolves as soon as the first update arrives.
 */
const getLocationOnce = (timeoutMs = 20000): Promise<Location> =>
  new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;

    const timer = setTimeout(() => {
      unsubscribe?.();
      reject({ code: 3, message: 'Location timed out after ' + timeoutMs / 1000 + 's' });
    }, timeoutMs);

    unsubscribe = RNLocation.subscribeToLocationUpdates((locations) => {
      const loc = locations?.[0];
      if (!loc) return;           // skip empty batches; wait for a real fix
      clearTimeout(timer);
      unsubscribe?.();
      resolve(loc);
    });
  });

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useGeo = () => {
  const [state, setState] = useState<GeoState>({
    latitude: null, longitude: null,
    accuracy: null, address:  null,
    loading:  false, error:   null, gpsOff: false,
  });

  const fetchLocation = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null, gpsOff: false }));

    // ── Step 1: Permission ────────────────────────────────────────────────────
    const granted = await RNLocation.requestPermission({
      ios: 'whenInUse',
      android: {
        detail: 'fine',
        rationale: {
          title:          'Location Permission Required',
          message:        'Please allow location access to record your attendance accurately.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      },
    });

    if (!granted) {
      setState(s => ({
        ...s, loading: false, gpsOff: false,
        error: 'Location permission denied. Open Settings to enable it.',
      }));
      Alert.alert(
        'Permission Required',
        'Location permission is needed. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    // ── Step 2: Get a fresh GPS fix via subscription ───────────────────────────
    // (subscribeToLocationUpdates triggers an active fix; getLatestLocation only
    //  reads the OS cache which may be null on first launch / emulator / fresh boot)
    try {
      const loc = await getLocationOnce(20000);

      const lat      = loc.latitude;
      const lng      = loc.longitude;
      const accuracy = loc.accuracy ?? null;

      // Default: coordinate string in case reverse-geocode fails
      let addressObj: AddressObj = {
        full:        `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        short:       `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        road: '', houseNumber: '', city: '', state: '', country: '', postcode: '',
      };

      // ── Step 3: Reverse geocode ─────────────────────────────────────────────
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'SolarProjectApp/1.0 (contact@yourdomain.com)',
              'Accept':     'application/json',
            },
          }
        );
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data?.display_name && data?.address) {
            const a           = data.address;
            const houseNumber = a.house_number || '';
            const road        = a.road || a.pedestrian || a.footway || a.path || '';
            const suburb      = a.suburb || a.neighbourhood || a.quarter || '';
            const city        = a.city || a.town || a.village || suburb || '';
            const state       = a.state   || '';
            const country     = a.country || '';
            const postcode    = a.postcode || '';
            const short       = [road, city].filter(Boolean).join(', ')
                                || data.display_name.split(',')[0].trim();
            addressObj = { full: data.display_name, short, road, houseNumber, city, state, country, postcode };
          }
        }
      } catch (geocodeErr) {
        console.warn('Reverse geocode failed (non-critical):', geocodeErr);
      }

      setState({
        latitude: lat, longitude: lng, accuracy,
        address: addressObj, loading: false, error: null, gpsOff: false,
      });

    } catch (err: any) {
      // ── Timeout (code 3) ────────────────────────────────────────────────────
      if (err?.code === 3) {
        setState(s => ({
          ...s, loading: false, gpsOff: false,
          error: 'Location timed out. Move to an open area and tap Retry.',
        }));
        return;
      }

      // ── GPS / provider off ──────────────────────────────────────────────────
      // react-native-location throws {type:'503'} or includes
      // 'no valid location provider' when the device GPS provider is disabled.
      const isGpsOff =
        err?.type    === '503'                              ||
        err?.code    === 2                                  ||
        String(err?.message).includes('no valid location provider') ||
        String(err?.message).includes('503');

      if (isGpsOff) {
        setState(s => ({
          ...s, loading: false, gpsOff: true,
          error: 'GPS is off. Please turn on Location and tap Retry.',
        }));
        showGpsOffAlert();
      } else {
        setState(s => ({
          ...s, loading: false, gpsOff: false,
          error: err?.message || 'Could not get your location. Please try again.',
        }));
      }
    }
  }, []);

  const reset = useCallback(() =>
    setState({
      latitude: null, longitude: null, accuracy: null, address: null,
      loading: false, error: null, gpsOff: false,
    }),
    []
  );

  return { ...state, fetchLocation, reset };
};