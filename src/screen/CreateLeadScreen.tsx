import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import TopBar from '../components/TopBar';

// ─── Form Field Component ─────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  iconName: string;
  required?: boolean;
  hint?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}

const FormField: React.FC<FieldProps> = ({
  label, placeholder, value, onChangeText,
  iconName, required, hint, multiline, keyboardType = 'default',
}) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    <View style={[styles.inputWrap, multiline && styles.inputWrapMulti]}>
      <MaterialCommunityIcons name={iconName} size={18} color="#aaa" style={styles.inputIcon} />
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
    {hint && <Text style={styles.hint}>{hint}</Text>}
  </View>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({
  iconName, iconBg, title, subtitle,
}: {
  iconName: string; iconBg: string; title: string; subtitle: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionIcon, {backgroundColor: iconBg}]}>
      <MaterialCommunityIcons name={iconName} size={22} color="#3b5bdb" />
    </View>
    <View style={{flex: 1, marginLeft: 12}}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface CreateLeadScreenProps {
  onMenuPress:    () => void;
  onSearchPress:  () => void;
  onProfilePress: () => void;
  onBack:         () => void;
}

const CreateLeadScreen: React.FC<CreateLeadScreenProps> = ({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onBack,
}) => {
  // ── Personal Info
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [phone,       setPhone]       = useState('');

  // ── Address Info
  const [consumerNum, setConsumerNum] = useState('');
  const [street,      setStreet]      = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('');
  const [postalCode,  setPostalCode]  = useState('');
  const [zone,        setZone]        = useState('');
  const [notes,       setNotes]       = useState('');

  const handleCreate = () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'Please enter the first name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter the phone number.');
      return;
    }
    Alert.alert('Success', 'Lead created successfully!');
  };

  const handleReset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setConsumerNum(''); setStreet(''); setCity(''); setState('');
    setPostalCode(''); setZone(''); setNotes('');
  };

  return (
    <View style={styles.root}>
      <TopBar
        onMenuPress={onMenuPress}
        onSearchPress={onSearchPress}
        onProfilePress={onProfilePress}
        initials="RS"
      />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero Banner ── */}
          <View style={styles.heroBanner}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{flex: 1, marginLeft: 14}}>
              <Text style={styles.heroTitle}>Create New Lead</Text>
              <Text style={styles.heroSubtitle}>
                Fill in the lead details below • Role: Team Member
              </Text>
            </View>
          </View>

          {/* ── Personal Information ── */}
          <View style={styles.card}>
            <SectionHeader
              iconName="account-outline"
              iconBg="#eef1ff"
              title="Personal Information"
              subtitle="Basic details about the lead"
            />

            <FormField
              label="First Name"
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
              iconName="account-outline"
              required
              hint="Enter lead's first name"
            />
            <FormField
              label="Last Name"
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
              iconName="account-outline"
              hint="Optional"
            />
            <FormField
              label="Email Address"
              placeholder="john@example.com"
              value={email}
              onChangeText={setEmail}
              iconName="email-outline"
              hint="Optional"
              keyboardType="email-address"
            />
            <FormField
              label="Phone Number"
              placeholder="9876543210"
              value={phone}
              onChangeText={setPhone}
              iconName="phone-outline"
              required
              hint="Enter lead's phone number"
              keyboardType="phone-pad"
            />
          </View>

          {/* ── Address Information ── */}
          <View style={styles.card}>
            <SectionHeader
              iconName="map-marker-outline"
              iconBg="#eef1ff"
              title="Address Information"
              subtitle="Optional - Fill if you have address details"
            />

            <FormField
              label="Consumer Number"
              placeholder="CN12345"
              value={consumerNum}
              onChangeText={setConsumerNum}
              iconName="card-account-details-outline"
              hint="Optional"
            />
            <FormField
              label="Street Address"
              placeholder="123 Main Street"
              value={street}
              onChangeText={setStreet}
              iconName="home-outline"
              hint="Optional"
            />
            <FormField
              label="City"
              placeholder="Bangalore"
              value={city}
              onChangeText={setCity}
              iconName="map-marker-outline"
              hint="Optional"
            />
            <FormField
              label="State"
              placeholder="Karnataka"
              value={state}
              onChangeText={setState}
              iconName="map-outline"
              hint="Optional"
            />
            <FormField
              label="Postal Code"
              placeholder="560001"
              value={postalCode}
              onChangeText={setPostalCode}
              iconName="map-marker-radius-outline"
              hint="Optional"
              keyboardType="numeric"
            />
            <FormField
              label="Zone/Area"
              placeholder="North Zone"
              value={zone}
              onChangeText={setZone}
              iconName="earth"
              hint="Optional"
            />
            <FormField
              label="Notes"
              placeholder="Add any additional notes about the lead..."
              value={notes}
              onChangeText={setNotes}
              iconName="note-text-outline"
              hint="Optional"
              multiline
            />
          </View>

          {/* ── Action Buttons ── */}
          <View style={styles.actionCard}>
            {/* Cancel */}
            <TouchableOpacity style={styles.cancelBtn} onPress={onBack} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {/* Reset Form */}
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.resetText}>Reset Form</Text>
            </TouchableOpacity>

            {/* Create Lead */}
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate} activeOpacity={0.85}>
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.createBtnText}>Create Lead</Text>
            </TouchableOpacity>
          </View>

          {/* ── Important Information ── */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#3b5bdb" />
              <Text style={styles.infoTitle}>Important Information</Text>
            </View>
            {[
              {bold: 'Required Fields:', text: ' Only First Name and Phone Number are mandatory.'},
              {bold: 'All Other Fields:', text: ' All other fields are optional and can be filled later.'},
              {bold: 'Phone Number:', text: ' Enter any valid phone number format.'},
              {bold: 'Auto-assignment:', text: ' Leads are automatically assigned to you as the creator.'},
            ].map((item, idx) => (
              <View key={idx} style={styles.infoRow}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>{item.bold}</Text>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={{height: 40}} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default CreateLeadScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   {flex: 1, backgroundColor: '#f0f4ff'},
  scroll: {flex: 1},

  // Hero
  heroBanner: {
    margin: 12, borderRadius: 16, backgroundColor: '#3b5bdb',
    padding: 18, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle:    {fontSize: 17, fontWeight: '800', color: '#fff'},
  heroSubtitle: {fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3, lineHeight: 16},

  // Cards
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 18,
  },
  sectionIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle:    {fontSize: 15, fontWeight: '800', color: '#1a1a3e'},
  sectionSubtitle: {fontSize: 11, color: '#888', marginTop: 2},

  // Form fields
  fieldWrap:  {marginBottom: 14},
  fieldLabel: {fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 6},
  required:   {color: '#e03131'},
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8f9ff', borderRadius: 10,
    borderWidth: 1, borderColor: '#eef1ff',
    paddingHorizontal: 12, height: 46,
  },
  inputWrapMulti: {
    height: 'auto', alignItems: 'flex-start', paddingVertical: 10,
  },
  inputIcon:     {marginRight: 8},
  input: {
    flex: 1, fontSize: 14, color: '#222', paddingVertical: 0,
  },
  inputMulti: {
    minHeight: 80, textAlignVertical: 'top',
  },
  hint: {fontSize: 11, color: '#aaa', marginTop: 4, marginLeft: 2},

  // Action buttons card
  actionCard: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    gap: 10,
  },
  cancelBtn: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: {fontSize: 15, color: '#555', fontWeight: '600'},
  resetText: {
    textAlign: 'center', fontSize: 13, color: '#888',
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#ff9800', borderRadius: 10, paddingVertical: 13,
  },
  createBtnText: {fontSize: 15, color: '#fff', fontWeight: '700'},

  // Info card
  infoCard: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  infoHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  infoTitle:  {fontSize: 15, fontWeight: '800', color: '#1a1a3e'},
  infoRow:    {flexDirection: 'row', gap: 6, marginBottom: 8},
  infoBullet: {fontSize: 13, color: '#555', marginTop: 1},
  infoText:   {flex: 1, fontSize: 12, color: '#555', lineHeight: 18},
  infoBold:   {fontWeight: '700', color: '#1a1a3e'},
});