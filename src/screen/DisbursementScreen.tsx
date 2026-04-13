// screens/DisbursementPage.tsx
// React Native conversion of DisbursementPage.jsx
// Dependencies:
//   npm install @react-navigation/native react-native-vector-icons
//   npm install @react-native-community/datetimepicker
//   npm install react-native-safe-area-context

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
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  RefreshControl,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  format,
  isValid,
  parseISO,
  subWeeks,
  subMonths,
} from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

// ========== CONSTANTS ==========
const PRIMARY_COLOR = '#4569ea';
const BG_COLOR = '#f8fafc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALLOWED_ROLES = ['Head_office', 'ZSM', 'ASM', 'TEAM'];
const DEFAULT_ITEMS_PER_PAGE = 10;

const PERIOD_OPTIONS = [
  { value: 'Today',      label: 'Today' },
  { value: 'This Week',  label: 'This Week' },
  { value: 'This Month', label: 'This Month' },
  { value: 'All',        label: 'All Time' },
];

const DISBURSEMENT_STATUS_OPTIONS = ['pending', 'completed', 'cancelled'];

const DISBURSEMENT_STATUS_CONFIG: Record<string, any> = {
  pending: {
    bg: 'rgba(69,105,234,0.10)',
    color: PRIMARY_COLOR,
    iconName: 'pending-actions',
    label: 'Pending',
    description: 'Disbursement is pending',
  },
  completed: {
    bg: '#e8f5e9',
    color: '#2e7d32',
    iconName: 'check-circle',
    label: 'Completed',
    description: 'Disbursement completed successfully',
  },
  cancelled: {
    bg: '#ffebee',
    color: '#c62828',
    iconName: 'cancel',
    label: 'Cancelled',
    description: 'Disbursement cancelled',
  },
};

const LEAD_STATUS_OPTIONS = ['Disbursement', 'Installation Completion', 'Missed Leads'];

const LEAD_STATUS_CONFIG: Record<string, any> = {
  Disbursement: {
    bg: 'rgba(69,105,234,0.10)',
    color: PRIMARY_COLOR,
    iconName: 'payment',
    label: 'Disbursement',
    description: 'Loan disbursement in progress',
  },
  'Installation Completion': {
    bg: '#e8f5e9',
    color: '#2e7d32',
    iconName: 'check-circle',
    label: 'Installation Completion',
    description: 'Installation completed',
  },
  'Missed Leads': {
    bg: '#ffebee',
    color: '#c62828',
    iconName: 'cancel',
    label: 'Missed Leads',
    description: 'Lead lost or not converted',
  },
};

const BANK_LIST = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Punjab National Bank', 'Bank of Baroda', 'Canara Bank',
  'Union Bank of India', 'Bank of India', 'IndusInd Bank',
  'Kotak Mahindra Bank', 'Yes Bank', 'IDFC First Bank',
  'Federal Bank', 'Other',
];

// ========== HELPERS ==========
const hasAccess = (role: string | null) => ALLOWED_ROLES.includes(role || '');

const getUserPermissions = (role: string | null) => ({
  canView:         ['Head_office', 'ZSM', 'ASM', 'TEAM'].includes(role || ''),
  canEdit:         ['Head_office', 'ZSM', 'ASM', 'TEAM'].includes(role || ''),
  canDelete:       role === 'Head_office',
  canManage:       ['Head_office', 'ZSM', 'ASM'].includes(role || ''),
  canSeeAll:       ['Head_office', 'ZSM', 'ASM'].includes(role || ''),
  canSeeOwn:       role === 'TEAM',
  canUpdateStatus: ['Head_office', 'ZSM', 'ASM', 'TEAM'].includes(role || ''),
});

const getDisbursementStatusConfig = (status?: string) => {
  const key = status?.toLowerCase() || '';
  return DISBURSEMENT_STATUS_CONFIG[key] || {
    bg: 'rgba(69,105,234,0.10)',
    color: PRIMARY_COLOR,
    iconName: 'pending-actions',
    label: status || 'Unknown',
    description: 'Unknown status',
  };
};

const getLeadStatusConfig = (status?: string) =>
  LEAD_STATUS_CONFIG[status || ''] || {
    bg: 'rgba(69,105,234,0.10)',
    color: PRIMARY_COLOR,
    iconName: 'warning',
    label: status || 'Unknown',
    description: 'Unknown status',
  };

const formatCurrency = (amount?: number | string) => {
  if (!amount && amount !== 0) return '₹0';
  const n = parseFloat(String(amount));
  if (isNaN(n)) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const formatDate = (dateString?: string, fmt = 'dd MMM yyyy, hh:mm a') => {
  if (!dateString) return 'Not set';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, fmt) : 'Invalid Date';
  } catch {
    return 'Invalid Date';
  }
};

