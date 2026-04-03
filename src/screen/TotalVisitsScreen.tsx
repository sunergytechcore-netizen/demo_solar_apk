// src/screen/TotalVisitsScreen.tsx
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
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,

  StatusBar,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

// ========== CONSTANTS ==========
const PRIMARY_COLOR = '#4569ea';
const ERROR_COLOR = '#f44336';
const SUCCESS_COLOR = '#4caf50';
const BG_COLOR = '#f8fafc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEMS_PER_PAGE = 10;

const ALLOWED_ROLES = ['Head_office', 'ZSM', 'ASM', 'TEAM'];
const hasAccess = (role: string | null) => ALLOWED_ROLES.includes(role ?? '');

// ========== PROPS ==========
interface TotalVisitsScreenProps {
  onBackPress?: () => void; // ← Back arrow in header
  onMenuPress?: () => void; // ← Sidebar (from commonHandlers)
  onSearchPress?: () => void; // ← Global search
  onProfilePress?: () => void; // ← Profile dropdown
}

// ========== TYPES ==========
interface Visit {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  visitStatus: string;
  visitDate?: string;
  visitTime?: string;
  visitLocation?: string;
  visitNotes?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Summary {
  totalVisits: number;
  completedVisits: number;
  scheduledVisits: number;
  thisWeekVisits: number;
  conversionRate: number;
}

// ========== HELPERS ==========
const formatDate = (ds?: string, short = false): string => {
  if (!ds) return 'Not set';
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return 'Invalid date';
    return short
      ? d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  } catch {
    return 'Invalid date';
  }
};

const getInitials = (f?: string, l?: string) =>
  `${f?.charAt(0) ?? ''}${l?.charAt(0) ?? ''}`.toUpperCase();

const visitStatusColor = (s: string) =>
  ({ Completed: '#22c55e', Scheduled: PRIMARY_COLOR, Cancelled: ERROR_COLOR }[
    s
  ] ?? '#f59e0b');

const leadStatusColor = (s: string) =>
  ({ Registration: '#22c55e', 'Missed Leads': ERROR_COLOR, Other: '#8b5cf6' }[
    s
  ] ?? PRIMARY_COLOR);

const subWeeks = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() - n * 7);
  return r;
};
const subMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() - n);
  return r;
};
const toParam = (d: Date) => d.toISOString().split('T')[0];

// ========== TINY COMPONENTS ==========
const InitialsAvatar = ({
  firstName,
  lastName,
  size = 44,
}: {
  firstName?: string;
  lastName?: string;
  size?: number;
}) => (
  <View
    style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}
  >
    <Text style={[S.avatarTxt, { fontSize: size * 0.38 }]}>
      {getInitials(firstName, lastName)}
    </Text>
  </View>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <View style={[S.badge, { backgroundColor: color + '22' }]}>
    <View style={[S.badgeDot, { backgroundColor: color }]} />
    <Text style={[S.badgeTxt, { color }]}>{label}</Text>
  </View>
);

const StatCard = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: number;
  sub: string;
}) => (
  <View style={S.statCard}>
    <View style={S.statIconBox}>
      <MaterialCommunityIcons name={icon} size={22} color={PRIMARY_COLOR} />
    </View>
    <Text style={S.statVal}>{value}</Text>
    <Text style={S.statLabel}>{label}</Text>
    <Text style={S.statSub}>{sub}</Text>
  </View>
);

const Shimmer = () => (
  <View style={S.shimCard}>
    <View style={S.shimAvatar} />
    <View style={{ flex: 1, gap: 8 }}>
      <View style={S.shimLine} />
      <View style={[S.shimLine, { width: '55%' }]} />
    </View>
  </View>
);

