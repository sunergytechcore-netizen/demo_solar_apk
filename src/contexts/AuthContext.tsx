// src/contexts/AuthContext.tsx
// ─── NO native dependencies — uses a pure in-memory key-value store ───────────
// Drop-in replacement for AsyncStorage. Swap in MMKV or AsyncStorage later
// by changing only the 4 lines inside `Storage`.

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startAttendanceLocationTracking,
  stopAttendanceLocationTracking,
} from '../services/attendanceLocationTracker';

/* ─────────────────────────────────────────────────────────────
   IN-MEMORY STORE  (mimics AsyncStorage API — async get/set/clear)

   ✅  Zero native modules — works immediately with:
         npm run android
         emulator -avd Pixel_4

   🔄  To upgrade to real persistence later, replace this block with:
         import AsyncStorage from '@react-native-async-storage/async-storage';
         const Storage = AsyncStorage;
───────────────────────────────────────────────────────────── */
const Storage = AsyncStorage;

/* ─────────────────────────────────────────────────────────────
   CONTEXT SETUP
───────────────────────────────────────────────────────────── */
const AuthContext = createContext<any>({});
const API_BASE_URL = 'https://solar-backend-1-4szm.onrender.com/api/v1';
const API_TIMEOUT_MS = 45_000;
const APP_ALLOWED_ROLE = 'TEAM';

const parseResponseBody = async (response: Response) => {
  const rawText = await response.text();
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return { message: rawText };
  }
};

const pickFirstString = (...values: any[]) =>
  values.find(value => typeof value === 'string' && value.trim().length > 0) || null;

const extractAuthPayload = (payload: any) => {
  const result = payload?.result ?? payload?.data ?? payload;
  const user =
    result?.user ??
    result?.employee ??
    result?.admin ??
    payload?.user ??
    payload?.employee ??
    payload?.admin ??
    result;

  const token = pickFirstString(
    result?.token,
    result?.accessToken,
    result?.authToken,
    payload?.token,
    payload?.accessToken,
    payload?.authToken,
  );

  const role = pickFirstString(
    user?.role,
    user?.userRole,
    user?.employeeRole,
    user?.designation,
  );

  return {
    token,
    user: role && !user?.role ? { ...user, role } : user,
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user,    setUser]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ═══════════════════════════════
     CHECK AUTHENTICATION
  ═══════════════════════════════ */
  const isAuthenticated = useCallback(async () => {
    const token     = await Storage.getItem('token');
    const savedUser = await Storage.getItem('user');
    if (!token || !savedUser) return false;
    try {
      const parsed = JSON.parse(savedUser);
      return !!(parsed?.email && parsed?.role === APP_ALLOWED_ROLE);
    } catch {
      return false;
    }
  }, []);

  /* ═══════════════════════════════
     INIT AUTH FROM STORE
  ═══════════════════════════════ */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token     = await Storage.getItem('token');
        const savedUser = await Storage.getItem('user');
        if (token && savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed?.email && parsed?.role === APP_ALLOWED_ROLE) {
            setUser(parsed);
          } else {
            await Storage.multiRemove(['token', 'user']);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  /* ═══════════════════════════════
     API HELPER
  ═══════════════════════════════ */
  const fetchAPI = useCallback(async (endpoint: string, options: any = {}) => {
    const token      = await Storage.getItem('token');
    const isFormData = options.body instanceof FormData;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token        && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data     = await parseResponseBody(response);

      if (!response.ok) {
        if (response.status === 401) {
          await Storage.multiRemove(['token', 'user']);
          setUser(null);
        }
        throw new Error(
          data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`,
        );
      }

      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Server is taking too long to respond. Please try again in a moment.');
      }
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  /* ═══════════════════════════════
     SAFE API HELPER
  ═══════════════════════════════ */
  const safeFetchAPI = useCallback(
    async (endpoint: string, options: any = {}) => {
      try {
        const result = await fetchAPI(endpoint, options);
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: err.message || 'Request failed' };
      }
    },
    [fetchAPI],
  );

  const getTrackingConfig = useCallback(async () => {
    const token = await Storage.getItem('token');
    return {
      apiBaseUrl: API_BASE_URL,
      token,
    };
  }, []);

  /* ═══════════════════════════════
     LOGIN
  ═══════════════════════════════ */
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const { token, user: userData } = extractAuthPayload(response);

      if (!token) throw new Error('No token received');
      if (!userData || typeof userData !== 'object') {
        throw new Error('User details not found in login response');
      }
      if (userData?.role !== APP_ALLOWED_ROLE) {
        await Storage.multiRemove(['token', 'user']);
        throw new Error('Only TEAM members can login in this app');
      }

      await Storage.multiSet([
        ['token', token],
        ['user', JSON.stringify(userData)],
      ]);

      setUser(userData);
      setSuccess('Login successful');

      return { success: true, user: userData, token };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════
     LOGOUT
  ═══════════════════════════════ */
  const logout = useCallback(async () => {
    await stopAttendanceLocationTracking();
    await Storage.multiRemove(['token', 'user']);
    setUser(null);
  }, []);

  /* ═══════════════════════════════
     PUNCH IN
  ═══════════════════════════════ */
  const punchIn = useCallback(
    async (locationData: any) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAPI('/attendance/punch-in', {
          method: 'POST',
          body: JSON.stringify(locationData),
        });
        if (response.success) {
          const trackingConfig = await getTrackingConfig();
          await startAttendanceLocationTracking(fetchAPI, trackingConfig);
          setUser((prev: any) => ({
            ...prev,
            lastPunchIn: new Date().toISOString(),
          }));
        }
        return response;
      } catch (err: any) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [fetchAPI, getTrackingConfig],
  );

  /* ═══════════════════════════════
     PUNCH OUT
  ═══════════════════════════════ */
  const punchOut = useCallback(
    async (locationData: any) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAPI('/attendance/punch-out', {
          method: 'POST',
          body: JSON.stringify(locationData),
        });
        if (response.success) {
          await stopAttendanceLocationTracking();
          setUser((prev: any) => ({
            ...prev,
            lastPunchOut: new Date().toISOString(),
          }));
        }
        return response;
      } catch (err: any) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [fetchAPI],
  );

  /* ═══════════════════════════════
     ROLE HELPERS
  ═══════════════════════════════ */
  const getUserRole  = useCallback(() => user?.role || null, [user]);
  const isTeamMember = useCallback(() => user?.role === 'TEAM', [user]);
  const isManager    = useCallback(
    () => ['ZSM', 'ASM', 'Head_office'].includes(user?.role),
    [user],
  );

  /* ═══════════════════════════════
     CONTEXT VALUE
  ═══════════════════════════════ */
  const value = {
    user,
    loading,
    error,
    success,
    login,
    logout,
    fetchAPI,
    punchIn,
    punchOut,
    safeFetchAPI,
    getTrackingConfig,
    isAuthenticated,
    getUserRole,
    isTeamMember,
    isManager,
    setError,
    setSuccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