const getInitials = (first?: string, last?: string) =>
  `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();

// ========== RECOMPUTE SUMMARY ==========
// Shared helper — used both in fetch and in optimistic status update
const computeSummary = (leads: any[]) => ({
  totalLeads:              leads.length,
  pendingLeads:            leads.filter(l => l.disbursementStatus?.toLowerCase() === 'pending').length,
  completedLeads:          leads.filter(l => l.disbursementStatus?.toLowerCase() === 'completed').length,
  cancelledLeads:          leads.filter(l => l.disbursementStatus?.toLowerCase() === 'cancelled').length,
  totalDisbursementAmount: leads.reduce((sum, l) => sum + (parseFloat(l.disbursementAmount) || 0), 0),
});

// ========== SMALL REUSABLE COMPONENTS ==========

const StatusBadge = ({
  status,
  type = 'disbursement',
}: {
  status?: string;
  type?: 'disbursement' | 'lead';
}) => {
  const cfg =
    type === 'disbursement'
      ? getDisbursementStatusConfig(status)
      : getLeadStatusConfig(status);
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <MaterialIcons name={cfg.iconName} size={13} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

const Avatar = ({ initials, size = 40 }: { initials: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
  </View>
);

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <View style={styles.sectionHeader}>
    <MaterialIcons name={icon} size={18} color={PRIMARY_COLOR} />
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// ========== TOAST ==========
const Toast = ({
  visible,
  message,
  severity,
}: {
  visible: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);
  const bg =
    severity === 'success' ? '#2e7d32' : severity === 'error' ? '#c62828' : PRIMARY_COLOR;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ========== SUMMARY CARD ==========
const SummaryCard = ({ card }: { card: any }) => (
  <View style={styles.summaryCard}>
    <View style={[styles.summaryIcon, { backgroundColor: `${card.color}18` }]}>
      <MaterialIcons name={card.iconName} size={22} color={card.color} />
    </View>
    <Text style={[styles.summaryValue, { color: card.color }]}>{card.value}</Text>
    <Text style={styles.summaryLabel}>{card.label}</Text>
    <Text style={styles.summarySubText}>{card.subText}</Text>
  </View>
);

// ========== EMPTY STATE ==========
const EmptyState = ({
  onClearFilters,
  hasFilters,
}: {
  onClearFilters: () => void;
  hasFilters: boolean;
}) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrapper}>
      <MaterialIcons name="payment" size={48} color={PRIMARY_COLOR} />
    </View>
    <Text style={styles.emptyTitle}>No disbursements found</Text>
    <Text style={styles.emptySubtitle}>
      {hasFilters
        ? 'No disbursements match your current filters. Try adjusting your search criteria.'
        : 'No disbursements have been processed yet.'}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={styles.clearBtn} onPress={onClearFilters}>
        <MaterialIcons name="clear" size={16} color="#fff" />
        <Text style={styles.clearBtnText}>Clear All Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ========== DISBURSEMENT CARD ==========
const DisbursementCard = ({
  lead,
  onView,
  onStatusUpdate,
  permissions,
}: {
  lead: any;
  onView: (l: any) => void;
  onStatusUpdate: (l: any) => void;
  permissions: any;
}) => {
  const [expanded, setExpanded] = useState(false);
  const initials = getInitials(lead.firstName, lead.lastName);

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderLeft}>
          <Avatar initials={initials} size={46} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.cardName}>
              {lead.firstName} {lead.lastName}
            </Text>
            <Text style={styles.cardId}>ID: {lead._id?.slice(-8) || 'N/A'}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={styles.expandBtn}
        >
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={22}
            color={PRIMARY_COLOR}
          />
        </TouchableOpacity>
      </View>

      {/* Quick Info */}
      <View style={styles.cardQuickInfo}>
        <View style={styles.cardInfoItem}>
          <MaterialIcons name="phone" size={13} color={PRIMARY_COLOR} />
          <Text style={styles.cardInfoText} numberOfLines={1}>
            {lead.phoneNumber || lead.phone || 'No phone'}
          </Text>
        </View>
        <View style={styles.cardInfoItem}>
          <MaterialIcons name="email" size={13} color={PRIMARY_COLOR} />
          <Text style={styles.cardInfoText} numberOfLines={1}>
            {lead.email || 'No email'}
          </Text>
        </View>
      </View>

      {/* Amount */}
      <View style={styles.cardAmountRow}>
        <MaterialCommunityIcons name="currency-inr" size={14} color={PRIMARY_COLOR} />
        <Text style={styles.cardAmount}>{formatCurrency(lead.disbursementAmount)}</Text>
        {lead.disbursementDate && (
          <>
            <Text style={styles.dot}>·</Text>
            <MaterialIcons name="calendar-today" size={13} color={PRIMARY_COLOR} />
            <Text style={styles.cardAmount}>
              {formatDate(lead.disbursementDate, 'dd MMM')}
            </Text>
          </>
        )}
      </View>
      {lead.bank ? (
        <View style={styles.cardInfoItem}>
          <MaterialIcons name="account-balance" size={13} color={PRIMARY_COLOR} />
          <Text style={styles.cardInfoText}>{lead.bank}</Text>
        </View>
      ) : null}

      {/* Badges */}
      <View style={styles.cardBadgeRow}>
        <StatusBadge status={lead.disbursementStatus} type="disbursement" />
        <StatusBadge status={lead.status} type="lead" />
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={styles.cardExpanded}>
          <View style={styles.divider} />
          {lead.disbursementTransactionId ? (
            <>
              <Text style={styles.cardExpandLabel}>Transaction ID</Text>
              <Text style={styles.cardExpandValue}>{lead.disbursementTransactionId}</Text>
            </>
          ) : null}
          {lead.branchName ? (
            <>
              <Text style={styles.cardExpandLabel}>Branch</Text>
              <Text style={styles.cardExpandValue}>{lead.branchName}</Text>
            </>
          ) : null}
          {lead.disbursementNotes ? (
            <>
              <Text style={styles.cardExpandLabel}>Notes</Text>
              <Text style={styles.cardExpandValue}>{lead.disbursementNotes}</Text>
            </>
          ) : null}
          <View style={styles.cardExpandRow}>
            <View>
              <Text style={styles.cardExpandLabel}>Created</Text>
              <Text style={styles.cardExpandValue}>
                {formatDate(lead.createdAt, 'dd MMM yyyy')}
              </Text>
            </View>
            <View>
              <Text style={styles.cardExpandLabel}>Last Updated</Text>
              <Text style={styles.cardExpandValue}>
                {formatDate(lead.updatedAt, 'dd MMM yyyy')}
              </Text>
            </View>
          </View>
          <View style={styles.cardActionRow}>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={() => onView(lead)}
            >
              <MaterialIcons name="visibility" size={15} color="#fff" />
              <Text style={styles.actionBtnPrimaryText}>View</Text>
            </TouchableOpacity>
            {permissions.canUpdateStatus && (
              <TouchableOpacity
                style={styles.actionBtnOutline}
                onPress={() => onStatusUpdate(lead)}
              >
                <MaterialIcons name="trending-up" size={15} color={PRIMARY_COLOR} />
                <Text style={styles.actionBtnOutlineText}>Status</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ========== VIEW LEAD MODAL ==========
const ViewLeadModal = ({
  visible,
  onClose,
  lead,
}: {
  visible: boolean;
  onClose: () => void;
  lead: any;
}) => {
  const [activeTab, setActiveTab] = useState(0);
  if (!lead) return null;
  const tabs = ['Disbursement', 'Customer', 'Documents', 'Notes'];
  const docs = [
    { title: 'Registration Doc', url: lead.uploadDocument?.url, iconName: 'description' },
    { title: 'Aadhaar Card', url: lead.aadhaar?.url, iconName: 'badge' },
    { title: 'PAN Card', url: lead.panCard?.url, iconName: 'credit-card' },
    { title: 'Bank Passbook', url: lead.passbook?.url, iconName: 'receipt-long' },
    { title: 'Installation Doc', url: lead.installationDocument?.url, iconName: 'construction' },
    ...(lead.otherDocuments?.map((d: any, i: number) => ({
      title: d.name || `Other Doc ${i + 1}`, url: d.url, iconName: 'insert-drive-file',
    })) || []),
    ...(lead.enhancementDocuments?.map((d: any, i: number) => ({
      title: d.name || `Enhancement Doc ${i + 1}`, url: d.url, iconName: 'bolt',
    })) || []),
  ].filter((d: any) => d.url);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: PRIMARY_COLOR }}>
        <StatusBar backgroundColor={PRIMARY_COLOR} barStyle="light-content" />

        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <Avatar initials={getInitials(lead.firstName, lead.lastName)} size={44} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.modalTitle}>
                {lead.firstName} {lead.lastName}
              </Text>
              <Text style={styles.modalSubtitle}>
                Disbursement Details · {formatCurrency(lead.disbursementAmount)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Disbursement Tab */}
          {activeTab === 0 && (
            <>
              <View style={styles.infoCard}>
                <SectionHeader title="Disbursement Information" icon="payment" />
                <InfoRow label="Amount" value={formatCurrency(lead.disbursementAmount)} />
                <View style={styles.divider} />
                <InfoRow label="Date" value={formatDate(lead.disbursementDate)} />
                <View style={styles.divider} />
                <InfoRow
                  label="Transaction ID"
                  value={lead.disbursementTransactionId || 'Not specified'}
                />
                <View style={styles.divider} />
                <InfoRow label="Bank" value={lead.bank || 'Not specified'} />
              </View>

              <View style={styles.infoCard}>
                <SectionHeader title="Status Information" icon="gpp-maybe" />
                <View style={[styles.infoRow, { alignItems: 'center' }]}>
                  <Text style={styles.infoLabel}>Disbursement Status</Text>
                  <StatusBadge status={lead.disbursementStatus} type="disbursement" />
                </View>
                <View style={styles.divider} />
                <View style={[styles.infoRow, { alignItems: 'center' }]}>
                  <Text style={styles.infoLabel}>Lead Status</Text>
                  <StatusBadge status={lead.status} type="lead" />
                </View>
                <View style={styles.divider} />
                <InfoRow label="Last Updated" value={formatDate(lead.updatedAt)} />
              </View>
            </>
          )}

          {/* Customer Tab */}
          {activeTab === 1 && (
            <View style={styles.infoCard}>
              <SectionHeader title="Customer Information" icon="person" />
              <InfoRow label="Full Name" value={`${lead.firstName} ${lead.lastName}`} />
              <View style={styles.divider} />
              <InfoRow label="Email" value={lead.email || 'Not set'} />
              <View style={styles.divider} />
              <InfoRow label="Phone" value={lead.phoneNumber || lead.phone || 'Not set'} />
              <View style={styles.divider} />
              <InfoRow label="Address" value={lead.address || 'Not set'} />
              <View style={styles.divider} />
              <InfoRow label="City" value={lead.city || 'Not set'} />
            </View>
          )}

          {activeTab === 2 && (
            <View style={styles.infoCard}>
              <SectionHeader title="All Documents" icon="folder-open" />
              {docs.length > 0 ? docs.map((doc: any, i: number) => (
                <View key={i}>
                  <View style={[styles.infoRow, { alignItems: 'center' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialIcons name={doc.iconName} size={18} color={PRIMARY_COLOR} />
                      <Text style={{ marginLeft: 10, color: '#111827', fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {doc.title}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => Linking.openURL(doc.url)}>
                      <Text style={{ color: PRIMARY_COLOR, fontWeight: '700' }}>View</Text>
                    </TouchableOpacity>
                  </View>
                  {i < docs.length - 1 && <View style={styles.divider} />}
                </View>
              )) : (
                <Text style={styles.notesText}>No documents uploaded</Text>
              )}
            </View>
          )}

          {/* Notes Tab */}
          {activeTab === 3 && (
            <View style={styles.infoCard}>
              <SectionHeader title="Disbursement Notes" icon="note" />
              <Text style={styles.notesText}>
                {lead.disbursementNotes || 'No notes available'}
              </Text>
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
            <Text style={styles.closeFooterBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ========== STATUS UPDATE MODAL ==========
const StatusUpdateModal = ({
  visible,
  onClose,
  lead,
  onStatusUpdate,
  showSnackbar,
}: {
  visible: boolean;
  onClose: () => void;
  lead: any;
  // FIX: receives the updated lead object returned by the API for optimistic update
  onStatusUpdate: (updatedLead: any) => void;
  showSnackbar: (msg: string, sev: 'success' | 'error') => void;
}) => {
  const { fetchAPI, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [disbursementStatus, setDisbursementStatus] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [amount, setAmount] = useState('');
  const [disbDate, setDisbDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDisbStatusPicker, setShowDisbStatusPicker] = useState(false);
  const [showLeadStatusPicker, setShowLeadStatusPicker] = useState(false);

  useEffect(() => {
    if (visible && lead) {
      setDisbursementStatus(lead.disbursementStatus || 'pending');
      setLeadStatus(lead.status || 'Disbursement');
      setAmount(lead.disbursementAmount?.toString() || '');
      setDisbDate(lead.disbursementDate ? parseISO(lead.disbursementDate) : null);
      setNotes(lead.disbursementNotes || '');
      setErrors({});
    }
  }, [visible, lead]);

  const handleSelectDisbStatus = (val: string) => {
    setDisbursementStatus(val);
    if (val === 'completed')      setLeadStatus('Installation Completion');
    else if (val === 'cancelled') setLeadStatus('Missed Leads');
    else if (val === 'pending')   setLeadStatus('Disbursement');
    setShowDisbStatusPicker(false);
  };

  const leadStatusOptions = useMemo(() => {
    if (disbursementStatus === 'completed')  return ['Installation Completion'];
    if (disbursementStatus === 'cancelled')  return ['Missed Leads'];
    if (disbursementStatus === 'pending')    return ['Disbursement'];
    return LEAD_STATUS_OPTIONS;
  }, [disbursementStatus]);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!disbursementStatus) newErrors.disbursementStatus = 'Select disbursement status';
    if (!leadStatus)         newErrors.leadStatus = 'Select lead status';
    if (disbursementStatus === 'completed') {
      if (!amount.trim())
        newErrors.amount = 'Amount is required';
      else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
        newErrors.amount = 'Enter valid amount > 0';
      if (!disbDate)
        newErrors.date = 'Disbursement date is required';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setLoading(true);
    try {
      const updateData: any = {
        disbursementStatus,
        status:            leadStatus,
        disbursementNotes: notes.trim() || undefined,
        updatedBy:         user?._id,
        updatedByRole:     user?.role,
        updatedAt:         new Date().toISOString(),
      };
      if (disbursementStatus === 'completed') {
        updateData.disbursementAmount = parseFloat(amount);
        updateData.disbursementDate   = format(disbDate!, 'yyyy-MM-dd');
      }

      // FIX: fetchAPI in AuthContext throws on error — wrap in try/catch (already done)
      // and use the returned data directly.
      // AuthContext.fetchAPI returns the raw parsed JSON, so check response.success
      // If your backend wraps in { success, result } this works as-is.
      // If it returns the lead directly on 200, fall back to treating data as the lead.
      const data = await fetchAPI(`/lead/updateLead/${lead._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updateData),
      });

      // Normalise: support { success, result } and bare-object responses
      const updatedLead = data?.result ?? data;

      showSnackbar('Disbursement status updated successfully', 'success');
      // FIX: pass the actual updated lead object — parent does optimistic update
      onStatusUpdate(updatedLead);
      onClose();
    } catch (err: any) {
      // fetchAPI already throws with err.message set
      setErrors({ submit: err.message });
      showSnackbar(err.message || 'Failed to update status', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.statusModalHeader}>
            <View style={styles.statusModalIconBox}>
              <MaterialIcons name="payment" size={26} color={PRIMARY_COLOR} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.statusModalTitle}>Update Disbursement Status</Text>
              <Text style={styles.statusModalSubtitle}>
                {lead.firstName} {lead.lastName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <MaterialIcons name="close" size={22} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Error */}
            {errors.submit ? (
              <View style={styles.alertError}>
                <Text style={styles.alertErrorText}>{errors.submit}</Text>
              </View>
            ) : null}

            {/* Current Status Row */}
            <View style={styles.currentStatusRow}>
              <View>
                <Text style={styles.fieldLabel}>Current Disbursement</Text>
                <StatusBadge status={lead.disbursementStatus} type="disbursement" />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Current Lead Status</Text>
                <StatusBadge status={lead.status} type="lead" />
              </View>
            </View>

            {/* Disbursement Status Picker */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.fieldLabel}>New Disbursement Status *</Text>
              <TouchableOpacity
                style={[
                  styles.pickerBtn,
                  errors.disbursementStatus ? styles.pickerBtnError : null,
                ]}
                onPress={() => setShowDisbStatusPicker(true)}
              >
                <StatusBadge status={disbursementStatus} type="disbursement" />
                <MaterialIcons name="expand-more" size={20} color="#888" />
              </TouchableOpacity>
              {errors.disbursementStatus ? (
                <Text style={styles.errText}>{errors.disbursementStatus}</Text>
              ) : null}
            </View>

            {/* Lead Status Picker */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.fieldLabel}>Lead Status *</Text>
              <TouchableOpacity
                style={[
                  styles.pickerBtn,
                  errors.leadStatus ? styles.pickerBtnError : null,
                ]}
                onPress={() => setShowLeadStatusPicker(true)}
              >
                <StatusBadge status={leadStatus} type="lead" />
                <MaterialIcons name="expand-more" size={20} color="#888" />
              </TouchableOpacity>
              {errors.leadStatus ? (
                <Text style={styles.errText}>{errors.leadStatus}</Text>
              ) : null}
            </View>

            {/* Completed Fields */}
            {disbursementStatus === 'completed' && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>Disbursement Amount *</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      errors.amount ? styles.inputWrapperError : null,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="currency-inr"
                      size={16}
                      color="#888"
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter amount"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                    />
                  </View>
                  {errors.amount ? (
                    <Text style={styles.errText}>{errors.amount}</Text>
                  ) : null}
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>Disbursement Date *</Text>
                  <TouchableOpacity
                    style={[
                      styles.inputWrapper,
                      errors.date ? styles.inputWrapperError : null,
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color="#888"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ flex: 1, color: disbDate ? '#222' : '#aaa' }}>
                      {disbDate ? format(disbDate, 'dd MMM yyyy') : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                  {errors.date ? (
                    <Text style={styles.errText}>{errors.date}</Text>
                  ) : null}
                </View>
              </>
            )}

            {/* Notes */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[
                  styles.inputWrapper,
                  { height: 90, textAlignVertical: 'top', paddingTop: 8 },
                ]}
                placeholder="Add remarks or internal notes..."
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            {/* Info Banner */}
            {disbursementStatus ? (
              <View style={styles.infoBanner}>
                <MaterialIcons name="info" size={16} color={PRIMARY_COLOR} />
                <Text style={styles.infoBannerText}>
                  {disbursementStatus === 'completed'
                    ? 'Lead will move to → Installation Completion'
                    : disbursementStatus === 'cancelled'
                    ? 'Lead will move to → Missed Leads'
                    : 'Lead remains in → Disbursement stage'}
                </Text>
              </View>
            ) : null}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.statusModalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={16} color="#fff" />
                  <Text style={styles.submitBtnText}>Update Status</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={disbDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) setDisbDate(date);
          }}
        />
      )}

      <BottomPicker
        visible={showDisbStatusPicker}
        title="Select Disbursement Status"
        options={DISBURSEMENT_STATUS_OPTIONS.map(s => ({
          value:    s,
          label:    getDisbursementStatusConfig(s).label,
          iconName: getDisbursementStatusConfig(s).iconName,
          color:    getDisbursementStatusConfig(s).color,
        }))}
        onSelect={handleSelectDisbStatus}
        onClose={() => setShowDisbStatusPicker(false)}
      />

      <BottomPicker
        visible={showLeadStatusPicker}
        title="Select Lead Status"
        options={leadStatusOptions.map(s => ({
          value:    s,
          label:    s,
          iconName: getLeadStatusConfig(s).iconName,
          color:    getLeadStatusConfig(s).color,
        }))}
        onSelect={val => { setLeadStatus(val); setShowLeadStatusPicker(false); }}
        onClose={() => setShowLeadStatusPicker(false)}
      />
    </Modal>
  );
};