const Empty = ({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) => (
  <View style={S.emptyWrap}>
    <Text style={{ fontSize: 52, marginBottom: 12 }}>🔍</Text>
    <Text style={S.emptyTitle}>No visits found</Text>
    <Text style={S.emptySub}>
      {hasFilters
        ? 'Try adjusting your search or filters.'
        : 'No visits scheduled yet.'}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={S.clearBtn} onPress={onClear}>
        <Text style={S.clearBtnTxt}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

const Toast = ({
  visible,
  message,
  type,
}: {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}) => {
  if (!visible) return null;
  const bg =
    type === 'success'
      ? SUCCESS_COLOR
      : type === 'error'
      ? ERROR_COLOR
      : PRIMARY_COLOR;
  return (
    <View style={[S.toast, { backgroundColor: bg }]}>
      <Text style={S.toastTxt}>{message}</Text>
    </View>
  );
};

// ---- InfoRow (used inside modals) ----
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={S.infoRow}>
    <Text style={S.infoLbl}>{label}</Text>
    <Text style={S.infoVal} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// ---- PickerModal ----
const PickerModal = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <TouchableOpacity
      style={S.pickerOverlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={S.pickerBox}>
        <Text style={S.pickerTitle}>{title}</Text>
        {options.map(o => (
          <TouchableOpacity
            key={o}
            style={[S.pickerOpt, selected === o && S.pickerOptActive]}
            onPress={() => onSelect(o)}
          >
            <Text
              style={[
                S.pickerOptTxt,
                selected === o && { color: PRIMARY_COLOR, fontWeight: '700' },
              ]}
            >
              {o}
            </Text>
            {selected === o && <Text style={{ color: PRIMARY_COLOR }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  </Modal>
);

// ---- VisitCard ----
const VisitCard = ({
  visit,
  onView,
  onEdit,
}: {
  visit: Visit;
  onView: (v: Visit) => void;
  onEdit: (v: Visit) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const vc = visitStatusColor(visit.visitStatus);
  const lc = leadStatusColor(visit.status);

  return (
    <View style={S.card}>
      {/* Header row */}
      <View style={S.cardHeader}>
        <InitialsAvatar firstName={visit.firstName} lastName={visit.lastName} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={S.cardName} numberOfLines={1}>
            {visit.firstName} {visit.lastName}
          </Text>
          <Text style={S.cardId}>ID: {visit._id?.slice(-8) ?? 'N/A'}</Text>
        </View>
        <TouchableOpacity
          style={S.expandBtn}
          onPress={() => setExpanded(e => !e)}
        >
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={PRIMARY_COLOR}
          />
        </TouchableOpacity>
      </View>

      {/* Contact */}
      <View style={S.infoLine}>
        {visit.phone ? (
          <Text style={S.infoTxt} numberOfLines={1}>
            📞 {visit.phone}
          </Text>
        ) : null}
        {visit.email ? (
          <Text style={S.infoTxt} numberOfLines={1}>
            ✉️ {visit.email}
          </Text>
        ) : null}
      </View>

      {/* Date / time */}
      <View style={S.infoLine}>
        <Text style={S.infoTxt}>📅 {formatDate(visit.visitDate, true)}</Text>
        {visit.visitTime ? (
          <Text style={S.infoTxt}>⏰ {visit.visitTime}</Text>
        ) : null}
      </View>

      {visit.visitLocation ? (
        <Text style={S.locationTxt} numberOfLines={1}>
          📍 {visit.visitLocation}
        </Text>
      ) : null}

      {/* Badges */}
      <View style={S.badgeRow}>
        <Badge label={visit.visitStatus || 'Not Assigned'} color={vc} />
        <Badge
          label={
            visit.status === 'Missed Leads' ? 'Missed' : visit.status || 'Visit'
          }
          color={lc}
        />
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={{ marginTop: 4 }}>
          <View style={S.divider} />
          {visit.visitNotes ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={S.detailLbl}>
                {visit.status === 'Other' ? 'Description' : 'Notes'}
              </Text>
              <Text style={S.detailVal}>{visit.visitNotes}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={S.detailLbl}>Created</Text>
              <Text style={S.detailVal}>
                {formatDate(visit.createdAt, true)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.detailLbl}>Updated</Text>
              <Text style={S.detailVal}>
                {formatDate(visit.updatedAt, true)}
              </Text>
            </View>
          </View>
          <View style={S.actionRow}>
            <TouchableOpacity
              style={[S.actBtn, { backgroundColor: PRIMARY_COLOR }]}
              onPress={() => onView(visit)}
            >
              <MaterialCommunityIcons
                name="eye-outline"
                size={16}
                color="#fff"
              />
              <Text style={S.actBtnTxt}> View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                S.actBtn,
                {
                  backgroundColor: '#fff',
                  borderWidth: 1.5,
                  borderColor: PRIMARY_COLOR,
                },
              ]}
              onPress={() => onEdit(visit)}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={16}
                color={PRIMARY_COLOR}
              />
              <Text style={[S.actBtnTxt, { color: PRIMARY_COLOR }]}> Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ---- ViewVisitModal ----
const ViewVisitModal = ({
  visible,
  visit,
  onClose,
}: {
  visible: boolean;
  visit: Visit | null;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState(0);
  if (!visit) return null;
  const vc = visitStatusColor(visit.visitStatus);
  const lc = leadStatusColor(visit.status);
  const tabs = ['Basic Info', 'Notes & Location', 'Timeline'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={S.overlay}>
        <View style={S.sheet}>
          {/* Header */}
          <View style={S.modalHead}>
            <InitialsAvatar
              firstName={visit.firstName}
              lastName={visit.lastName}
              size={46}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={S.modalHeadTitle}>
                {visit.firstName} {visit.lastName}
              </Text>
              <Text style={S.modalHeadSub}>ID: {visit._id?.slice(-8)}</Text>
            </View>
            <TouchableOpacity style={S.closeBtn} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={S.tabBar}>
            {tabs.map((t, i) => (
              <TouchableOpacity
                key={t}
                style={[S.tabItem, tab === i && S.tabActive]}
                onPress={() => setTab(i)}
              >
                <Text style={[S.tabTxt, tab === i && S.tabTxtActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {tab === 0 && (
              <>
                <Text style={S.secTitle}>👤 Personal Information</Text>
                <InfoRow
                  label="Full Name"
                  value={`${visit.firstName} ${visit.lastName}`}
                />
                <InfoRow label="Email" value={visit.email ?? 'Not set'} />
                <InfoRow label="Phone" value={visit.phone ?? 'Not set'} />
                <View style={S.secDivider} />
                <Text style={S.secTitle}>📅 Visit Information</Text>
                <View style={S.infoRow}>
                  <Text style={S.infoLbl}>Visit Status</Text>
                  <Badge label={visit.visitStatus} color={vc} />
                </View>
                <View style={S.infoRow}>
                  <Text style={S.infoLbl}>Lead Status</Text>
                  <Badge label={visit.status} color={lc} />
                </View>
                <InfoRow
                  label="Visit Date"
                  value={formatDate(visit.visitDate, true)}
                />
                <InfoRow
                  label="Visit Time"
                  value={visit.visitTime ?? 'Not set'}
                />
              </>
            )}
            {tab === 1 && (
              <>
                {visit.visitLocation && (
                  <>
                    <Text style={S.secTitle}>📍 Location</Text>
                    <Text style={S.noteTxt}>{visit.visitLocation}</Text>
                    <View style={S.secDivider} />
                  </>
                )}
                {visit.visitNotes ? (
                  <>
                    <Text style={S.secTitle}>
                      📝 {visit.status === 'Other' ? 'Description' : 'Notes'}
                    </Text>
                    <Text style={S.noteTxt}>{visit.visitNotes}</Text>
                  </>
                ) : (
                  <Text style={S.emptyNote}>
                    No {visit.status === 'Other' ? 'description' : 'notes'}{' '}
                    available.
                  </Text>
                )}
              </>
            )}
            {tab === 2 && (
              <>
                <Text style={S.secTitle}>🕐 Timeline</Text>
                <InfoRow label="Created" value={formatDate(visit.createdAt)} />
                <InfoRow
                  label="Last Updated"
                  value={formatDate(visit.updatedAt)}
                />
              </>
            )}
          </ScrollView>

          <View style={S.modalFoot}>
            <TouchableOpacity
              style={[S.primBtn, { flex: 1 }]}
              onPress={onClose}
            >
              <Text style={S.primBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---- EditVisitModal ----
const EditVisitModal = ({
  visible,
  visit,
  onClose,
  onSave,
  showSnackbar,
}: {
  visible: boolean;
  visit: Visit | null;
  onClose: () => void;
  onSave: (v: Visit) => void;
  showSnackbar: (m: string, t: 'success' | 'error' | 'info') => void;
}) => {
  const { fetchAPI } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    visitStatus: 'Not Assigned',
    visitDate: '',
    visitTime: '',
    visitLocation: '',
    status: 'Visit',
    visitNotes: '',
  });
  const [showVS, setShowVS] = useState(false);
  const [showLS, setShowLS] = useState(false);

  const VS_OPTS = ['Not Assigned', 'Scheduled', 'Completed', 'Cancelled'];
  const LS_OPTS = ['Visit', 'Registration', 'Missed Leads', 'Other'];

  useEffect(() => {
    if (visible && visit)
      setForm({
        visitStatus: visit.visitStatus || 'Not Assigned',
        visitDate: visit.visitDate ? visit.visitDate.split('T')[0] : '',
        visitTime: visit.visitTime || '',
        visitLocation: visit.visitLocation || '',
        status: visit.status || 'Visit',
        visitNotes: visit.visitNotes || '',
      });
  }, [visible, visit]);

  const handleSubmit = async () => {
    if (!visit) return;
    if (!form.visitStatus) {
      showSnackbar('Visit status is required', 'error');
      return;
    }
    if (form.visitStatus === 'Scheduled' && !form.visitDate) {
      showSnackbar('Visit date required for Scheduled', 'error');
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, string> = {
        visitStatus: form.visitStatus,
        status: form.status,
      };
      if (form.visitDate.trim()) payload.visitDate = form.visitDate;
      if (form.visitTime.trim()) payload.visitTime = form.visitTime.trim();
      if (form.visitLocation.trim())
        payload.visitLocation = form.visitLocation.trim();
      if (form.visitNotes.trim()) payload.visitNotes = form.visitNotes.trim();

      const res = await fetchAPI(`/lead/updateLead/${visit._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res?.success) {
        showSnackbar('Visit updated successfully', 'success');
        onSave(res.result);
        onClose();
      } else throw new Error(res?.message || 'Update failed');
    } catch (e: any) {
      showSnackbar(e.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!visit) return null;
  const F = (field: string) => (t: string) =>
    setForm(p => ({ ...p, [field]: t }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={S.overlay}>
          <View style={[S.sheet, { maxHeight: '92%' }]}>
            {/* Header */}
            <View style={[S.modalHead, { backgroundColor: '#f0f4ff' }]}>
              <View style={S.editIconBox}>
                <Text style={{ fontSize: 22 }}>✏️</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[S.modalHeadTitle, { color: '#111827' }]}>
                  Edit Visit
                </Text>
                <Text style={[S.modalHeadSub, { color: '#6b7280' }]}>
                  {visit.firstName} {visit.lastName}
                </Text>
              </View>
              <TouchableOpacity
                style={[S.closeBtn, { backgroundColor: '#e5e7eb' }]}
                onPress={onClose}
              >
                <Text style={[S.closeTxt, { color: '#374151' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, gap: 14 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Visit Status */}
              <View>
                <Text style={S.fldLbl}>Visit Status *</Text>
                <TouchableOpacity
                  style={S.pickerTrigger}
                  onPress={() => setShowVS(true)}
                >
                  <Text style={S.pickerTrigTxt}>{form.visitStatus}</Text>
                  <Text style={{ color: PRIMARY_COLOR }}>▼</Text>
                </TouchableOpacity>
              </View>
              {/* Date */}
              <View>
                <Text style={S.fldLbl}>Visit Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={S.input}
                  placeholder="e.g. 2025-03-25"
                  value={form.visitDate}
                  onChangeText={F('visitDate')}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              {/* Time */}
              <View>
                <Text style={S.fldLbl}>Visit Time (HH:MM)</Text>
                <TextInput
                  style={S.input}
                  placeholder="e.g. 14:30"
                  value={form.visitTime}
                  onChangeText={F('visitTime')}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              {/* Location */}
              <View>
                <Text style={S.fldLbl}>Visit Location</Text>
                <TextInput
                  style={[S.input, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Enter address"
                  value={form.visitLocation}
                  onChangeText={F('visitLocation')}
                  multiline
                  placeholderTextColor="#9ca3af"
                />
              </View>
              {/* Notes */}
              <View>
                <Text style={S.fldLbl}>
                  {visit.status === 'Other' ? 'Description' : 'Visit Notes'}
                </Text>
                <TextInput
                  style={[S.input, { height: 72, textAlignVertical: 'top' }]}
                  placeholder={
                    visit.status === 'Other' ? 'Add description' : 'Add notes'
                  }
                  value={form.visitNotes}
                  onChangeText={F('visitNotes')}
                  multiline
                  placeholderTextColor="#9ca3af"
                />
              </View>
              {/* Lead Status */}
              <View>
                <Text style={S.fldLbl}>Lead Status</Text>
                <TouchableOpacity
                  style={S.pickerTrigger}
                  onPress={() => setShowLS(true)}
                >
                  <Text style={S.pickerTrigTxt}>{form.status}</Text>
                  <Text style={{ color: PRIMARY_COLOR }}>▼</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={S.modalFoot}>
              <TouchableOpacity
                style={[S.outlineBtn, { flex: 1 }]}
                onPress={onClose}
              >
                <Text style={S.outlineBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.primBtn, { flex: 1, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={S.primBtnTxt}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showVS}
        title="Select Visit Status"
        options={VS_OPTS}
        selected={form.visitStatus}
        onSelect={v => {
          setForm(p => ({ ...p, visitStatus: v }));
          setShowVS(false);
        }}
        onClose={() => setShowVS(false)}
      />
      <PickerModal
        visible={showLS}
        title="Select Lead Status"
        options={LS_OPTS}
        selected={form.status}
        onSelect={v => {
          setForm(p => ({ ...p, status: v }));
          setShowLS(false);
        }}
        onClose={() => setShowLS(false)}
      />
    </Modal>
  );
};

// ---- Filter Sheet ----
const FilterSheet = ({
  visible,
  onClose,
  period,
  setPeriod,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onClear,
  activeCount,
}: {
  visible: boolean;
  onClose: () => void;
  period: string;
  setPeriod: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onClear: () => void;
  activeCount: number;
}) => {
  const PERIODS = ['Today', 'This Week', 'This Month', 'All'];
  const STATUSES = [
    'All',
    'Not Assigned',
    'Scheduled',
    'Completed',
    'Cancelled',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={S.sheetOverlay}>
        <View style={S.sheetInner}>
          <View style={S.handle} />
          <View style={S.sheetHead}>
            <View>
              <Text style={S.sheetTitle}>Filter Visits</Text>
              <Text style={S.sheetSub}>
                {activeCount} active filter{activeCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity style={S.closeBtn} onPress={onClose}>
              <Text style={S.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
            {/* Search */}
            <View>
              <Text style={S.fldLbl}>Search</Text>
              <View style={S.searchBox}>
                <Text>🔍</Text>
                <TextInput
                  style={S.searchInput}
                  placeholder="Name, email, phone..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={{ color: '#6b7280' }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Period */}
            <View>
              <Text style={S.fldLbl}>Time Period</Text>
              <View style={S.chipRow}>
                {PERIODS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[S.chip, period === p && S.chipActive]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text style={[S.chipTxt, period === p && S.chipTxtActive]}>
                      {p === 'All' ? 'All Time' : p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status */}
            <View>
              <Text style={S.fldLbl}>Visit Status</Text>
              <View style={S.chipRow}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[S.chip, statusFilter === s && S.chipActive]}
                    onPress={() => setStatusFilter(s)}
                  >
                    <Text
                      style={[S.chipTxt, statusFilter === s && S.chipTxtActive]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={S.modalFoot}>
            <TouchableOpacity
              style={[S.outlineBtn, { flex: 1 }]}
              onPress={() => {
                onClear();
                onClose();
              }}
            >
              <Text style={S.outlineBtnTxt}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.primBtn, { flex: 1 }]}
              onPress={onClose}
            >
              <Text style={S.primBtnTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ========== MAIN SCREEN ==========
export default function TotalVisitsScreen({
  onBackPress,
  onMenuPress,
  onSearchPress,
  onProfilePress,
}: TotalVisitsScreenProps) {
  const { fetchAPI, getUserRole } = useAuth();
  const userRole: string | null = getUserRole();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalVisits: 0,
    completedVisits: 0,
    scheduledVisits: 0,
    thisWeekVisits: 0,
    conversionRate: 0,
  });

  const [period, setPeriod] = useState('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(0);

  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selVisit, setSelVisit] = useState<Visit | null>(null);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info',
  });
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnackbar = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ visible: true, message, type });
      if (toastRef.current) clearTimeout(toastRef.current);
      toastRef.current = setTimeout(
        () => setToast(t => ({ ...t, visible: false })),
        3500,
      );
    },
    [],
  );

  const fetchVisits = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const p = new URLSearchParams();
        const today = new Date();
        if (period === 'Today') {
          const d = toParam(today);
          p.append('startDate', d);
          p.append('endDate', d);
        } else if (period === 'This Week') {
          p.append('startDate', toParam(subWeeks(today, 1)));
          p.append('endDate', toParam(today));
        } else if (period === 'This Month') {
          p.append('startDate', toParam(subMonths(today, 1)));
          p.append('endDate', toParam(today));
        }

        const res = await fetchAPI(`/lead/visitSummary?${p.toString()}`);
        if (res?.success) {
          const visits: Visit[] = res.result?.visits ?? res.result ?? [];
          const total = visits.length;
          const completed = visits.filter(
            v => v.visitStatus === 'Completed',
          ).length;
          const scheduled = visits.filter(
            v => v.visitStatus === 'Scheduled',
          ).length;
          const weekAgo = subWeeks(new Date(), 1);
          weekAgo.setHours(0, 0, 0, 0);
          const thisWeek = visits.filter(v => {
            if (!v.visitDate) return false;
            const d = new Date(v.visitDate);
            return !isNaN(d.getTime()) && d >= weekAgo;
          }).length;
          setAllVisits(visits);
          setSummary({
            totalVisits: total,
            completedVisits: completed,
            scheduledVisits: scheduled,
            thisWeekVisits: thisWeek,
            conversionRate:
              total > 0 ? Math.round((completed / total) * 100) : 0,
          });
          setPage(0);
        } else throw new Error(res?.message || 'Failed to fetch visits');
      } catch (e: any) {
        showSnackbar(e.message || 'Failed to fetch visits', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, fetchAPI, showSnackbar],
  );

  useEffect(() => {
    if (hasAccess(userRole)) fetchVisits();
  }, [fetchVisits, userRole]);

  const filteredVisits = useMemo(() => {
    let r = [...allVisits];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(v =>
        [
          v.firstName,
          v.lastName,
          v.email,
          v.phone,
          v.visitLocation,
          v.visitNotes,
        ].some(f => (f ?? '').toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== 'All')
      r = r.filter(v => v.visitStatus === statusFilter);
    return r;
  }, [allVisits, searchQuery, statusFilter]);

  const activeFilterCount = useMemo(
    () => (searchQuery ? 1 : 0) + (statusFilter !== 'All' ? 1 : 0),
    [searchQuery, statusFilter],
  );
  const totalPages = Math.ceil(filteredVisits.length / ITEMS_PER_PAGE);
  const paginatedVisits = useMemo(
    () =>
      filteredVisits.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE),
    [filteredVisits, page],
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('All');
    setPage(0);
  }, []);
  const onView = useCallback((v: Visit) => {
    setSelVisit(v);
    setViewOpen(true);
  }, []);
  const onEdit = useCallback((v: Visit) => {
    setSelVisit(v);
    setEditOpen(true);
  }, []);
  const onSaved = useCallback(
    async (_: Visit) => {
      await fetchVisits(true);
    },
    [fetchVisits],
  );

  // Access guard
  if (!hasAccess(userRole)) {
    return (
      <SafeAreaView style={S.centered}>
        <View style={S.accessBox}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>🚫</Text>
          <Text style={S.accessTitle}>Access Denied</Text>
          <Text style={S.accessSub}>
            You don't have permission to view this page.
          </Text>
          {onBackPress && (
            <TouchableOpacity
              style={[S.primBtn, { marginTop: 16, paddingHorizontal: 28 }]}
              onPress={onBackPress}
            >
              <Text style={S.primBtnTxt}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

      {/* ── Modals ── */}
      <ViewVisitModal
        visible={viewOpen}
        visit={selVisit}
        onClose={() => setViewOpen(false)}
      />
      <EditVisitModal
        visible={editOpen}
        visit={selVisit}
        onClose={() => setEditOpen(false)}
        onSave={onSaved}
        showSnackbar={showSnackbar}
      />
      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        period={period}
        setPeriod={v => {
          setPeriod(v);
          setPage(0);
        }}
        statusFilter={statusFilter}
        setStatusFilter={v => {
          setStatusFilter(v);
          setPage(0);
        }}
        searchQuery={searchQuery}
        setSearchQuery={v => {
          setSearchQuery(v);
          setPage(0);
        }}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
      />

      <FlatList
        data={paginatedVisits}
        keyExtractor={item => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchVisits(true);
            }}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Header Banner ── */}
            <View style={S.banner}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
              >
                {/* Back arrow — shown only when onBackPress is provided by App.tsx */}
                {onBackPress && (
                  <TouchableOpacity
                    onPress={onBackPress}
                    style={S.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={S.bannerTitle}>Visit Management</Text>
                  <Text style={S.bannerSub}>
                    Track and manage visit activities
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={S.bannerBtn}
                  onPress={() => setSheetOpen(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                      name="filter-variant"
                      size={18}
                      color="#fff"
                    />
                    {activeFilterCount > 0 && (
                      <Text style={[S.bannerBtnTxt, { marginLeft: 4 }]}>
                        {activeFilterCount}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.bannerBtn}
                  onPress={() => fetchVisits()}
                >
                  <MaterialCommunityIcons
                    name="reload"
                    size={22}
                    color="#fff"
                  />
                </TouchableOpacity>
                {/* Wire to App.tsx ProfileDropdown */}
                {onProfilePress && (
                  <TouchableOpacity
                    style={S.bannerBtn}
                    onPress={onProfilePress}
                  >
                    <MaterialCommunityIcons
                      name="account-circle"
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {/* ── Stat Cards ── */}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={S.summaryScroll}
              contentContainerStyle={[
                S.summaryContainer,
                { paddingHorizontal: 10 },
              ]}
            >
              <StatCard
                icon="account-group"
                label="Total"
                value={summary?.totalVisits || 0}
                sub="All visits"
              />

              <StatCard
                icon="check-circle"
                label="Completed"
                value={summary?.completedVisits || 0}
                sub="Done"
              />

              <StatCard
                icon="calendar-clock"
                label="Scheduled"
                value={summary?.scheduledVisits || 0}
                sub="Upcoming"
              />

              <StatCard
                icon="chart-line"
                label="This Week"
                value={summary?.thisWeekVisits || 0}
                sub="Recent"
              />
            </ScrollView>

            {/* ── Quick search ── */}
            <View style={S.searchWrap}>
              <View style={S.searchBox}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={18}
                  color="#6b7280"
                />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search visits..."
                  value={searchQuery}
                  onChangeText={v => {
                    setSearchQuery(v);
                    setPage(0);
                  }}
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setPage(0);
                    }}
                  >
                    <Text style={{ color: '#6b7280', fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* ── Active filter chips ── */}
            {activeFilterCount > 0 && (
              <View style={S.activeRow}>
                {searchQuery ? (
                  <TouchableOpacity
                    style={S.activeChip}
                    onPress={() => setSearchQuery('')}
                  >
                    <Text style={S.activeChipTxt}>"{searchQuery}" ✕</Text>
                  </TouchableOpacity>
                ) : null}
                {statusFilter !== 'All' ? (
                  <TouchableOpacity
                    style={S.activeChip}
                    onPress={() => setStatusFilter('All')}
                  >
                    <Text style={S.activeChipTxt}>{statusFilter} ✕</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={clearFilters}>
                  <Text
                    style={{
                      color: ERROR_COLOR,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    Clear all
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── List header ── */}
            <View style={S.listHead}>
              <Text style={S.listHeadTxt}>
                Visit Records{' '}
                <Text style={{ color: PRIMARY_COLOR }}>
                  ({filteredVisits.length})
                </Text>
              </Text>
              <Text style={S.periodPill}>
                {period === 'All' ? 'All Time' : period}
              </Text>
            </View>

            {loading && [1, 2, 3].map(i => <Shimmer key={i} />)}
          </>
        }
        renderItem={({ item }) => (
          <VisitCard visit={item} onView={onView} onEdit={onEdit} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          !loading ? (
            <Empty hasFilters={activeFilterCount > 0} onClear={clearFilters} />
          ) : null
        }
        ListFooterComponent={
          filteredVisits.length > 0 ? (
            <View style={S.pagination}>
              <Text style={S.pageInfo}>
                {page * ITEMS_PER_PAGE + 1}–
                {Math.min((page + 1) * ITEMS_PER_PAGE, filteredVisits.length)}{' '}
                of {filteredVisits.length}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[S.pageBtn, page === 0 && { opacity: 0.35 }]}
                  disabled={page === 0}
                  onPress={() => setPage(p => p - 1)}
                >
                  <Text style={S.pageBtnTxt}>‹ Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    S.pageBtn,
                    page >= totalPages - 1 && { opacity: 0.35 },
                  ]}
                  disabled={page >= totalPages - 1}
                  onPress={() => setPage(p => p + 1)}
                >
                  <Text style={S.pageBtnTxt}>Next ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ========== STYLES ==========
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_COLOR,
  },

  avatar: {
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontWeight: '700' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontSize: 12, fontWeight: '600' },

  // Stat cards

  summaryScroll: {
    marginBottom: 12,
  },
  summaryContainer: {
    paddingHorizontal: 8,
  },

  statCard: {
    width: 150, // 👈 FIX: give fixed width
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',

    marginRight: 10, // 👈 spacing between cards

    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,

    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}18`,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${PRIMARY_COLOR}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statVal: { fontSize: 20, fontWeight: '800', color: PRIMARY_COLOR },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  statSub: { fontSize: 10, color: '#6b7280', textAlign: 'center' },

  // Banner / header
  banner: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  bannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bannerBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  backBtn: { marginRight: 10, padding: 4 },
  backTxt: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 26 },

  // Search
  searchWrap: { paddingHorizontal: 12, marginBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}28`,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  activeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  activeChip: {
    backgroundColor: `${PRIMARY_COLOR}18`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeChipTxt: { color: PRIMARY_COLOR, fontSize: 12, fontWeight: '600' },

  listHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  listHeadTxt: { fontSize: 16, fontWeight: '700', color: '#111827' },
  periodPill: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    backgroundColor: `${PRIMARY_COLOR}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  // Visit card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}18`,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: PRIMARY_COLOR },
  cardId: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${PRIMARY_COLOR}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLine: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  infoTxt: { fontSize: 12, color: '#374151', flex: 1 },
  locationTxt: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  divider: {
    height: 1,
    backgroundColor: `${PRIMARY_COLOR}18`,
    marginVertical: 10,
  },
  detailLbl: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  detailVal: { fontSize: 13, color: '#111827', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  shimCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shimAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
  },
  shimLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    width: '80%',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  clearBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 9999,
    maxWidth: SCREEN_WIDTH * 0.9,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  pageInfo: { fontSize: 13, color: '#6b7280' },
  pageBtn: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pageBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Modal / sheet shared
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    flex: 1,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: PRIMARY_COLOR,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeadTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalHeadSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalFoot: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  editIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${PRIMARY_COLOR}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY_COLOR },
  tabTxt: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  tabTxtActive: { color: PRIMARY_COLOR },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    gap: 12,
  },
  infoLbl: { fontSize: 13, color: '#6b7280', flex: 1 },
  infoVal: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
  secTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginBottom: 12,
    marginTop: 4,
  },
  secDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 14 },
  noteTxt: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
  },
  emptyNote: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },

  // Edit form
  fldLbl: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: `${PRIMARY_COLOR}30`,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  pickerTrigger: {
    borderWidth: 1.5,
    borderColor: `${PRIMARY_COLOR}30`,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  pickerTrigTxt: { fontSize: 14, color: '#111827', fontWeight: '500' },

  // Picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: SCREEN_WIDTH * 0.82,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerOpt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  pickerOptActive: {
    backgroundColor: `${PRIMARY_COLOR}08`,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  pickerOptTxt: { fontSize: 14, color: '#374151', fontWeight: '500' },

  // Filter sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  sheetInner: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginVertical: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: PRIMARY_COLOR },
  sheetSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: `${PRIMARY_COLOR}40`,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  chipTxt: { fontSize: 13, color: PRIMARY_COLOR, fontWeight: '600' },
  chipTxtActive: { color: '#fff' },

  // Buttons
  primBtn: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnTxt: { color: PRIMARY_COLOR, fontWeight: '700', fontSize: 15 },

  // Access denied
  accessBox: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  accessTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ERROR_COLOR,
    marginBottom: 6,
  },
  accessSub: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});
