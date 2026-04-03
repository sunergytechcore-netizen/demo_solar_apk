// screens/MissedLeadsPage.tsx
// React Native — uses react-native-vector-icons/MaterialIcons throughout
//
// Install:
//   npm install react-native-vector-icons
//   npm install --save-dev @types/react-native-vector-icons
//   # iOS:  cd ios && pod install
//   # Android: auto-linked in RN 0.60+

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
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import {
  format,
  isValid,
  parseISO,
  subWeeks,
  subMonths,
} from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========== CONSTANTS ==========
const PRIMARY_COLOR   = '#4569ea';
const SECONDARY_COLOR = '#1a237e';
const DEFAULT_ITEMS_PER_PAGE = 10;

const PERIOD_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: 'Today',      label: 'Today',      icon: 'today' },
  { value: 'This Week',  label: 'This Week',  icon: 'date-range' },
  { value: 'This Month', label: 'This Month', icon: 'calendar-month' },
  { value: 'All',        label: 'All Time',   icon: 'all-inclusive' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgcolor: string; icon: string; description: string }> = {
  High: {
    label: 'High',
    color: '#f44336',
    bgcolor: '#fdecea',
    icon: 'priority-high',
    description: 'Inactive 30+ days — Immediate action required',
  },
  Medium: {
    label: 'Medium',
    color: '#ff9800',
    bgcolor: '#fff3e0',
    icon: 'warning',
    description: 'Inactive 15–29 days — Follow up needed',
  },
  Low: {
    label: 'Low',
    color: '#4caf50',
    bgcolor: '#e8f5e9',
    icon: 'check-circle',
    description: 'Inactive < 15 days — Monitor',
  },
};

// ========== HELPERS ==========
const getPriorityConfig = (daysInactive: number) => {
  if (daysInactive >= 30) return PRIORITY_CONFIG.High;
  if (daysInactive >= 15) return PRIORITY_CONFIG.Medium;
  return PRIORITY_CONFIG.Low;
};

const formatDate = (dateString: any, formatStr = 'dd MMM yyyy'): string => {
  if (!dateString) return 'Not Available';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, formatStr) : 'Invalid Date';
  } catch {
    return 'Invalid Date';
  }
};