// ========== BOTTOM PICKER ==========
const BottomPicker = ({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string; iconName: string; color: string }[];
  onSelect: (val: string) => void;
  onClose: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.pickerOverlay} onPress={onClose} activeOpacity={1}>
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHandle} />
        <Text style={styles.pickerTitle}>{title}</Text>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={styles.pickerItem}
            onPress={() => onSelect(opt.value)}
          >
            <MaterialIcons name={opt.iconName} size={20} color={opt.color} />
            <Text style={[styles.pickerItemText, { color: opt.color }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  </Modal>
);

// ========== FILTER DRAWER ==========
const FilterDrawer = ({
  visible, onClose, period, setPeriod,
  disbursementStatusFilter, setDisbursementStatusFilter,
  leadStatusFilter, setLeadStatusFilter,
  bankFilter, setBankFilter,
  searchQuery, setSearchQuery,
  handleClearFilters, activeFilterCount,
}: any) => {
  const [showBankPicker, setShowBankPicker] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.filterOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={styles.filterSheet}>
          <View style={styles.pickerHandle} />

          {/* Header */}
          <View style={styles.filterHeader}>
            <View>
              <Text style={styles.filterTitle}>Filter Disbursements</Text>
              <Text style={styles.filterSubtitle}>
                {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Search */}
            <Text style={styles.filterSectionLabel}>Search</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="search" size={18} color="#aaa" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.input}
                placeholder="Name, email, phone, transaction ID..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={16} color="#aaa" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Period */}
            <Text style={styles.filterSectionLabel}>Time Period</Text>
            <View style={styles.periodRow}>
              {PERIOD_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.periodBtn, period === opt.value && styles.periodBtnActive]}
                  onPress={() => setPeriod(opt.value)}
                >
                  <Text
                    style={[
                      styles.periodBtnText,
                      period === opt.value && styles.periodBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Disbursement Status */}
            <Text style={styles.filterSectionLabel}>Disbursement Status</Text>
            <View style={styles.filterChipRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  disbursementStatusFilter === 'All' && styles.filterChipActive,
                ]}
                onPress={() => setDisbursementStatusFilter('All')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    disbursementStatusFilter === 'All' && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {DISBURSEMENT_STATUS_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filterChip,
                    disbursementStatusFilter === s && styles.filterChipActive,
                  ]}
                  onPress={() => setDisbursementStatusFilter(s)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      disbursementStatusFilter === s && styles.filterChipTextActive,
                    ]}
                  >
                    {getDisbursementStatusConfig(s).label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Lead Status */}
            <Text style={styles.filterSectionLabel}>Lead Status</Text>
            <View style={styles.filterChipRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  leadStatusFilter === 'All' && styles.filterChipActive,
                ]}
                onPress={() => setLeadStatusFilter('All')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    leadStatusFilter === 'All' && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {LEAD_STATUS_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filterChip,
                    leadStatusFilter === s && styles.filterChipActive,
                  ]}
                  onPress={() => setLeadStatusFilter(s)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      leadStatusFilter === s && styles.filterChipTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bank */}
            <Text style={styles.filterSectionLabel}>Bank</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowBankPicker(true)}
            >
              <Text style={{ flex: 1, color: bankFilter !== 'All' ? '#222' : '#aaa' }}>
                {bankFilter !== 'All' ? bankFilter : 'Select Bank'}
              </Text>
              <MaterialIcons name="expand-more" size={20} color="#888" />
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Actions */}
          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterClearBtn}
              onPress={() => { handleClearFilters(); onClose(); }}
            >
              <MaterialIcons name="clear" size={16} color={PRIMARY_COLOR} />
              <Text style={styles.filterClearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyBtn} onPress={onClose}>
              <Text style={styles.filterApplyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <BottomPicker
        visible={showBankPicker}
        title="Select Bank"
        options={[
          { value: 'All', label: 'All Banks', iconName: 'account-balance', color: '#555' },
          ...BANK_LIST.map(b => ({
            value: b, label: b, iconName: 'account-balance', color: '#555',
          })),
        ]}
        onSelect={val => { setBankFilter(val); setShowBankPicker(false); }}
        onClose={() => setShowBankPicker(false)}
      />
    </Modal>
  );
};

