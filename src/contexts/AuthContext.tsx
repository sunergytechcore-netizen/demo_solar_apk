// src/contexts/AuthContext.tsx
// ─── NO native dependencies — uses a pure in-memory key-value store ───────────
// Drop-in replacement for AsyncStorage. Swap in MMKV or AsyncStorage later
// by changing only the 4 lines inside `MemStore`.

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from 'react';

/* ─────────────────────────────────────────────────────────────
   IN-MEMORY STORE  (mimics AsyncStorage API — async get/set/clear)

   ✅  Zero native modules — works immediately with:
         npm run android
         emulator -avd Pixel_4

   🔄  To upgrade to real persistence later, replace this block with:
         import AsyncStorage from '@react-native-async-storage/async-storage';
         const MemStore = AsyncStorage;
───────────────────────────────────────────────────────────── */
const _store: Record<string, string> = {};

const MemStore = {
  getItem: (key: string): Promise<string | null> =>
    Promise.resolve(_store[key] ?? null),

  setItem: (key: string, value: string): Promise<void> => {
    _store[key] = value;
    return Promise.resolve();
  },

  removeItem: (key: string): Promise<void> => {
    delete _store[key];
    return Promise.resolve();
  },

  clear: (): Promise<void> => {
    Object.keys(_store).forEach(k => delete _store[k]);
    return Promise.resolve();
  },
};

/* ─────────────────────────────────────────────────────────────
   CONTEXT SETUP
───────────────────────────────────────────────────────────── */
const AuthContext = createContext<any>({});
const API_BASE_URL = 'https://solar-backend-4bsb.onrender.com/api/v1';

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
    const token     = await MemStore.getItem('token');
    const savedUser = await MemStore.getItem('user');
    if (!token || !savedUser) return false;
    try {
      const parsed = JSON.parse(savedUser);
      return !!(parsed?.email && parsed?.role);
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
        const token     = await MemStore.getItem('token');
        const savedUser = await MemStore.getItem('user');
        if (token && savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed?.email && parsed?.role) setUser(parsed);
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
    const token      = await MemStore.getItem('token');
    const isFormData = options.body instanceof FormData;

    console.log("token",token)

    const config = {
      ...options,
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token        && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data     = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await MemStore.clear();
          setUser(null);
        }
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (err: any) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
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

      const token    = response.result?.token || response.token;
      const userData = response.result?.user  || response.result || response;

      if (!token) throw new Error('No token received');

      await MemStore.setItem('token', token);
      await MemStore.setItem('user',  JSON.stringify(userData));

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
    await MemStore.clear();
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
    [fetchAPI],
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