const getInitials = (firstName?: string, lastName?: string): string =>
  `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '??';

// ========== AVATAR ==========
const Avatar = ({ initials, size = 40 }: { initials: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
  </View>
);

// ========== PRIORITY BADGE ==========
const PriorityBadge = ({ daysInactive }: { daysInactive: number }) => {
  const cfg = getPriorityConfig(daysInactive);
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bgcolor }]}>
      <Icon name={cfg.icon} size={11} color={cfg.color} style={styles.badgeIcon} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ========== STAGE BADGE ==========
const StageBadge = ({ status }: { status?: string }) => {
  const isMissed  = status === 'Missed';
  const color     = isMissed ? '#f44336' : PRIMARY_COLOR;
  const bgcolor   = isMissed ? '#fdecea' : '#e8eeff';
  const iconName  = isMissed ? 'warning' : 'build';
  const label     = status === 'Installation Completion' ? 'Installation' : (status || 'New');
  return (
    <View style={[styles.badge, { backgroundColor: bgcolor }]}>
      <Icon name={iconName} size={11} color={color} style={styles.badgeIcon} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
};

// ========== SUMMARY CARD ==========
interface SummaryCardProps {
  label: string;
  value: number | string;
  subText: string;
  color: string;
  iconName: string;
}
const SummaryCard = ({ label, value, subText, color, iconName }: SummaryCardProps) => (
  <View style={[styles.summaryCard, { borderColor: color + '30' }]}>
    <View style={[styles.summaryIconBox, { backgroundColor: color + '18' }]}>
      <Icon name={iconName} size={20} color={color} />
    </View>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summarySubText}>{subText}</Text>
  </View>
);

// ========== LEAD CARD ==========
const LeadCard = ({
  lead,
  onView,
  onReopen,
}: {
  lead: any;
  onView: (lead: any) => void;
  onReopen: (lead: any) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const initials = getInitials(lead.firstName, lead.lastName);
  const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unnamed Lead';

  return (
    <View style={styles.leadCard}>
      {/* Header */}
      <View style={styles.leadCardHeader}>
        <Avatar initials={initials} size={44} />
        <View style={styles.leadCardInfo}>
          <Text style={styles.leadCardName}>{fullName}</Text>
          <Text style={styles.leadCardId}>ID: {lead._id?.slice(-8) || 'N/A'}</Text>
        </View>
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={22}
            color={PRIMARY_COLOR}
          />
        </TouchableOpacity>
      </View>

      {/* Phone / Email */}
      <View style={styles.leadCardRow}>
        <View style={styles.leadMetaItem}>
          <Icon name="phone" size={13} color={PRIMARY_COLOR} style={styles.metaIcon} />
          <Text style={styles.leadCardMeta} numberOfLines={1}>{lead.phone || 'No phone'}</Text>
        </View>
        <View style={styles.leadMetaItem}>
          <Icon name="email" size={13} color={PRIMARY_COLOR} style={styles.metaIcon} />
          <Text style={styles.leadCardMeta} numberOfLines={1}>{lead.email || 'No email'}</Text>
        </View>
      </View>

      {/* Date / Inactive */}
      <View style={styles.leadCardRow}>
        <View style={styles.leadMetaItem}>
          <Icon name="calendar-today" size={13} color={PRIMARY_COLOR} style={styles.metaIcon} />
          <Text style={styles.leadCardMeta}>{formatDate(lead.createdAt)}</Text>
        </View>
        <View style={styles.leadMetaItem}>
          <Icon name="access-time" size={13} color={PRIMARY_COLOR} style={styles.metaIcon} />
          <Text style={styles.leadCardMeta}>{lead.daysInactive || 0} days inactive</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.leadCardBadges}>
        <PriorityBadge daysInactive={lead.daysInactive || 0} />
        <StageBadge status={lead.status} />
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.divider} />

          {lead.address ? (
            <View style={styles.detailRow}>
              <View style={styles.detailLabelRow}>
                <Icon name="location-on" size={13} color="#bbb" style={styles.metaIcon} />
                <Text style={styles.detailLabel}>Address</Text>
              </View>
              <Text style={styles.detailValue}>{lead.address}</Text>
            </View>
          ) : null}

          {lead.notes ? (
            <View style={styles.detailRow}>
              <View style={styles.detailLabelRow}>
                <Icon name="notes" size={13} color="#bbb" style={styles.metaIcon} />
                <Text style={styles.detailLabel}>Notes</Text>
              </View>
              <Text style={styles.detailValue}>{lead.notes}</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Icon name="history" size={13} color="#bbb" style={styles.metaIcon} />
              <Text style={styles.detailLabel}>Last Contact</Text>
            </View>
            <Text style={styles.detailValue}>{formatDate(lead.lastContactedAt)}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: PRIMARY_COLOR }]}
              onPress={() => onView(lead)}
              activeOpacity={0.8}
            >
              <Icon name="visibility" size={15} color="#fff" style={styles.btnIcon} />
              <Text style={styles.actionBtnTextWhite}>View</Text>
            </TouchableOpacity>

            {lead.canReopen !== false && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGreen]}
                onPress={() => onReopen(lead)}
                activeOpacity={0.8}
              >
                <Icon name="restore" size={15} color="#4caf50" style={styles.btnIcon} />
                <Text style={[styles.actionBtnText, { color: '#4caf50' }]}>Reopen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ========== DETAIL MODAL ==========
const LeadDetailModal = ({
  visible,
  onClose,
  lead,
  onReopen,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  lead: any;
  onReopen: (lead: any) => void;
  loading: boolean;
}) => {
  if (!lead) return null;
  const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unnamed Lead';

  const basicInfo: { label: string; value: string; icon: string }[] = [
    { label: 'Full Name',         value: fullName,                                           icon: 'person' },
    { label: 'Email',             value: lead.email          || 'Not Available',              icon: 'email' },
    { label: 'Phone',             value: lead.phone          || 'Not Available',              icon: 'phone' },
    { label: 'Address',           value: lead.address        || 'Not Available',              icon: 'home' },
    { label: 'City',              value: lead.city           || 'Not Available',              icon: 'location-on' },
    { label: 'Pincode',           value: lead.pincode        || 'Not Available',              icon: 'pin-drop' },
    { label: 'Solar Requirement', value: lead.solarRequirement || 'Not Available',            icon: 'wb-sunny' },
    { label: 'Created',           value: formatDate(lead.createdAt, 'dd MMM yyyy, HH:mm'),   icon: 'calendar-today' },
  ];

  const statusInfo: { label: string; value: string; icon: string }[] = [
    { label: 'Days Inactive',    value: `${lead.daysInactive || 0} days`,                                 icon: 'access-time' },
    { label: 'Last Contacted',   value: formatDate(lead.lastContactedAt, 'dd MMM yyyy, HH:mm'),          icon: 'history' },
    {
      label: 'Assigned Manager',
      value: lead.assignedManager
        ? `${lead.assignedManager.firstName || ''} ${lead.assignedManager.lastName || ''}`.trim() || 'Not Assigned'
        : 'Not Assigned',
      icon: 'supervisor-account',
    },
    {
      label: 'Assigned User',
      value: lead.assignedUser
        ? `${lead.assignedUser.firstName || ''} ${lead.assignedUser.lastName || ''}`.trim() || 'Not Assigned'
        : 'Not Assigned',
      icon: 'person-outline',
    },
    { label: 'Updated At',       value: formatDate(lead.updatedAt, 'dd MMM yyyy, HH:mm'),               icon: 'update' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <Avatar initials={getInitials(lead.firstName, lead.lastName)} size={40} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.modalTitle}>{fullName}</Text>
              <Text style={styles.modalSubtitle}>Complete Information</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Icon name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Basic Info */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Icon name="person" size={18} color={PRIMARY_COLOR} style={styles.sectionTitleIcon} />
                <Text style={styles.sectionTitle}>Basic Information</Text>
              </View>
              {basicInfo.map(item => (
                <View key={item.label} style={styles.infoRow}>
                  <View style={styles.infoLabelRow}>
                    <Icon name={item.icon} size={13} color="#bbb" style={styles.metaIcon} />
                    <Text style={styles.infoLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Status & Timeline */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Icon name="timeline" size={18} color={PRIMARY_COLOR} style={styles.sectionTitleIcon} />
                <Text style={styles.sectionTitle}>Status & Timeline</Text>
              </View>
              <View style={styles.statusRow}>
                <PriorityBadge daysInactive={lead.daysInactive || 0} />
                <StageBadge status={lead.status} />
              </View>
              {statusInfo.map(item => (
                <View key={item.label} style={styles.infoRow}>
                  <View style={styles.infoLabelRow}>
                    <Icon name={item.icon} size={13} color="#bbb" style={styles.metaIcon} />
                    <Text style={styles.infoLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Notes */}
            {lead.notes ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionTitleRow}>
                  <Icon name="notes" size={18} color={PRIMARY_COLOR} style={styles.sectionTitleIcon} />
                  <Text style={styles.sectionTitle}>Notes</Text>
                </View>
                <Text style={styles.notesText}>{lead.notes}</Text>
              </View>
            ) : null}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.footerBtn, styles.footerBtnOutline]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Icon name="close" size={16} color={PRIMARY_COLOR} style={styles.btnIcon} />
            <Text style={[styles.footerBtnText, { color: PRIMARY_COLOR }]}>Close</Text>
          </TouchableOpacity>

          {lead.canReopen !== false && (
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: '#4caf50' }]}
              onPress={() => { onReopen(lead); onClose(); }}
              activeOpacity={0.8}
            >
              <Icon name="restore" size={16} color="#fff" style={styles.btnIcon} />
              <Text style={[styles.footerBtnText, { color: '#fff' }]}>Reopen Lead</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ========== FILTER MODAL ==========
const FilterModal = ({
  visible,
  onClose,
  period,
  setPeriod,
  priorityFilter,
  setPriorityFilter,
  searchQuery,
  setSearchQuery,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  period: string;
  setPeriod: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onClear: () => void;
}) => {
  const priorityOptions: { value: string; label: string; icon: string }[] = [
    { value: '',       label: 'All Priorities', icon: 'filter-list' },
    { value: 'High',   label: 'High',           icon: 'priority-high' },
    { value: 'Medium', label: 'Medium',          icon: 'warning' },
    { value: 'Low',    label: 'Low',             icon: 'check-circle' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.filterModal}>
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.filterHeader}>
          <View style={styles.filterHeaderLeft}>
            <Icon name="tune" size={20} color={PRIMARY_COLOR} style={styles.sectionTitleIcon} />
            <Text style={styles.filterTitle}>Filter Missed Leads</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.filterCloseBtn} activeOpacity={0.7}>
            <Icon name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
          {/* Search */}
          <Text style={styles.filterSectionLabel}>Search</Text>
          <View style={styles.searchContainer}>
            <Icon name="search" size={18} color="#bbb" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Name, email, phone..."
              placeholderTextColor="#bbb"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Icon name="close" size={16} color="#bbb" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Period */}
          <Text style={styles.filterSectionLabel}>Time Period</Text>
          <View style={styles.periodGrid}>
            {PERIOD_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.periodBtn, period === opt.value && styles.periodBtnActive]}
                onPress={() => setPeriod(opt.value)}
                activeOpacity={0.8}
              >
                <Icon
                  name={opt.icon}
                  size={14}
                  color={period === opt.value ? '#fff' : PRIMARY_COLOR}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.periodBtnText, period === opt.value && styles.periodBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority */}
          <Text style={styles.filterSectionLabel}>Priority</Text>
          {priorityOptions.map(opt => (
            <TouchableOpacity
              key={opt.value || 'all'}
              style={[styles.priorityOption, priorityFilter === opt.value && styles.priorityOptionActive]}
              onPress={() => setPriorityFilter(opt.value)}
              activeOpacity={0.8}
            >
              <Icon
                name={opt.icon}
                size={16}
                color={priorityFilter === opt.value ? '#fff' : '#666'}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.priorityOptionText, priorityFilter === opt.value && { color: '#fff' }]}>
                {opt.label}
              </Text>
              {priorityFilter === opt.value && (
                <Icon name="check" size={16} color="#fff" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.filterFooter}>
          <TouchableOpacity
            style={[styles.footerBtn, styles.footerBtnOutline]}
            onPress={() => { onClear(); onClose(); }}
            activeOpacity={0.8}
          >
            <Icon name="clear" size={16} color={PRIMARY_COLOR} style={styles.btnIcon} />
            <Text style={[styles.footerBtnText, { color: PRIMARY_COLOR }]}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerBtn, { backgroundColor: PRIMARY_COLOR }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Icon name="check" size={16} color="#fff" style={styles.btnIcon} />
            <Text style={[styles.footerBtnText, { color: '#fff' }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ========== EMPTY STATE ==========
const EmptyState = ({ onClear, hasFilters }: { onClear: () => void; hasFilters: boolean }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconBox}>
      <Icon name="trending-down" size={48} color={PRIMARY_COLOR} />
    </View>
    <Text style={styles.emptyTitle}>No missed leads found</Text>
    <Text style={styles.emptySubText}>
      {hasFilters
        ? 'Try adjusting your search criteria.'
        : 'Great! You have no missed leads to recover.'}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.8}>
        <Icon name="filter-list-off" size={16} color="#fff" style={styles.btnIcon} />
        <Text style={styles.clearBtnText}>Clear Filters</Text>
      </TouchableOpacity>
    )}
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
export default function MissedLeadsPage({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onBackPress,
}: Props = {}) {
  const { fetchAPI } = useAuth();

  const [period, setPeriod]           = useState('Today');
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [missedLeads, setMissedLeads] = useState<any[]>([]);

  const [searchQuery, setSearchQuery]         = useState('');
  const [priorityFilter, setPriorityFilter]   = useState('');
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [page, setPage]     = useState(0);
  const rowsPerPage         = DEFAULT_ITEMS_PER_PAGE;

  const [viewModalOpen, setViewModalOpen]   = useState(false);
  const [selectedLead, setSelectedLead]     = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [summaryStats, setSummaryStats] = useState({
    total: 0, highPriority: 0, avgInactiveDays: 0, reopenable: 0,
  });

  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  // ── Summary stats ──
  const calculateSummaryStats = useCallback((leads: any[]) => {
    const high = leads.filter(l => (l.daysInactive || 0) >= 30).length;
    const avgDays = leads.length > 0
      ? Math.round(leads.reduce((s, l) => s + (l.daysInactive || 0), 0) / leads.length)
      : 0;
    const reopenable = leads.filter(l => l.canReopen !== false).length;
    setSummaryStats({ total: leads.length, highPriority: high, avgInactiveDays: avgDays, reopenable });
  }, []);

  // ── Fetch ──
  const fetchMissedLeads = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);

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

      const response = await fetchAPI(`/lead/missed?${params.toString()}`);
      if (response?.success) {
        const leads = response.result.missedLeads || [];
        setMissedLeads(leads);
        calculateSummaryStats(leads);
        setPage(0);
      } else {
        throw new Error(response?.message || 'Failed to fetch missed leads');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load missed leads', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, fetchAPI, calculateSummaryStats, showToast]);

  // ── Filter ──
  const filteredLeads = useMemo(() => {
    let list = [...missedLeads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(l =>
        (l.firstName?.toLowerCase() || '').includes(q) ||
        (l.lastName?.toLowerCase()  || '').includes(q) ||
        (l.email?.toLowerCase()     || '').includes(q) ||
        (l.phone || '').includes(q),
      );
    }
    if (priorityFilter === 'High')   list = list.filter(l => (l.daysInactive || 0) >= 30);
    if (priorityFilter === 'Medium') list = list.filter(l => (l.daysInactive || 0) >= 15 && (l.daysInactive || 0) < 30);
    if (priorityFilter === 'Low')    list = list.filter(l => (l.daysInactive || 0) < 15);
    return list;
  }, [missedLeads, searchQuery, priorityFilter]);

  const paginatedLeads = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredLeads.slice(start, start + rowsPerPage);
  }, [filteredLeads, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchQuery)    c++;
    if (priorityFilter) c++;
    return c;
  }, [searchQuery, priorityFilter]);

  // ── View ──
  const handleViewClick = useCallback(async (lead: any) => {
    setSelectedLead(lead);
    setDetailsLoading(true);
    setViewModalOpen(true);
    try {
      const res = await fetchAPI(`/lead/getLeadById/${lead._id}`);
      if (res?.success) setSelectedLead(res.result);
    } catch (err: any) {
      showToast('Failed to load lead details: ' + err.message, 'error');
    } finally {
      setDetailsLoading(false);
    }
  }, [fetchAPI, showToast]);

  // ── Reopen ──
  const handleReopenClick = useCallback(async (lead: any) => {
    try {
      const res = await fetchAPI(`/lead/updateLead/${lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Visit',
          lastContactedAt: new Date().toISOString(),
          notes: lead.notes
            ? `${lead.notes}\n[${new Date().toLocaleDateString()}] Lead reopened from Missed status`
            : `[${new Date().toLocaleDateString()}] Lead reopened from Missed status`,
        }),
      });
      if (res?.success) {
        showToast('Lead reopened successfully!', 'success');
        const updated = missedLeads.filter(i => i._id !== lead._id);
        setMissedLeads(updated);
        calculateSummaryStats(updated);
        setTimeout(() => fetchMissedLeads(), 1000);
      } else {
        throw new Error(res?.message || 'Failed to reopen lead');
      }
    } catch (err: any) {
      showToast('Failed to reopen lead: ' + err.message, 'error');
    }
  }, [missedLeads, fetchAPI, fetchMissedLeads, calculateSummaryStats, showToast]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setPriorityFilter('');
    setPeriod('Today');
    setPage(0);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) setPage(newPage);
  }, [totalPages]);

  useEffect(() => { fetchMissedLeads(); }, [fetchMissedLeads]);

  // ── Loading Screen ──
  if (loading && missedLeads.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading missed leads...</Text>
      </SafeAreaView>
    );
  }

  // ── Main Render ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

      {/* Toast */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: toast.type === 'success' ? '#4caf50' : '#f44336',
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }),
              }],
            },
          ]}
        >
          <Icon
            name={toast.type === 'success' ? 'check-circle' : 'error'}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      {/* Detail Modal */}
      <LeadDetailModal
        visible={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        lead={selectedLead}
        onReopen={handleReopenClick}
        loading={detailsLoading}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        period={period}
        setPeriod={v => { setPeriod(v); setPage(0); }}
        priorityFilter={priorityFilter}
        setPriorityFilter={v => { setPriorityFilter(v); setPage(0); }}
        searchQuery={searchQuery}
        setSearchQuery={v => { setSearchQuery(v); setPage(0); }}
        onClear={handleClearFilters}
      />

      <FlatList
        data={paginatedLeads}
        keyExtractor={item => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMissedLeads(true)}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
        ListHeaderComponent={
          <>
            {/* ══ Page Header ══ */}
            <View style={styles.pageHeader}>
              <View style={styles.pageHeaderLeft}>
                {/* Menu or Back */}
                {onMenuPress ? (
                  <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={onMenuPress}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="menu" size={24} color="#fff" />
                  </TouchableOpacity>
                ) : onBackPress ? (
                  <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={onBackPress}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                ) : null}

                <View style={{ flex: 1 }}>
                  <Text style={styles.pageTitle}>Missed Leads Recovery</Text>
                  <Text style={styles.pageSubtitle}>Track and recover lost opportunities</Text>
                </View>
              </View>

              <View style={styles.pageHeaderRight}>
                {onSearchPress && (
                  <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={onSearchPress}
                    activeOpacity={0.7}
                  >
                    <Icon name="search" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                {onProfilePress && (
                  <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={onProfilePress}
                    activeOpacity={0.7}
                  >
                    <Icon name="account-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => fetchMissedLeads(true)}
                  activeOpacity={0.7}
                >
                  <Icon name="refresh" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ══ Summary Cards ══ */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.summaryScroll}
              contentContainerStyle={styles.summaryScrollContent}
            >
              <SummaryCard label="Total Missed"   value={summaryStats.total}                     subText="Leads lost"            color={PRIMARY_COLOR} iconName="trending-down" />
              <SummaryCard label="High Priority"  value={summaryStats.highPriority}              subText="30+ days inactive"     color="#f44336"       iconName="priority-high" />
              <SummaryCard label="Avg Inactive"   value={`${summaryStats.avgInactiveDays}d`}     subText="Days without contact"  color="#ff9800"       iconName="access-time" />
              <SummaryCard label="Can Reopen"     value={summaryStats.reopenable}                subText="Ready for recovery"    color="#4caf50"       iconName="restore" />
            </ScrollView>

            {/* ══ Search + Filter ══ */}
            <View style={styles.searchBarRow}>
              <View style={styles.searchContainer}>
                <Icon name="search" size={18} color="#bbb" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, email, phone..."
                  placeholderTextColor="#bbb"
                  value={searchQuery}
                  onChangeText={v => { setSearchQuery(v); setPage(0); }}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setPage(0); }} activeOpacity={0.7}>
                    <Icon name="close" size={16} color="#bbb" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity style={styles.filterFab} onPress={() => setFilterModalOpen(true)} activeOpacity={0.8}>
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
                <Icon name="tune" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* ══ List Title ══ */}
            <View style={styles.listTitleRow}>
              <View style={styles.listTitleLeft}>
                <Icon name="list" size={18} color={PRIMARY_COLOR} style={{ marginRight: 6 }} />
                <Text style={styles.listTitle}>Missed Leads</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredLeads.length} total</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <LeadCard lead={item} onView={handleViewClick} onReopen={handleReopenClick} />
        )}
        ListEmptyComponent={
          <EmptyState onClear={handleClearFilters} hasFilters={activeFilterCount > 0} />
        }
        ListFooterComponent={
          filteredLeads.length > rowsPerPage ? (
            <View style={styles.pagination}>
              <Text style={styles.paginationInfo}>
                {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, filteredLeads.length)} of {filteredLeads.length}
              </Text>
              <View style={styles.paginationBtns}>
                <TouchableOpacity
                  style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                  onPress={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                  activeOpacity={0.7}
                >
                  <Icon name="chevron-left" size={22} color={page === 0 ? '#bbb' : '#fff'} />
                </TouchableOpacity>
                <Text style={styles.pageNum}>{page + 1} / {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                  onPress={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages - 1}
                  activeOpacity={0.7}
                >
                  <Icon name="chevron-right" size={22} color={page >= totalPages - 1 ? '#bbb' : '#fff'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : <View style={{ height: 32 }} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText:        { marginTop: 12, color: '#666', fontSize: 14 },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  // Toast
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 12,
    left: 16, right: 16, zIndex: 9999,
    borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },

  // Page Header
  pageHeader: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pageHeaderLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  pageHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  pageTitle:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  pageSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },

  // Summary
  summaryScroll:        { backgroundColor: PRIMARY_COLOR, paddingBottom: 14 },
  summaryScrollContent: { paddingHorizontal: 16, gap: 10 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, width: 132, borderWidth: 1,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  summaryIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  summaryValue:   { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  summaryLabel:   { fontSize: 12, fontWeight: '600', color: '#333' },
  summarySubText: { fontSize: 10, color: '#888', marginTop: 2 },

  // Search
  searchBarRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333', padding: 0 },
  filterFab: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: PRIMARY_COLOR, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4, width: 18, height: 18,
    borderRadius: 9, backgroundColor: '#f44336', justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // List
  listContent:   { paddingBottom: 20 },
  listTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  listTitleLeft: { flexDirection: 'row', alignItems: 'center' },
  listTitle:     { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  countBadge:    { backgroundColor: '#e8eeff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countBadgeText:{ color: PRIMARY_COLOR, fontSize: 11, fontWeight: '600' },

  // Lead Card
  leadCard: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff',
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e8eeff',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  leadCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  leadCardInfo:   { flex: 1 },
  leadCardName:   { fontSize: 15, fontWeight: '700', color: PRIMARY_COLOR },
  leadCardId:     { fontSize: 11, color: '#aaa', marginTop: 2 },
  expandBtn:      { padding: 5, backgroundColor: '#f0f3ff', borderRadius: 8 },
  leadCardRow:    { flexDirection: 'row', gap: 12, marginBottom: 6 },
  leadMetaItem:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  metaIcon:       { marginRight: 4 },
  leadCardMeta:   { fontSize: 12, color: '#666', flex: 1 },
  leadCardBadges: { flexDirection: 'row', gap: 8, marginTop: 4 },

  // Expanded
  expandedSection: { marginTop: 4 },
  divider:         { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  detailRow:       { marginBottom: 10 },
  detailLabelRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  detailLabel:     { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  detailValue:     { fontSize: 13, color: '#333', marginLeft: 17 },
  actionRow:       { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn:       { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionBtnGreen:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#4caf50' },
  actionBtnTextWhite: { color: '#fff', fontWeight: '600', fontSize: 13 },
  actionBtnText:   { fontWeight: '600', fontSize: 13 },
  btnIcon:         { marginRight: 5 },

  // Badge
  badge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  badgeIcon: { marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Avatar
  avatar:     { backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },

  // Empty
  emptyState:   { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 24 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e8eeff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  clearBtn:     { marginTop: 20, backgroundColor: PRIMARY_COLOR, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  clearBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Pagination
  pagination:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  paginationInfo:  { fontSize: 13, color: '#666' },
  paginationBtns:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center' },
  pageBtnDisabled: { backgroundColor: '#e0e0e0' },
  pageNum:         { fontSize: 13, color: '#333', fontWeight: '600', minWidth: 48, textAlign: 'center' },

  // Detail Modal
  modalContainer:  { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: PRIMARY_COLOR },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  modalTitle:      { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalSubtitle:   { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  closeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  modalContent:    { flex: 1, padding: 16 },
  sectionCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitleIcon:{ marginRight: 8 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabelRow:    { flexDirection: 'row', alignItems: 'center', flex: 0.48 },
  infoLabel:       { fontSize: 12, color: '#aaa', fontWeight: '500' },
  infoValue:       { fontSize: 13, color: '#333', fontWeight: '500', flex: 0.52, textAlign: 'right' },
  statusRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  notesText:       { fontSize: 14, color: '#444', lineHeight: 20, backgroundColor: '#fafafa', borderRadius: 8, padding: 12 },
  modalFooter:     { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  footerBtn:       { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  footerBtnOutline:{ borderWidth: 1.5, borderColor: PRIMARY_COLOR, backgroundColor: 'transparent' },
  footerBtnText:   { fontSize: 15, fontWeight: '700' },

  // Filter Modal
  filterModal:      { flex: 1, backgroundColor: '#fff' },
  dragHandle:       { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  filterHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  filterTitle:      { fontSize: 18, fontWeight: '700', color: PRIMARY_COLOR },
  filterCloseBtn:   { padding: 6 },
  filterContent:    { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  filterSectionLabel:{ fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 6 },
  periodGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  periodBtn:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY_COLOR, backgroundColor: 'transparent' },
  periodBtnActive:  { backgroundColor: PRIMARY_COLOR },
  periodBtnText:    { color: PRIMARY_COLOR, fontSize: 13, fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },
  priorityOption:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#eee', marginBottom: 8, backgroundColor: '#fafafa' },
  priorityOptionActive:{ backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  priorityOptionText:  { fontSize: 14, fontWeight: '600', color: '#333' },
  filterFooter:     { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
});