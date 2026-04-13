// src/screen/RegistrationScreen.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  errorCodes as documentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerError,
  pick as pickDocument,
  types as documentPickerTypes,
} from '@react-native-documents/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';

const PRIMARY   = '#4569ea';
const SECONDARY = '#1a237e';
const SUCCESS   = '#4caf50';
const WARNING   = '#ff9800';
const ERROR     = '#f44336';
const BG        = '#f8fafc';
const WHITE     = '#ffffff';
const BORDER    = '#edf2f7';

const { width: SCREEN_W } = Dimensions.get('window');

const rgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

const ALLOWED_ROLES     = ['Head_office', 'ZSM', 'ASM', 'TEAM'];
const DEFAULT_PAGE_SIZE = 10;
const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

const REGISTRATION_UPLOAD_TYPE_OPTIONS = [
  { value: 'registrationDocument', label: 'Registration Document', icon: 'file-document-outline' },
  { value: 'aadhaar', label: 'Aadhaar Card', icon: 'card-account-details-outline' },
  { value: 'panCard', label: 'PAN Card', icon: 'card-bulleted-outline' },
  { value: 'passbook', label: 'Bank Passbook', icon: 'bank-outline' },
  { value: 'otherDocuments', label: 'Other Document', icon: 'file-outline' },
];

const REGISTRATION_STATUS_OPTIONS = ['pending', 'completed', 'inProgress'];
const REGISTRATION_STATUS_CONFIG: Record<string, any> = {
  inProgress: { color: PRIMARY, icon: 'clock-outline',        label: 'In Progress', order: 3 },
  pending:    { color: WARNING, icon: 'clock-alert-outline',  label: 'Pending',     order: 1 },
  completed:  { color: SUCCESS, icon: 'check-circle-outline', label: 'Completed',   order: 2 },
};

const LEAD_STATUS_OPTIONS = ['Registration', 'Document Submission', 'Missed Leads'];
const LEAD_STATUS_CONFIG: Record<string, any> = {
  'Registration':        { color: PRIMARY, icon: 'account-check-outline' },
  'Document Submission': { color: PRIMARY, icon: 'bank-outline'          },
  'Missed Leads':        { color: ERROR,   icon: 'account-cancel-outline'},
};

const SOLAR_REQUIREMENT_TYPES = [
  'Residential (1-5 kW)',
  'Commercial (5-50 kW)',
  'Industrial (50+ kW)',
  'Agricultural',
  'Government/Institutional',
  'Other',
];

const PERIOD_OPTIONS = [
  { value: 'Today',      label: 'Today'      },
  { value: 'This Week',  label: 'This Week'  },
  { value: 'This Month', label: 'This Month' },
  { value: 'All',        label: 'All Time'   },
];

const getInitials = (first = '', last = '') =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '??';

const getRegStatusConfig = (status?: string) =>
  REGISTRATION_STATUS_CONFIG[status ?? ''] ?? {
    color: PRIMARY, icon: 'help-circle-outline', label: status || 'Unknown', order: 0,
  };

const getLeadStatusConfig = (status?: string) =>
  LEAD_STATUS_CONFIG[status ?? ''] ?? { color: PRIMARY, icon: 'help-circle-outline' };

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Not set';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? 'Invalid Date'
      : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return 'Invalid Date'; }
};

const getUserPermissions = (role: string) => ({
  canEdit:         true,
  canDelete:       role === 'Head_office',
  canManage:       ['Head_office', 'ZSM', 'ASM'].includes(role),
  canSeeAll:       ['Head_office', 'ZSM', 'ASM'].includes(role),
  canUpdateStatus: ['Head_office', 'ZSM', 'ASM'].includes(role),
  canUploadDocs:   ALLOWED_ROLES.includes(role),
});

const validatePincode = (v: string) => {
  if (!v.trim()) return 'Pincode is required';
  if (!/^\d{6}$/.test(v.trim())) return 'Pincode must be 6 digits';
  return '';
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const isDocumentPickerCancel = (error: unknown) =>
  isDocumentPickerError(error) &&
  error.code === documentPickerErrorCodes.OPERATION_CANCELED;

const LinearProgress = ({ value = 0 }: { value: number }) => (
  <View style={styles.regProgressTrack}>
    <View style={[styles.regProgressFill, { width: `${Math.min(value, 100)}%` }]} />
  </View>
);

const RegistrationSelect = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(opt => opt.value === value);

  return (
    <>
      <TouchableOpacity
        style={styles.regSelectTrigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.regSelectTriggerText, !selected && styles.regPlaceholderText]}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="#6b7280" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.regSelectOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.regSelectPanel}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.regSelectOption, value === opt.value && styles.regSelectOptionActive]}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.regSelectOptionText, value === opt.value && styles.regSelectOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {value === opt.value && (
                    <MaterialCommunityIcons name="check" size={16} color={PRIMARY} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const RegistrationFileUploadField = ({
  label,
  field,
  value,
  onFileChange,
  onRemove,
  validationErrors,
}: any) => {
  const hasFile = value?.preview || value?.url;

  const handlePick = async () => {
    try {
      const res = await pickDocument({
        type: [documentPickerTypes.images, documentPickerTypes.pdf],
      });
      onFileChange(field, res[0]);
    } catch (e) {
      if (!isDocumentPickerCancel(e)) console.warn('File pick error', e);
    }
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.regUploadFieldLabel}>{label}</Text>
      {hasFile ? (
        <View style={[styles.regUploadFileBox, validationErrors?.[field] && styles.regUploadErrorBorder]}>
          {value.preview
            ? <Image source={{ uri: value.preview }} style={styles.regUploadThumb} />
            : <MaterialCommunityIcons name="file-document-outline" size={34} color={PRIMARY} />}
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={styles.regUploadFileName} numberOfLines={1}>
              {value.file?.name || value.url?.split('/').pop() || label}
            </Text>
            <Text style={styles.regUploadFileMeta}>
              {value.file?.size ? formatFileSize(value.file.size) : 'Existing document'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(field)}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={ERROR} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.regUploadDrop, validationErrors?.[field] && styles.regUploadErrorBorder]}
          onPress={handlePick}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="cloud-upload-outline" size={36} color="#d1d5db" />
          <Text style={styles.regUploadDropText}>Tap to upload {label}</Text>
          <Text style={styles.regUploadDropHint}>JPG, PNG or PDF - max 10 MB</Text>
        </TouchableOpacity>
      )}
      {validationErrors?.[field] ? (
        <Text style={styles.regUploadErrorText}>{validationErrors[field]}</Text>
      ) : null}
    </View>
  );
};

// ─── Avatar ───────────────────────────────────────────────────
const InitialsAvatar = ({ first = '', last = '', size = 40 }: any) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>
      {getInitials(first, last)}
    </Text>
  </View>
);

// ─── StatusChip ───────────────────────────────────────────────
const StatusChip = ({ label, color, icon }: any) => (
  <View style={[styles.chip, { backgroundColor: rgba(color, 0.12) }]}>
    <MaterialCommunityIcons name={icon} size={12} color={color} style={{ marginRight: 3 }} />
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);

