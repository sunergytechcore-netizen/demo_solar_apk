// screens/ExpensesScreen.jsx
// React Native – Expenses Screen
// Icons  : react-native-vector-icons/MaterialCommunityIcons
//          (Expo users: swap import to @expo/vector-icons MaterialCommunityIcons)
// Props  : documented via PropTypes for IDE autocomplete

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import PropTypes from 'prop-types';

// ─── Icon Import ──────────────────────────────────────────────────────────────
// Bare React Native:
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// Expo – replace with:
// import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Color Theme ──────────────────────────────────────────────────────────────
const COLORS = {
  primary:  { main: '#4569ea', light: '#60a5fa', dark: '#1d4ed8', bg: '#eff6ff' },
  success:  { main: '#059669', light: '#34d399', dark: '#047857', bg: '#ecfdf5' },
  warning:  { main: '#d97706', light: '#fbbf24', dark: '#b45309', bg: '#fffbeb' },
  error:    { main: '#dc2626', light: '#f87171', dark: '#b91c1c', bg: '#fef2f2' },
  info:     { main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8', bg: '#eff6ff' },
  neutral: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
    400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
    800: '#1e293b', 900: '#0f172a',
  },
};

// ─── Central Icon Map ─────────────────────────────────────────────────────────
const ICONS = {
  close:        'close',
  menu:         'dots-vertical',
  filter:       'filter-variant',
  search:       'magnify',
  add:          'plus',
  edit:         'pencil-outline',
  delete:       'trash-can-outline',
  view:         'eye-outline',
  refresh:      'refresh',
  approve:      'check-circle-outline',
  reject:       'close-circle-outline',
  back:         'arrow-left',
  check:        'check',
  chevronDown:  'chevron-down',
  chevronRight: 'chevron-right',
  chevronLeft:  'chevron-left',
  // categories
  food:         'food-fork-drink',
  hotel:        'bed-king-outline',
  fuel:         'gas-station-outline',
  software:     'laptop',
  hardware:     'tools',
  office:       'package-variant-closed',
  misc:         'format-list-bulleted',
  // status
  pending:      'clock-time-four-outline',
  // vehicles / fuel
  bike:         'motorbike',
  car:          'car-outline',
  electric:     'lightning-bolt-outline',
  speed:        'speedometer-outline',
  // currency / stats
  rupee:        'currency-inr',
  receipt:      'receipt-outline',
  trending:     'trending-up',
  // misc
  calendar:     'calendar-outline',
  person:       'account-circle-outline',
  location:     'map-marker-outline',
  attachment:   'paperclip',
};

// ─── Fuel Config ──────────────────────────────────────────────────────────────
const FUEL_RATES = {
  Bike: { Petrol: 2.5, Electric: 0.8 },
  Car:  { Petrol: 4.5, Diesel: 4.0, CNG: 3.2, Electric: 1.2 },
};
const VEHICLE_TYPES = ['Bike', 'Car'];
const FUEL_TYPES    = {
  Bike: ['Petrol', 'Electric'],
  Car:  ['Petrol', 'Diesel', 'CNG', 'Electric'],
};

// ─── Category Config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  Food:          { color: '#059669', bg: '#ecfdf5', icon: ICONS.food,     label: 'Food' },
  Accommodation: { color: '#7c3aed', bg: '#f5f3ff', icon: ICONS.hotel,    label: 'Accommodation' },
  Fuel:          { color: '#ea580c', bg: '#fff7ed', icon: ICONS.fuel,     label: 'Fuel' },
  Software:      { color: '#0891b2', bg: '#ecfeff', icon: ICONS.software, label: 'Software' },
  Hardware:      { color: '#4f46e5', bg: '#eef2ff', icon: ICONS.hardware, label: 'Hardware' },
  Office:        { color: '#b45309', bg: '#fffbeb', icon: ICONS.office,   label: 'Office' },
  Miscellaneous: { color: '#64748b', bg: '#f1f5f9', icon: ICONS.misc,     label: 'Miscellaneous' },
};

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Approved: { color: '#059669', bg: '#ecfdf5', icon: ICONS.approve, label: 'Approved' },
  Pending:  { color: '#d97706', bg: '#fffbeb', icon: ICONS.pending, label: 'Pending'  },
  Rejected: { color: '#dc2626', bg: '#fef2f2', icon: ICONS.reject,  label: 'Rejected' },
};

const TIME_PERIODS = [
  { value: 'today', label: 'Today'      },
  { value: 'week',  label: 'This Week'  },
  { value: 'month', label: 'This Month' },
  { value: 'year',  label: 'This Year'  },
  { value: 'all',   label: 'All Time'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return 'N/A'; }
};

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const alpha = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Circular icon button.
 * @param {{ name:string, size?:number, color?:string, bg?:string, onPress:()=>void, style?:object }} props
 */
const IconBtn = ({ name, size = 20, color = '#fff', bg = 'rgba(255,255,255,0.2)', onPress, style }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.iconBtn, { backgroundColor: bg }, style]}
    activeOpacity={0.75}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    <Icon name={name} size={size} color={color} />
  </TouchableOpacity>
);
IconBtn.propTypes = {
  name:    PropTypes.string.isRequired,
  size:    PropTypes.number,
  color:   PropTypes.string,
  bg:      PropTypes.string,
  onPress: PropTypes.func.isRequired,
  style:   PropTypes.object,
};

/**
 * Status / category badge chip.
 * @param {{ label:string, iconName?:string, color:string, bg:string, iconSize?:number }} props
 */
const Chip = ({ label, iconName, color, bg, iconSize = 13 }) => (
  <View style={[styles.chip, { backgroundColor: bg, borderColor: alpha(color, 0.3) }]}>
    {iconName
      ? <Icon name={iconName} size={iconSize} color={color} style={{ marginRight: 4 }} />
      : null}
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);
Chip.propTypes = {
  label:    PropTypes.string.isRequired,
  iconName: PropTypes.string,
  color:    PropTypes.string.isRequired,
  bg:       PropTypes.string.isRequired,
  iconSize: PropTypes.number,
};

/**
 * Animated toast notification shown at the top of the screen.
 * @param {{ visible:boolean, message:string, type:'success'|'error'|'info' }} props
 */
const Toast = ({ visible, message, type }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);

  if (!visible) return null;
  const bg       = type === 'success' ? COLORS.success.main : type === 'error' ? COLORS.error.main : COLORS.primary.main;
  const iconName = type === 'success' ? ICONS.approve : type === 'error' ? ICONS.reject : ICONS.refresh;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Icon name={iconName} size={18} color="#fff" style={{ marginRight: 8 }} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};
Toast.propTypes = {
  visible: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  type:    PropTypes.oneOf(['success', 'error', 'info']),
};

/**
 * Summary stat card shown in the top row.
 * @param {{ iconName:string, title:string, value:string, color:string }} props
 */
const StatCard = ({ iconName, title, value, color }) => (
  <View style={[styles.statCard, { borderColor: alpha(color, 0.18) }]}>
    <View style={[styles.statIconBox, { backgroundColor: alpha(color, 0.12) }]}>
      <Icon name={iconName} size={20} color={color} />
    </View>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);
StatCard.propTypes = {
  iconName: PropTypes.string.isRequired,
  title:    PropTypes.string.isRequired,
  value:    PropTypes.string.isRequired,
  color:    PropTypes.string.isRequired,
};

