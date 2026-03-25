import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// Uses built-in navigator.geolocation — no extra native package needed
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Coords {
  latitude:  number;
  longitude: number;
}

interface CreateVisitScreenProps {
  onBack:          () => void;
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
}

// ─── Permission helpers ───────────────────────────────────────────────────────
const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return true; // iOS prompts automatically via navigator.geolocation
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title:   'Location Permission Required',
        message: 'This app needs your location to log visit details and show the map.',
        buttonNeutral:  'Ask Me Later',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CreateVisitScreen: React.FC<CreateVisitScreenProps> = ({
  onBack,
  onMenuPress,
  onSearchPress,
  onProfilePress,
}) => {
  // ── Location state ──────────────────────────────────────────────────────
  const [locationState, setLocationState] = useState<
    'idle' | 'requesting' | 'fetching' | 'granted' | 'denied' | 'error'
  >('idle');
  const [coords,      setCoords]      = useState<Coords | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const mapRef = useRef<MapView>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState('');
  const [contactName,  setContactName]  = useState('');
  const [phone,        setPhone]        = useState('');
  const [email,        setEmail]        = useState('');
  const [notes,        setNotes]        = useState('');
  const [solarExisting, setSolarExisting] = useState<'yes' | 'no' | 'other' | null>(null);
  const [photoTaken,   setPhotoTaken]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // ── On mount: check & request location ─────────────────────────────────
  useEffect(() => {
    initLocation();
  }, []);

  const initLocation = async () => {
    setLocationState('requesting');
    const granted = await requestLocationPermission();
    if (!granted) {
      setLocationState('denied');
      return;
    }
    fetchLocation();
  };

  const fetchLocation = () => {
    setLocationState('fetching');

    if (!navigator.geolocation) {
      setLocationState('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const c: Coords = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(c);
        setLocationState('granted');
        setIsConnected(true);
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude:       c.latitude,
              longitude:      c.longitude,
              latitudeDelta:  0.01,
              longitudeDelta: 0.01,
            },
            600,
          );
        }, 300);
      },
      err => {
        console.warn('Geolocation error:', err.code, err.message);
        setLocationState('error');
        setIsConnected(false);
      },
      {
        enableHighAccuracy: true,
        timeout:            15000,
        maximumAge:         0,
      },
    );
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!businessName.trim()) {
      Alert.alert('Required', 'Please enter the Location / Business Name.');
      return;
    }
    if (!photoTaken) {
      Alert.alert('Required', 'Please take a site photo before creating the visit.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert('Success', 'Visit created successfully!', [
        {text: 'OK', onPress: onBack},
      ]);
    }, 1200);
  };

  // ── Map region ──────────────────────────────────────────────────────────
  const mapRegion = coords
    ? {
        latitude:       coords.latitude,
        longitude:      coords.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude:       20.2961,   // fallback: Bhubaneswar
        longitude:      85.8245,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenuPress} style={styles.topBtn}>
          <MaterialCommunityIcons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSearchPress} style={styles.topBtn}>
          <MaterialCommunityIcons name="magnify" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfilePress} style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>RS</Text>
        </TouchableOpacity>
      </View>

      {/* ── Hero Banner ── */}
      <View style={styles.heroBanner}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Create New Visit</Text>
          <Text style={styles.heroSubtitle}>
            {new Date().toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}
          </Text>
        </View>
        {/* Connected indicator */}
        <View style={[styles.connectedChip, isConnected && styles.connectedChipActive]}>
          <MaterialCommunityIcons
            name={isConnected ? 'wifi' : 'wifi-off'}
            size={14}
            color={isConnected ? '#fff' : 'rgba(255,255,255,0.6)'}
          />
          <Text style={[styles.connectedText, !isConnected && styles.connectedTextOff]}>
            {isConnected ? 'Connected' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Site Photo ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="camera-outline" size={20} color="#3b5bdb" />
            <Text style={styles.cardTitle}>Site Photo</Text>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredBadgeText}>Required</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.photoBox, photoTaken && styles.photoBoxDone]}
            onPress={() => {
              setPhotoTaken(true);
              Alert.alert('Camera', 'Photo captured successfully!');
            }}
            activeOpacity={0.8}>
            {photoTaken ? (
              <View style={styles.photoTakenContent}>
                <MaterialCommunityIcons name="check-circle" size={40} color="#2e7d32" />
                <Text style={styles.photoTakenText}>Photo Captured</Text>
                <Text style={styles.photoRetakeText}>Tap to retake</Text>
              </View>
            ) : (
              <View style={styles.photoPlaceholderContent}>
                <MaterialCommunityIcons name="camera" size={44} color="#a0aec0" />
                <Text style={styles.photoTapText}>Tap to open camera</Text>
                <Text style={styles.photoHintText}>
                  Take a photo of the site · Max 10 MB
                </Text>
                <TouchableOpacity
                  style={styles.openCameraBtn}
                  onPress={() => {
                    setPhotoTaken(true);
                    Alert.alert('Camera', 'Photo captured!');
                  }}>
                  <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                  <Text style={styles.openCameraBtnText}>Open Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Location Details ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="office-building-outline" size={20} color="#3b5bdb" />
            <Text style={styles.cardTitle}>Location Details</Text>
          </View>

          <FormField
            label="Location / Business Name"
            placeholder="e.g., Client Office, Store Name"
            value={businessName}
            onChangeText={setBusinessName}
            icon="map-marker-outline"
            required
          />

          {/* Solar Existing */}
          <Text style={styles.fieldLabel}>
            Existing Solar System?
          </Text>
          <View style={styles.radioRow}>
            {(['yes', 'no', 'other'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.radioItem}
                onPress={() => setSolarExisting(opt)}
                activeOpacity={0.75}>
                <View style={[
                  styles.radioOuter,
                  solarExisting === opt && styles.radioOuterActive,
                ]}>
                  {solarExisting === opt && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioLabel}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Contact Information ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="account-outline" size={20} color="#3b5bdb" />
            <Text style={styles.cardTitle}>Contact Information</Text>
          </View>

          <FormField
            label="Contact Person"
            placeholder="Enter contact name"
            value={contactName}
            onChangeText={setContactName}
            icon="account-outline"
          />
          <FormField
            label="Phone Number"
            placeholder="Enter phone number"
            value={phone}
            onChangeText={setPhone}
            icon="phone-outline"
            keyboardType="phone-pad"
          />
          <FormField
            label="Email Address"
            placeholder="Enter email"
            value={email}
            onChangeText={setEmail}
            icon="email-outline"
            keyboardType="email-address"
          />
        </View>

        {/* ── Your Location (Map) ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRowSpaced}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#3b5bdb" />
              <Text style={styles.cardTitle}>Your Location</Text>
            </View>
            {locationState === 'granted' && (
              <TouchableOpacity style={styles.refreshBtn} onPress={fetchLocation}>
                <MaterialCommunityIcons name="refresh" size={16} color="#3b5bdb" />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Location States ── */}
          {locationState === 'idle' || locationState === 'requesting' ? (
            <View style={styles.mapStateBox}>
              <ActivityIndicator size="large" color="#3b5bdb" />
              <Text style={styles.mapStateText}>Requesting location permission…</Text>
            </View>
          ) : locationState === 'fetching' ? (
            <View style={styles.mapStateBox}>
              <ActivityIndicator size="large" color="#3b5bdb" />
              <Text style={styles.mapStateText}>Fetching your location…</Text>
            </View>
          ) : locationState === 'denied' ? (
            <View style={styles.mapStateBox}>
              <MaterialCommunityIcons name="map-marker-off" size={48} color="#e53935" />
              <Text style={styles.mapStateTitleRed}>Location Permission Denied</Text>
              <Text style={styles.mapStateSubtext}>
                Please enable location access for this app to log visit details.
              </Text>
              <View style={styles.mapStateActions}>
                <TouchableOpacity style={styles.retryBtn} onPress={initLocation}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
                  <MaterialCommunityIcons name="cog-outline" size={16} color="#3b5bdb" />
                  <Text style={styles.settingsBtnText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : locationState === 'error' ? (
            <View style={styles.mapStateBox}>
              <MaterialCommunityIcons name="map-marker-alert" size={48} color="#e65100" />
              <Text style={styles.mapStateTitleOrange}>Unable to Get Location</Text>
              <Text style={styles.mapStateSubtext}>
                Make sure your GPS / device location is turned on and try again.
              </Text>
              <TouchableOpacity style={styles.retryBtnFull} onPress={fetchLocation}>
                <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
                <Text style={styles.retryBtnFullText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── MAP ──
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={mapRegion}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={true}
                toolbarEnabled={false}
                mapType="standard">
                {coords && (
                  <Marker
                    coordinate={coords}
                    title="Your Location"
                    description="Current position">
                    <View style={styles.markerOuter}>
                      <View style={styles.markerInner}>
                        <MaterialCommunityIcons name="navigation" size={16} color="#fff" />
                      </View>
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Map overlay controls */}
              <View style={styles.mapZoomControls}>
                <TouchableOpacity
                  style={styles.mapZoomBtn}
                  onPress={() => mapRef.current?.animateToRegion(
                    {...mapRegion, latitudeDelta: mapRegion.latitudeDelta / 2, longitudeDelta: mapRegion.longitudeDelta / 2},
                    300,
                  )}>
                  <Text style={styles.mapZoomBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapZoomBtn}
                  onPress={() => mapRef.current?.animateToRegion(
                    {...mapRegion, latitudeDelta: mapRegion.latitudeDelta * 2, longitudeDelta: mapRegion.longitudeDelta * 2},
                    300,
                  )}>
                  <Text style={styles.mapZoomBtnText}>−</Text>
                </TouchableOpacity>
              </View>

              {/* Coordinates chip */}
              {coords && (
                <View style={styles.coordsChip}>
                  <MaterialCommunityIcons name="map-marker-check" size={12} color="#2e7d32" />
                  <Text style={styles.coordsText}>
                    {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Location error banner (bottom of card) */}
          {(locationState === 'denied' || locationState === 'error') && (
            <View style={styles.locationErrorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#e65100" />
              <Text style={styles.locationErrorText}>
                {locationState === 'denied'
                  ? 'Location permission denied.'
                  : 'Location unavailable.'}
              </Text>
              <TouchableOpacity
                onPress={locationState === 'denied' ? openSettings : fetchLocation}>
                <Text style={styles.locationErrorAction}>
                  {locationState === 'denied' ? 'Enable' : 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Visit Notes ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="text-box-outline" size={20} color="#3b5bdb" />
            <Text style={styles.cardTitle}>Visit Notes</Text>
          </View>
          <View style={styles.notesInputWrap}>
            <TextInput
              style={styles.notesInput}
              placeholder="Enter any additional notes about the visit..."
              placeholderTextColor="#bbb"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={[styles.createBtn, submitting && styles.createBtnLoading]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="calendar-check" size={18} color="#fff" />
            )}
            <Text style={styles.createBtnText}>
              {submitting ? 'Creating…' : 'Create Visit'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onBack}
            activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 40}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Form Field ───────────────────────────────────────────────────────────────
const FormField: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  icon: string;
  required?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
}> = ({label, placeholder, value, onChangeText, icon, required, keyboardType = 'default'}) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.fieldRequired}> *</Text>}
    </Text>
    <View style={styles.inputWrap}>
      <MaterialCommunityIcons name={icon} size={18} color="#aaa" style={{marginRight: 8}} />
      <TextInput
        style={styles.textInput}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

export default CreateVisitScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   {flex: 1, backgroundColor: '#f0f4ff'},
  scroll: {flex: 1},

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    backgroundColor: '#3b5bdb', gap: 10,
  },
  topBtn: {padding: 4},
  profileAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: {color: '#fff', fontSize: 12, fontWeight: '700'},

  // Hero banner
  heroBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#3b5bdb',
    paddingHorizontal: 14, paddingBottom: 18, paddingTop: 4,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroText:    {flex: 1},
  heroTitle:   {fontSize: 17, fontWeight: '800', color: '#fff'},
  heroSubtitle:{fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2},
  connectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  connectedChipActive: {backgroundColor: 'rgba(255,255,255,0.25)'},
  connectedText:    {fontSize: 11, color: '#fff', fontWeight: '600'},
  connectedTextOff: {color: 'rgba(255,255,255,0.6)'},

  // Cards
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  cardTitleRowSpaced: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1a1a3e'},
  requiredBadge: {
    backgroundColor: '#ff9800', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  requiredBadgeText: {fontSize: 11, fontWeight: '700', color: '#fff'},

  // Photo box
  photoBox: {
    borderWidth: 2, borderColor: '#c5cfe8', borderStyle: 'dashed',
    borderRadius: 14, minHeight: 160,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8f9ff', overflow: 'hidden',
  },
  photoBoxDone:  {borderColor: '#a5d6a7', borderStyle: 'solid', backgroundColor: '#f1f8f2'},
  photoPlaceholderContent: {alignItems: 'center', padding: 24, gap: 6},
  photoTapText:  {fontSize: 15, fontWeight: '700', color: '#3b5bdb', marginTop: 4},
  photoHintText: {fontSize: 12, color: '#aaa', textAlign: 'center'},
  openCameraBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ff9800', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8, marginTop: 8,
  },
  openCameraBtnText: {fontSize: 13, fontWeight: '700', color: '#fff'},
  photoTakenContent: {alignItems: 'center', padding: 24, gap: 6},
  photoTakenText: {fontSize: 15, fontWeight: '700', color: '#2e7d32'},
  photoRetakeText:{fontSize: 12, color: '#888'},

  // Form fields
  fieldWrap:     {marginBottom: 14},
  fieldLabel:    {fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6},
  fieldRequired: {color: '#e03131'},
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8f9ff', borderRadius: 10,
    borderWidth: 1, borderColor: '#eef1ff',
    paddingHorizontal: 12, height: 46,
  },
  textInput: {flex: 1, fontSize: 14, color: '#222', padding: 0},

  // Radio
  radioRow:   {flexDirection: 'row', gap: 20, marginTop: 4},
  radioItem:  {flexDirection: 'row', alignItems: 'center', gap: 8},
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#ccc',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: {borderColor: '#3b5bdb'},
  radioInner: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b5bdb',
  },
  radioLabel: {fontSize: 14, color: '#333'},

  // Map
  mapContainer: {
    borderRadius: 12, overflow: 'hidden',
    height: 220, backgroundColor: '#e0e8f0',
  },
  map: {flex: 1},

  // Map state boxes (loading / denied / error)
  mapStateBox: {
    height: 220, backgroundColor: '#f8f9ff',
    borderRadius: 12, borderWidth: 1, borderColor: '#eef1ff',
    alignItems: 'center', justifyContent: 'center',
    padding: 20, gap: 10,
  },
  mapStateText:       {fontSize: 14, color: '#888', textAlign: 'center'},
  mapStateTitleRed:   {fontSize: 15, fontWeight: '700', color: '#c62828'},
  mapStateTitleOrange:{fontSize: 15, fontWeight: '700', color: '#e65100'},
  mapStateSubtext:    {fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18},
  mapStateActions:    {flexDirection: 'row', gap: 10, marginTop: 4},

  retryBtn: {
    backgroundColor: '#ff9800', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  retryBtnText: {fontSize: 13, fontWeight: '700', color: '#fff'},
  settingsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eef1fb', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  settingsBtnText: {fontSize: 13, fontWeight: '600', color: '#3b5bdb'},
  retryBtnFull: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ff9800', borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 10, marginTop: 4,
  },
  retryBtnFullText: {fontSize: 14, fontWeight: '700', color: '#fff'},

  // Refresh button
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eef1fb', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  refreshText: {fontSize: 12, fontWeight: '600', color: '#3b5bdb'},

  // Custom marker
  markerOuter: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(59,91,219,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  markerInner: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#3b5bdb',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3b5bdb', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },

  // Map overlay controls
  mapZoomControls: {
    position: 'absolute', left: 10, top: 10,
    backgroundColor: '#fff', borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },
  mapZoomBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  mapZoomBtnText: {fontSize: 20, color: '#333', fontWeight: '400', lineHeight: 24},

  // Coords chip
  coordsChip: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  coordsText: {fontSize: 10, color: '#2e7d32', fontWeight: '600'},

  // Location error banner
  locationErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff3e0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  locationErrorText:   {flex: 1, fontSize: 12, color: '#e65100'},
  locationErrorAction: {fontSize: 12, fontWeight: '700', color: '#e65100'},

  // Notes
  notesInputWrap: {
    backgroundColor: '#f8f9ff', borderRadius: 10,
    borderWidth: 1, borderColor: '#eef1ff',
    padding: 12,
  },
  notesInput: {
    fontSize: 14, color: '#222', minHeight: 100,
    textAlignVertical: 'top',
  },

  // Action buttons
  actionsCard: {
    marginHorizontal: 12, marginTop: 12, gap: 10,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ff9800', borderRadius: 14, paddingVertical: 15,
    shadowColor: '#ff9800', shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  createBtnLoading: {opacity: 0.75},
  createBtnText:    {fontSize: 16, fontWeight: '800', color: '#fff'},
  cancelBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#e4e8f5',
  },
  cancelBtnText: {fontSize: 15, color: '#555', fontWeight: '600'},
});