// screens/CreateVisitScreen.tsx
//
// Required packages:
//   npm i react-native-location
//   npm install react-native-webview        ← for the LeafletMap component
//   npm install react-native-image-picker
//   npm install react-native-vector-icons
//   cd ios && pod install
//
// Android AndroidManifest.xml:
//   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
//   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
//   <uses-permission android:name="android.permission.CAMERA" />
//   <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
//   <uses-permission android:name="android.permission.INTERNET" />
//
// iOS Info.plist:
//   NSLocationWhenInUseUsageDescription
//   NSCameraUsageDescription
//   NSPhotoLibraryUsageDescription

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Platform, PermissionsAndroid, ActivityIndicator,
  Image, Animated, KeyboardAvoidingView,
  Dimensions, StatusBar,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchCamera } from 'react-native-image-picker';
import { useAuth } from '../contexts/AuthContext';
import LeafletMap from '../components/Leafletmap';
import { useGeo } from '../hooks/useGeo';

// ─── useGeo hook ──────────────────────────────────────────────────────────────
// Handles permission, GPS-off detection (503 / null loc), reverse geocoding,
// and alert dialogs. Drop in and call fetchLocation() wherever you need it.


// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY   = '#4569ea';
const SECONDARY = '#1a237e';
const SUCCESS   = '#4caf50';
const ERROR_COL = '#f44336';
const WARNING   = '#ff9800';
const BG        = '#f8fafc';

const rgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  locationName: string; remarks: string;
  contactPerson: string; phone: string; email: string;
}
interface ImageData { uri: string; type: string; name: string; }
interface Props {
  onClose?: () => void;
  onSave?:  (data: any) => void;
  onBackPress?: () => void;
}

// ─── Snack Bar ────────────────────────────────────────────────────────────────
const SnackBar = ({ msg, type }: { msg: string; type: 'success'|'error'|'info'|'warning' }) => {
  const bgMap    = { success:'#dcfce7', error:'#fee2e2', info:'#dbeafe', warning:'#fef9c3' };
  const colorMap = { success:'#16a34a', error:'#dc2626', info:'#2563eb', warning:'#d97706' };
  return (
    <View style={[s.snackBar, { backgroundColor: bgMap[type] }]}>
      <MaterialCommunityIcons
        name={type==='success' ? 'check-circle' : type==='error' ? 'alert-circle' : 'information'}
        size={16} color={colorMap[type]} />
      <Text style={[s.snackText, { color: colorMap[type] }]}>{msg}</Text>
    </View>
  );
};

// ─── Section Card / Title / Input ─────────────────────────────────────────────
const SectionCard = ({ children, style }: any) => (
  <View style={[s.sectionCard, style]}>{children}</View>
);

const SectionTitle = ({ icon, label, badge, badgeColor }: any) => (
  <View style={s.sectionTitleRow}>
    <MaterialCommunityIcons name={icon} size={18} color={PRIMARY} />
    <Text style={s.sectionTitleText}>{label}</Text>
    {badge && (
      <View style={[s.badge, {
        backgroundColor:
          badgeColor==='success' ? rgba(SUCCESS,0.12) :
          badgeColor==='error'   ? rgba(ERROR_COL,0.12) : rgba(WARNING,0.12),
      }]}>
        <Text style={[s.badgeText, {
          color: badgeColor==='success' ? SUCCESS : badgeColor==='error' ? ERROR_COL : WARNING,
        }]}>{badge}</Text>
      </View>
    )}
  </View>
);