// ─────────────────────────────────────────────────────────────────────────────
//  EXPENSE CARD
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Single expense row card rendered in the FlatList.
 *
 * @param {{
 *   expense:     object,
 *   onPress:     (expense: object) => void,
 *   onMenuPress: (expense: object) => void,
 * }} props
 */
const ExpenseCard = ({ expense, onPress, onMenuPress }) => {
  const cat    = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.Miscellaneous;
  const stat   = STATUS_CONFIG[expense.status]     || STATUS_CONFIG.Pending;
  const isFuel = expense.category === 'Fuel';
  const initials = (expense.createdBy?.name || expense.createdBy?.email || 'U').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.expenseCard, { borderLeftColor: cat.color }]}
      onPress={() => onPress(expense)}
      activeOpacity={0.85}
    >
      {/* Top */}
      <View style={styles.cardTopRow}>
        <View style={[styles.cardIconBox, { backgroundColor: cat.bg }]}>
          <Icon name={cat.icon} size={24} color={cat.color} />
        </View>
        <View style={styles.cardTitleBox}>
          <Text style={styles.cardTitle} numberOfLines={1}>{expense.title}</Text>
          <Text style={styles.cardId}>#{expense._id?.slice(-8) || 'N/A'}</Text>
        </View>
        <View style={styles.cardAmountBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={ICONS.rupee} size={14} color={COLORS.primary.main} />
            <Text style={styles.cardAmount}>{Number(expense.amount || 0).toLocaleString('en-IN')}</Text>
          </View>
          {isFuel && expense.fuelRatePerKm
            ? <Text style={styles.cardRate}>₹{expense.fuelRatePerKm}/km</Text>
            : null}
        </View>
      </View>

      {/* Chips */}
      <View style={styles.chipRow}>
        <Chip label={cat.label}  iconName={cat.icon}  color={cat.color}  bg={cat.bg}  />
        <Chip label={stat.label} iconName={stat.icon} color={stat.color} bg={stat.bg} />
        {isFuel && expense.vehicleType
          ? <Chip
              label={`${expense.vehicleType} · ${expense.kilometersTraveled}km`}
              iconName={expense.vehicleType === 'Bike' ? ICONS.bike : ICONS.car}
              color={COLORS.warning.main}
              bg={COLORS.warning.bg}
            />
          : null}
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.cardCreator}>
          <View style={styles.creatorAvatar}>
            <Text style={styles.creatorInitial}>{initials}</Text>
          </View>
          <Text style={styles.creatorName} numberOfLines={1}>
            {expense.createdBy?.name || expense.createdBy?.email?.split('@')[0] || 'Unknown'}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Icon name={ICONS.calendar} size={12} color={COLORS.neutral[400]} />
          <Text style={styles.cardDate}>{formatDate(expense.createdAt)}</Text>
          <TouchableOpacity
            onPress={() => onMenuPress(expense)}
            style={styles.menuDotBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name={ICONS.menu} size={20} color={COLORS.neutral[500]} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};
ExpenseCard.propTypes = {
  expense:     PropTypes.object.isRequired,
  onPress:     PropTypes.func.isRequired,
  onMenuPress: PropTypes.func.isRequired,
};

// ─────────────────────────────────────────────────────────────────────────────
//  PICKER MODAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generic bottom-sheet list picker.
 *
 * @param {{
 *   visible:  boolean,
 *   title:    string,
 *   options:  Array<{ value:string, label:string, iconName?:string }>,
 *   selected: string,
 *   onSelect: (value: string) => void,
 *   onClose:  () => void,
 * }} props
 */