// ========== LOADING SKELETON ==========
const LoadingSkeleton = () => (
  <View style={{ padding: 16 }}>
    {[1, 2, 3, 4].map(i => (
      <View
        key={i}
        style={[styles.skeletonCard, { height: 100, marginBottom: 12, borderRadius: 12 }]}
      />
    ))}
  </View>
);

// ========== PROPS ==========
interface Props {
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
  onBackPress?:    () => void;
}

// ========== MAIN COMPONENT ==========
export default function DisbursementPage({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onBackPress,
}: Props = {}) {
  const { fetchAPI, user, getUserRole } = useAuth();
  const userRole        = getUserRole();
  const userPermissions = useMemo(() => getUserPermissions(userRole), [userRole]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [period,      setPeriod]      = useState('Today');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [snackbar,    setSnackbar]    = useState({
    open: false, message: '', severity: 'success' as 'success' | 'error',
  });
  const snackbarTimer = useRef<any>(null);

  const [disbursementData, setDisbursementData] = useState<any>({
    leads: [],
    summary: {
      totalLeads: 0, pendingLeads: 0,
      completedLeads: 0, cancelledLeads: 0, totalDisbursementAmount: 0,
    },
  });

  const [searchQuery,              setSearchQuery]              = useState('');
  const [disbursementStatusFilter, setDisbursementStatusFilter] = useState('All');
  const [leadStatusFilter,         setLeadStatusFilter]         = useState('All');
  const [bankFilter,               setBankFilter]               = useState('All');
  const [filterDrawerOpen,         setFilterDrawerOpen]         = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: string | null; direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // FIX: removed unused `const [page] = useState(0)` — was never read
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = DEFAULT_ITEMS_PER_PAGE;

  const [viewModalOpen,         setViewModalOpen]         = useState(false);
  const [statusUpdateModalOpen, setStatusUpdateModalOpen] = useState(false);
  const [selectedLead,          setSelectedLead]          = useState<any>(null);

  // ── Snackbar ───────────────────────────────────────────────────────────────
  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' = 'success') => {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
      setSnackbar({ open: true, message, severity });
      snackbarTimer.current = setTimeout(
        () => setSnackbar(p => ({ ...p, open: false })),
        3500,
      );
    },
    [],
  );

  // ── FIX: reset page whenever any filter changes ────────────────────────────
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, disbursementStatusFilter, leadStatusFilter, bankFilter, period]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // FIX: fetchAPI in AuthContext throws on non-2xx — no need to check response.success.
  // We catch the throw and set error state. On success we normalise the payload
  // to support both { success, result: { disbursements } } and bare arrays.
  const fetchDisbursementData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        const today  = new Date();
        if (period === 'Today') {
          params.append('startDate', format(today, 'yyyy-MM-dd'));
          params.append('endDate',   format(today, 'yyyy-MM-dd'));
        } else if (period === 'This Week') {
          params.append('startDate', format(subWeeks(today, 1), 'yyyy-MM-dd'));
          params.append('endDate',   format(today, 'yyyy-MM-dd'));
        } else if (period === 'This Month') {
          params.append('startDate', format(subMonths(today, 1), 'yyyy-MM-dd'));
          params.append('endDate',   format(today, 'yyyy-MM-dd'));
        }
        params.append('status', 'Disbursement');

        // fetchAPI throws on error, returns parsed JSON on success
        const data = await fetchAPI(
          `/lead/disbursementSummary?${params.toString()}`,
        );

        // Normalise payload — backend may send { result: { disbursements } }
        // or { result: { leads } } or just a top-level array
        const result    = data?.result ?? data;
        let rawLeads: any[] = result?.disbursements || result?.leads || [];

        // Ensure it's actually an array (guard against unexpected shapes)
        if (!Array.isArray(rawLeads)) rawLeads = [];

        // TEAM role: filter to own leads only
        if (userRole === 'TEAM' && user?._id) {
          rawLeads = rawLeads.filter(
            (lead: any) =>
              lead.assignedTo        === user._id ||
              lead.assignedManager   === user._id ||
              lead.assignedUser      === user._id ||
              lead.assignedUser?._id === user._id ||
              lead.createdBy         === user._id,
          );
        }

        setDisbursementData({
          leads:   rawLeads,
          summary: computeSummary(rawLeads),
        });
      } catch (err: any) {
        const msg = err.message || 'Network error. Please try again.';
        setError(msg);
        showSnackbar(msg, 'error');
        setDisbursementData({
          leads:   [],
          summary: computeSummary([]),
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, fetchAPI, userRole, user, showSnackbar],
  );

  useEffect(() => {
    if (hasAccess(userRole)) fetchDisbursementData();
  }, [fetchDisbursementData, userRole]);

  // ── Filtered & sorted leads ────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    let leads = [...disbursementData.leads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      leads = leads.filter(
        (l: any) =>
          (l.firstName?.toLowerCase()                 || '').includes(q) ||
          (l.lastName?.toLowerCase()                  || '').includes(q) ||
          (l.email?.toLowerCase()                     || '').includes(q) ||
          (l.phoneNumber || l.phone                   || '').includes(q) ||
          (l.bank?.toLowerCase()                      || '').includes(q) ||
          (l.disbursementTransactionId?.toLowerCase() || '').includes(q),
      );
    }
    if (disbursementStatusFilter !== 'All')
      leads = leads.filter((l: any) => l.disbursementStatus === disbursementStatusFilter);
    if (leadStatusFilter !== 'All')
      leads = leads.filter((l: any) => l.status === leadStatusFilter);
    if (bankFilter !== 'All')
      leads = leads.filter((l: any) => l.bank === bankFilter);
    if (sortConfig.key) {
      leads.sort((a: any, b: any) => {
        let av = a[sortConfig.key!], bv = b[sortConfig.key!];
        if (sortConfig.key === 'disbursementAmount') {
          av = parseFloat(av) || 0;
          bv = parseFloat(bv) || 0;
        }
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1  : -1;
        return 0;
      });
    }
    return leads;
  }, [
    disbursementData.leads,
    searchQuery,
    disbursementStatusFilter,
    leadStatusFilter,
    bankFilter,
    sortConfig,
  ]);

  const paginatedLeads = useMemo(
    () => filteredLeads.slice(
      currentPage * rowsPerPage,
      (currentPage + 1) * rowsPerPage,
    ),
    [filteredLeads, currentPage, rowsPerPage],
  );

  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchQuery)                        c++;
    if (disbursementStatusFilter !== 'All') c++;
    if (leadStatusFilter !== 'All')         c++;
    if (bankFilter !== 'All')               c++;
    return c;
  }, [searchQuery, disbursementStatusFilter, leadStatusFilter, bankFilter]);

  const summaryCards = useMemo(
    () => [
      { label: 'Total',     value: disbursementData.summary.totalLeads,     color: PRIMARY_COLOR, iconName: 'payment',         subText: 'All leads' },
      { label: 'Pending',   value: disbursementData.summary.pendingLeads,   color: '#e65100',     iconName: 'pending-actions', subText: 'Pending'   },
      { label: 'Completed', value: disbursementData.summary.completedLeads, color: '#2e7d32',     iconName: 'check-circle',    subText: 'Done'      },
      { label: 'Cancelled', value: disbursementData.summary.cancelledLeads, color: '#c62828',     iconName: 'cancel',          subText: 'Cancelled' },
    ],
    [disbursementData.summary],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDisbursementStatusFilter('All');
    setLeadStatusFilter('All');
    setBankFilter('All');
    setSortConfig({ key: null, direction: 'asc' });
    setCurrentPage(0);
  }, []);

  // FIX: signature changed from `async () => void` to `(updatedLead: any) => void`
  // Performs an optimistic in-place update — no extra network call needed.
  // The modal already calls onStatusUpdate(response.result) with the fresh lead.
  const handleStatusUpdate = useCallback((updatedLead: any) => {
    setDisbursementData((prev: any) => {
      const leads = prev.leads.map((l: any) =>
        l._id === updatedLead._id ? updatedLead : l,
      );
      return { leads, summary: computeSummary(leads) };
    });
    // Also refresh selectedLead so ViewLeadModal reflects new data if still open
    setSelectedLead((prev: any) =>
      prev?._id === updatedLead._id ? updatedLead : prev,
    );
    showSnackbar('Disbursement status updated successfully', 'success');
  }, [showSnackbar]);

  // ── Access denied ──────────────────────────────────────────────────────────
  if (!hasAccess(userRole)) {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialIcons name="lock" size={48} color="#c62828" />
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorSubtitle}>
          You don't have permission to access this page.
        </Text>
        <TouchableOpacity style={styles.submitBtn} onPress={() => onBackPress?.()}>
          <Text style={styles.submitBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading && disbursementData.leads.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG_COLOR }}>
        <LoadingSkeleton />
      </SafeAreaView>
    );
  }

  if (error && disbursementData.leads.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color="#c62828" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => fetchDisbursementData()}
        >
          <Text style={styles.submitBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_COLOR }}>
      <StatusBar backgroundColor={PRIMARY_COLOR} barStyle="light-content" />

      {/* Modals */}
      <ViewLeadModal
        visible={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        lead={selectedLead}
      />
      <StatusUpdateModal
        visible={statusUpdateModalOpen}
        onClose={() => setStatusUpdateModalOpen(false)}
        lead={selectedLead}
        onStatusUpdate={handleStatusUpdate}
        showSnackbar={showSnackbar}
      />
      <FilterDrawer
        visible={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        period={period}
        setPeriod={setPeriod}
        disbursementStatusFilter={disbursementStatusFilter}
        setDisbursementStatusFilter={setDisbursementStatusFilter}
        leadStatusFilter={leadStatusFilter}
        setLeadStatusFilter={setLeadStatusFilter}
        bankFilter={bankFilter}
        setBankFilter={setBankFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleClearFilters={handleClearFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Toast */}
      <Toast
        visible={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
      />

      <FlatList
        data={paginatedLeads}
        keyExtractor={(item: any) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDisbursementData(true)}
            colors={[PRIMARY_COLOR]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Page Header */}
            <View style={styles.pageHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>Disbursement Management</Text>
                <Text style={styles.pageSubtitle}>
                  Track and manage all loan disbursements
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setFilterDrawerOpen(true)}
                >
                  <MaterialIcons name="filter-alt" size={18} color="#fff" />
                  <Text style={styles.headerBtnText}>Filter</Text>
                  {activeFilterCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.headerBtn, loading && { opacity: 0.6 }]}
                  onPress={() => fetchDisbursementData()}
                  disabled={loading}
                >
                  <MaterialIcons name="refresh" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              {summaryCards.map(card => (
                <SummaryCard key={card.label} card={card} />
              ))}
            </View>

            {/* Search Bar */}
            <View style={styles.searchWrapper}>
              <MaterialIcons name="search" size={20} color="#aaa" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, email, phone, ID..."
                placeholderTextColor="#aaa"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={18} color="#aaa" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Results Header + Sort */}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsHeaderText}>
                Disbursements{' '}
                <Text style={styles.resultsCount}>{filteredLeads.length} total</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  { key: 'disbursementAmount', label: '₹' },
                  { key: 'disbursementDate',   label: 'Date' },
                ].map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.sortBtn,
                      sortConfig.key === s.key && styles.sortBtnActive,
                    ]}
                    onPress={() =>
                      setSortConfig(prev => ({
                        key:       s.key,
                        direction:
                          prev.key === s.key && prev.direction === 'asc'
                            ? 'desc'
                            : 'asc',
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.sortBtnText,
                        sortConfig.key === s.key && styles.sortBtnTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                    {sortConfig.key === s.key && (
                      <MaterialIcons
                        name={
                          sortConfig.direction === 'asc'
                            ? 'arrow-upward'
                            : 'arrow-downward'
                        }
                        size={12}
                        color={sortConfig.key === s.key ? '#fff' : PRIMARY_COLOR}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {loading && <View style={styles.loadingBar} />}
          </>
        }
        renderItem={({ item }: { item: any }) => (
          <DisbursementCard
            lead={item}
            onView={lead => { setSelectedLead(lead); setViewModalOpen(true); }}
            onStatusUpdate={lead => { setSelectedLead(lead); setStatusUpdateModalOpen(true); }}
            permissions={userPermissions}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            onClearFilters={handleClearFilters}
            hasFilters={activeFilterCount > 0}
          />
        }
        ListFooterComponent={
          filteredLeads.length > 0 ? (
            <View style={styles.pagination}>
              <Text style={styles.paginationInfo}>
                {currentPage * rowsPerPage + 1}–
                {Math.min((currentPage + 1) * rowsPerPage, filteredLeads.length)} of{' '}
                {filteredLeads.length}
              </Text>
              <View style={styles.paginationBtns}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 0 && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={22}
                    color={currentPage === 0 ? '#ccc' : PRIMARY_COLOR}
                  />
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>
                  {currentPage + 1} / {totalPages || 1}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    currentPage >= totalPages - 1 && styles.pageBtnDisabled,
                  ]}
                  onPress={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={currentPage >= totalPages - 1 ? '#ccc' : PRIMARY_COLOR}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12,
  },
  errorTitle:    { fontSize: 20, fontWeight: '700', color: '#c62828', marginTop: 8 },
  errorSubtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 8 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: -12,
    marginBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  pageTitle:    { color: '#fff', fontSize: 18, fontWeight: '700' },
  pageSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    position: 'relative',
  },
  headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#f44336',
    borderRadius: 8, width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  summaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14, gap: 8,
  },
  summaryCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 12 * 2 - 8) / 2 - 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8edf5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  summaryValue:   { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  summaryLabel:   { fontSize: 12, fontWeight: '600', color: '#222' },
  summarySubText: { fontSize: 10, color: '#888', marginTop: 1 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e6f0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#222', padding: 0 },
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  resultsHeaderText: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  resultsCount:      { fontSize: 13, fontWeight: '500', color: PRIMARY_COLOR },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7, borderWidth: 1, borderColor: PRIMARY_COLOR,
  },
  sortBtnActive:     { backgroundColor: PRIMARY_COLOR },
  sortBtnText:       { fontSize: 11, color: PRIMARY_COLOR, fontWeight: '600' },
  sortBtnTextActive: { color: '#fff' },
  loadingBar: {
    height: 3, backgroundColor: PRIMARY_COLOR,
    borderRadius: 2, marginBottom: 8, opacity: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#e8edf5',
    shadowColor: '#4569ea', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardName:       { fontSize: 15, fontWeight: '700', color: PRIMARY_COLOR },
  cardId:         { fontSize: 11, color: '#888', marginTop: 1 },
  expandBtn:      { backgroundColor: `${PRIMARY_COLOR}18`, borderRadius: 8, padding: 4 },
  cardQuickInfo:  { flexDirection: 'row', gap: 12, marginBottom: 8 },
  cardInfoItem:   { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  cardInfoText:   { fontSize: 12, color: '#555', flex: 1 },
  cardAmountRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  cardAmount:     { fontSize: 14, fontWeight: '600', color: '#222' },
  dot:            { color: '#ccc', fontSize: 10 },
  cardBadgeRow:   { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  cardExpanded:   { marginTop: 12 },
  cardExpandLabel: { fontSize: 11, color: '#888', marginBottom: 2, marginTop: 8 },
  cardExpandValue: { fontSize: 13, color: '#333', fontWeight: '500' },
  cardExpandRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardActionRow:   { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: PRIMARY_COLOR, borderRadius: 9, paddingVertical: 9,
  },
  actionBtnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: PRIMARY_COLOR, borderRadius: 9, paddingVertical: 9,
  },
  actionBtnOutlineText: { color: PRIMARY_COLOR, fontSize: 13, fontWeight: '600' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  avatar:     { backgroundColor: PRIMARY_COLOR, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#222', fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: PRIMARY_COLOR },
  infoCard: {
    backgroundColor: `${PRIMARY_COLOR}06`,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: `${PRIMARY_COLOR}18`,
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: PRIMARY_COLOR,
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  modalTitle:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSubtitle:   { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  modalCloseBtn:   { padding: 4 },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e0e6f0',
  },
  tab: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: PRIMARY_COLOR },
  tabText:       { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: PRIMARY_COLOR },
  modalContent:  { flex: 1, backgroundColor: BG_COLOR, padding: 16 },
  notesText:     { fontSize: 14, color: '#333', lineHeight: 22 },
  modalFooter: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#e0e6f0', backgroundColor: '#fff',
  },
  closeFooterBtn: {
    backgroundColor: PRIMARY_COLOR, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  closeFooterBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statusModalHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e6f0',
    backgroundColor: `${PRIMARY_COLOR}08`,
  },
  statusModalIconBox: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: `${PRIMARY_COLOR}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  statusModalTitle:    { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  statusModalSubtitle: { fontSize: 12, color: '#666', marginTop: 1 },
  statusModalFooter: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: '#e0e6f0', backgroundColor: '#fff',
  },
  currentStatusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: `${PRIMARY_COLOR}06`,
    borderRadius: 10, padding: 12, marginBottom: 16, marginTop: 4,
  },
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#dde3f0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff',
  },
  inputWrapperError: { borderColor: '#c62828' },
  input:             { flex: 1, fontSize: 14, color: '#222', padding: 0 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#dde3f0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    backgroundColor: '#fff',
  },
  pickerBtnError: { borderColor: '#c62828' },
  errText:        { color: '#c62828', fontSize: 11, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: PRIMARY_COLOR,
    borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: PRIMARY_COLOR, fontWeight: '700', fontSize: 14 },
  submitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 13,
  },
  submitBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  alertError:     { backgroundColor: '#ffebee', borderRadius: 8, padding: 12, marginBottom: 12 },
  alertErrorText: { color: '#c62828', fontSize: 13 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: `${PRIMARY_COLOR}10`, borderRadius: 10, padding: 12,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: PRIMARY_COLOR, lineHeight: 20 },
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingBottom: 24, paddingTop: 8,
  },
  pickerHandle: {
    width: 36, height: 4, backgroundColor: '#ddd',
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 15, fontWeight: '700', color: '#1a1a2e',
    paddingHorizontal: 18, marginBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  pickerItemText: { fontSize: 14, fontWeight: '600' },
  filterOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 16, paddingHorizontal: 16, paddingTop: 8,
  },
  filterHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, paddingTop: 4,
  },
  filterTitle:        { fontSize: 16, fontWeight: '700', color: PRIMARY_COLOR },
  filterSubtitle:     { fontSize: 12, color: '#888', marginTop: 1 },
  filterSectionLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 12 },
  periodRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5, borderColor: PRIMARY_COLOR,
  },
  periodBtnActive:     { backgroundColor: PRIMARY_COLOR },
  periodBtnText:       { color: PRIMARY_COLOR, fontSize: 12, fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },
  filterChipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: `${PRIMARY_COLOR}40`,
  },
  filterChipActive:     { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  filterChipText:       { fontSize: 12, color: PRIMARY_COLOR, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterActions: {
    flexDirection: 'row', gap: 12,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: '#eee', marginTop: 4,
  },
  filterClearBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 12,
  },
  filterClearBtnText: { color: PRIMARY_COLOR, fontWeight: '700', fontSize: 14 },
  filterApplyBtn: {
    flex: 1, backgroundColor: PRIMARY_COLOR,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  filterApplyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pagination: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4,
  },
  paginationInfo: { fontSize: 13, color: '#555' },
  paginationBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: `${PRIMARY_COLOR}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#f0f0f0' },
  pageIndicator:   { fontSize: 13, fontWeight: '600', color: PRIMARY_COLOR },
  toast: {
    position: 'absolute', top: 50, alignSelf: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
    zIndex: 9999,
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconWrapper: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${PRIMARY_COLOR}12`,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  emptySubtitle: {
    fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 18,
  },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  skeletonCard: { backgroundColor: '#e8edf5' },
});
