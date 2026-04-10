// src/screen/LoginScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext'; // ✅ ADDED

// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR            = '#4569ea';
const COLOR_LIGHT      = '#5c7cec';
const COLOR_DARK       = '#3a5ac8';
const COLOR_VERY_LIGHT = '#e8edff';
const { width }        = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  onLoginSuccess?: (user: any) => void;
}

interface FormData {
  email:      string;
  password:   string;
  rememberMe: boolean;
}

interface Errors {
  email:    string;
  password: string;
}

interface Validation {
  emailValid:    boolean;
  passwordValid: boolean;
  formValid:     boolean;
}

interface PasswordStrength {
  score:   number;
  message: string;
  color:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────
const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {

  // ✅ Get login from AuthContext — this saves token to MemStore automatically
  const { login } = useAuth();

  // Form state
  const [formData, setFormData]         = useState<FormData>({ email: '', password: '', rememberMe: true });
  const [errors, setErrors]             = useState<Errors>({ email: '', password: '' });
  const [validation, setValidation]     = useState<Validation>({ emailValid: false, passwordValid: false, formValid: false });
  const [touched, setTouched]           = useState({ email: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [localError, setLocalError]     = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockUntil, setLockUntil]       = useState<Date | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({ score: 0, message: '', color: '' });

  // Animation refs
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Input refs
  const passwordRef = useRef<TextInput>(null);

  // ── Mount animations ────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Form validity ───────────────────────────────────────────────────────
  useEffect(() => {
    setValidation(prev => ({
      ...prev,
      formValid: validation.emailValid && validation.passwordValid,
    }));
  }, [validation.emailValid, validation.passwordValid]);

  // ── Rate limit ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (attemptCount >= 5) {
      const lockTime = new Date();
      lockTime.setMinutes(lockTime.getMinutes() + 15);
      setLockUntil(lockTime);
      setLocalError('Too many failed attempts. Account locked for 15 minutes.');
    }
  }, [attemptCount]);

  // ── Error fade-in ───────────────────────────────────────────────────────
  useEffect(() => {
    if (localError) {
      Animated.timing(errorAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      errorAnim.setValue(0);
    }
  }, [localError]);

  // ── Validators ──────────────────────────────────────────────────────────
  const validateEmail = (email: string) => {
    if (!email)     return { valid: false, message: 'Email is required' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    return { valid: false, message: 'Please enter a valid email address' };
    if (email.length > 100)
                    return { valid: false, message: 'Email must be less than 100 characters' };
    return { valid: true, message: '' };
  };

  const validatePassword = (password: string) => {
    if (!password)            return { valid: false, message: 'Password is required' };
    if (password.length < 6)  return { valid: false, message: 'Password must be at least 6 characters' };
    if (password.length > 50) return { valid: false, message: 'Password must be less than 50 characters' };

    let score = 0;
    if (password.length >= 6)          score++;
    if (password.length >= 8)          score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[a-z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const message = score >= 5 ? 'Strong password' : score >= 3 ? 'Moderate password' : 'Weak password';
    const color   = score >= 5 ? '#22c55e'         : score >= 3 ? '#f59e0b'           : '#ef4444';
    setPasswordStrength({ score, message, color });
    return { valid: true, message: '' };
  };

  const validateField = (name: string, value: string) => {
    if (name === 'email') {
      const r = validateEmail(value);
      setValidation(prev => ({ ...prev, emailValid: r.valid }));
      return r;
    }
    const r = validatePassword(value);
    setValidation(prev => ({ ...prev, passwordValid: r.valid }));
    return r;
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof Errors]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (localError)    setLocalError(null);
    if (successMessage) setSuccessMessage('');
    if (touched[name as keyof typeof touched]) validateField(name, value);
  };

  const handleBlur = (name: string, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const r = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: r.valid ? '' : r.message }));
  };

  const isLocked = () => lockUntil !== null && new Date() < lockUntil;

  const formatLockTime = () => {
    if (!lockUntil) return '';
    const diff = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
    return diff <= 0 ? 'now' : `${diff} minute${diff > 1 ? 's' : ''}`;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  // ✅ KEY FIX: Uses AuthContext.login() which saves token+user to MemStore,
  //    so fetchAPI in LeadFunnelScreen (and everywhere) can read the token.
  const handleSubmit = async () => {
    if (isLocked()) {
      setLocalError(`Too many failed attempts. Try again in ${formatLockTime()}.`);
      return;
    }

    setTouched({ email: true, password: true });

    const ev = validateEmail(formData.email);
    const pv = validatePassword(formData.password);
    setErrors({ email: ev.message, password: pv.message });

    if (!ev.valid || !pv.valid) {
      setLocalError('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    setLocalError(null);

    try {
      // ✅ AuthContext.login calls MemStore.setItem('token') and MemStore.setItem('user')
      //    This is what was missing — the old raw fetch never saved to MemStore
      const result = await login(formData.email, formData.password);

      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }

      const userData = result.user;
      const userRole = userData?.role;

      if (!userRole) throw new Error('User role not found in response');

      if (userRole !== 'TEAM') {
        throw new Error('Only TEAM members can login in this app');
      }

      setAttemptCount(0);
      setSuccessMessage('Login successful! Redirecting...');

      setTimeout(() => {
        onLoginSuccess?.(userData);
      }, 1200);

    } catch (err: any) {
      const message      = err.message || 'An unexpected error occurred';
      const isPermission = message.toLowerCase().includes('permission');
      const lowerMessage = message.toLowerCase();
      const isNetwork    = lowerMessage.includes('network') ||
                           lowerMessage.includes('fetch') ||
                           lowerMessage.includes('respond') ||
                           lowerMessage.includes('timeout');

      if (!isPermission) setAttemptCount(prev => prev + 1);

      setLocalError(
        isNetwork    ? 'Server is slow or unreachable. Please check your internet and try again in a minute.' :
        isPermission ? 'You do not have permission to access this system.'     :
        message
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderStrengthBar = () => {
    if (!formData.password || !touched.password || errors.password) return null;
    return (
      <View style={styles.strengthContainer}>
        <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
          {passwordStrength.message}
        </Text>
        <View style={styles.strengthBars}>
          {[1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.strengthBar,
                { backgroundColor: i <= passwordStrength.score ? passwordStrength.color : COLOR_VERY_LIGHT },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderFieldHelper = (field: 'email' | 'password') => {
    const hasError = touched[field] && errors[field];
    const isValid  = touched[field] && !errors[field] && formData[field];
    if (hasError) {
      return (
        <View style={styles.helperRow}>
          <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#ef4444" />
          <Text style={styles.errorText}>{errors[field]}</Text>
        </View>
      );
    }
    if (isValid) {
      return (
        <View style={styles.helperRow}>
          <MaterialCommunityIcons name="check-circle-outline" size={13} color={COLOR} />
          <Text style={styles.successText}>
            {field === 'email' ? 'Valid email address' : 'Password meets requirements'}
          </Text>
        </View>
      );
    }
    return null;
  };

  // ── Root render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR_DARK} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Top accent bar */}
            <View style={styles.topBar} />

            {/* ── Logo ── */}
            <View style={styles.logoSection}>
              <Animated.View style={[styles.logoCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Image
  source={require('../../assets/Images/logo192.png')}
  style={{ width: 50, height: 50 }}
/>
              </Animated.View>
              <Text style={styles.appTitle}>Solar Management System</Text>
              <Text style={styles.appSubtitle}>SunergyTech</Text>
            </View>

            {/* ── Success alert ── */}
            {successMessage ? (
              <View style={[styles.alertBox, styles.alertSuccess]}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={COLOR} />
                <Text style={[styles.alertText, { color: COLOR_DARK }]}>{successMessage}</Text>
              </View>
            ) : null}

            {/* ── Error alert ── */}
            {localError ? (
              <Animated.View style={[styles.alertBox, styles.alertError, { opacity: errorAnim }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLOR} />
                <View style={styles.flex}>
                  <Text style={[styles.alertText, { color: COLOR_DARK }]}>{localError}</Text>
                  {attemptCount > 0 && attemptCount < 5 && (
                    <Text style={styles.attemptsText}>
                      Failed attempts: {attemptCount}/5
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setLocalError(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={16} color={COLOR} />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            {/* ── Attempts warning ── */}
            {attemptCount >= 3 && attemptCount < 5 && !lockUntil ? (
              <View style={[styles.alertBox, styles.alertWarning]}>
                <MaterialCommunityIcons name="alert-outline" size={16} color={COLOR_DARK} />
                <Text style={[styles.alertText, { color: COLOR_DARK }]}>
                  <Text style={{ fontWeight: '700' }}>Warning: </Text>
                  {5 - attemptCount} attempt{5 - attemptCount > 1 ? 's' : ''} remaining before account lock.
                </Text>
              </View>
            ) : null}

            {/* ── Email field ── */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Email Address <Text style={styles.required}>*</Text>
              </Text>
              <View style={[
                styles.inputWrapper,
                touched.email && errors.email                    ? styles.inputError : null,
                touched.email && !errors.email && formData.email ? styles.inputValid : null,
              ]}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={20}
                  color={touched.email && errors.email ? '#ef4444' : COLOR}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94a3b8"
                  value={formData.email}
                  onChangeText={v => handleChange('email', v)}
                  onBlur={() => handleBlur('email', formData.email)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLocked()}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
              {renderFieldHelper('email')}
            </View>

            {/* ── Password field ── */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <View style={[
                styles.inputWrapper,
                touched.password && errors.password                       ? styles.inputError : null,
                touched.password && !errors.password && formData.password ? styles.inputValid : null,
              ]}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color={touched.password && errors.password ? '#ef4444' : COLOR}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter your password"
                  placeholderTextColor="#94a3b8"
                  value={formData.password}
                  onChangeText={v => handleChange('password', v)}
                  onBlur={() => handleBlur('password', formData.password)}
                  secureTextEntry={!showPassword}
                  editable={!isLocked()}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(p => !p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.eyeBtn}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLOR}
                  />
                </TouchableOpacity>
              </View>
              {renderStrengthBar()}
              {renderFieldHelper('password')}
            </View>

            {/* ── Remember Me ── */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setFormData(prev => ({ ...prev, rememberMe: !prev.rememberMe }))}
              disabled={isLocked()}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, formData.rememberMe && styles.checkboxChecked]}>
                {formData.rememberMe && (
                  <MaterialCommunityIcons name="check" size={13} color="#fff" />
                )}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            {/* ── Submit Button ── */}
            <TouchableOpacity
              style={[styles.loginBtn, (loading || isLocked()) && styles.loginBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading || isLocked()}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="login" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>LOGIN</Text>
                </>
              )}
            </TouchableOpacity>

            {/* ── Footer ── */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © {new Date().getFullYear()} SunergyTech Solar Management System
              </Text>
              <Text style={styles.versionText}>
                Version 2.1.0 • {new Date().toLocaleDateString()}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: COLOR_DARK,
  },
  flex: { flex: 1 },

  scrollContent: {
    flexGrow:          1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   32,
    paddingHorizontal: 16,
    backgroundColor:   COLOR_DARK,
  },

  card: {
    width:             Math.min(width - 32, 480),
    backgroundColor:   '#ffffff',
    borderRadius:      16,
    paddingHorizontal: 24,
    paddingBottom:     28,
    paddingTop:        0,
    shadowColor:       COLOR_DARK,
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:     0.25,
    shadowRadius:      16,
    elevation:         12,
    overflow:          'hidden',
  },

  topBar: {
    height:           4,
    backgroundColor:  COLOR,
    marginHorizontal: -24,
    marginBottom:     24,
  },

  logoSection: {
    alignItems:   'center',
    marginBottom: 24,
  },
  logoCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: COLOR_VERY_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    12,
    borderWidth:     2.5,
    borderColor:     COLOR,
    shadowColor:     COLOR,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.25,
    shadowRadius:    8,
    elevation:       6,
  },
  appTitle: {
    fontSize:      20,
    fontWeight:    '700',
    color:         COLOR,
    letterSpacing: 0.4,
    textAlign:     'center',
  },
  appSubtitle: {
    fontSize:  13,
    color:     COLOR_LIGHT,
    marginTop: 2,
  },

  alertBox: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    borderRadius:  10,
    padding:       12,
    marginBottom:  12,
    borderWidth:   1,
  },
  alertError: {
    backgroundColor: 'rgba(69,105,234,0.07)',
    borderColor:     'rgba(69,105,234,0.2)',
  },
  alertSuccess: {
    backgroundColor: 'rgba(34,197,94,0.07)',
    borderColor:     'rgba(34,197,94,0.25)',
  },
  alertWarning: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor:     'rgba(245,158,11,0.3)',
  },
  alertText: {
    fontSize:   13,
    flexShrink: 1,
    lineHeight: 18,
  },
  attemptsText: {
    fontSize:  11,
    color:     COLOR,
    marginTop: 3,
  },

  fieldContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize:     13,
    fontWeight:   '600',
    color:        COLOR_DARK,
    marginBottom: 6,
  },
  required: {
    color: '#ef4444',
  },
  inputWrapper: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLOR_VERY_LIGHT,
    borderRadius:      10,
    borderWidth:       1.5,
    borderColor:       'transparent',
    height:            50,
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor:     '#ef4444',
    backgroundColor: '#fff5f5',
  },
  inputValid: {
    borderColor: COLOR,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex:            1,
    fontSize:        15,
    color:           '#1e293b',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },

  strengthContainer: {
    marginTop: 6,
  },
  strengthText: {
    fontSize:     11,
    fontWeight:   '600',
    marginBottom: 4,
  },
  strengthBars: {
    flexDirection: 'row',
    gap:           4,
  },
  strengthBar: {
    flex:         1,
    height:       3,
    borderRadius: 2,
  },

  helperRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
  },
  errorText: {
    fontSize: 12,
    color:    '#ef4444',
  },
  successText: {
    fontSize: 12,
    color:    COLOR,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  18,
    marginTop:     2,
  },
  checkbox: {
    width:          20,
    height:         20,
    borderRadius:   5,
    borderWidth:    2,
    borderColor:    COLOR,
    alignItems:     'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLOR,
  },
  rememberText: {
    fontSize: 14,
    color:    COLOR_DARK,
  },

  loginBtn: {
    backgroundColor: COLOR,
    borderRadius:    10,
    height:          50,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     COLOR_DARK,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       6,
    marginBottom:    8,
  },
  loginBtnDisabled: {
    opacity: 0.65,
  },
  loginBtnText: {
    color:         '#ffffff',
    fontWeight:    '700',
    fontSize:      16,
    letterSpacing: 1,
  },

  footer: {
    alignItems: 'center',
    marginTop:  20,
  },
  footerText: {
    fontSize:  12,
    color:     COLOR,
    textAlign: 'center',
  },
  versionText: {
    fontSize:  11,
    color:     COLOR_LIGHT,
    marginTop: 2,
  },
});

export default LoginScreen;