const PickerModal = ({ visible, title, options, selected, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <IconBtn name={ICONS.close} size={16} color={COLORS.neutral[600]} bg={COLORS.neutral[100]} onPress={onClose} />
        </View>
        <ScrollView>
          {options.map((opt) => {
            const isSel = opt.value === selected;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sheetOption, isSel && styles.sheetOptionActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {opt.iconName
                    ? <Icon name={opt.iconName} size={20} color={isSel ? COLORS.primary.main : COLORS.neutral[500]} />
                    : null}
                  <Text style={[styles.sheetOptionText, isSel && { color: COLORS.primary.main, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                </View>
                {isSel ? <Icon name={ICONS.check} size={18} color={COLORS.primary.main} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </TouchableOpacity>
  </Modal>
);
PickerModal.propTypes = {
  visible:  PropTypes.bool.isRequired,
  title:    PropTypes.string.isRequired,
  options:  PropTypes.arrayOf(PropTypes.shape({
    value:    PropTypes.string.isRequired,
    label:    PropTypes.string.isRequired,
    iconName: PropTypes.string,
  })).isRequired,
  selected: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onClose:  PropTypes.func.isRequired,
};

// ─────────────────────────────────────────────────────────────────────────────
//  EXPENSE FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create / Edit expense form shown as a full-screen modal.
 *
 * @param {{
 *   visible:         boolean,
 *   onClose:         () => void,
 *   onSubmit:        () => void,
 *   formData:        object,
 *   setFormData:     (updater: any) => void,
 *   selectedExpense: object | null,
 *   loading:         boolean,
 * }} props
 */
const ExpenseFormModal = ({
  visible, onClose, onSubmit, formData, setFormData, selectedExpense, loading,
}) => {
  const [errors,   setErrors]   = useState({});
  const [catOpen,  setCatOpen]  = useState(false);
  const [vehOpen,  setVehOpen]  = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);

  const isFuel = formData.category === 'Fuel';

  // Auto-calculate fuel amount
  useEffect(() => {
    if (
      isFuel &&
      formData.vehicleType && formData.vehicleType !== 'None' &&
      formData.fuelType    && formData.fuelType    !== 'None' &&
      formData.kilometersTraveled > 0
    ) {
      const rate = FUEL_RATES[formData.vehicleType]?.[formData.fuelType];
      if (rate) setFormData(p => ({ ...p, amount: (formData.kilometersTraveled * rate).toString() }));
    }
  }, [isFuel, formData.vehicleType, formData.fuelType, formData.kilometersTraveled]);

  const validate = () => {
    const e = {};
    if (!formData.title?.trim())  e.title    = 'Title is required';
    if (!formData.category)       e.category = 'Category is required';
    if (isFuel) {
      if (!formData.vehicleType || formData.vehicleType === 'None') e.vehicleType = 'Vehicle type required';
      if (!formData.fuelType    || formData.fuelType    === 'None') e.fuelType    = 'Fuel type required';
      if (!formData.kilometersTraveled || formData.kilometersTraveled <= 0) e.km = 'Distance must be > 0';
    } else {
      if (!formData.amount || parseFloat(formData.amount) <= 0) e.amount = 'Valid amount required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const catOptions  = Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ value: k, label: v.label, iconName: v.icon }));
  const vehOptions  = VEHICLE_TYPES.map(v => ({ value: v, label: v, iconName: v === 'Bike' ? ICONS.bike : ICONS.car }));
  const fuelOptions = (formData.vehicleType && formData.vehicleType !== 'None')
    ? (FUEL_TYPES[formData.vehicleType] || []).map(f => ({ value: f, label: f, iconName: f === 'Electric' ? ICONS.electric : ICONS.fuel }))
    : [];

  const calcRate = FUEL_RATES[formData.vehicleType]?.[formData.fuelType];
  const calcAmt  = calcRate && formData.kilometersTraveled > 0
    ? (calcRate * formData.kilometersTraveled).toFixed(2) : null;

  const selCat = CATEGORY_CONFIG[formData.category];

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* ── Header ── */}
          <View style={styles.modalHeader}>
            <IconBtn name={ICONS.close} onPress={onClose} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.modalTitle}>{selectedExpense ? 'Edit Expense' : 'New Expense'}</Text>
              <Text style={styles.modalSubtitle}>{selectedExpense ? 'Update expense details' : 'Fill in the details below'}</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

            {/* Title */}
            <Text style={styles.fieldLabel}>Title <Text style={{ color: COLORS.error.main }}>*</Text></Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Enter expense title"
              placeholderTextColor={COLORS.neutral[400]}
              value={formData.title}
              onChangeText={v => { setFormData(p => ({ ...p, title: v })); setErrors(p => ({ ...p, title: null })); }}
            />
            {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}

            {/* Category */}
            <Text style={styles.fieldLabel}>Category <Text style={{ color: COLORS.error.main }}>*</Text></Text>
            <TouchableOpacity
              style={[styles.selectBtn, errors.category && styles.inputError]}
              onPress={() => setCatOpen(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon
                  name={selCat ? selCat.icon : ICONS.filter}
                  size={18}
                  color={selCat ? selCat.color : COLORS.neutral[400]}
                />
                <Text style={[styles.selectText, !formData.category && { color: COLORS.neutral[400] }]}>
                  {selCat ? selCat.label : 'Select category'}
                </Text>
              </View>
              <Icon name={ICONS.chevronDown} size={20} color={COLORS.neutral[400]} />
            </TouchableOpacity>
            {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

            {/* ── Fuel Section ── */}
            {isFuel && (
              <View style={styles.fuelSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <Icon name={ICONS.fuel} size={20} color={COLORS.warning.main} />
                  <Text style={styles.fuelSectionTitle}>Fuel Auto-Calculation</Text>
                </View>

                {/* Vehicle type */}
                <Text style={styles.fieldLabel}>Vehicle Type <Text style={{ color: COLORS.error.main }}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.selectBtn, errors.vehicleType && styles.inputError]}
                  onPress={() => setVehOpen(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon
                      name={formData.vehicleType === 'Bike' ? ICONS.bike : ICONS.car}
                      size={18}
                      color={(formData.vehicleType && formData.vehicleType !== 'None') ? COLORS.warning.main : COLORS.neutral[400]}
                    />
                    <Text style={[styles.selectText, (!formData.vehicleType || formData.vehicleType === 'None') && { color: COLORS.neutral[400] }]}>
                      {(formData.vehicleType && formData.vehicleType !== 'None') ? formData.vehicleType : 'Select vehicle'}
                    </Text>
                  </View>
                  <Icon name={ICONS.chevronDown} size={20} color={COLORS.neutral[400]} />
                </TouchableOpacity>
                {errors.vehicleType ? <Text style={styles.errorText}>{errors.vehicleType}</Text> : null}

                {/* Fuel type */}
                <Text style={styles.fieldLabel}>Fuel Type <Text style={{ color: COLORS.error.main }}>*</Text></Text>
                <TouchableOpacity
                  style={[
                    styles.selectBtn,
                    errors.fuelType && styles.inputError,
                    (!formData.vehicleType || formData.vehicleType === 'None') && { opacity: 0.45 },
                  ]}
                  onPress={() => { if (formData.vehicleType && formData.vehicleType !== 'None') setFuelOpen(true); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon
                      name={formData.fuelType === 'Electric' ? ICONS.electric : ICONS.fuel}
                      size={18}
                      color={(formData.fuelType && formData.fuelType !== 'None') ? COLORS.warning.main : COLORS.neutral[400]}
                    />
                    <Text style={[styles.selectText, (!formData.fuelType || formData.fuelType === 'None') && { color: COLORS.neutral[400] }]}>
                      {(formData.fuelType && formData.fuelType !== 'None') ? formData.fuelType : 'Select fuel type'}
                    </Text>
                  </View>
                  <Icon name={ICONS.chevronDown} size={20} color={COLORS.neutral[400]} />
                </TouchableOpacity>
                {errors.fuelType ? <Text style={styles.errorText}>{errors.fuelType}</Text> : null}

                {/* KM Traveled */}
                <Text style={styles.fieldLabel}>Kilometers Traveled <Text style={{ color: COLORS.error.main }}>*</Text></Text>
                <View style={[styles.inputRow, errors.km && styles.inputError]}>
                  <Icon name={ICONS.speed} size={18} color={COLORS.neutral[400]} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.inputInner}
                    placeholder="0.0"
                    placeholderTextColor={COLORS.neutral[400]}
                    keyboardType="numeric"
                    value={formData.kilometersTraveled?.toString() || ''}
                    onChangeText={v => {
                      setFormData(p => ({ ...p, kilometersTraveled: parseFloat(v) || 0 }));
                      setErrors(p => ({ ...p, km: null }));
                    }}
                  />
                  <Text style={styles.inputSuffix}>km</Text>
                </View>
                {errors.km ? <Text style={styles.errorText}>{errors.km}</Text> : null}

                {/* Calculated Amount Preview */}
                {calcAmt && (
                  <View style={styles.calcPreview}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Icon name={ICONS.rupee} size={13} color={COLORS.neutral[500]} />
                      <Text style={styles.calcLabel}>Calculated Amount</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginVertical: 4 }}>
                      <Icon name={ICONS.rupee} size={18} color={COLORS.primary.main} />
                      <Text style={[styles.calcAmount, { color: COLORS.primary.main }]}>{calcAmt}</Text>
                    </View>
                    <Text style={styles.calcFormula}>{formData.kilometersTraveled} km × ₹{calcRate}/km</Text>
                  </View>
                )}
              </View>
            )}

            {/* Amount */}
            {!isFuel ? (
              <>
                <Text style={styles.fieldLabel}>Amount (₹) <Text style={{ color: COLORS.error.main }}>*</Text></Text>
                <View style={[styles.inputRow, errors.amount && styles.inputError]}>
                  <Icon name={ICONS.rupee} size={18} color={COLORS.neutral[400]} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.inputInner}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.neutral[400]}
                    keyboardType="numeric"
                    value={formData.amount}
                    onChangeText={v => { setFormData(p => ({ ...p, amount: v })); setErrors(p => ({ ...p, amount: null })); }}
                  />
                </View>
                {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Amount (₹) — Auto Calculated</Text>
                <View style={[styles.inputRow, { backgroundColor: COLORS.neutral[100] }]}>
                  <Icon name={ICONS.rupee} size={18} color={COLORS.neutral[400]} style={{ marginRight: 6 }} />
                  <TextInput
                    style={[styles.inputInner, { color: COLORS.neutral[500] }]}
                    value={formData.amount || ''}
                    editable={false}
                    placeholder="Will be auto-filled"
                    placeholderTextColor={COLORS.neutral[400]}
                  />
                </View>
              </>
            )}

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add additional details…"
              placeholderTextColor={COLORS.neutral[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={formData.description}
              onChangeText={v => setFormData(p => ({ ...p, description: v }))}
            />

            <View style={{ height: 32 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Icon name={ICONS.close} size={16} color={COLORS.primary.main} />
              <Text style={[styles.cancelBtnText, { marginLeft: 6 }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.65 }]}
              onPress={() => { if (validate()) onSubmit(); }}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Icon name={selectedExpense ? ICONS.edit : ICONS.add} size={18} color="#fff" />
                    <Text style={[styles.submitBtnText, { marginLeft: 6 }]}>{selectedExpense ? 'Update' : 'Create'}</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker bottom sheets */}
      <PickerModal
        visible={catOpen} title="Select Category" options={catOptions} selected={formData.category}
        onSelect={v => {
          if (v !== 'Fuel') setFormData(p => ({ ...p, category: v, vehicleType: 'None', fuelType: 'None', kilometersTraveled: 0 }));
          else setFormData(p => ({ ...p, category: v }));
          setErrors(p => ({ ...p, category: null }));
        }}
        onClose={() => setCatOpen(false)}
      />
      <PickerModal
        visible={vehOpen} title="Select Vehicle Type" options={vehOptions} selected={formData.vehicleType}
        onSelect={v => setFormData(p => ({ ...p, vehicleType: v, fuelType: 'None' }))}
        onClose={() => setVehOpen(false)}
      />
      <PickerModal
        visible={fuelOpen} title="Select Fuel Type" options={fuelOptions} selected={formData.fuelType}
        onSelect={v => setFormData(p => ({ ...p, fuelType: v }))}
        onClose={() => setFuelOpen(false)}
      />
    </>
  );
};
ExpenseFormModal.propTypes = {
  visible:         PropTypes.bool.isRequired,
  onClose:         PropTypes.func.isRequired,
  onSubmit:        PropTypes.func.isRequired,
  formData:        PropTypes.object.isRequired,
  setFormData:     PropTypes.func.isRequired,
  selectedExpense: PropTypes.object,
  loading:         PropTypes.bool,
};

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW EXPENSE MODAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Read-only detail view for a single expense.
 *
 * @param {{ visible:boolean, onClose:()=>void, expense:object|null }} props
 */
const ViewExpenseModal = ({ visible, onClose, expense }) => {
  if (!expense) return null;
  const cat    = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.Miscellaneous;
  const stat   = STATUS_CONFIG[expense.status]     || STATUS_CONFIG.Pending;
  const isFuel = expense.category === 'Fuel';

  const InfoRow = ({ label, value }) => (
    <View style={styles.viewRow}>
      <Text style={styles.viewKey}>{label}</Text>
      <Text style={styles.viewVal}>{value}</Text>
    </View>
  );

  const Section = ({ iconName, title, color = COLORS.neutral[600], bg, borderColor, children }) => (
    <View style={[styles.viewSection, bg && { backgroundColor: bg }, borderColor && { borderColor }]}>
      <View style={styles.viewSectionHeader}>
        <Icon name={iconName} size={16} color={color} />
        <Text style={[styles.viewSectionTitle, { color }]}>{title}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.neutral[50] }}>
        <View style={styles.modalHeader}>
          <IconBtn name={ICONS.close} onPress={onClose} />
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>{expense.title}</Text>
            <Text style={styles.modalSubtitle}>#{expense._id?.slice(-8)}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>

          {/* Amount hero */}
          <View style={styles.viewAmountCard}>
            <Text style={styles.viewAmountLabel}>Total Amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginVertical: 6 }}>
              <Icon name={ICONS.rupee} size={26} color={COLORS.primary.main} />
              <Text style={[styles.viewAmount, { color: COLORS.primary.main }]}>
                {Number(expense.amount || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.chipRow}>
              <Chip label={cat.label}  iconName={cat.icon}  color={cat.color}  bg={cat.bg}  />
              <Chip label={stat.label} iconName={stat.icon} color={stat.color} bg={stat.bg} />
            </View>
          </View>

          {/* Details */}
          <Section iconName={ICONS.receipt} title="Details">
            <InfoRow label="Date"       value={formatDate(expense.createdAt)} />
            <InfoRow label="Created By" value={expense.createdBy?.name || 'Unknown'} />
            {expense.createdBy?.email ? <InfoRow label="Email" value={expense.createdBy.email} /> : null}
          </Section>

          {/* Fuel */}
          {isFuel && (
            <Section iconName={ICONS.fuel} title="Fuel Details" color={COLORS.warning.main}>
              <InfoRow label="Vehicle"   value={expense.vehicleType || 'N/A'} />
              <InfoRow label="Fuel Type" value={expense.fuelType    || 'N/A'} />
              <InfoRow label="Distance"  value={`${expense.kilometersTraveled || 0} km`} />
              {expense.fuelRatePerKm && (
                <>
                  <InfoRow label="Rate/km"     value={`₹${expense.fuelRatePerKm}`} />
                  <View style={[styles.viewRow, { borderTopWidth: 1, borderTopColor: COLORS.neutral[200], marginTop: 6, paddingTop: 6 }]}>
                    <Text style={styles.viewKey}>Calculation</Text>
                    <Text style={styles.viewVal}>{expense.kilometersTraveled} × ₹{expense.fuelRatePerKm} = ₹{expense.amount}</Text>
                  </View>
                </>
              )}
            </Section>
          )}

          {/* Description */}
          {expense.description ? (
            <Section iconName={ICONS.misc} title="Description">
              <Text style={styles.viewDescription}>{expense.description}</Text>
            </Section>
          ) : null}

          {/* Rejection */}
          {expense.rejectionReason ? (
            <Section iconName={ICONS.reject} title="Rejection Reason" color={COLORS.error.main} bg={COLORS.error.bg} borderColor={alpha(COLORS.error.main, 0.3)}>
              <Text style={[styles.viewDescription, { color: COLORS.error.main }]}>{expense.rejectionReason}</Text>
            </Section>
          ) : null}

          {/* Approved by */}
          {expense.approvedBy ? (
            <Section iconName={ICONS.approve} title="Approved By" color={COLORS.success.main} bg={COLORS.success.bg} borderColor={alpha(COLORS.success.main, 0.3)}>
              <Text style={[styles.viewDescription, { color: COLORS.success.main }]}>
                {expense.approvedBy?.name || 'Unknown'}{expense.approvedAt ? ` · ${formatDate(expense.approvedAt)}` : ''}
              </Text>
              {expense.approverRemarks
                ? <Text style={[styles.viewDescription, { color: COLORS.success.main, marginTop: 4 }]}>Remarks: {expense.approverRemarks}</Text>
                : null}
            </Section>
          ) : null}

          <View style={{ height: 32 }} />
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={onClose}>
            <Icon name={ICONS.check} size={16} color="#fff" />
            <Text style={[styles.submitBtnText, { marginLeft: 6 }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
ViewExpenseModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  expense: PropTypes.object,
};

// ─────────────────────────────────────────────────────────────────────────────
//  ACTION MENU
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Slide-up context menu for an expense (view / edit / approve / reject / delete).
 *
 * @param {{
 *   visible:          boolean,
 *   expense:          object | null,
 *   onClose:          () => void,
 *   onAction:         (action: 'view'|'edit'|'approve'|'reject'|'delete') => void,
 *   canEdit:          boolean,
 *   canDelete:        boolean,
 *   canUpdateStatus:  boolean,
 *   user:             object,
 * }} props
 */
const ActionMenu = ({ visible, expense, onClose, onAction, canEdit, canDelete, canUpdateStatus, user }) => {
  if (!expense) return null;
  const isOwn     = expense.createdBy?._id === user?._id;
  const isPending = expense.status === 'Pending';
  const cat       = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.Miscellaneous;

  const MenuRow = ({ iconName, label, color = COLORS.neutral[800], action }) => (
    <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onAction(action); }}>
      <Icon name={iconName} size={20} color={color} />
      <Text style={[styles.menuItemText, { color, flex: 1 }]}>{label}</Text>
      <Icon name={ICONS.chevronRight} size={16} color={alpha(color, 0.35)} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          {/* Title */}
          <View style={styles.menuTitleRow}>
            <View style={[styles.cardIconBox, { backgroundColor: cat.bg, marginRight: 10 }]}>
              <Icon name={cat.icon} size={20} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle} numberOfLines={1}>{expense.title}</Text>
              <Text style={styles.menuSubtitle}>{formatCurrency(expense.amount)}</Text>
            </View>
            <IconBtn name={ICONS.close} size={16} color={COLORS.neutral[600]} bg={COLORS.neutral[100]} onPress={onClose} />
          </View>

          <View style={styles.menuDivider} />

          <MenuRow iconName={ICONS.view} label="View Details" action="view" color={COLORS.neutral[800]} />

          {isPending && canEdit && (isOwn || user?.role === 'Head_office') && (
            <MenuRow iconName={ICONS.edit} label="Edit Expense" action="edit" color={COLORS.primary.main} />
          )}

          {canUpdateStatus && isPending && (
            <>
              <View style={styles.menuDivider} />
              <MenuRow iconName={ICONS.approve} label="Approve"        action="approve" color={COLORS.success.main} />
              <MenuRow iconName={ICONS.reject}  label="Reject"         action="reject"  color={COLORS.warning.main} />
            </>
          )}

          {canDelete && (
            <>
              <View style={styles.menuDivider} />
              <MenuRow iconName={ICONS.delete} label="Delete Expense" action="delete" color={COLORS.error.main} />
            </>
          )}

          <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
ActionMenu.propTypes = {
  visible:         PropTypes.bool.isRequired,
  expense:         PropTypes.object,
  onClose:         PropTypes.func.isRequired,
  onAction:        PropTypes.func.isRequired,
  canEdit:         PropTypes.bool,
  canDelete:       PropTypes.bool,
  canUpdateStatus: PropTypes.bool,
  user:            PropTypes.object,
};

// ─────────────────────────────────────────────────────────────────────────────
//  FILTER SHEET
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Bottom-sheet filter panel (period / category / status / sort).
 *
 * @param {{
 *   visible:  boolean,
 *   onClose:  () => void,
 *   filters:  object,
 *   onChange: (key: string, value: string) => void,
 *   onReset:  () => void,
 * }} props
 */
const FilterSheet = ({ visible, onClose, filters, onChange, onReset }) => {
  const cats = [
    { value: 'all', label: 'All Categories', iconName: ICONS.filter },
    ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ value: k, label: v.label, iconName: v.icon })),
  ];
  const statuses = [
    { value: 'all',      label: 'All Status', iconName: ICONS.filter  },
    { value: 'Pending',  label: 'Pending',    iconName: ICONS.pending },
    { value: 'Approved', label: 'Approved',   iconName: ICONS.approve },
    { value: 'Rejected', label: 'Rejected',   iconName: ICONS.reject  },
  ];
  const sorts = [
    { value: '-createdAt', label: 'Newest First',   iconName: ICONS.trending  },
    { value: 'createdAt',  label: 'Oldest First',   iconName: ICONS.calendar  },
    { value: '-amount',    label: 'Highest Amount', iconName: ICONS.rupee     },
    { value: 'amount',     label: 'Lowest Amount',  iconName: ICONS.rupee     },
  ];

  const SectionLabel = ({ iconName, label }) => (
    <View style={styles.filterSectionLabel}>
      <Icon name={iconName} size={13} color={COLORS.neutral[500]} />
      <Text style={styles.filterGroupTitle}>{label}</Text>
    </View>
  );

  const Row = ({ opt, active, onPress }) => (
    <TouchableOpacity style={[styles.sheetOption, active && styles.sheetOptionActive]} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={opt.iconName} size={18} color={active ? COLORS.primary.main : COLORS.neutral[500]} />
        <Text style={[styles.sheetOptionText, active && { color: COLORS.primary.main, fontWeight: '700' }]}>{opt.label}</Text>
      </View>
      {active ? <Icon name={ICONS.check} size={16} color={COLORS.primary.main} /> : null}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.bottomSheet, { maxHeight: SCREEN_HEIGHT * 0.88 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={ICONS.filter} size={20} color={COLORS.primary.main} />
              <Text style={styles.sheetTitle}>Filter Expenses</Text>
            </View>
            <IconBtn name={ICONS.close} size={16} color={COLORS.neutral[600]} bg={COLORS.neutral[100]} onPress={onClose} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            <SectionLabel iconName={ICONS.calendar} label="TIME PERIOD" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16, marginBottom: 12 }}>
              {TIME_PERIODS.map(p => {
                const active = filters.period === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.periodPill, active && styles.periodPillActive]}
                    onPress={() => onChange('period', p.value)}
                  >
                    <Text style={[styles.periodPillText, active && styles.periodPillTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <SectionLabel iconName={ICONS.filter}  label="CATEGORY" />
            {cats.map(c => <Row key={c.value} opt={c} active={filters.category === c.value} onPress={() => onChange('category', c.value)} />)}

            <SectionLabel iconName={ICONS.approve} label="STATUS" />
            {statuses.map(s => <Row key={s.value} opt={s} active={filters.status === s.value} onPress={() => onChange('status', s.value)} />)}

            <SectionLabel iconName={ICONS.trending} label="SORT BY" />
            {sorts.map(s => <Row key={s.value} opt={s} active={filters.sortBy === s.value} onPress={() => onChange('sortBy', s.value)} />)}

            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { onReset(); onClose(); }}>
              <Icon name={ICONS.close} size={16} color={COLORS.primary.main} />
              <Text style={[styles.cancelBtnText, { marginLeft: 6 }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={onClose}>
              <Icon name={ICONS.check} size={16} color="#fff" />
              <Text style={[styles.submitBtnText, { marginLeft: 6 }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
FilterSheet.propTypes = {
  visible:  PropTypes.bool.isRequired,
  onClose:  PropTypes.func.isRequired,
  filters:  PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onReset:  PropTypes.func.isRequired,
};

// ─────────────────────────────────────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear, canCreate, onCreate }) => (
  <View style={styles.emptyState}>
    <View style={[styles.emptyIconBox, { backgroundColor: alpha(COLORS.primary.main, 0.1) }]}>
      <Icon name={ICONS.receipt} size={48} color={COLORS.primary.main} />
    </View>
    <Text style={styles.emptyTitle}>No expenses found</Text>
    <Text style={styles.emptyText}>
      {hasFilters ? 'No expenses match your filters.' : canCreate ? 'Create your first expense claim.' : 'No expenses available.'}
    </Text>
    {hasFilters
      ? <TouchableOpacity style={styles.emptyBtn} onPress={onClear}>
          <Icon name={ICONS.close} size={16} color="#fff" />
          <Text style={[styles.emptyBtnText, { marginLeft: 6 }]}>Clear Filters</Text>
        </TouchableOpacity>
      : canCreate
      ? <TouchableOpacity style={styles.emptyBtn} onPress={onCreate}>
          <Icon name={ICONS.add} size={16} color="#fff" />
          <Text style={[styles.emptyBtnText, { marginLeft: 6 }]}>New Expense</Text>
        </TouchableOpacity>
      : null}
  </View>
);
EmptyState.propTypes = {
  hasFilters: PropTypes.bool,
  onClear:    PropTypes.func,
  canCreate:  PropTypes.bool,
  onCreate:   PropTypes.func,
};

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════
/**
 * ExpensesScreen – full expense management screen.
 *
 * All props are optional. Wire them from your navigator or parent:
 *
 * @param {{
 *   onMenuPress?:    () => void,   // hamburger / side-drawer
 *   onBackPress?:    () => void,   // back navigation (stack)
 *   onProfilePress?: () => void,   // open user profile
 *   onSearchPress?:  () => void,   // open global search overlay
 * }} props
 *
 * Usage:
 *   <ExpensesScreen
 *     onMenuPress={() => navigation.openDrawer()}
 *     onProfilePress={() => navigation.navigate('Profile')}
 *   />
 */

interface ExpensesScreenProps {
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
  onBackPress?:    () => void;
}


export default function ExpensesScreen({
  onMenuPress,
  onBackPress,
  onProfilePress,
  onSearchPress,
}:ExpensesScreenProps) {
  const { user, fetchAPI, isAuthenticated, safeFetchAPI } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [expenses,   setExpenses]  = useState([]);
  const [loading,    setLoading]   = useState({ expenses: true, action: false });
  const [refreshing, setRefreshing]= useState(false);
  const [pagination, setPagination]= useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters,   setFilters]  = useState({ search: '', status: 'all', category: 'all', period: 'month', sortBy: '-createdAt' });
  const [activeTab, setActiveTab]= useState(0);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen]= useState(false);
  const [formOpen,   setFormOpen]  = useState(false);
  const [viewOpen,   setViewOpen]  = useState(false);
  const [menuOpen,   setMenuOpen]  = useState(false);
  const [selected,   setSelected]  = useState(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  // ── Form ──────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title: '', amount: '', category: '', description: '',
    vehicleType: 'None', fuelType: 'None', kilometersTraveled: 0,
  });

  const TABS = [
    { label: 'All',      status: 'all'      },
    { label: 'Pending',  status: 'Pending'  },
    { label: 'Approved', status: 'Approved' },
    { label: 'Rejected', status: 'Rejected' },
  ];

  // ── Role / permissions ────────────────────────────────────────────────────
  const role            = user?.role || '';
  const canCreate       = ['TEAM', 'ASM', 'ZSM', 'Head_office'].includes(role);
  const canEdit         = ['TEAM', 'ASM', 'ZSM', 'Head_office'].includes(role);
  const canDelete       = role === 'Head_office';
  const canUpdateStatus = ['ASM', 'ZSM', 'Head_office'].includes(role);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  };

  const resetForm = () => {
    setFormData({ title: '', amount: '', category: '', description: '', vehicleType: 'None', fuelType: 'None', kilometersTraveled: 0 });
    setSelected(null);
  };

  const handleFilterChange = (key, value) => {
    setFilters(p => ({ ...p, [key]: value }));
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({ search: '', status: 'all', category: 'all', period: 'month', sortBy: '-createdAt' });
    setPagination(p => ({ ...p, page: 1 }));
  };

  // ── Fetch expenses ────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async (isRefresh = false) => {
    if (!(await isAuthenticated())) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(p => ({ ...p, expenses: true }));
    try {
      const qp = new URLSearchParams({
        page:  pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search           && { search:    filters.search   }),
        ...(filters.status !== 'all' && { status:    filters.status   }),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.period !== 'all'   && { period:   filters.period   }),
        sortBy:    filters.sortBy.replace('-', ''),
        sortOrder: filters.sortBy.startsWith('-') ? 'desc' : 'asc',
      });
      const res = await safeFetchAPI(`/expense/getAll?${qp.toString()}`);
      if (res?.success) {
        setExpenses(res.result?.expenses || []);
        setPagination(p => ({
          ...p,
          totalPages: res.result?.pagination?.totalPages || 1,
          totalItems: res.result?.pagination?.total      || 0,
        }));
      }
    } catch { showToast('Failed to fetch expenses', 'error'); }
    finally {
      setLoading(p => ({ ...p, expenses: false }));
      setRefreshing(false);
    }
  }, [isAuthenticated, safeFetchAPI, pagination.page, pagination.limit, filters]);

  useEffect(() => { fetchExpenses(); }, [filters.status, filters.category, filters.period, filters.sortBy, pagination.page]);

  // ── Submit (create / edit) ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!(await isAuthenticated()) || !canCreate) return;
    setLoading(p => ({ ...p, action: true }));
    try {
      const body = {
        title: formData.title, category: formData.category, description: formData.description || '',
        ...(formData.category !== 'Fuel'
          ? { amount: parseFloat(formData.amount) }
          : { vehicleType: formData.vehicleType, fuelType: formData.fuelType, kilometersTraveled: formData.kilometersTraveled }),
      };
      const ep     = selected ? `/expense/update/${selected._id}` : '/expense/create';
      const method = selected ? 'PUT' : 'POST';
      const res    = await fetchAPI(ep, { method, body: JSON.stringify(body) });
      if (res?.success) {
        showToast(selected ? 'Expense updated!' : 'Expense created!', 'success');
        setFormOpen(false);
        resetForm();
        fetchExpenses();
      } else throw new Error(res?.message || 'Operation failed');
    } catch (err) { showToast(err.message || 'Operation failed', 'error'); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  // ── Approve / Reject ──────────────────────────────────────────────────────
  const handleStatusUpdate = async (actionType) => {
    if (!(await isAuthenticated()) || !canUpdateStatus || !selected) return;
    setLoading(p => ({ ...p, action: true }));
    try {
      const ep   = actionType === 'approve' ? `/expense/approve/${selected._id}` : `/expense/reject/${selected._id}`;
      const body = actionType === 'reject' ? { reason: 'Rejected by approver' } : { remarks: 'Approved' };
      const res  = await fetchAPI(ep, { method: 'PUT', body: JSON.stringify(body) });
      if (res?.success) {
        showToast(`Expense ${actionType}d!`, 'success');
        setSelected(null);
        fetchExpenses();
      } else throw new Error(res?.message || `${actionType} failed`);
    } catch (err) { showToast(err.message || `${actionType} failed`, 'error'); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!(await isAuthenticated()) || !canDelete || !selected) return;
    setLoading(p => ({ ...p, action: true }));
    try {
      const res = await fetchAPI(`/expense/delete/${selected._id}`, { method: 'DELETE' });
      if (res?.success) {
        showToast('Expense deleted!', 'success');
        setSelected(null);
        fetchExpenses();
      } else throw new Error(res?.message || 'Delete failed');
    } catch (err) { showToast(err.message || 'Delete failed', 'error'); }
    finally { setLoading(p => ({ ...p, action: false })); }
  };

  // ── Menu action handler ───────────────────────────────────────────────────
  const handleMenuAction = (action) => {
    if (action === 'view') {
      setViewOpen(true);
    } else if (action === 'edit') {
      if (selected?.status !== 'Pending') { showToast('Only pending expenses can be edited', 'error'); return; }
      setFormData({
        title: selected.title || '', amount: selected.amount?.toString() || '',
        category: selected.category || '', description: selected.description || '',
        vehicleType: selected.vehicleType || 'None',
        fuelType: selected.fuelType || 'None',
        kilometersTraveled: selected.kilometersTraveled || 0,
      });
      setFormOpen(true);
    } else if (action === 'approve') {
      Alert.alert('Approve Expense', `Approve "${selected?.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => handleStatusUpdate('approve') },
      ]);
    } else if (action === 'reject') {
      Alert.alert('Reject Expense', `Reject "${selected?.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => handleStatusUpdate('reject') },
      ]);
    } else if (action === 'delete') {
      Alert.alert('Delete Expense', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ]);
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search)             n++;
    if (filters.category !== 'all') n++;
    if (filters.status   !== 'all') n++;
    if (filters.period   !== 'month') n++;
    return n;
  }, [filters]);

  const stats = useMemo(() => {
    const total    = expenses.length;
    const approved = expenses.filter(e => e.status === 'Approved').length;
    const pending  = expenses.filter(e => e.status === 'Pending').length;
    const sum      = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    return { total, approved, pending, avg: total ? (sum / total).toFixed(0) : '0' };
  }, [expenses]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary.dark} />

      {/* ══ Header ══ */}
      <View style={styles.header}>
        {/* Left */}
        {onBackPress
          ? <IconBtn name={ICONS.back}   onPress={onBackPress} />
          : onMenuPress
          ? <IconBtn name={ICONS.menu}   onPress={onMenuPress} />
          : <View style={{ width: 36 }} />}

        {/* Centre */}
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <Text style={styles.headerTitle}>Expense Management</Text>
          <Text style={styles.headerSub}>Track and manage all claims</Text>
        </View>

        {/* Right */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onProfilePress && <IconBtn name={ICONS.person} onPress={onProfilePress} />}
          <IconBtn
            name={ICONS.filter}
            onPress={() => setFilterOpen(true)}
            bg={activeFilterCount > 0 ? COLORS.warning.main : 'rgba(255,255,255,0.2)'}
          />
          {canCreate && (
            <IconBtn name={ICONS.add} bg="rgba(255,255,255,0.35)" onPress={() => { resetForm(); setFormOpen(true); }} />
          )}
        </View>
      </View>

      {/* Active filter banner */}
      {activeFilterCount > 0 && (
        <View style={styles.filterBanner}>
          <Icon name={ICONS.filter} size={13} color={COLORS.primary.main} />
          <Text style={styles.filterBannerText}>{activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}</Text>
          <TouchableOpacity onPress={handleResetFilters} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={ICONS.close} size={12} color={COLORS.error.main} />
            <Text style={styles.filterBannerClear}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══ Stats ══ */}
      <View style={styles.statsRow}>
        <StatCard iconName={ICONS.receipt}  title="Total"    value={stats.total.toString()}    color={COLORS.primary.main} />
        <StatCard iconName={ICONS.approve}  title="Approved" value={stats.approved.toString()} color={COLORS.success.main} />
        <StatCard iconName={ICONS.pending}  title="Pending"  value={stats.pending.toString()}  color={COLORS.warning.main} />
        <StatCard iconName={ICONS.trending} title="Average"  value={`₹${stats.avg}`}           color={COLORS.info.main}    />
      </View>

      {/* ══ Tabs ══ */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => { setActiveTab(i); handleFilterChange('status', t.status); }}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ══ Search ══ */}
      <View style={styles.searchBox}>
        <Icon name={ICONS.search} size={18} color={COLORS.neutral[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses…"
          placeholderTextColor={COLORS.neutral[400]}
          value={filters.search}
          onChangeText={v => handleFilterChange('search', v)}
          returnKeyType="search"
          onSubmitEditing={() => fetchExpenses()}
        />
        {filters.search
          ? <TouchableOpacity onPress={() => handleFilterChange('search', '')}>
              <Icon name={ICONS.close} size={16} color={COLORS.neutral[400]} />
            </TouchableOpacity>
          : null}
        {onSearchPress
          ? <TouchableOpacity onPress={onSearchPress} style={{ marginLeft: 6 }}>
              <Icon name={ICONS.search} size={18} color={COLORS.primary.main} />
            </TouchableOpacity>
          : null}
      </View>

      {/* ══ List ══ */}
      {loading.expenses && expenses.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary.main} />
          <Text style={styles.loadingText}>Loading expenses…</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ExpenseCard
              expense={item}
              onPress={exp => { setSelected(exp); setViewOpen(true); }}
              onMenuPress={exp => { setSelected(exp); setMenuOpen(true); }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              hasFilters={activeFilterCount > 0}
              onClear={handleResetFilters}
              canCreate={canCreate}
              onCreate={() => { resetForm(); setFormOpen(true); }}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenses(true)}
              colors={[COLORS.primary.main]}
              tintColor={COLORS.primary.main}
            />
          }
          ListFooterComponent={
            pagination.totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, pagination.page === 1 && { opacity: 0.4 }]}
                  onPress={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={pagination.page === 1}
                >
                  <Icon name={ICONS.chevronLeft}  size={16} color="#fff" />
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{pagination.page} / {pagination.totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, pagination.page === pagination.totalPages && { opacity: 0.4 }]}
                  onPress={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                  <Icon name={ICONS.chevronRight} size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* ══ Modals ══ */}
      <ExpenseFormModal
        visible={formOpen}
        onClose={() => { setFormOpen(false); resetForm(); }}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        selectedExpense={selected}
        loading={loading.action}
      />
      <ViewExpenseModal visible={viewOpen} onClose={() => setViewOpen(false)} expense={selected} />
      <ActionMenu
        visible={menuOpen}
        expense={selected}
        onClose={() => setMenuOpen(false)}
        onAction={handleMenuAction}
        canEdit={canEdit}
        canDelete={canDelete}
        canUpdateStatus={canUpdateStatus}
        user={user}
      />
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onChange={handleFilterChange} onReset={handleResetFilters} />

      {/* ══ Toast ══ */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </View>
  );
}

ExpensesScreen.propTypes = {
  /** Opens a side drawer / hamburger menu */
  onMenuPress:    PropTypes.func,
  /** Go back (for stack navigation) */
  onBackPress:    PropTypes.func,
  /** Open user profile sheet */
  onProfilePress: PropTypes.func,
  /** Open a global search overlay */
  onSearchPress:  PropTypes.func,
};
ExpensesScreen.defaultProps = {
  onMenuPress:    undefined,
  onBackPress:    undefined,
  onProfilePress: undefined,
  onSearchPress:  undefined,
};

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: COLORS.neutral[50] },
  iconBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:        { backgroundColor: COLORS.primary.main, paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 12, paddingBottom: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerTitle:   { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:     { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },

  // Filter banner
  filterBanner:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: alpha(COLORS.primary.main, 0.08), paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: alpha(COLORS.primary.main, 0.12) },
  filterBannerText: { fontSize: 12, color: COLORS.primary.main, fontWeight: '600' },
  filterBannerClear:{ fontSize: 12, color: COLORS.error.main, fontWeight: '600' },

  // Stats
  statsRow:    { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  statCard:    { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statIconBox: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statTitle:   { fontSize: 9, color: COLORS.neutral[500], fontWeight: '600', marginBottom: 2, textAlign: 'center', textTransform: 'uppercase' },
  statValue:   { fontSize: 14, fontWeight: '800', textAlign: 'center' },

  // Tabs
  tabsWrapper:   { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.neutral[200] },
  tab:           { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: COLORS.primary.main },
  tabText:       { fontSize: 14, color: COLORS.neutral[500], fontWeight: '600' },
  tabTextActive: { color: COLORS.primary.main },

  // Search
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.neutral[200] },
  searchInput: { flex: 1, height: 44, fontSize: 14, color: COLORS.neutral[800] },

  // Loading
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadingText:   { marginTop: 12, color: COLORS.neutral[500], fontSize: 14 },

  // Expense Card
  expenseCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  cardTopRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardIconBox:    { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitleBox:   { flex: 1 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: COLORS.neutral[800] },
  cardId:         { fontSize: 11, color: COLORS.neutral[400], marginTop: 1 },
  cardAmountBox:  { alignItems: 'flex-end' },
  cardAmount:     { fontSize: 15, fontWeight: '800', color: COLORS.primary.main },
  cardRate:       { fontSize: 10, color: COLORS.neutral[400], marginTop: 1 },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  chipText:       { fontWeight: '600', fontSize: 12 },
  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCreator:    { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  creatorAvatar:  { width: 24, height: 24, borderRadius: 6, backgroundColor: COLORS.neutral[500], alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { color: '#fff', fontSize: 12, fontWeight: '700' },
  creatorName:    { fontSize: 12, color: COLORS.neutral[600], flex: 1 },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardDate:       { fontSize: 11, color: COLORS.neutral[400] },
  menuDotBtn:     { padding: 4 },

  // Modal header
  modalHeader:    { backgroundColor: COLORS.primary.main, paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 12, paddingBottom: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle:     { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modalSubtitle:  { color: 'rgba(255,255,255,0.78)', fontSize: 12, textAlign: 'center', marginTop: 1 },
  modalBody:      { flex: 1, padding: 16, backgroundColor: COLORS.neutral[50] },
  modalFooter:    { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.neutral[200] },

  // Form
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: COLORS.neutral[700], marginBottom: 6, marginTop: 8 },
  input:        { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.neutral[300], borderRadius: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 15, color: COLORS.neutral[800], marginBottom: 2 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.neutral[300], borderRadius: 10, paddingHorizontal: 12, marginBottom: 2, minHeight: Platform.OS === 'ios' ? 46 : 44 },
  inputInner:   { flex: 1, fontSize: 15, color: COLORS.neutral[800], paddingVertical: 0 },
  inputSuffix:  { fontSize: 13, color: COLORS.neutral[400], marginLeft: 4 },
  inputError:   { borderColor: COLORS.error.main },
  errorText:    { fontSize: 11, color: COLORS.error.main, marginBottom: 6, marginLeft: 2 },
  textArea:     { height: 84, textAlignVertical: 'top' },
  selectBtn:    { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.neutral[300], borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  selectText:   { fontSize: 15, color: COLORS.neutral[800] },

  // Fuel
  fuelSection:      { backgroundColor: alpha(COLORS.warning.main, 0.05), borderRadius: 12, padding: 14, borderWidth: 1, borderColor: alpha(COLORS.warning.main, 0.25), marginTop: 4, marginBottom: 4 },
  fuelSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.warning.main },
  calcPreview:      { backgroundColor: alpha(COLORS.primary.main, 0.06), borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: alpha(COLORS.primary.main, 0.15) },
  calcLabel:        { fontSize: 11, color: COLORS.neutral[500], marginBottom: 2 },
  calcAmount:       { fontSize: 22, fontWeight: '800' },
  calcFormula:      { fontSize: 11, color: COLORS.neutral[500], marginTop: 2 },

  // Buttons
  cancelBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.primary.main, borderRadius: 10, paddingVertical: 13 },
  cancelBtnText: { color: COLORS.primary.main, fontSize: 15, fontWeight: '700' },
  submitBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary.main, borderRadius: 10, paddingVertical: 13 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // View modal
  viewAmountCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  viewAmountLabel:  { fontSize: 12, color: COLORS.neutral[500], fontWeight: '600', marginBottom: 2 },
  viewAmount:       { fontSize: 30, fontWeight: '800' },
  viewSection:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.neutral[200] },
  viewSectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  viewSectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.neutral[600] },
  viewRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  viewKey:          { fontSize: 13, color: COLORS.neutral[500], flex: 1 },
  viewVal:          { fontSize: 13, fontWeight: '600', color: COLORS.neutral[800], flex: 2, textAlign: 'right' },
  viewDescription:  { fontSize: 14, color: COLORS.neutral[700], lineHeight: 20 },

  // Bottom sheet shared
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  bottomSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 16, maxHeight: SCREEN_HEIGHT * 0.72 },
  sheetHandle:       { width: 40, height: 4, backgroundColor: COLORS.neutral[300], borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 2 },
  sheetHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle:        { fontSize: 16, fontWeight: '700', color: COLORS.neutral[800] },
  sheetOption:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.neutral[100] },
  sheetOptionActive: { backgroundColor: alpha(COLORS.primary.main, 0.05) },
  sheetOptionText:   { fontSize: 15, color: COLORS.neutral[700] },

  // Action menu
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuTitle:    { fontSize: 15, fontWeight: '700', color: COLORS.neutral[800] },
  menuSubtitle: { fontSize: 12, color: COLORS.neutral[500], marginTop: 1 },
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  menuDivider:  { height: 1, backgroundColor: COLORS.neutral[100], marginVertical: 2 },

  // Filter
  filterSectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  filterGroupTitle:   { fontSize: 11, fontWeight: '700', color: COLORS.neutral[500], textTransform: 'uppercase', letterSpacing: 0.6 },
  filterFooter:       { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: COLORS.neutral[200] },
  periodPill:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.neutral[300], marginRight: 8 },
  periodPillActive:   { borderColor: COLORS.primary.main, backgroundColor: alpha(COLORS.primary.main, 0.08) },
  periodPillText:     { fontSize: 13, color: COLORS.neutral[600], fontWeight: '600' },
  periodPillTextActive: { color: COLORS.primary.main },

  // Empty
  emptyState:   { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.neutral[700], marginBottom: 8 },
  emptyText:    { fontSize: 14, color: COLORS.neutral[500], textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary.main, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Pagination
  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, paddingVertical: 16 },
  pageBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary.main, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  pageBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  pageInfo:      { fontSize: 14, color: COLORS.neutral[600], fontWeight: '600' },

  // Toast
  toast:    { position: 'absolute', top: Platform.OS === 'ios' ? 62 : 42, left: 16, right: 16, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', zIndex: 9999, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 10 },
  toastText:{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
});