// ─── SectionCard ──────────────────────────────────────────────
const SectionCard = ({ title, icon, children }: any) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionCardHeader}>
      <MaterialCommunityIcons name={icon} size={18} color={PRIMARY} />
      <Text style={styles.sectionCardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

// ─── InfoRow ──────────────────────────────────────────────────
const InfoRow = ({ label, value }: any) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || 'Not set'}</Text>
  </View>
);

// ─── Toast ────────────────────────────────────────────────────
const Toast = ({ message, severity, visible }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0,   duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);
  const bg = severity === 'error' ? ERROR : severity === 'warning' ? WARNING : SUCCESS;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// SelectModal
// FIX: Uses a high zIndex/elevation so it always appears above
// its sibling Modals. Never nested inside another Modal.
// ─────────────────────────────────────────────────────────────
const SelectModal = ({ visible, onClose, options, value, onSelect, title }: any) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    {/* Extra elevation wrapper so this sheet always sits on top */}
    <View style={{ flex: 1, justifyContent: 'flex-end', zIndex: 9999, elevation: 9999 }}>
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={onClose}
      />
      <View style={styles.selectSheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
          {options.map((opt: any) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.selectOption, value === opt.value && styles.selectOptionActive]}
              onPress={() => { onSelect(opt.value); onClose(); }}
            >
              {opt.icon && (
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={18}
                  color={value === opt.value ? WHITE : PRIMARY}
                  style={{ marginRight: 10 }}
                />
              )}
              <Text style={[styles.selectOptionText, value === opt.value && { color: WHITE }]}>
                {opt.label}
              </Text>
              {value === opt.value && (
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={WHITE}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
          <TouchableOpacity
            style={[styles.btnOutline, { marginTop: 0 }]}
            onPress={onClose}
          >
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ─── SummaryCard ──────────────────────────────────────────────
const SummaryCard = ({ label, value, icon, subText }: any) => (
  <View style={styles.summaryCard}>
    <View style={styles.summaryCardTop}>
      <View style={styles.summaryIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={PRIMARY} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summarySubtext}>{subText}</Text>
  </View>
);

// ─── RegistrationCard ─────────────────────────────────────────
const RegistrationCard = ({ item, onView, onEdit, onUpload, permissions }: any) => {
  const [expanded, setExpanded] = useState(false);
  const regCfg  = getRegStatusConfig(item.registrationStatus);
  const leadCfg = getLeadStatusConfig(item.status);

  return (
    <View style={styles.regCard}>
      <View style={styles.regCardHeader}>
        <InitialsAvatar first={item.firstName} last={item.lastName} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.regCardName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.regCardId}>ID: {item._id?.slice(-8) || 'N/A'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setExpanded(e => !e)}
          style={styles.expandBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={PRIMARY}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.regCardInfo}>
        <View style={styles.regCardInfoItem}>
          <MaterialCommunityIcons name="phone-outline" size={13} color={rgba(PRIMARY, 0.7)} />
          <Text style={styles.regCardInfoText} numberOfLines={1}>{item.phone || 'No phone'}</Text>
        </View>
        <View style={styles.regCardInfoItem}>
          <MaterialCommunityIcons name="email-outline" size={13} color={rgba(PRIMARY, 0.7)} />
          <Text style={styles.regCardInfoText} numberOfLines={1}>{item.email || 'No email'}</Text>
        </View>
      </View>

      <View style={styles.regCardMeta}>
        <MaterialCommunityIcons name="calendar-outline" size={13} color={rgba(PRIMARY, 0.7)} />
        <Text style={styles.regCardMetaText}>{formatDate(item.dateOfRegistration)}</Text>
        <View style={styles.dot} />
        <MaterialCommunityIcons name="solar-power" size={13} color={rgba(PRIMARY, 0.7)} />
        <Text style={styles.regCardMetaText} numberOfLines={1}>
          {item.solarRequirement || 'Not specified'}
        </Text>
      </View>

      <View style={styles.chipRow}>
        <StatusChip label={regCfg.label}             color={regCfg.color}  icon={regCfg.icon}  />
        <StatusChip label={item.status || 'Unknown'}  color={leadCfg.color} icon={leadCfg.icon} />
      </View>

      {item.city && (
        <View style={[styles.regCardInfoItem, { marginTop: 6 }]}>
          <MaterialCommunityIcons name="map-marker-outline" size={13} color={rgba(PRIMARY, 0.7)} />
          <Text style={styles.regCardInfoText}>
            {item.city}{item.state ? `, ${item.state}` : ''}
          </Text>
        </View>
      )}

      {expanded && (
        <View style={styles.expandedSection}>
          {!!item.address           && <InfoRow label="Address"      value={item.address} />}
          {!!item.pincode           && <InfoRow label="Pincode"      value={item.pincode} />}
          {!!item.registrationNotes && <InfoRow label="Notes"        value={item.registrationNotes} />}
          <InfoRow label="Created"      value={formatDate(item.createdAt)} />
          <InfoRow label="Last Updated" value={formatDate(item.updatedAt)} />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              activeOpacity={0.7}
              onPress={() => onView(item)}
            >
              <MaterialCommunityIcons name="eye-outline" size={14} color={WHITE} />
              <Text style={styles.actionBtnTextPrimary}>View</Text>
            </TouchableOpacity>
            {permissions.canEdit && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnOutline]}
                activeOpacity={0.7}
                onPress={() => onEdit(item)}
              >
                <MaterialCommunityIcons name="pencil-outline" size={14} color={PRIMARY} />
                <Text style={styles.actionBtnTextOutline}>Edit</Text>
              </TouchableOpacity>
            )}
            {permissions.canUploadDocs && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnOutline]}
                activeOpacity={0.7}
                onPress={() => onUpload(item)}
              >
                <MaterialCommunityIcons name="cloud-upload-outline" size={14} color={PRIMARY} />
                <Text style={styles.actionBtnTextOutline}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const RegistrationUploadModal = ({
  visible,
  onClose,
  registration,
  onUploaded,
  showToast,
}: any) => {
  const { fetchAPI } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState<any>({
    documentStatus: 'pending',
    registrationDocument: { file: null, url: '', preview: null },
    aadhaar: { file: null, url: '', preview: null },
    panCard: { file: null, url: '', preview: null },
    passbook: { file: null, url: '', preview: null },
    otherDocuments: [],
    documentSubmissionDate: null,
    documentNotes: '',
  });

  useEffect(() => {
    if (visible) {
      setUploading(false);
      setProgress(0);
      setErrors({});
      setShowDatePicker(false);
      setForm({
        documentStatus: registration?.documentStatus || 'pending',
        registrationDocument: {
          file: null,
          url: registration?.uploadDocument?.url || '',
          preview: null,
        },
        aadhaar: {
          file: null,
          url: registration?.aadhaar?.url || '',
          preview: registration?.aadhaar?.url || null,
        },
        panCard: {
          file: null,
          url: registration?.panCard?.url || '',
          preview: registration?.panCard?.url || null,
        },
        passbook: {
          file: null,
          url: registration?.passbook?.url || '',
          preview: registration?.passbook?.url || null,
        },
        otherDocuments: registration?.otherDocuments || [],
        documentSubmissionDate: registration?.documentSubmissionDate ? new Date(registration.documentSubmissionDate) : null,
        documentNotes: registration?.documentNotes || '',
      });
    }
  }, [visible, registration?._id]);

  const handleFileChange = useCallback((field: string, file: any) => {
    if (file.size && file.size > MAX_UPLOAD_FILE_SIZE) {
      showToast('File must be under 10 MB', 'error');
      return;
    }
    const isImg = file.type?.startsWith('image/');
    setForm((prev: any) => ({
      ...prev,
      [field]: { file, url: file.uri, preview: isImg ? file.uri : null },
    }));
    setErrors((prev: any) => ({ ...prev, [field]: '' }));
  }, [showToast]);

  const handleRemove = useCallback((field: string) => {
    setForm((prev: any) => ({
      ...prev,
      [field]: { file: null, url: '', preview: null },
    }));
  }, []);

  const handleAddOtherDoc = useCallback(async () => {
    try {
      const res = await pickDocument({
        type: [documentPickerTypes.images, documentPickerTypes.pdf],
      });
      const file = res[0];
      if (!file) return;
      if (file.size && file.size > MAX_UPLOAD_FILE_SIZE) {
        showToast('File must be under 10 MB', 'error');
        return;
      }
      setForm((prev: any) => ({
        ...prev,
        otherDocuments: [
          ...prev.otherDocuments,
          {
            file,
            name: file.name,
            url: file.uri,
            preview: file.type?.startsWith('image/') ? file.uri : null,
          },
        ],
      }));
    } catch (e) {
      if (!isDocumentPickerCancel(e)) showToast('Failed to pick file', 'error');
    }
  }, [showToast]);

  const handleUpload = useCallback(async () => {
    if (!registration?._id) return;
    if (!form.documentStatus) {
      setErrors({ documentStatus: 'Document status is required' });
      return;
    }

    const hasGeneralFiles =
      !!form.aadhaar.file ||
      !!form.panCard.file ||
      !!form.passbook.file ||
      form.otherDocuments.some((d: any) => !!d.file);
    const hasRegistrationFile = !!form.registrationDocument.file;

    if (!hasGeneralFiles && !hasRegistrationFile) {
      showToast('Please select at least one document to upload', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      let latestResult: any = registration;
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 400);

      if (hasRegistrationFile) {
        const regFd = new FormData();
        regFd.append('document', {
          uri: form.registrationDocument.file.uri,
          type: form.registrationDocument.file.type || 'application/octet-stream',
          name: form.registrationDocument.file.name || `registration_${Date.now()}`,
        } as any);

        const regRes = await fetchAPI(`/lead/registration/${registration._id}/document-upload`, {
          method: 'POST',
          body: regFd,
        });

        if (!regRes?.success) {
          throw new Error(regRes?.message || 'Registration document upload failed');
        }
        latestResult = regRes.result || latestResult;
      }

      if (hasGeneralFiles || form.documentNotes || form.documentSubmissionDate || form.documentStatus) {
        const fd = new FormData();
        const jsonData: any = {};
        if (form.documentNotes) jsonData.documentNotes = form.documentNotes;
        if (form.documentStatus) jsonData.documentStatus = form.documentStatus;
        if (form.documentSubmissionDate) {
          jsonData.documentSubmissionDate = new Date(form.documentSubmissionDate)
            .toISOString()
            .split('T')[0];
        }

        const appendFile = (key: string, f: any) =>
          fd.append(key, { uri: f.uri, type: f.type || 'application/octet-stream', name: f.name } as any);

        if (form.aadhaar.file) appendFile('aadhaar', form.aadhaar.file);
        if (form.panCard.file) appendFile('panCard', form.panCard.file);
        if (form.passbook.file) appendFile('passbook', form.passbook.file);
        form.otherDocuments.forEach((d: any) => { if (d.file) appendFile('otherDocuments', d.file); });
        fd.append('data', JSON.stringify(jsonData));

        const docsRes = await fetchAPI(`/lead/upload/${registration._id}/upload-documents`, {
          method: 'PUT',
          body: fd,
        });

        if (!docsRes?.success) {
          throw new Error(docsRes?.message || 'Document upload failed');
        }
        latestResult = docsRes.result || latestResult;
      }

      setProgress(100);
      showToast('Document uploaded successfully', 'success');
      onUploaded?.(latestResult);
      setTimeout(() => onClose(), 500);
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setProgress(0);
      setUploading(false);
    }
  }, [fetchAPI, form, onClose, onUploaded, registration, showToast]);

  if (!registration) return null;

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.regUploadHeaderBar}>
            <View style={styles.regUploadHeaderIconWrap}>
              <MaterialCommunityIcons name="cloud-upload-outline" size={22} color={PRIMARY} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.regUploadHeaderTitle}>Upload Documents</Text>
              <Text style={styles.regUploadHeaderSub}>{registration.firstName} {registration.lastName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={uploading}>
              <MaterialCommunityIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {uploading && progress > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.regUploadProgressText}>Uploading... {progress}%</Text>
                <LinearProgress value={progress} />
              </View>
            )}

            <Text style={styles.regUploadFieldLabel}>Document Status *</Text>
            <RegistrationSelect
              value={form.documentStatus}
              options={statusOptions}
              onChange={v => setForm((prev: any) => ({ ...prev, documentStatus: v }))}
            />
            {errors.documentStatus ? <Text style={styles.regUploadErrorText}>{errors.documentStatus}</Text> : null}

            <Text style={[styles.regUploadFieldLabel, { marginTop: 14 }]}>Submission Date</Text>
            <TouchableOpacity style={styles.regUploadDateRow} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-month-outline" size={16} color="#6b7280" />
              <Text style={[styles.regUploadDateText, !form.documentSubmissionDate && styles.regPlaceholderText]}>
                {form.documentSubmissionDate
                  ? new Date(form.documentSubmissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Select date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={form.documentSubmissionDate || new Date()}
                mode="date"
                display="default"
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setForm((prev: any) => ({ ...prev, documentSubmissionDate: d }));
                }}
              />
            )}

            <Text style={[styles.regUploadSectionTitle, { marginTop: 16 }]}>Required Documents</Text>
            <RegistrationFileUploadField
              label="Registration Document"
              field="registrationDocument"
              value={form.registrationDocument}
              onFileChange={handleFileChange}
              onRemove={handleRemove}
              validationErrors={errors}
            />
            <RegistrationFileUploadField
              label="Aadhaar Card"
              field="aadhaar"
              value={form.aadhaar}
              onFileChange={handleFileChange}
              onRemove={handleRemove}
              validationErrors={errors}
            />
            <RegistrationFileUploadField
              label="PAN Card"
              field="panCard"
              value={form.panCard}
              onFileChange={handleFileChange}
              onRemove={handleRemove}
              validationErrors={errors}
            />
            <RegistrationFileUploadField
              label="Passbook"
              field="passbook"
              value={form.passbook}
              onFileChange={handleFileChange}
              onRemove={handleRemove}
              validationErrors={errors}
            />

            <Text style={[styles.regUploadSectionTitle, { marginTop: 4 }]}>
              Other Documents ({form.otherDocuments.length})
            </Text>
            {form.otherDocuments.map((doc: any, i: number) => (
              <View key={i} style={styles.regOtherDocItem}>
                <MaterialCommunityIcons name="file-document-outline" size={26} color={PRIMARY} />
                <Text style={styles.regOtherDocName} numberOfLines={1}>{doc.name}</Text>
                <TouchableOpacity
                  onPress={() => setForm((prev: any) => ({
                    ...prev,
                    otherDocuments: prev.otherDocuments.filter((_: any, j: number) => j !== i),
                  }))}
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color={ERROR} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.regAddMoreBtn} onPress={handleAddOtherDoc} disabled={uploading}>
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={PRIMARY} />
              <Text style={styles.regAddMoreText}>Add More Documents</Text>
            </TouchableOpacity>

            <Text style={[styles.regUploadFieldLabel, { marginTop: 16 }]}>Document Notes</Text>
            <TextInput
              style={styles.regUploadNotesInput}
              value={form.documentNotes}
              onChangeText={t => setForm((prev: any) => ({ ...prev, documentNotes: t }))}
              multiline
              numberOfLines={4}
              placeholder="Add any comments or notes..."
              placeholderTextColor="#9ca3af"
              editable={!uploading}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.regUploadFooterBar}>
            <TouchableOpacity style={styles.regUploadCancelBtn} onPress={onClose} disabled={uploading}>
              <Text style={styles.regUploadCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.regUploadSubmitBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#fff" />
              )}
              <Text style={styles.regUploadSubmitText}>{uploading ? 'Uploading...' : 'Upload Documents'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// ViewRegistrationModal
// FIX: Modal always mounts; content guarded with {registration && ...}
// ─────────────────────────────────────────────────────────────
const ViewRegistrationModal = ({ visible, onClose, registration }: any) => {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (visible) setActiveTab(0);
  }, [visible]);

  const tabs = ['Basic Info', 'Notes', 'Timeline'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {registration ? (
        <View style={styles.modalRoot}>
          {/* Header */}
          <View style={styles.viewModalHeader}>
            <InitialsAvatar first={registration.firstName} last={registration.lastName} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.viewModalName}>
                {registration.firstName} {registration.lastName}
              </Text>
              <Text style={styles.viewModalId}>ID: {registration._id?.slice(-8)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {tabs.map((t, i) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, activeTab === i && styles.tabActive]}
                onPress={() => setActiveTab(i)}
              >
                <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {activeTab === 0 && (
              <>
                <SectionCard title="Personal Information" icon="account-outline">
                  <InfoRow label="Full Name" value={`${registration.firstName} ${registration.lastName}`} />
                  <InfoRow label="Email"     value={registration.email} />
                  <InfoRow label="Phone"     value={registration.phone} />
                </SectionCard>

                <SectionCard title="Registration Information" icon="solar-power">
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reg. Status</Text>
                <StatusChip
                      label={getRegStatusConfig(registration.registrationStatus).label}
                      color={getRegStatusConfig(registration.registrationStatus).color}
                      icon={getRegStatusConfig(registration.registrationStatus).icon}
                    />
                  </View>
                  <InfoRow
                    label="Registration Doc"
                    value={registration.uploadDocument?.url ? 'Uploaded' : 'Not uploaded'}
                  />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Lead Status</Text>
                    <StatusChip
                      label={registration.status || 'Unknown'}
                      color={getLeadStatusConfig(registration.status).color}
                      icon={getLeadStatusConfig(registration.status).icon}
                    />
                  </View>
                  <InfoRow label="Reg. Date"        value={formatDate(registration.dateOfRegistration)} />
                  <InfoRow label="Solar Requirement" value={registration.solarRequirement} />
                </SectionCard>

                <SectionCard title="Address Information" icon="map-marker-outline">
                  <InfoRow label="Address" value={registration.address} />
                  <InfoRow label="City"    value={registration.city} />
                  <InfoRow label="State"   value={registration.state} />
                  <InfoRow label="Pincode" value={registration.pincode} />
                </SectionCard>
              </>
            )}

            {activeTab === 1 && (
              <SectionCard title="Registration Notes" icon="note-outline">
                <Text style={styles.notesText}>
                  {registration.registrationNotes || 'No notes available'}
                </Text>
              </SectionCard>
            )}

            {activeTab === 2 && (
              <SectionCard title="Activity Timeline" icon="clock-outline">
                <InfoRow label="Created"      value={formatDate(registration.createdAt)} />
                <InfoRow label="Last Updated" value={formatDate(registration.updatedAt)} />
              </SectionCard>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onClose}>
              <Text style={styles.btnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.modalRoot, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      )}
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// EditRegistrationModal
// FIX 1: SelectModals are rendered as top-level siblings of the
//         main Modal so they are never buried under it.
// FIX 2: Each SelectModal controls its own independent visible
//         prop so only one can open at a time without fighting
//         the parent Modal's stacking context.
// ─────────────────────────────────────────────────────────────
const EditRegistrationModal = ({
  visible, onClose, registration, onSave, showToast,
}: any) => {
  const { fetchAPI } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    address:            '',
    city:               '',
    pincode:            '',
    solarRequirement:   '',
    registrationStatus: 'inProgress',
    registrationNotes:  '',
    status:             'Registration',
  });
  const [errors, setErrors]       = useState<Record<string, string>>({});
  // FIX: use separate booleans instead of a single openSheet string
  // so each SelectModal has its own visible prop — cleaner and avoids
  // stale-closure issues when one modal closes and another opens fast.
  const [solarOpen,     setSolarOpen]     = useState(false);
  const [regStatusOpen, setRegStatusOpen] = useState(false);
  const [leadStatusOpen,setLeadStatusOpen]= useState(false);

  useEffect(() => {
    if (visible && registration) {
      setForm({
        address:            registration.address            || '',
        city:               registration.city               || '',
        pincode:            registration.pincode            || '',
        solarRequirement:   registration.solarRequirement   || '',
        registrationStatus: registration.registrationStatus || 'inProgress',
        registrationNotes:  registration.registrationNotes  || '',
        status:             registration.status             || 'Registration',
      });
      setErrors({});
      setSolarOpen(false);
      setRegStatusOpen(false);
      setLeadStatusOpen(false);
    }
  }, [visible, registration]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.address.trim())          e.address          = 'Address is required';
    if (!form.city.trim())             e.city             = 'City is required';
    const pc = validatePincode(form.pincode);
    if (pc)                            e.pincode          = pc;
    if (!form.solarRequirement.trim()) e.solarRequirement = 'Solar requirement is required';
    setErrors(e);
    return Object.values(e).every(v => !v);
  };

  const handleSave = async () => {
    if (!validate()) { showToast('Please fix the errors in the form', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetchAPI(`/lead/updateLead/${registration._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (res?.success) {
        showToast('Registration updated successfully', 'success');
        onSave(res.result || { ...registration, ...form });
        onClose();
      } else {
        throw new Error(res?.message || 'Update failed');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to update registration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const solarOptions = SOLAR_REQUIREMENT_TYPES.map(t => ({ value: t, label: t }));
  const regStatusOptions = REGISTRATION_STATUS_OPTIONS.map(s => ({
    value: s, label: getRegStatusConfig(s).label, icon: getRegStatusConfig(s).icon,
  }));
  const leadStatusOptions = LEAD_STATUS_OPTIONS.map(s => ({
    value: s, label: s, icon: getLeadStatusConfig(s).icon,
  }));

  return (
    <>
      {/* ── SelectModals rendered OUTSIDE the main Modal ── */}
      <SelectModal
        visible={solarOpen}
        onClose={() => setSolarOpen(false)}
        title="Select Solar Requirement"
        options={solarOptions}
        value={form.solarRequirement}
        onSelect={(v: string) => setForm(p => ({ ...p, solarRequirement: v }))}
      />
      <SelectModal
        visible={regStatusOpen}
        onClose={() => setRegStatusOpen(false)}
        title="Select Registration Status"
        options={regStatusOptions}
        value={form.registrationStatus}
        onSelect={(v: string) => setForm(p => ({ ...p, registrationStatus: v }))}
      />
      <SelectModal
        visible={leadStatusOpen}
        onClose={() => setLeadStatusOpen(false)}
        title="Select Lead Status"
        options={leadStatusOptions}
        value={form.status}
        onSelect={(v: string) => setForm(p => ({ ...p, status: v }))}
      />

      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {registration ? (
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editModalHeader}>
              <View style={styles.editModalIcon}>
                <MaterialCommunityIcons name="pencil-outline" size={22} color={PRIMARY} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.editModalTitle}>Edit Registration</Text>
                <Text style={styles.editModalSub}>
                  {registration.firstName} {registration.lastName}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Address *</Text>
              <TextInput
                style={[styles.textInput, errors.address && styles.inputError, { height: 80 }]}
                value={form.address}
                onChangeText={v => setForm(p => ({ ...p, address: v }))}
                multiline
                placeholder="Enter address"
                placeholderTextColor="#aaa"
                textAlignVertical="top"
              />
              {!!errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

              <Text style={styles.fieldLabel}>City *</Text>
              <TextInput
                style={[styles.textInput, errors.city && styles.inputError]}
                value={form.city}
                onChangeText={v => setForm(p => ({ ...p, city: v }))}
                placeholder="Enter city"
                placeholderTextColor="#aaa"
              />
              {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

              <Text style={styles.fieldLabel}>Pincode *</Text>
              <TextInput
                style={[styles.textInput, errors.pincode && styles.inputError]}
                value={form.pincode}
                onChangeText={v => setForm(p => ({ ...p, pincode: v }))}
                placeholder="6-digit pincode"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={6}
              />
              {!!errors.pincode && <Text style={styles.errorText}>{errors.pincode}</Text>}

              <Text style={styles.fieldLabel}>Solar Requirement *</Text>
              <TouchableOpacity
                style={[styles.selectField, errors.solarRequirement && styles.inputError]}
                onPress={() => setSolarOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={form.solarRequirement ? styles.selectFieldText : styles.selectPlaceholder}>
                  {form.solarRequirement || 'Select requirement'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
              </TouchableOpacity>
              {!!errors.solarRequirement && (
                <Text style={styles.errorText}>{errors.solarRequirement}</Text>
              )}

              <Text style={styles.fieldLabel}>Registration Status</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setRegStatusOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText}>
                  {getRegStatusConfig(form.registrationStatus).label}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Lead Status</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setLeadStatusOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText}>{form.status}</Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Registration Notes</Text>
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                value={form.registrationNotes}
                onChangeText={v => setForm(p => ({ ...p, registrationNotes: v }))}
                multiline
                placeholder="Add notes..."
                placeholderTextColor="#aaa"
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.editModalFooter}>
              <TouchableOpacity style={styles.btnOutline} onPress={onClose}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1, marginLeft: 8 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={WHITE} size="small" />
                  : <Text style={styles.btnPrimaryText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.modalRoot, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={PRIMARY} size="large" />
          </View>
        )}
      </Modal>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// FilterDrawer
// FIX: Same pattern — SelectModals are siblings rendered before
//      the filter Modal so they aren't buried under its backdrop.
//      Separate boolean state instead of a single openSheet string.
// ─────────────────────────────────────────────────────────────
const FilterDrawer = ({ visible, onClose, filters, setFilters, onClear }: any) => {
  const [periodOpen,    setPeriodOpen]    = useState(false);
  const [regStatusOpen, setRegStatusOpen] = useState(false);
  const [leadStatusOpen,setLeadStatusOpen]= useState(false);

  useEffect(() => {
    if (!visible) {
      setPeriodOpen(false);
      setRegStatusOpen(false);
      setLeadStatusOpen(false);
    }
  }, [visible]);

  const regStatusOptions = [
    { value: 'All', label: 'All Statuses' },
    ...REGISTRATION_STATUS_OPTIONS.map(s => ({
      value: s, label: getRegStatusConfig(s).label, icon: getRegStatusConfig(s).icon,
    })),
  ];
  const leadStatusOptions = [
    { value: 'All', label: 'All Statuses' },
    ...LEAD_STATUS_OPTIONS.map(s => ({
      value: s, label: s, icon: getLeadStatusConfig(s).icon,
    })),
  ];
  const periodOpts = PERIOD_OPTIONS.map(p => ({ value: p.value, label: p.label }));

  return (
    <>
      {/* ── SelectModals rendered OUTSIDE the filter Modal ── */}
      <SelectModal
        visible={periodOpen}
        onClose={() => setPeriodOpen(false)}
        title="Select Period"
        options={periodOpts}
        value={filters.period}
        onSelect={(v: string) => setFilters((p: any) => ({ ...p, period: v }))}
      />
      <SelectModal
        visible={regStatusOpen}
        onClose={() => setRegStatusOpen(false)}
        title="Registration Status"
        options={regStatusOptions}
        value={filters.regStatus}
        onSelect={(v: string) => setFilters((p: any) => ({ ...p, regStatus: v }))}
      />
      <SelectModal
        visible={leadStatusOpen}
        onClose={() => setLeadStatusOpen(false)}
        title="Lead Status"
        options={leadStatusOptions}
        value={filters.leadStatus}
        onSelect={(v: string) => setFilters((p: any) => ({ ...p, leadStatus: v }))}
      />

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <View style={[styles.selectSheet, { maxHeight: '85%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.filterHeader}>
              <Text style={styles.sheetTitle}>Filter Registrations</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Search */}
              <Text style={styles.fieldLabel}>Search</Text>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={18} color="#888" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Name, email, phone..."
                  placeholderTextColor="#aaa"
                  value={filters.search}
                  onChangeText={v => setFilters((p: any) => ({ ...p, search: v }))}
                />
                {filters.search !== '' && (
                  <TouchableOpacity onPress={() => setFilters((p: any) => ({ ...p, search: '' }))}>
                    <MaterialCommunityIcons name="close-circle" size={16} color="#aaa" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Period */}
              <Text style={styles.fieldLabel}>Time Period</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setPeriodOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText}>{filters.period}</Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
              </TouchableOpacity>

              {/* Reg Status */}
              <Text style={styles.fieldLabel}>Registration Status</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setRegStatusOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText}>
                  {filters.regStatus === 'All'
                    ? 'All Statuses'
                    : getRegStatusConfig(filters.regStatus).label}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
              </TouchableOpacity>

              {/* Lead Status */}
              <Text style={styles.fieldLabel}>Lead Status</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setLeadStatusOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText}>
                  {filters.leadStatus === 'All' ? 'All Statuses' : filters.leadStatus}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => { onClear(); onClose(); }}
              >
                <Text style={styles.btnOutlineText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1, marginLeft: 8 }]}
                onPress={onClose}
              >
                <Text style={styles.btnPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ─── LoadingSkeleton ──────────────────────────────────────────
const LoadingSkeleton = () => {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  const Bone = ({ h = 16, w = '100%' as any, radius = 8, mb = 8 }) => (
    <Animated.View style={{
      height: h, width: w, borderRadius: radius,
      backgroundColor: '#dde3f5', marginBottom: mb, opacity,
    }} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: BG, padding: 16 }}>
      <Bone h={120} radius={12} mb={16} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[0,1,2,3].map(i => (
          <Bone key={i} h={80} w={(SCREEN_W - 52) / 2} radius={10} mb={0} />
        ))}
      </View>
      {[0,1,2,3,4].map(i => <Bone key={i} h={130} radius={12} mb={12} />)}
    </View>
  );
};

// ─── EmptyState ───────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear }: any) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconCircle}>
      <MaterialCommunityIcons name="account-check-outline" size={40} color={PRIMARY} />
    </View>
    <Text style={styles.emptyTitle}>No registrations found</Text>
    <Text style={styles.emptyMsg}>
      {hasFilters
        ? 'No registrations match your filters. Try adjusting your criteria.'
        : 'No registrations have been submitted yet.'}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={styles.btnPrimary} onPress={onClear}>
        <MaterialCommunityIcons name="close-circle-outline" size={16} color={WHITE} style={{ marginRight: 6 }} />
        <Text style={styles.btnPrimaryText}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────
interface RegistrationScreenProps {
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
  onBackPress?:    () => void;
}

export default function RegistrationScreen({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onBackPress,
}: RegistrationScreenProps) {
  const { fetchAPI, user, getUserRole } = useAuth();
  const userRole    = getUserRole?.() ?? (user as any)?.role ?? '';
  const permissions = useMemo(() => getUserPermissions(userRole), [userRole]);

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalRegistrations: 0, pendingRegistrations: 0,
    completedRegistrations: 0, approvedRegistrations: 0,
  });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const [filters, setFilters] = useState({
    search: '', period: 'Today', regStatus: 'All', leadStatus: 'All',
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [page,       setPage]       = useState(0);

  // ── FIX: use a single selectedReg ref that is set BEFORE the
  //    modal opens, guaranteeing it is non-null when the modal
  //    first renders. We never reset it to null on close so the
  //    modal content doesn't flash away during its close animation.
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [viewOpen,    setViewOpen]    = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [uploadOpen,  setUploadOpen]  = useState(false);

  const [toast, setToast] = useState({ message: '', severity: 'success', visible: false });
  const showToast = useCallback((message: string, severity = 'success') => {
    setToast({ message, severity, visible: true });
    setTimeout(() => setToast(p => ({ ...p, visible: false })), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    if (!ALLOWED_ROLES.includes(userRole)) return;
    try {
      setError(null);
      const params = new URLSearchParams();
      const today  = new Date();
      const fmt    = (d: Date) => d.toISOString().split('T')[0];

      if (filters.period === 'Today') {
        params.append('startDate', fmt(today));
        params.append('endDate',   fmt(today));
      } else if (filters.period === 'This Week') {
        const w = new Date(today); w.setDate(w.getDate() - 7);
        params.append('startDate', fmt(w));
        params.append('endDate',   fmt(today));
      } else if (filters.period === 'This Month') {
        const m = new Date(today); m.setMonth(m.getMonth() - 1);
        params.append('startDate', fmt(m));
        params.append('endDate',   fmt(today));
      }

      const res = await fetchAPI(`/lead/registrationSummary?${params.toString()}`);
      if (res?.success) {
        const raw: any[] = res.result?.registrations || [];
        let list = raw;
        if (userRole === 'TEAM' && (user as any)?._id) {
          const uid = (user as any)._id;
          list = raw.filter(r =>
            r.assignedTo === uid || r.assignedUser?._id === uid || r.createdBy === uid,
          );
        }
        setRegistrations(list);
        setSummary({
          totalRegistrations:     list.length,
          pendingRegistrations:   list.filter(r => r.registrationStatus === 'pending').length,
          completedRegistrations: list.filter(r => r.registrationStatus === 'completed').length,
          approvedRegistrations:  list.filter(r => r.registrationStatus === 'approved').length,
        });
      } else {
        throw new Error(res?.message || 'Failed to fetch');
      }
    } catch (e: any) {
      setError(e.message);
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAPI, userRole, user, filters.period, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [filters]);

  const handleSave = useCallback((updated: any) => {
    setRegistrations(prev =>
      prev.map(r => r._id === updated._id ? { ...r, ...updated } : r),
    );
    setSelectedReg((prev: any) =>
      prev?._id === updated._id ? { ...prev, ...updated } : prev,
    );
  }, []);

  // ── FIX: set selectedReg BEFORE opening the modal.
  //    React batches these two setState calls in the same render,
  //    so by the time the Modal's first render runs, selectedReg
  //    is already the correct object — not null.
  const handleOpenView = useCallback((r: any) => {
    setSelectedReg(r);
    setViewOpen(true);
  }, []);

  const handleOpenEdit = useCallback((r: any) => {
    setSelectedReg(r);
    setEditOpen(true);
  }, []);

  const handleOpenUpload = useCallback((r: any) => {
    setSelectedReg(r);
    setUploadOpen(true);
  }, []);

  // ── FIX: on close, do NOT reset selectedReg to null immediately.
  //    The slide-out animation takes ~300 ms; resetting to null
  //    during that window causes the modal content to flash blank.
  //    Instead, just close the modal and let selectedReg hold its
  //    last value until the next open overwrites it.
  const handleCloseView = useCallback(() => setViewOpen(false), []);
  const handleCloseEdit = useCallback(() => setEditOpen(false), []);
  const handleCloseUpload = useCallback(() => setUploadOpen(false), []);

  const filtered = useMemo(() => {
    let list = [...registrations];
    const q  = filters.search.toLowerCase().trim();
    if (q) {
      list = list.filter(r =>
        (`${r.firstName} ${r.lastName}`).toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.city  || '').toLowerCase().includes(q),
      );
    }
    if (filters.regStatus  !== 'All') list = list.filter(r => r.registrationStatus === filters.regStatus);
    if (filters.leadStatus !== 'All') list = list.filter(r => r.status === filters.leadStatus);
    return list;
  }, [registrations, filters]);

  const paginated  = useMemo(
    () => filtered.slice(page * DEFAULT_PAGE_SIZE, (page + 1) * DEFAULT_PAGE_SIZE),
    [filtered, page],
  );
  const totalPages = Math.ceil(filtered.length / DEFAULT_PAGE_SIZE);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.search)               c++;
    if (filters.regStatus  !== 'All') c++;
    if (filters.leadStatus !== 'All') c++;
    return c;
  }, [filters]);

  const clearFilters = useCallback(() =>
    setFilters({ search: '', period: 'Today', regStatus: 'All', leadStatus: 'All' }),
  []);

  if (!ALLOWED_ROLES.includes(userRole)) {
    return (
      <View style={styles.accessDenied}>
        <MaterialCommunityIcons name="lock-outline" size={48} color={ERROR} />
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedMsg}>You don't have permission to view this page.</Text>
      </View>
    );
  }

  if (loading) return <LoadingSkeleton />;

  const summaryCards = [
    { label: 'Total',     value: summary.totalRegistrations,     icon: 'account-check-outline', subText: 'All registrations' },
    { label: 'Pending',   value: summary.pendingRegistrations,   icon: 'clock-alert-outline',   subText: 'Pending review'    },
    { label: 'Completed', value: summary.completedRegistrations, icon: 'check-circle-outline',  subText: 'Done'              },
    { label: 'Approved',  value: summary.approvedRegistrations,  icon: 'shield-check-outline',  subText: 'Approved'          },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={26} color={WHITE} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Registration Management</Text>
          <Text style={styles.headerSub}>Track and manage customer registrations</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="filter-variant" size={20} color={WHITE} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => { setRefreshing(true); fetchData(); }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.summaryGrid}>
          {summaryCards.map(c => (
            <View key={c.label} style={{ width: (SCREEN_W - 40) / 2 }}>
              <SummaryCard {...c} />
            </View>
          ))}
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={18} color="#888" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, phone..."
              placeholderTextColor="#aaa"
              value={filters.search}
              onChangeText={v => setFilters(p => ({ ...p, search: v }))}
            />
            {filters.search !== '' && (
              <TouchableOpacity onPress={() => setFilters(p => ({ ...p, search: '' }))}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>
            Registrations
            <Text style={styles.resultCount}>  {filtered.length} total</Text>
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && registrations.length === 0 ? (
          <View style={styles.errorState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color={ERROR} />
            <Text style={styles.errorStateText}>{error}</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={fetchData}>
              <Text style={styles.btnPrimaryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : paginated.length === 0 ? (
          <EmptyState hasFilters={activeFilterCount > 0} onClear={clearFilters} />
        ) : (
          <View style={{ paddingHorizontal: 12 }}>
            {paginated.map(item => (
              <RegistrationCard
                key={item._id}
                item={item}
                permissions={permissions}
                onView={handleOpenView}
                onEdit={handleOpenEdit}
                onUpload={handleOpenUpload}
              />
            ))}
          </View>
        )}

        {totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <MaterialCommunityIcons name="chevron-left" size={18} color={page === 0 ? '#ccc' : PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.pageInfo}>
              {page + 1} / {totalPages}{'  '}
              <Text style={styles.pageSubInfo}>
                ({page * DEFAULT_PAGE_SIZE + 1}–
                {Math.min((page + 1) * DEFAULT_PAGE_SIZE, filtered.length)} of {filtered.length})
              </Text>
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <MaterialCommunityIcons name="chevron-right" size={18} color={page >= totalPages - 1 ? '#ccc' : PRIMARY} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last updated: {new Date().toLocaleString('en-IN')}</Text>
          <Text style={styles.footerText}>{summary.totalRegistrations} total registrations</Text>
        </View>
      </ScrollView>

      {/* ── ALL MODALS at root level ── */}
      <ViewRegistrationModal
        visible={viewOpen}
        onClose={handleCloseView}
        registration={selectedReg}
      />

      <EditRegistrationModal
        visible={editOpen}
        onClose={handleCloseEdit}
        registration={selectedReg}
        showToast={showToast}
        onSave={handleSave}
      />

      <RegistrationUploadModal
        visible={uploadOpen}
        onClose={handleCloseUpload}
        registration={selectedReg}
        showToast={showToast}
        onUploaded={async (updated: any) => {
          handleSave(updated);
          await fetchData();
        }}
      />

      <FilterDrawer
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onClear={clearFilters}
      />

      <Toast message={toast.message} severity={toast.severity} visible={toast.visible} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 50 : 14,
  },
  menuBtn:       { padding: 4, marginRight: 10 },
  headerTitle:   { color: WHITE, fontSize: 16, fontWeight: '700' },
  headerSub:     { color: rgba(WHITE, 0.85), fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: rgba(WHITE, 0.2),
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: ERROR, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: WHITE, fontSize: 8, fontWeight: '700' },
  summaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingTop: 14, gap: 8,
  },
  summaryCard: {
    backgroundColor: WHITE, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: rgba(PRIMARY, 0.1),
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, marginBottom: 4,
  },
  summaryCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  summaryIcon:     { width: 36, height: 36, borderRadius: 8, backgroundColor: rgba(PRIMARY, 0.1), alignItems: 'center', justifyContent: 'center' },
  summaryValue:    { fontSize: 22, fontWeight: '800', color: PRIMARY },
  summaryLabel:    { fontSize: 12, fontWeight: '700', color: '#1a1a3e' },
  summarySubtext:  { fontSize: 10, color: '#888', marginTop: 2 },
  searchContainer: { paddingHorizontal: 12, paddingTop: 12, marginBottom: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput:    { flex: 1, fontSize: 13, color: '#333', padding: 0 },
  resultHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  resultTitle:    { fontSize: 14, fontWeight: '700', color: '#1a1a3e' },
  resultCount:    { fontSize: 12, fontWeight: '400', color: PRIMARY },
  clearText:      { fontSize: 12, color: ERROR, fontWeight: '600' },
  regCard: {
    backgroundColor: WHITE, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: rgba(PRIMARY, 0.1),
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  regCardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  regCardName:     { fontSize: 15, fontWeight: '700', color: PRIMARY },
  regCardId:       { fontSize: 11, color: '#888', marginTop: 1 },
  expandBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: rgba(PRIMARY, 0.1), alignItems: 'center', justifyContent: 'center' },
  regCardInfo:     { flexDirection: 'row', gap: 16, marginBottom: 6 },
  regCardInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  regCardInfoText: { fontSize: 11, color: '#555', flex: 1 },
  regCardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  regCardMetaText: { fontSize: 11, color: '#555' },
  dot:             { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ccc', marginHorizontal: 2 },
  chipRow:         { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: rgba(PRIMARY, 0.1) },
  actionRow:       { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 4 },
  actionBtnPrimary:     { backgroundColor: PRIMARY },
  actionBtnOutline:     { borderWidth: 1, borderColor: PRIMARY },
  actionBtnTextPrimary: { color: WHITE,   fontSize: 12, fontWeight: '600' },
  actionBtnTextOutline: { color: PRIMARY, fontSize: 12, fontWeight: '600' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18,
  },
  btnPrimaryText: { color: WHITE,   fontWeight: '700', fontSize: 14 },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18,
  },
  btnOutlineText: { color: PRIMARY, fontWeight: '700', fontSize: 14 },
  chip:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '600' },
  avatar:     { backgroundColor: rgba(PRIMARY, 0.15), alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: PRIMARY, fontWeight: '700' },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: rgba(PRIMARY, 0.07) },
  infoLabel: { fontSize: 12, color: '#888' },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#1a1a3e', flex: 1, textAlign: 'right', marginLeft: 8 },
  sectionCard:       { backgroundColor: WHITE, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: rgba(PRIMARY, 0.1) },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionCardTitle:  { fontSize: 13, fontWeight: '700', color: PRIMARY, marginLeft: 8 },
  notesText:         { fontSize: 13, color: '#333', lineHeight: 20 },
  modalRoot:       { flex: 1, backgroundColor: WHITE },
  viewModalHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, padding: 16, paddingTop: Platform.OS === 'ios' ? 50 : 16 },
  viewModalName:   { fontSize: 16, fontWeight: '700', color: WHITE },
  viewModalId:     { fontSize: 11, color: rgba(WHITE, 0.85), marginTop: 2 },
  closeBtn:        { width: 30, height: 30, borderRadius: 15, backgroundColor: rgba(WHITE, 0.2), alignItems: 'center', justifyContent: 'center' },
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  uploadSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    height: '86%',
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  uploadHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: rgba(PRIMARY, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  uploadSubtitle: { fontSize: 12, color: '#777', marginTop: 2 },
  uploadBody: { flex: 1 },
  uploadBodyContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
  uploadLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  uploadSelect: {
    borderWidth: 1.5,
    borderColor: rgba(PRIMARY, 0.35),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WHITE,
  },
  uploadSelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadSelectText: { fontSize: 15, color: '#222', fontWeight: '500' },
  uploadOptions: {
    marginTop: 6,
    maxHeight: 260,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: rgba(PRIMARY, 0.12),
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  uploadOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: WHITE,
  },
  uploadOptionRowActive: { backgroundColor: '#f3f6ff' },
  uploadOptionText: { fontSize: 15, color: '#222' },
  uploadDropzone: {
    marginTop: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d8dbe3',
    borderRadius: 22,
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  uploadDropzoneTitle: {
    marginTop: 12,
    fontSize: 15,
    color: '#222',
    textAlign: 'center',
    fontWeight: '500',
  },
  uploadDropzoneSub: {
    marginTop: 10,
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
  },
  uploadFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 22 : 18,
    gap: 12,
  },
  uploadCancelBtn: {
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  uploadCancelText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  uploadSubmitBtn: {
    backgroundColor: '#f58c27',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  uploadSubmitBtnDisabled: { opacity: 0.55 },
  uploadSubmitText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  regProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  regProgressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 999,
  },
  regSelectTrigger: {
    borderWidth: 1.5,
    borderColor: rgba(PRIMARY, 0.25),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WHITE,
  },
  regSelectTriggerText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  regPlaceholderText: {
    color: '#9ca3af',
  },
  regSelectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  regSelectPanel: {
    maxHeight: 320,
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingVertical: 8,
  },
  regSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  regSelectOptionActive: {
    backgroundColor: '#f3f6ff',
  },
  regSelectOptionText: {
    fontSize: 14,
    color: '#1f2937',
  },
  regSelectOptionTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  regUploadFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  regUploadFileBox: {
    borderWidth: 1.5,
    borderColor: rgba(PRIMARY, 0.18),
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
  },
  regUploadThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  regUploadFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  regUploadFileMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  regUploadDrop: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbfdff',
  },
  regUploadDropText: {
    marginTop: 10,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'center',
  },
  regUploadDropHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  regUploadErrorBorder: {
    borderColor: ERROR,
  },
  regUploadErrorText: {
    fontSize: 11,
    color: ERROR,
    marginTop: 4,
  },
  regUploadHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  regUploadHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: rgba(PRIMARY, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  regUploadHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  regUploadHeaderSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  regUploadProgressText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  regUploadDateRow: {
    borderWidth: 1.5,
    borderColor: rgba(PRIMARY, 0.25),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
  },
  regUploadDateText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#1f2937',
  },
  regUploadSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  regOtherDocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: rgba(PRIMARY, 0.12),
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: WHITE,
  },
  regOtherDocName: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 13,
    color: '#1f2937',
  },
  regAddMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: rgba(PRIMARY, 0.25),
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fbff',
  },
  regAddMoreText: {
    color: PRIMARY,
    fontWeight: '600',
    marginLeft: 6,
  },
  regUploadNotesInput: {
    borderWidth: 1.5,
    borderColor: rgba(PRIMARY, 0.18),
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#111827',
    minHeight: 110,
    backgroundColor: WHITE,
  },
  regUploadFooterBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  regUploadCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  regUploadCancelText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  regUploadSubmitBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  regUploadSubmitText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  editModalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER, paddingTop: Platform.OS === 'ios' ? 50 : 16, backgroundColor: rgba(PRIMARY, 0.04) },
  editModalIcon:   { width: 44, height: 44, borderRadius: 10, backgroundColor: rgba(PRIMARY, 0.12), alignItems: 'center', justifyContent: 'center' },
  editModalTitle:  { fontSize: 16, fontWeight: '700', color: '#1a1a3e' },
  editModalSub:    { fontSize: 12, color: '#888' },
  editModalFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: BORDER },
  modalFooter:     { padding: 16, borderTopWidth: 1, borderTopColor: BORDER },
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  tab:           { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText:       { fontSize: 12, color: '#888', fontWeight: '500' },
  tabTextActive: { color: PRIMARY, fontWeight: '700' },
  fieldLabel:    { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 14, marginBottom: 5 },
  textInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#333',
    backgroundColor: WHITE,
  },
  inputError:        { borderColor: ERROR },
  errorText:         { fontSize: 11, color: ERROR, marginTop: 3 },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: WHITE,
  },
  selectFieldText:   { fontSize: 13, color: '#333' },
  selectPlaceholder: { fontSize: 13, color: '#aaa' },
  modalOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  selectSheet: {
    backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 8,
  },
  sheetHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: '#dde3f5', alignSelf: 'center', marginVertical: 12 },
  sheetTitle:         { fontSize: 16, fontWeight: '700', color: PRIMARY, paddingHorizontal: 16, marginBottom: 8 },
  selectOption:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  selectOptionActive: { backgroundColor: PRIMARY },
  selectOptionText:   { fontSize: 14, color: '#333' },
  filterHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  filterFooter:  { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: BORDER },
  pagination:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 16 },
  pageBtn:         { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { borderColor: '#ddd' },
  pageInfo:        { fontSize: 13, color: '#333', fontWeight: '600' },
  pageSubInfo:     { fontSize: 11, color: '#888', fontWeight: '400' },
  footer:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20 },
  footerText: { fontSize: 11, color: '#aaa' },
  toast: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { color: WHITE, fontWeight: '600', fontSize: 13 },
  emptyState:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: rgba(PRIMARY, 0.1), alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptyMsg:        { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  errorState:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  errorStateText:  { fontSize: 13, color: ERROR, textAlign: 'center', marginVertical: 12 },
  accessDenied:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  accessDeniedTitle: { fontSize: 18, fontWeight: '700', color: ERROR, marginTop: 12 },
  accessDeniedMsg:   { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8 },
});