const InputField = ({
  icon, label, value, onChange, placeholder,
  error, multiline=false, rows=1, keyboardType='default', disabled=false,
}: any) => (
  <View style={s.inputWrap}>
    <Text style={s.inputLabel}>{label}</Text>
    <View style={[s.inputRow, error && s.inputRowError, disabled && s.inputRowDisabled]}>
      {icon && (
        <MaterialCommunityIcons name={icon} size={18} color={rgba(PRIMARY,0.5)} style={{ marginRight:8 }} />
      )}
      <TextInput
        style={[s.textInput, multiline && { height: rows*44, textAlignVertical:'top' }]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor="#bbb" multiline={multiline}
        numberOfLines={multiline ? rows : 1} keyboardType={keyboardType} editable={!disabled}
      />
    </View>
    {error ? <Text style={s.errorText}>{error}</Text> : null}
  </View>
);

// ─── Success Modal ────────────────────────────────────────────────────────────
const SuccessModal = ({ visible, visitData, onClose }: any) => {
  const scale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (visible) Animated.spring(scale, { toValue:1, useNativeDriver:true, tension:60, friction:8 }).start();
    else scale.setValue(0.7);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <Animated.View style={[s.successCard, { transform:[{ scale }] }]}>
          <View style={s.successIconWrap}>
            <MaterialCommunityIcons name="check-circle" size={56} color={SUCCESS} />
          </View>
          <Text style={s.successTitle}>Visit Created Successfully!</Text>
          <Text style={s.successSub}>Your visit has been recorded and synced.</Text>
          {visitData?.photos?.[0]?.url && (
            <Image source={{ uri: visitData.photos[0].url }} style={s.successImage} />
          )}
          {visitData?.locationName && (
            <View style={s.successInfoRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color={PRIMARY} />
              <Text style={s.successInfoText}>{visitData.locationName}</Text>
            </View>
          )}
          {visitData?.coordinates && (
            <View style={s.coordRow}>
              <View style={s.coordBox}>
                <Text style={s.coordLabel}>Latitude</Text>
                <Text style={s.coordVal}>{visitData.coordinates.lat?.toFixed(6)}°</Text>
              </View>
              <View style={s.coordBox}>
                <Text style={s.coordLabel}>Longitude</Text>
                <Text style={s.coordVal}>{visitData.coordinates.lng?.toFixed(6)}°</Text>
              </View>
            </View>
          )}
          <View style={s.successBtns}>
            <TouchableOpacity style={s.successCloseBtn} onPress={onClose}>
              <Text style={s.successCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const CreateVisitScreen: React.FC<Props> = ({ onClose, onSave, onBackPress }) => {
  const { fetchAPI } = useAuth();

  // ── useGeo replaces: location, locationLoading, locationAttempts,
  //    geocoding, reverseGeocode(), getCurrentLocation(), and its useEffect.
  //
  //    address.short  → auto-fill locationName
  //    latitude/longitude → submitted with the form
  //    loading  → shown in the map refresh button / overlay
  //    error    → shown in the map overlay
  //    gpsOff   → true when 503 / null-location; alerts are already shown
  //               by the hook so no extra Alert.alert() is needed here
  // ──────────────────────────────────────────────────────────────────────────
  const {
    latitude,
    longitude,
    accuracy,
    address:    geoAddress,
    loading:    locationLoading,
    error:      locationError,
    gpsOff,
    fetchLocation,
  } = useGeo();

  // Auto-fill locationName from reverse-geocoded address (once, when it arrives)
  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (geoAddress?.short && !autoFilledRef.current) {
      setFormData(prev =>
        prev.locationName.trim() === ''
          ? { ...prev, locationName: geoAddress.short }
          : prev
      );
      autoFilledRef.current = true;
    }
  }, [geoAddress]);

  // Reset auto-fill flag if the user manually clears the field so it can
  // re-populate if they hit Refresh and get a new address.
  // (handled implicitly: autoFilledRef stays false after reset())

  // Kick off location fetch on mount
  useEffect(() => { fetchLocation(); }, []);

  // ── Other screen state ────────────────────────────────────────────────────
  const [loading,          setLoading]          = useState(false);
  const [imageData,        setImageData]        = useState<ImageData | null>(null);
  const [preview,          setPreview]          = useState<string | null>(null);
  const [isLeadCreated,    setIsLeadCreated]    = useState<'yes'|'no'|'other'>('no');
  const [submitError,      setSubmitError]      = useState<string | null>(null);
  const [success,          setSuccess]          = useState(false);
  const [createdVisit,     setCreatedVisit]     = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<any>({});
  const [snack,            setSnack]            = useState<{ msg:string; type:any }|null>(null);
  const [punchInAddress,   setPunchInAddress]   = useState<string | null>(null);
  const [punchInTime,      setPunchInTime]      = useState<string | null>(null);
  const [suggestions,      setSuggestions]      = useState<any[]>([]);
  const [showSuggestions,  setShowSuggestions]  = useState(false);
  const [searchingLeads,   setSearchingLeads]   = useState(false);

  const [formData, setFormData] = useState<FormData>({
    locationName:'', remarks:'', contactPerson:'', phone:'', email:'',
  });
  const leadOptionCreatesLead = true;

  const showSnack = useCallback((msg: string, type: any = 'success') => {
    setSnack({ msg, type });
    setTimeout(() => setSnack(null), 3000);
  }, []);

  // ── Punch-in fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const data  = await fetchAPI(`/attendance?startDate=${today}&endDate=${today}&limit=1`, { method:'GET' });
        const list  = data?.result?.attendances || data?.attendances || [];
        const att   = Array.isArray(list) ? list[0] : list;
        if (att?.punchIn?.time && !att?.punchOut?.time) {
          const addr = att.punchIn?.address;
          setPunchInAddress(typeof addr==='string' ? addr : addr?.full || addr?.short || null);
          setPunchInTime(att.punchIn.time);
        }
      } catch (e: any) { console.warn('Punch-in fetch failed:', e.message); }
    })();
  }, [fetchAPI]);

  // ── Lead autocomplete ─────────────────────────────────────────────────────
  const searchLeads = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      setSearchingLeads(true);
      const data = await fetchAPI(`/lead/getAll?search=${encodeURIComponent(query)}&limit=5`, { method:'GET' });
      const leads = data?.result?.leads || data?.result || [];
      setSuggestions(leads);
      setShowSuggestions(leads.length > 0);
    } catch (e) { console.warn('Lead search failed:', e); }
    finally { setSearchingLeads(false); }
  }, [fetchAPI]);

  const handleSelectSuggestion = (lead: any) => {
    setFormData(prev => ({
      ...prev,
      contactPerson: `${lead.firstName} ${lead.lastName}`.trim(),
      phone: lead.phone || '',
      email: lead.email || '',
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Camera ────────────────────────────────────────────────────────────────
  const handleCameraCapture = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title:'Camera Permission', message:'Needed only if you want to attach a site photo.',
        buttonPositive:'Allow', buttonNegative:'Deny',
      });
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) { showSnack('Camera permission denied.', 'error'); return; }
    }
    launchCamera(
      { mediaType:'photo', quality:0.8, maxWidth:1920, maxHeight:1080, saveToPhotos:false },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) { showSnack(response.errorMessage || 'Camera error', 'error'); return; }
        const asset = response.assets?.[0];
        if (!asset?.uri) return;
        if (asset.fileSize && asset.fileSize > 10*1024*1024) { showSnack('Image must be under 10 MB', 'error'); return; }
        setImageData({ uri:asset.uri, type:asset.type||'image/jpeg', name:asset.fileName||`visit_${Date.now()}.jpg` });
        setPreview(asset.uri);
        setValidationErrors((p: any) => ({ ...p, photo:'' }));
      }
    );
  }, [showSnack]);

  const handleRemovePhoto = () => { setImageData(null); setPreview(null); };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleChange = (field: keyof FormData) => (val: string) => {
    setFormData(p => ({ ...p, [field]:val }));
    if (validationErrors[field]) setValidationErrors((p: any) => ({ ...p, [field]:'' }));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: any = {};
    if (!formData.locationName.trim()) errors.locationName = 'Location name is required';
    if (latitude === null || longitude === null) errors.location = 'Location coordinates are required';
    if (leadOptionCreatesLead) {
      if (
        !formData.contactPerson.trim() &&
        !formData.phone.trim() &&
        !formData.email.trim()
      ) {
        errors.contactPerson = 'Enter at least one contact detail';
      }
      if (formData.phone && !/^[0-9+\-\s()]{10,15}$/.test(formData.phone)) errors.phone = 'Enter a valid phone number';
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Enter a valid email';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) { showSnack('Please fill all required fields correctly', 'error'); return; }
    setLoading(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.append('latitude',     latitude!.toString());
      fd.append('longitude',    longitude!.toString());
      fd.append('locationName', formData.locationName.trim());
      fd.append('isLeadCreated',isLeadCreated);
      if (formData.remarks.trim())       fd.append('remarks',       formData.remarks.trim());
      if (formData.contactPerson.trim()) fd.append('contactPerson', formData.contactPerson.trim());
      if (formData.phone.trim())         fd.append('phone',         formData.phone.trim());
      if (formData.email.trim())         fd.append('email',         formData.email.trim());
      if (imageData) {
        fd.append('photos', { uri:imageData.uri, type:imageData.type, name:imageData.name } as any);
      }

      const visitJson = await fetchAPI('/visit', { method:'POST', body:fd });
      const visitResult = visitJson?.result ?? visitJson?.data ?? visitJson;
      const visitData = visitResult?.visit ?? visitResult;
      const createdLead = visitResult?.lead ?? visitData?.leadCreated ?? null;
      const createdLeadId =
        createdLead?._id ||
        (typeof createdLead === 'string' ? createdLead : null) ||
        visitData?.leadCreated?._id ||
        (typeof visitData?.leadCreated === 'string' ? visitData.leadCreated : null);

      if (!visitData?._id) {
        throw new Error(visitJson?.message || visitResult?.message || 'Visit was created, but the app could not read the response');
      }

      if (leadOptionCreatesLead && !createdLeadId) {
        throw new Error('Visit was saved, but lead was not created. Please check backend lead creation.');
      }

      setCreatedVisit(visitData);
      setSuccess(true);
      showSnack('Visit created successfully', 'success');
      if (onSave) onSave(visitData);
      setImageData(null); setPreview(null);
      setFormData({ locationName:'', remarks:'', contactPerson:'', phone:'', email:'' });
      setIsLeadCreated('no');
      autoFilledRef.current = false; // allow re-fill on next open
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create visit');
      showSnack(err.message || 'Failed to create visit', 'error');
    } finally { setLoading(false); }
  };

  // latitude/longitude come from useGeo; both must be non-null to enable submit
  const hasCoords = latitude !== null && longitude !== null;
  const requiresContact = true;
  const canSubmit  =
    !loading &&
    hasCoords &&
    !!formData.locationName.trim() &&
    (
      !requiresContact ||
      !!formData.contactPerson.trim() ||
      !!formData.phone.trim() ||
      !!formData.email.trim()
    );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBackPress || onClose} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex:1, marginLeft:12 }}>
          <Text style={s.headerTitle}>Create New Visit</Text>
          <Text style={s.headerDate}>{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</Text>
        </View>
      </View>
      <View style={s.headerGradientLine} />

      {snack && <SnackBar msg={snack.msg} type={snack.type} />}

      <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
        <ScrollView style={{ flex:1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Punch-in banner */}
          {punchInAddress && (
            <View style={s.punchBanner}>
              <View style={s.pulseDot} />
              <MaterialCommunityIcons name="map-marker" size={14} color="#16a34a" />
              <View style={{ flex:1, marginLeft:6 }}>
                <Text style={s.punchAddr} numberOfLines={1}>{punchInAddress}</Text>
                {punchInTime && (
                  <Text style={s.punchTime}>
                    On duty since {new Date(punchInTime).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                  </Text>
                )}
              </View>
              <View style={s.onDutyBadge}><Text style={s.onDutyText}>On Duty</Text></View>
            </View>
          )}

          {/* ── Camera ── */}
          <SectionCard>
              <SectionTitle icon="camera" label="Site Photo"
                badge={imageData ? 'Captured' : 'Optional'}
              badgeColor={imageData ? 'success' : 'error'} />
            {preview ? (
              <View style={s.previewWrap}>
                <Image source={{ uri:preview }} style={s.previewImage} resizeMode="cover" />
                <View style={s.previewOverlay}>
                  <TouchableOpacity style={s.previewBtn} onPress={handleCameraCapture}>
                    <MaterialCommunityIcons name="camera-retake" size={18} color="#fff" />
                    <Text style={s.previewBtnTxt}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.previewBtn, { backgroundColor:rgba(ERROR_COL,0.85) }]} onPress={handleRemovePhoto}>
                    <MaterialCommunityIcons name="delete" size={18} color="#fff" />
                    <Text style={s.previewBtnTxt}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.uploadArea} onPress={handleCameraCapture} activeOpacity={0.8}>
                <MaterialCommunityIcons name="camera-plus" size={48} color={rgba(PRIMARY,0.5)} />
                <Text style={s.uploadTitle}>Tap to open camera</Text>
                    <Text style={s.uploadSub}>Optional site photo · Max 10 MB</Text>
                <View style={s.uploadBtn}>
                  <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                  <Text style={s.uploadBtnTxt}>Open Camera</Text>
                </View>
              </TouchableOpacity>
            )}
            {validationErrors.photo ? <Text style={s.errorText}>{validationErrors.photo}</Text> : null}
          </SectionCard>

          {/* ── Map ── */}
          <SectionCard style={{ padding:0, overflow:'hidden' }}>
            <View style={{ paddingHorizontal:16, paddingTop:16, paddingBottom:8, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <MaterialCommunityIcons name="crosshairs-gps" size={18} color={PRIMARY} />
                <Text style={s.sectionTitleText}>Your Location</Text>
              </View>
              {/* fetchLocation() from useGeo — replaces getCurrentLocation() */}
              <TouchableOpacity onPress={fetchLocation} disabled={locationLoading} style={s.refreshBtn}>
                {locationLoading
                  ? <ActivityIndicator size="small" color={PRIMARY} />
                  : <MaterialCommunityIcons name="refresh" size={16} color={PRIMARY} />}
                <Text style={s.refreshTxt}>{locationLoading ? 'Locating…' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height:260, position:'relative' }}>
              {hasCoords ? (
                <LeafletMap
                  lat={latitude!}
                  lng={longitude!}
                  accuracy={accuracy ?? undefined}
                  zoom={16}
                  height={260}
                  primaryColor={PRIMARY}
                />
              ) : locationLoading ? (
                <View style={s.mapOverlay}>
                  <ActivityIndicator size="large" color={PRIMARY} />
                  <Text style={s.mapOverlayTxt}>Getting your location…</Text>
                </View>
              ) : (
                <View style={s.mapOverlay}>
                  <MaterialCommunityIcons
                    name={gpsOff ? 'crosshairs-off' : 'map-marker-off'}
                    size={40} color={ERROR_COL} />
                  <Text style={[s.mapOverlayTxt, { color:ERROR_COL }]}>
                    {locationError || 'Failed to get location'}
                  </Text>
                  {/* fetchLocation() will show the GPS-off alert again if needed */}
                  <TouchableOpacity style={s.mapRetryBtn} onPress={fetchLocation}>
                    <Text style={s.mapRetryTxt}>{gpsOff ? 'Turn on GPS & Retry' : 'Retry'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {hasCoords && (
              <View style={s.coordInfoRow}>
                <MaterialCommunityIcons name="check-circle" size={14} color={SUCCESS} />
                <Text style={s.coordInfoTxt}>{latitude!.toFixed(5)}°, {longitude!.toFixed(5)}°</Text>
                {accuracy != null && (
                  <View style={[s.accuracyChip, {
                    backgroundColor:
                      accuracy<=20 ? rgba(SUCCESS,0.12) :
                      accuracy<=50 ? rgba(WARNING,0.12) : rgba(ERROR_COL,0.12),
                  }]}>
                    <Text style={[s.accuracyTxt, {
                      color: accuracy<=20 ? SUCCESS : accuracy<=50 ? WARNING : ERROR_COL,
                    }]}>±{accuracy.toFixed(0)} m</Text>
                  </View>
                )}
              </View>
            )}
            {validationErrors.location
              ? <Text style={[s.errorText, { marginHorizontal:16, marginBottom:12 }]}>{validationErrors.location}</Text>
              : null}
          </SectionCard>

          {/* ── Location Name ── */}
          <SectionCard>
            <SectionTitle icon="office-building" label="Location Details" />
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Location / Business Name *</Text>
              <View style={[s.inputRow, validationErrors.locationName && s.inputRowError]}>
                {/* Show spinner while reverse-geocoding (locationLoading covers both GPS + geocode) */}
                {locationLoading && !hasCoords
                  ? <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight:8 }} />
                  : <MaterialCommunityIcons name="map-marker" size={18} color={rgba(PRIMARY,0.5)} style={{ marginRight:8 }} />}
                <TextInput
                  style={s.textInput}
                  value={formData.locationName}
                  onChangeText={handleChange('locationName')}
                  placeholder="Auto-filled from GPS or enter manually"
                  placeholderTextColor="#bbb"
                  editable={!loading}
                />
                {formData.locationName.length > 0 && (
                  <TouchableOpacity onPress={() => setFormData(p => ({ ...p, locationName:'' }))} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                  </TouchableOpacity>
                )}
              </View>
              {locationLoading && !hasCoords
                ? <Text style={s.detectingText}>📍 Detecting location name from GPS…</Text>
                : null}
              {validationErrors.locationName ? <Text style={s.errorText}>{validationErrors.locationName}</Text> : null}
            </View>
          </SectionCard>

          {/* ── Lead Toggle ── */}
          <SectionCard>
            <SectionTitle icon="account-plus" label="New Lead Created?" />
            <View style={s.radioRow}>
              {(['yes','no','other'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.radioOpt, isLeadCreated===opt && s.radioOptActive]}
                  onPress={() => {
                    setIsLeadCreated(opt);
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setValidationErrors({});
                    setSubmitError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[s.radioCircle, isLeadCreated===opt && s.radioCircleActive]}>
                    {isLeadCreated===opt && <View style={s.radioInner} />}
                  </View>
                  <Text style={[s.radioLabel, isLeadCreated===opt && s.radioLabelActive]}>
                    {opt.charAt(0).toUpperCase()+opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>

          {/* ── Contact Fields ── */}
          {(isLeadCreated==='yes' || isLeadCreated==='no') && (
            <SectionCard>
              <SectionTitle icon="account" label="Contact Information"
                badge="Visit + Lead"
                badgeColor="success" />
              <View style={{ position:'relative' }}>
                <View style={s.inputWrap}>
                  <Text style={s.inputLabel}>Contact Person</Text>
                  <View style={[s.inputRow, validationErrors.contactPerson && s.inputRowError]}>
                    <MaterialCommunityIcons name="account" size={18} color={rgba(PRIMARY,0.5)} style={{ marginRight:8 }} />
                    <TextInput
                      style={[s.textInput, { flex:1 }]}
                      value={formData.contactPerson}
                      onChangeText={(val) => { handleChange('contactPerson')(val); searchLeads(val); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="Enter contact name" placeholderTextColor="#bbb" editable={!loading}
                    />
                    {searchingLeads && <ActivityIndicator size="small" color={PRIMARY} />}
                  </View>
                  {validationErrors.contactPerson ? <Text style={s.errorText}>{validationErrors.contactPerson}</Text> : null}
                </View>
                {showSuggestions && suggestions.length > 0 && (
                  <View style={s.suggestionsBox}>
                    {suggestions.map((lead, i) => (
                      <TouchableOpacity key={lead._id}
                        style={[s.suggestionRow, i<suggestions.length-1 && s.suggestionBorder]}
                        onPress={() => handleSelectSuggestion(lead)} activeOpacity={0.8}>
                        <View style={s.suggestionAvatar}>
                          <Text style={s.suggestionAvatarText}>{lead.firstName?.[0]}{lead.lastName?.[0]}</Text>
                        </View>
                        <View style={{ flex:1 }}>
                          <Text style={s.suggestionName}>{lead.firstName} {lead.lastName}</Text>
                          <View style={{ flexDirection:'row', gap:8 }}>
                            {lead.phone && <Text style={s.suggestionMeta}>📞 {lead.phone}</Text>}
                            {lead.email && <Text style={s.suggestionMeta}>✉ {lead.email}</Text>}
                          </View>
                        </View>
                        {lead.status && (
                          <View style={s.suggestionChip}><Text style={s.suggestionChipTxt}>{lead.status}</Text></View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <InputField icon="phone" label="Phone Number" value={formData.phone} onChange={handleChange('phone')}
                placeholder="Enter phone number" error={validationErrors.phone} keyboardType="phone-pad" disabled={loading} />
              <InputField icon="email" label="Email Address" value={formData.email} onChange={handleChange('email')}
                placeholder="Enter email" error={validationErrors.email} keyboardType="email-address" disabled={loading} />
            </SectionCard>
          )}

          {/* ── Remarks ── */}
          <SectionCard>
            <SectionTitle icon="note-text"
              label={isLeadCreated==='other' ? 'Description' : 'Visit Notes'}
                    badge={isLeadCreated==='other' ? (formData.remarks.trim() ? 'Filled' : undefined) : undefined}
              badgeColor={formData.remarks.trim() ? 'success' : 'error'} />
            <InputField icon="text"
                    label={isLeadCreated==='other' ? 'Description (optional)' : 'Notes (optional)'}
              value={formData.remarks} onChange={handleChange('remarks')}
              placeholder={isLeadCreated==='other' ? 'Enter a description of this visit…' : 'Enter any additional notes…'}
              error={validationErrors.remarks} multiline rows={4} disabled={loading} />
          </SectionCard>

          {/* Submit-level error (GPS errors are handled by the hook's own alerts) */}
          {submitError && (
            <View style={s.errorBanner}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={ERROR_COL} />
              <Text style={s.errorBannerTxt}>{submitError}</Text>
            </View>
          )}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onBackPress || onClose} disabled={loading}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleSubmit} disabled={!canSubmit} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialCommunityIcons name="content-save" size={18} color="#fff" />}
              <Text style={s.submitTxt}>{loading ? 'Creating Visit…' : 'Create Visit'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={success} visitData={createdVisit}
        onClose={() => { setSuccess(false); onClose?.(); }}
      />
    </View>
  );
};

export default CreateVisitScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:{ flex:1, backgroundColor:BG },
  header:{ flexDirection:'row', alignItems:'center', backgroundColor:PRIMARY, paddingHorizontal:16, paddingTop:Platform.OS==='ios'?56:14, paddingBottom:14 },
  backBtn:{ width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' },
  headerTitle:{ fontSize:18, fontWeight:'800', color:'#fff', letterSpacing:-0.3 },
  headerDate:{ fontSize:11, color:'rgba(255,255,255,0.75)', marginTop:2 },
  headerGradientLine:{ height:3, backgroundColor:SECONDARY },
  snackBar:{ flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:12, marginTop:8, padding:12, borderRadius:12 },
  snackText:{ fontSize:13, fontWeight:'600', flex:1 },
  body:{ padding:14, gap:14, paddingBottom:40 },
  punchBanner:{ flexDirection:'row', alignItems:'center', backgroundColor:'#f0fdf4', borderWidth:1, borderColor:'#bbf7d0', borderRadius:12, paddingHorizontal:12, paddingVertical:10, gap:8 },
  pulseDot:{ width:9, height:9, borderRadius:5, backgroundColor:'#22c55e', flexShrink:0 },
  punchAddr:{ fontSize:12, fontWeight:'700', color:'#14532d' },
  punchTime:{ fontSize:11, color:'#16a34a', marginTop:1 },
  onDutyBadge:{ paddingHorizontal:8, paddingVertical:3, borderRadius:20, borderWidth:1, borderColor:'#86efac' },
  onDutyText:{ fontSize:10, fontWeight:'800', color:'#16a34a' },
  sectionCard:{ backgroundColor:'#fff', borderRadius:16, padding:16, shadowColor:'#000', shadowOffset:{ width:0, height:2 }, shadowOpacity:0.04, shadowRadius:8, elevation:2 },
  sectionTitleRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:14 },
  sectionTitleText:{ fontSize:14, fontWeight:'700', color:PRIMARY, flex:1 },
  badge:{ paddingHorizontal:8, paddingVertical:3, borderRadius:20 },
  badgeText:{ fontSize:10, fontWeight:'700' },
  uploadArea:{ borderWidth:2, borderColor:rgba(PRIMARY,0.25), borderStyle:'dashed', borderRadius:14, padding:32, alignItems:'center', backgroundColor:rgba(PRIMARY,0.02) },
  uploadTitle:{ fontSize:15, fontWeight:'700', color:PRIMARY, marginTop:12 },
  uploadSub:{ fontSize:12, color:'#aaa', marginTop:4, textAlign:'center' },
  uploadBtn:{ flexDirection:'row', alignItems:'center', gap:6, marginTop:16, backgroundColor:PRIMARY, paddingHorizontal:20, paddingVertical:10, borderRadius:10 },
  uploadBtnTxt:{ fontSize:13, fontWeight:'700', color:'#fff' },
  previewWrap:{ borderRadius:14, overflow:'hidden', height:240 },
  previewImage:{ width:'100%', height:'100%' },
  previewOverlay:{ position:'absolute', bottom:0, left:0, right:0, flexDirection:'row', justifyContent:'space-between', padding:12, backgroundColor:'rgba(0,0,0,0.4)' },
  previewBtn:{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:rgba(PRIMARY,0.85), paddingHorizontal:14, paddingVertical:8, borderRadius:8 },
  previewBtnTxt:{ fontSize:13, fontWeight:'600', color:'#fff' },
  inputWrap:{ marginBottom:12 },
  inputLabel:{ fontSize:12, fontWeight:'600', color:'#555', marginBottom:6 },
  inputRow:{ flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#e0e7ff', borderRadius:10, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fafbff' },
  inputRowError:{ borderColor:ERROR_COL },
  inputRowDisabled:{ opacity:0.6 },
  textInput:{ flex:1, fontSize:14, color:'#1a1a3e', padding:0 },
  errorText:{ fontSize:11, color:ERROR_COL, marginTop:4 },
  detectingText:{ fontSize:11, color:PRIMARY, marginTop:4 },
  radioRow:{ flexDirection:'row', gap:10 },
  radioOpt:{ flex:1, flexDirection:'row', alignItems:'center', gap:7, padding:12, borderRadius:10, borderWidth:1.5, borderColor:'#e0e7ff', backgroundColor:'#fafbff' },
  radioOptActive:{ borderColor:PRIMARY, backgroundColor:rgba(PRIMARY,0.06) },
  radioCircle:{ width:18, height:18, borderRadius:9, borderWidth:2, borderColor:'#ccc', alignItems:'center', justifyContent:'center' },
  radioCircleActive:{ borderColor:PRIMARY },
  radioInner:{ width:9, height:9, borderRadius:5, backgroundColor:PRIMARY },
  radioLabel:{ fontSize:13, fontWeight:'600', color:'#555' },
  radioLabelActive:{ color:PRIMARY },
  suggestionsBox:{ position:'absolute', top:'100%', left:0, right:0, backgroundColor:'#fff', borderRadius:10, zIndex:999, elevation:12, shadowColor:'#000', shadowOffset:{ width:0, height:4 }, shadowOpacity:0.12, shadowRadius:8, borderWidth:1, borderColor:rgba(PRIMARY,0.15), marginTop:2 },
  suggestionRow:{ flexDirection:'row', alignItems:'center', padding:12, gap:10 },
  suggestionBorder:{ borderBottomWidth:1, borderBottomColor:rgba(PRIMARY,0.08) },
  suggestionAvatar:{ width:36, height:36, borderRadius:18, backgroundColor:rgba(PRIMARY,0.12), alignItems:'center', justifyContent:'center' },
  suggestionAvatarText:{ fontSize:11, fontWeight:'800', color:PRIMARY },
  suggestionName:{ fontSize:13, fontWeight:'700', color:'#1a1a3e' },
  suggestionMeta:{ fontSize:11, color:'#888' },
  suggestionChip:{ paddingHorizontal:8, paddingVertical:3, borderRadius:20, backgroundColor:rgba(PRIMARY,0.1) },
  suggestionChipTxt:{ fontSize:10, fontWeight:'700', color:PRIMARY },
  mapOverlay:{ ...StyleSheet.absoluteFillObject, zIndex:100, backgroundColor:'rgba(255,255,255,0.88)', alignItems:'center', justifyContent:'center', gap:10 },
  mapOverlayTxt:{ fontSize:13, color:'#555', textAlign:'center', paddingHorizontal:20 },
  mapRetryBtn:{ backgroundColor:PRIMARY, paddingHorizontal:20, paddingVertical:8, borderRadius:8, marginTop:4 },
  mapRetryTxt:{ fontSize:13, fontWeight:'700', color:'#fff' },
  refreshBtn:{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:12, paddingVertical:6, borderRadius:8, backgroundColor:rgba(PRIMARY,0.08) },
  refreshTxt:{ fontSize:12, fontWeight:'600', color:PRIMARY },
  coordInfoRow:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:16, paddingVertical:10, backgroundColor:rgba(PRIMARY,0.03) },
  coordInfoTxt:{ fontSize:12, fontWeight:'600', color:'#333', flex:1, fontFamily:Platform.OS==='ios'?'Courier':'monospace' },
  accuracyChip:{ paddingHorizontal:8, paddingVertical:3, borderRadius:20 },
  accuracyTxt:{ fontSize:11, fontWeight:'700' },
  errorBanner:{ flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'#fee2e2', borderRadius:10, padding:12 },
  errorBannerTxt:{ flex:1, fontSize:13, color:ERROR_COL, lineHeight:18 },
  actionRow:{ flexDirection:'row', gap:12, marginTop:8 },
  cancelBtn:{ flex:1, paddingVertical:14, borderRadius:12, borderWidth:1.5, borderColor:PRIMARY, alignItems:'center' },
  cancelTxt:{ fontSize:14, fontWeight:'600', color:PRIMARY },
  submitBtn:{ flex:2, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, borderRadius:12, backgroundColor:PRIMARY },
  submitBtnDisabled:{ backgroundColor:rgba(PRIMARY,0.35) },
  submitTxt:{ fontSize:14, fontWeight:'800', color:'#fff' },
  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', paddingHorizontal:24 },
  successCard:{ backgroundColor:'#fff', borderRadius:24, padding:28, width:'100%', alignItems:'center' },
  successIconWrap:{ width:80, height:80, borderRadius:40, backgroundColor:rgba(SUCCESS,0.12), alignItems:'center', justifyContent:'center', marginBottom:16 },
  successTitle:{ fontSize:20, fontWeight:'800', color:'#1a1a3e', marginBottom:6, textAlign:'center' },
  successSub:{ fontSize:13, color:'#888', marginBottom:16, textAlign:'center' },
  successImage:{ width:'100%', height:180, borderRadius:12, marginBottom:12 },
  successInfoRow:{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:12 },
  successInfoText:{ fontSize:14, fontWeight:'600', color:'#1a1a3e', flex:1 },
  coordRow:{ flexDirection:'row', gap:10, width:'100%', marginBottom:20 },
  coordBox:{ flex:1, backgroundColor:rgba(PRIMARY,0.05), borderRadius:10, padding:12 },
  coordLabel:{ fontSize:11, color:'#888', marginBottom:3 },
  coordVal:{ fontSize:13, fontWeight:'700', color:'#1a1a3e' },
  successBtns:{ flexDirection:'row', gap:12, width:'100%' },
  successCloseBtn:{ flex:1, paddingVertical:14, borderRadius:12, borderWidth:1.5, borderColor:PRIMARY, alignItems:'center' },
  successCloseTxt:{ fontSize:14, fontWeight:'600', color:PRIMARY },
});
