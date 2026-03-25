// src/screen/AllLeadsScreen.tsx
// Converted from LeadOverview.jsx (React Web → React Native)

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
  Dimensions,
  Platform,
  Animated,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
  Switch,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY   = '#4569ea';
const SECONDARY = '#1a237e';
const BG        = '#f8fafc';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const LEAD_STATUS_OPTIONS = [
  'Visit',
  'Registration',
  'Bank Loan Apply',
  'Document Submission',
  'Bank at Pending',
  'Disbursement',
  'Installation Completion',
  'Missed Leads',
  'New',
];

const ROLE_PERMISSIONS: Record<string, any> = {
  Head_office: { view: true, edit: true, assign: true, delete: true,  bulkActions: true,  label: 'Head Office',          canAssignTo: ['ASM', 'TEAM'] },
  ZSM:         { view: true, edit: true, assign: true, delete: false, bulkActions: true,  label: 'Zone Sales Manager',   canAssignTo: ['ASM', 'TEAM'] },
  ASM:         { view: true, edit: true, assign: true, delete: false, bulkActions: true,  label: 'Area Sales Manager',   canAssignTo: ['TEAM'] },
  TEAM:        { view: true, edit: true, assign: false,delete: false, bulkActions: false, label: 'Team Member',          canAssignTo: [] },
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; icon: string }> = {
  'Visit':                  { bg: '#eef1ff', color: PRIMARY,    icon: 'account'               },
  'Registration':           { bg: '#eef1ff', color: PRIMARY,    icon: 'clipboard-account'      },
  'Bank Loan Apply':        { bg: '#eef1ff', color: PRIMARY,    icon: 'bank'                  },
  'Document Submission':    { bg: '#eef1ff', color: PRIMARY,    icon: 'file-document'          },
  'Bank at Pending':        { bg: '#eef1ff', color: PRIMARY,    icon: 'clock-outline'          },
  'Disbursement':           { bg: '#eef1ff', color: PRIMARY,    icon: 'trending-up'           },
  'Installation Completion':{ bg: '#eef1ff', color: PRIMARY,    icon: 'check-circle'          },
  'Missed Leads':           { bg: '#ffebee', color: '#f44336',  icon: 'alert-circle'          },
  'New':                    { bg: '#e8f5e9', color: '#4caf50',  icon: 'plus-circle'           },
};

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const alpha = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

const getStatusCfg = (status: string) =>
  STATUS_CONFIG[status] || { bg: '#eef1ff', color: PRIMARY, icon: 'dots-horizontal' };

const initials = (first?: string, last?: string) =>
  `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'L';

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

const useDebounce = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* ─────────────────────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────────────────────── */
const Avatar = ({ label, color = PRIMARY, size = 40 }: { label: string; color?: string; size?: number }) => (
  <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
    <Text style={[av.text, { fontSize: size * 0.38 }]}>{label}</Text>
  </View>
);
const av = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});

/* ─────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────── */
const StatusBadge = ({ status }: { status: string }) => {
  const cfg = getStatusCfg(status);
  return (
    <View style={[sb.wrap, { backgroundColor: cfg.bg }]}>
      <MaterialCommunityIcons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={[sb.text, { color: cfg.color }]}>{status}</Text>
    </View>
  );
};
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
});

/* ─────────────────────────────────────────────────────────────
   SKELETON LOADER
───────────────────────────────────────────────────────────── */
const Skeleton = ({ h = 80, mb = 10 }: { h?: number; mb?: number }) => (
  <View style={{ height: h, borderRadius: 14, backgroundColor: '#e2e8f0', marginBottom: mb }} />
);
const LoadingSkeleton = () => (
  <View style={{ padding: 12 }}>
    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={110} mb={12} />)}
  </View>
);

/* ─────────────────────────────────────────────────────────────
   FILTER BOTTOM SHEET
───────────────────────────────────────────────────────────── */
const FilterSheet = ({
  visible, onClose, statusFilter, setStatusFilter,
  sortBy, setSortBy, searchQuery, setSearchQuery, onClear,
}: any) => {
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 80, friction: 12,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[fs.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={fs.handle} />
        <View style={fs.header}>
          <View>
            <Text style={fs.title}>Filter Leads</Text>
            <Text style={fs.sub}>Refine your results</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={fs.closeBtn}>
            <MaterialCommunityIcons name="close" size={18} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        <ScrollView style={fs.scroll} showsVerticalScrollIndicator={false}>
          {/* Search */}
          <Text style={fs.label}>Search</Text>
          <View style={fs.inputWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
            <TextInput style={fs.input} placeholder="Name, email, phone..." placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery} />
            {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><MaterialCommunityIcons name="close-circle" size={16} color="#94a3b8" /></TouchableOpacity> : null}
          </View>

          {/* Status Filter */}
          <Text style={fs.label}>Lead Status</Text>
          <View style={fs.chipRow}>
            <TouchableOpacity onPress={() => setStatusFilter('all')} style={[fs.chip, statusFilter === 'all' && { backgroundColor: PRIMARY }]}>
              <Text style={[fs.chipText, statusFilter === 'all' && { color: '#fff' }]}>All</Text>
            </TouchableOpacity>
            {LEAD_STATUS_OPTIONS.map(s => (
              <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[fs.chip, statusFilter === s && { backgroundColor: PRIMARY }]}>
                <Text style={[fs.chipText, statusFilter === s && { color: '#fff' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort */}
          <Text style={fs.label}>Sort By</Text>
          <View style={fs.chipRow}>
            {[
              { value: '-createdAt', label: 'Newest' },
              { value: 'createdAt',  label: 'Oldest' },
              { value: 'firstName',  label: 'A → Z'  },
              { value: '-firstName', label: 'Z → A'  },
            ].map(opt => (
              <TouchableOpacity key={opt.value} onPress={() => setSortBy(opt.value)} style={[fs.chip, sortBy === opt.value && { backgroundColor: PRIMARY }]}>
                <Text style={[fs.chipText, sortBy === opt.value && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={fs.actions}>
          <TouchableOpacity style={fs.clearBtn} onPress={() => { onClear(); onClose(); }}>
            <Text style={fs.clearText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fs.applyBtn} onPress={onClose}>
            <Text style={fs.applyText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};
const fs = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 28 },
  handle:   { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  title:    { fontSize: 17, fontWeight: '700', color: PRIMARY },
  sub:      { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: alpha(PRIMARY, 0.1), alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: 20 },
  label:    { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  inputWrap:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  input:    { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: alpha(PRIMARY, 0.3) },
  chipText: { fontSize: 12, color: PRIMARY, fontWeight: '500' },
  actions:  { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  clearBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, alignItems: 'center' },
  clearText:{ color: PRIMARY, fontWeight: '600', fontSize: 14 },
  applyBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  applyText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   VIEW LEAD MODAL
───────────────────────────────────────────────────────────── */
const ViewLeadModal = ({ visible, onClose, lead, userRole }: any) => {
  const { fetchAPI } = useAuth();
  const [details, setDetails]   = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [tab,     setTab]       = useState(0);

  const tabs = ['Basic', 'Visit', 'Documents', 'Timeline'];

  useEffect(() => {
    if (visible && lead?._id) { fetchDetails(); }
    else { setDetails(null); setError(null); setTab(0); }
  }, [visible, lead]);

  const fetchDetails = async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetchAPI(`/lead/getLeadById/${lead._id}`);
      if (res.success) setDetails(res.result);
      else throw new Error(res.message || 'Failed to fetch');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={[vm.header, { backgroundColor: PRIMARY }]}>
          <Avatar label={initials(lead?.firstName, lead?.lastName)} color="rgba(255,255,255,0.25)" size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={vm.headerName}>{lead?.firstName} {lead?.lastName}</Text>
            <Text style={vm.headerSub}>{lead?.email || 'No email'} · ID: {lead?._id?.slice(-8)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={vm.closeBtn}>
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Status strip */}
        <View style={vm.strip}>
          <StatusBadge status={lead?.status || 'New'} />
          {lead?.assignedUser && (
            <Text style={vm.assignedText}>
              Assigned to {lead.assignedUser.firstName}
            </Text>
          )}
          <Text style={vm.dateText}>Created {fmtDate(lead?.createdAt)}</Text>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={vm.tabBar} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {tabs.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setTab(i)}
              style={[vm.tab, tab === i && vm.tabActive]}>
              <Text style={[vm.tabText, tab === i && vm.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={vm.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={vm.loadingText}>Loading details...</Text>
          </View>
        ) : error ? (
          <View style={vm.center}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#f44336" />
            <Text style={vm.errorText}>{error}</Text>
            <TouchableOpacity style={vm.retryBtn} onPress={fetchDetails}>
              <Text style={vm.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : details ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {tab === 0 && (
              <View>
                <View style={vm.section}>
                  <Text style={vm.sectionTitle}>Personal Information</Text>
                  {[
                    { icon: 'account', label: 'Full Name',    value: `${details.firstName} ${details.lastName}` },
                    { icon: 'email',   label: 'Email',        value: details.email || 'Not set' },
                    { icon: 'phone',   label: 'Phone',        value: details.phone || 'Not set' },
                    { icon: 'home',    label: 'Address',      value: details.address || 'Not set' },
                    { icon: 'map-marker', label: 'City',      value: details.city || 'Not set' },
                    { icon: 'solar-power', label: 'Solar Req', value: details.solarRequirement || 'Not set' },
                  ].map(row => (
                    <View key={row.label} style={vm.infoRow}>
                      <MaterialCommunityIcons name={row.icon} size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={vm.infoLabel}>{row.label}</Text>
                        <Text style={vm.infoValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={vm.section}>
                  <Text style={vm.sectionTitle}>Assignment & Status</Text>
                  <View style={vm.infoRow}>
                    <MaterialCommunityIcons name="label" size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={vm.infoLabel}>Status</Text>
                      <StatusBadge status={details.status} />
                    </View>
                  </View>
                  {details.assignedUser && (
                    <View style={vm.infoRow}>
                      <MaterialCommunityIcons name="account-check" size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={vm.infoLabel}>Assigned To</Text>
                        <Text style={vm.infoValue}>{details.assignedUser.firstName} {details.assignedUser.lastName}</Text>
                        <View style={vm.roleBadge}><Text style={vm.roleBadgeText}>{details.assignedUser.role}</Text></View>
                      </View>
                    </View>
                  )}
                  {details.createdBy && (
                    <View style={vm.infoRow}>
                      <MaterialCommunityIcons name="account-plus" size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={vm.infoLabel}>Created By</Text>
                        <Text style={vm.infoValue}>{details.createdBy.firstName} {details.createdBy.lastName}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {details.notes ? (
                  <View style={vm.section}>
                    <Text style={vm.sectionTitle}>Notes</Text>
                    <View style={vm.noteBox}>
                      <Text style={vm.noteText}>{details.notes}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )}

            {tab === 1 && (
              <View style={vm.section}>
                <Text style={vm.sectionTitle}>Visit Information</Text>
                {[
                  { icon: 'check-circle', label: 'Visit Status',   value: details.visitStatus || 'Not Scheduled' },
                  { icon: 'calendar',     label: 'Visit Date',     value: fmtDate(details.visitDate) },
                  { icon: 'clock',        label: 'Visit Time',     value: details.visitTime || 'Not set' },
                  { icon: 'map-marker',   label: 'Location',       value: details.visitLocation || 'Not set' },
                  { icon: 'note',         label: 'Visit Notes',    value: details.visitNotes || 'No notes' },
                ].map(row => (
                  <View key={row.label} style={vm.infoRow}>
                    <MaterialCommunityIcons name={row.icon} size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={vm.infoLabel}>{row.label}</Text>
                      <Text style={vm.infoValue}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {tab === 2 && (
              <View style={vm.section}>
                <Text style={vm.sectionTitle}>Documents</Text>
                {details.aadhaar?.url ? (
                  <View style={vm.docCard}>
                    <MaterialCommunityIcons name="card-account-details" size={22} color="#f57c00" />
                    <Text style={vm.docTitle}>Aadhaar Card</Text>
                    <Text style={vm.docAvail}>Available</Text>
                  </View>
                ) : null}
                {details.panCard?.url ? (
                  <View style={vm.docCard}>
                    <MaterialCommunityIcons name="credit-card" size={22} color={PRIMARY} />
                    <Text style={vm.docTitle}>PAN Card</Text>
                    <Text style={vm.docAvail}>Available</Text>
                  </View>
                ) : null}
                {details.passbook?.url ? (
                  <View style={vm.docCard}>
                    <MaterialCommunityIcons name="book-open" size={22} color="#388e3c" />
                    <Text style={vm.docTitle}>Bank Passbook</Text>
                    <Text style={vm.docAvail}>Available</Text>
                  </View>
                ) : null}
                {!details.aadhaar?.url && !details.panCard?.url && !details.passbook?.url && (
                  <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No documents available</Text>
                )}
                <View style={vm.infoRow}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={vm.infoLabel}>Document Status</Text>
                    <Text style={vm.infoValue}>{details.documentStatus || 'Pending'}</Text>
                  </View>
                </View>
                <View style={vm.infoRow}>
                  <MaterialCommunityIcons name="calendar" size={18} color={alpha(PRIMARY, 0.6)} style={{ width: 26 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={vm.infoLabel}>Submission Date</Text>
                    <Text style={vm.infoValue}>{fmtDate(details.documentSubmissionDate)}</Text>
                  </View>
                </View>
              </View>
            )}

            {tab === 3 && (
              <View style={vm.section}>
                <Text style={vm.sectionTitle}>Timeline ({details.stageTimeline?.length || 0} updates)</Text>
                {details.stageTimeline?.length > 0 ? (
                  [...details.stageTimeline].reverse().map((tl: any, i: number) => {
                    const cfg = getStatusCfg(tl.stage);
                    return (
                      <View key={i} style={vm.tlItem}>
                        <View style={[vm.tlDot, { backgroundColor: cfg.bg }]}>
                          <MaterialCommunityIcons name={cfg.icon} size={16} color={cfg.color} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={vm.tlStage}>{tl.stage}</Text>
                            <Text style={vm.tlDate}>{fmtDate(tl.updatedAt)}</Text>
                          </View>
                          {tl.notes ? <Text style={vm.tlNotes}>{tl.notes}</Text> : null}
                          <Text style={vm.tlBy}>By: {tl.updatedBy?.firstName || 'System'} ({tl.updatedRole})</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No timeline data</Text>
                )}
              </View>
            )}
          </ScrollView>
        ) : null}

        {/* Footer */}
        <View style={vm.footer}>
          <TouchableOpacity style={vm.footerClose} onPress={onClose}>
            <Text style={vm.footerCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const vm = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: PRIMARY },
  headerName:      { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:       { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  strip:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fafbff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexWrap: 'wrap', gap: 8 },
  assignedText:    { fontSize: 12, color: '#64748b' },
  dateText:        { fontSize: 11, color: '#94a3b8', marginLeft: 'auto' },
  tabBar:          { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', maxHeight: 52 },
  tab:             { paddingHorizontal: 16, paddingVertical: 14 },
  tabActive:       { borderBottomWidth: 3, borderBottomColor: PRIMARY },
  tabText:         { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextActive:   { color: PRIMARY },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:     { color: '#64748b', fontSize: 14 },
  errorText:       { color: '#64748b', fontSize: 14, textAlign: 'center' },
  retryBtn:        { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText:       { color: '#fff', fontWeight: '700' },
  section:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: alpha(PRIMARY, 0.08) },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: PRIMARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  infoLabel:       { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  infoValue:       { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  roleBadge:       { backgroundColor: alpha(PRIMARY, 0.08), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  roleBadgeText:   { fontSize: 10, color: PRIMARY, fontWeight: '700' },
  noteBox:         { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 },
  noteText:        { fontSize: 13, color: '#334155', lineHeight: 20 },
  docCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  docTitle:        { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  docAvail:        { fontSize: 11, color: '#4caf50', fontWeight: '600' },
  tlItem:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tlDot:           { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tlStage:         { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  tlDate:          { fontSize: 11, color: '#94a3b8' },
  tlNotes:         { fontSize: 12, color: '#64748b', marginTop: 4 },
  tlBy:            { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  footer:          { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerClose:     { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  footerCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   EDIT LEAD MODAL
───────────────────────────────────────────────────────────── */
const EditLeadModal = ({ visible, onClose, lead, onSave, userRole }: any) => {
  const { fetchAPI } = useAuth();
  const [form,    setForm]    = useState({ firstName: '', lastName: '', email: '', phone: '', status: 'Visit' });
  const [errors,  setErrors]  = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({ firstName: lead.firstName || '', lastName: lead.lastName || '', email: lead.email || '', phone: lead.phone || '', status: lead.status || 'Visit' });
      setErrors({});
    }
  }, [lead]);

  const validate = () => {
    const e: any = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim())  e.lastName  = 'Last name is required';
    if (!form.email.trim())     e.email     = 'Email is required';
    if (!form.phone.trim())     e.phone     = 'Phone is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetchAPI(`/lead/updateLead/${lead._id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (res.success) { onSave(res.result); onClose(); }
      else throw new Error(res.message || 'Failed to update');
    } catch (e: any) {
      setErrors({ submit: e.message });
    } finally { setLoading(false); }
  };

  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.TEAM;

  if (!permissions.edit) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={[em.root, { alignItems: 'center', justifyContent: 'center' }]}>
          <MaterialCommunityIcons name="shield-alert" size={48} color="#f44336" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#f44336', marginTop: 12 }}>Access Denied</Text>
          <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 8 }}>You do not have permission to edit leads.</Text>
          <TouchableOpacity onPress={onClose} style={em.closeBtn}><Text style={em.closeBtnText}>Close</Text></TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={em.root}>
        {/* Header */}
        <View style={[em.header, { backgroundColor: PRIMARY }]}>
          <MaterialCommunityIcons name="pencil" size={22} color="#fff" />
          <Text style={em.headerTitle}>Edit Lead</Text>
          <TouchableOpacity onPress={onClose} style={em.headerClose}>
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {loading && <View style={em.progress}><View style={[em.progressBar, { width: '60%' }]} /></View>}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {errors.submit ? (
            <View style={em.errorAlert}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#c62828" />
              <Text style={em.errorAlertText}>{errors.submit}</Text>
            </View>
          ) : null}

          {[
            { key: 'firstName', label: 'First Name *', placeholder: 'John',            icon: 'account'       },
            { key: 'lastName',  label: 'Last Name *',  placeholder: 'Doe',             icon: 'account'       },
            { key: 'email',     label: 'Email *',      placeholder: 'john@email.com',  icon: 'email-outline' },
            { key: 'phone',     label: 'Phone *',      placeholder: '9876543210',      icon: 'phone'         },
          ].map(f => (
            <View key={f.key} style={em.field}>
              <Text style={em.fieldLabel}>{f.label}</Text>
              <View style={[em.inputWrap, errors[f.key] && em.inputError]}>
                <MaterialCommunityIcons name={f.icon} size={18} color={errors[f.key] ? '#f44336' : alpha(PRIMARY, 0.6)} />
                <TextInput
                  style={em.input}
                  placeholder={f.placeholder}
                  placeholderTextColor="#94a3b8"
                  value={form[f.key as keyof typeof form]}
                  onChangeText={v => { setForm(p => ({ ...p, [f.key]: v })); if (errors[f.key]) setErrors((p: any) => ({ ...p, [f.key]: '' })); }}
                  keyboardType={f.key === 'phone' ? 'phone-pad' : f.key === 'email' ? 'email-address' : 'default'}
                  autoCapitalize={f.key === 'email' || f.key === 'phone' ? 'none' : 'words'}
                />
              </View>
              {errors[f.key] ? <Text style={em.fieldError}>{errors[f.key]}</Text> : null}
            </View>
          ))}

          {/* Status Picker */}
          <View style={em.field}>
            <Text style={em.fieldLabel}>Status *</Text>
            <TouchableOpacity style={em.inputWrap} onPress={() => setShowStatusPicker(!showStatusPicker)}>
              <MaterialCommunityIcons name={getStatusCfg(form.status).icon} size={18} color={getStatusCfg(form.status).color} />
              <Text style={[em.input, { color: '#1e293b' }]}>{form.status}</Text>
              <MaterialCommunityIcons name={showStatusPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
            </TouchableOpacity>
            {showStatusPicker && (
              <View style={em.picker}>
                {LEAD_STATUS_OPTIONS.map(s => {
                  const cfg = getStatusCfg(s);
                  return (
                    <TouchableOpacity key={s} style={[em.pickerItem, form.status === s && em.pickerItemActive]}
                      onPress={() => { setForm(p => ({ ...p, status: s })); setShowStatusPicker(false); }}>
                      <MaterialCommunityIcons name={cfg.icon} size={16} color={form.status === s ? '#fff' : cfg.color} />
                      <Text style={[em.pickerText, form.status === s && em.pickerTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={em.footer}>
          <TouchableOpacity style={em.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={em.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[em.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <><MaterialCommunityIcons name="content-save" size={18} color="#fff" /><Text style={em.saveText}>Save Changes</Text></>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const em = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#fafbff' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerTitle:    { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' },
  headerClose:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  progress:       { height: 3, backgroundColor: alpha(PRIMARY, 0.15) },
  progressBar:    { height: '100%', backgroundColor: PRIMARY },
  errorAlert:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffebee', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ffcdd2' },
  errorAlertText: { flex: 1, fontSize: 13, color: '#c62828' },
  field:          { marginBottom: 16 },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafd', borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  inputError:     { borderColor: '#f44336', backgroundColor: '#fff5f5' },
  input:          { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  fieldError:     { fontSize: 11, color: '#f44336', marginTop: 4 },
  picker:         { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, overflow: 'hidden' },
  pickerItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemActive:{ backgroundColor: PRIMARY },
  pickerText:     { fontSize: 13, color: '#334155' },
  pickerTextActive:{ color: '#fff', fontWeight: '700' },
  footer:         { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff' },
  cancelBtn:      { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, alignItems: 'center' },
  cancelText:     { color: PRIMARY, fontWeight: '600', fontSize: 14 },
  saveBtn:        { flex: 2, flexDirection: 'row', gap: 6, backgroundColor: PRIMARY, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  closeBtn:       { marginTop: 20, backgroundColor: PRIMARY, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10 },
  closeBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   ASSIGN LEAD MODAL
───────────────────────────────────────────────────────────── */
const AssignLeadModal = ({ visible, onClose, lead, onAssign, userRole, showToast }: any) => {
  const { fetchAPI, user } = useAuth();
  const [users,         setUsers]         = useState<any[]>([]);
  const [selectedId,    setSelectedId]    = useState('');
  const [assignToRole,  setAssignToRole]  = useState('');
  const [loading,       setLoading]       = useState(false);
  const [fetching,      setFetching]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const permissions   = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.TEAM;
  const canAssign     = permissions.assign;
  const availRoles    = permissions.canAssignTo as string[];

  useEffect(() => {
    if (visible && canAssign) {
      setSelectedId(''); setError(null);
      if (availRoles.length === 1) { setAssignToRole(availRoles[0]); fetchUsers(availRoles[0]); }
      else { setAssignToRole(''); setUsers([]); }
    }
  }, [visible]);

  const fetchUsers = async (role: string) => {
    try {
      setFetching(true); setError(null);
      let endpoint = '';
      if ((userRole === 'Head_office' || userRole === 'ZSM') && role === 'ASM') endpoint = '/user/managerList?page=1&limit=100';
      else if ((userRole === 'Head_office' || userRole === 'ZSM') && role === 'TEAM') endpoint = '/user/getManagerUnderUserList?page=1&limit=100';
      else if (userRole === 'ASM' && role === 'TEAM') endpoint = `/user/getManagerUnderUserList?page=1&limit=100&supervisorId=${user._id}`;
      if (!endpoint) { setError('No users available for this assignment'); return; }
      const res = await fetchAPI(endpoint);
      if (res?.success) {
        const all = res.result?.users || (Array.isArray(res.result) ? res.result : []);
        const filtered = all.filter((u: any) => u.role === role && u.status === 'active');
        setUsers(filtered);
        if (filtered.length === 0) setError(`No active ${role} users available`);
      } else setError(res?.message || 'Failed to load users');
    } catch (e: any) { setError(e.message); }
    finally { setFetching(false); }
  };

  const handleRoleSelect = (role: string) => {
    setAssignToRole(role); setSelectedId(''); setUsers([]); fetchUsers(role);
  };

  const handleSubmit = async () => {
    if (!selectedId || !assignToRole) { setError('Please select a user'); return; }
    setLoading(true);
    try {
      const body: any = { leadId: lead._id, targetId: selectedId, targetRole: assignToRole };
      if (assignToRole === 'ASM') body.managerId = selectedId;
      else body.userId = selectedId;
      const res = await fetchAPI('/lead/assign', { method: 'POST', body: JSON.stringify(body) });
      if (res.success) { onAssign(res.result); onClose(); showToast?.('Lead assigned successfully', 'success'); }
      else throw new Error(res.message || 'Failed to assign');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!visible) return null;

  const selectedUser = users.find(u => u._id === selectedId);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={am.root}>
        {/* Header */}
        <View style={[am.header, { backgroundColor: '#00838f' }]}>
          <MaterialCommunityIcons name="account-arrow-right" size={22} color="#fff" />
          <Text style={am.headerTitle}>Assign Lead</Text>
          <TouchableOpacity onPress={onClose} style={am.headerClose}>
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {/* Lead preview */}
          {lead && (
            <View style={am.leadCard}>
              <Avatar label={initials(lead.firstName, lead.lastName)} color="#00838f" size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={am.leadName}>{lead.firstName} {lead.lastName}</Text>
                <Text style={am.leadEmail}>{lead.email} · {lead.phone}</Text>
                <StatusBadge status={lead.status} />
              </View>
            </View>
          )}

          {error && !fetching ? (
            <View style={am.errorBox}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#c62828" />
              <Text style={am.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => fetchUsers(assignToRole)} style={am.retryBtn}>
                <Text style={am.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Role Selection (if multiple roles available) */}
          {availRoles.length > 1 && (
            <View style={am.section}>
              <Text style={am.sectionLabel}>Assign To Role</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {availRoles.map(role => (
                  <TouchableOpacity key={role} style={[am.roleCard, assignToRole === role && am.roleCardActive]} onPress={() => handleRoleSelect(role)}>
                    <MaterialCommunityIcons name={role === 'ASM' ? 'account-supervisor' : 'account-group'} size={22} color={assignToRole === role ? '#fff' : '#00838f'} />
                    <Text style={[am.roleCardText, assignToRole === role && am.roleCardTextActive]}>{role === 'ASM' ? 'ASM' : 'Team'}</Text>
                    {users.length > 0 && assignToRole === role && <Text style={[am.roleCardSub, { color: assignToRole === role ? 'rgba(255,255,255,0.8)' : '#94a3b8' }]}>{users.length} available</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* User List */}
          {assignToRole ? (
            <View style={am.section}>
              <Text style={am.sectionLabel}>Select {assignToRole === 'TEAM' ? 'Team Member' : 'ASM'}</Text>
              {fetching ? (
                <View style={am.fetchingWrap}>
                  <ActivityIndicator size="small" color="#00838f" />
                  <Text style={am.fetchingText}>Loading users...</Text>
                </View>
              ) : users.length === 0 ? (
                <View style={am.emptyUsers}>
                  <MaterialCommunityIcons name="account-group" size={36} color={alpha('#00bcd4', 0.4)} />
                  <Text style={am.emptyText}>No users available</Text>
                </View>
              ) : (
                users.map((u: any) => (
                  <TouchableOpacity key={u._id} style={[am.userCard, selectedId === u._id && am.userCardActive]} onPress={() => setSelectedId(u._id)}>
                    <Avatar label={initials(u.firstName, u.lastName)} color="#00838f" size={38} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[am.userName, selectedId === u._id && { color: '#fff' }]}>{u.firstName} {u.lastName}</Text>
                      <Text style={[am.userEmail, selectedId === u._id && { color: 'rgba(255,255,255,0.7)' }]}>{u.email}</Text>
                    </View>
                    <View style={[am.radioCircle, selectedId === u._id && am.radioCircleActive]}>
                      {selectedId === u._id && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : null}

          {/* Confirm note */}
          {selectedId && assignToRole && selectedUser && (
            <View style={am.confirmBox}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#00838f" />
              <Text style={am.confirmText}>
                This lead will be assigned to <Text style={{ fontWeight: '700' }}>{selectedUser.firstName} {selectedUser.lastName}</Text> ({assignToRole})
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={am.footer}>
          <TouchableOpacity style={am.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={am.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[am.assignBtn, (!selectedId || !assignToRole || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!selectedId || !assignToRole || loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <><MaterialCommunityIcons name="account-arrow-right" size={18} color="#fff" /><Text style={am.assignText}>Assign Lead</Text></>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const am = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#f5fdfe' },
  header:            { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerTitle:       { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' },
  headerClose:       { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  leadCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: alpha('#00bcd4', 0.2) },
  leadName:          { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  leadEmail:         { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  errorBox:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffebee', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText:         { flex: 1, fontSize: 12, color: '#c62828' },
  retryBtn:          { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#c62828', borderRadius: 6 },
  retryText:         { fontSize: 11, color: '#fff', fontWeight: '600' },
  section:           { marginBottom: 16 },
  sectionLabel:      { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  roleCard:          { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: alpha('#00bcd4', 0.2), backgroundColor: '#fff', alignItems: 'center', gap: 4 },
  roleCardActive:    { borderColor: '#00bcd4', backgroundColor: '#00838f' },
  roleCardText:      { fontSize: 14, fontWeight: '700', color: '#00838f' },
  roleCardTextActive:{ color: '#fff' },
  roleCardSub:       { fontSize: 10 },
  fetchingWrap:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  fetchingText:      { color: '#64748b', fontSize: 14 },
  emptyUsers:        { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText:         { color: '#94a3b8', fontSize: 14 },
  userCard:          { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: alpha('#00bcd4', 0.15), backgroundColor: '#fff', marginBottom: 8 },
  userCardActive:    { borderColor: '#00bcd4', backgroundColor: '#00838f' },
  userName:          { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  userEmail:         { fontSize: 11, color: '#94a3b8' },
  radioCircle:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: alpha('#00bcd4', 0.3), alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { backgroundColor: '#00bcd4', borderColor: '#00bcd4' },
  confirmBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: alpha('#00bcd4', 0.06), borderRadius: 10, padding: 12, borderWidth: 1, borderColor: alpha('#00bcd4', 0.2) },
  confirmText:       { flex: 1, fontSize: 12, color: '#00838f' },
  footer:            { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: alpha('#00bcd4', 0.12), backgroundColor: '#fff' },
  cancelBtn:         { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#00838f', alignItems: 'center' },
  cancelText:        { color: '#00838f', fontWeight: '600', fontSize: 14 },
  assignBtn:         { flex: 2, flexDirection: 'row', gap: 6, backgroundColor: '#00838f', paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  assignText:        { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   LEAD CARD (Mobile)
───────────────────────────────────────────────────────────── */
const LeadCard = ({ lead, onView, onEdit, onAssign, onDelete, permissions }: any) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = getStatusCfg(lead.status);

  const handleDelete = () => {
    Alert.alert(
      'Delete Lead',
      `Are you sure you want to delete ${lead.firstName} ${lead.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(lead._id) },
      ],
    );
  };

  return (
    <View style={[lc.wrap, { borderColor: alpha(cfg.color, 0.15) }]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={lc.header}>
          <Avatar label={initials(lead.firstName, lead.lastName)} color={PRIMARY} size={46} />
          <View style={lc.headerInfo}>
            <Text style={[lc.name, { color: PRIMARY }]}>{lead.firstName} {lead.lastName}</Text>
            <Text style={lc.idText}>ID: {lead._id?.slice(-8) || 'N/A'}</Text>
          </View>
          <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#94a3b8" />
        </View>

        <View style={lc.metaRow}>
          <View style={lc.metaItem}>
            <MaterialCommunityIcons name="phone" size={13} color={alpha(PRIMARY, 0.6)} />
            <Text style={lc.metaText} numberOfLines={1}>{lead.phone || 'No phone'}</Text>
          </View>
          <View style={lc.metaItem}>
            <MaterialCommunityIcons name="email" size={13} color={alpha(PRIMARY, 0.6)} />
            <Text style={lc.metaText} numberOfLines={1}>{lead.email || 'No email'}</Text>
          </View>
        </View>

        <View style={lc.bottomRow}>
          <View style={lc.dateWrap}>
            <MaterialCommunityIcons name="calendar" size={13} color="#94a3b8" />
            <Text style={lc.dateText}>{fmtDate(lead.createdAt)}</Text>
          </View>
          <StatusBadge status={lead.status} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[lc.expanded, { borderTopColor: alpha(PRIMARY, 0.1) }]}>
          {lead.assignedUser || lead.assignedManager ? (
            <View style={lc.assignedWrap}>
              <Text style={lc.assignedLabel}>Assigned To</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Avatar label={initials(lead.assignedUser?.firstName || lead.assignedManager?.firstName)} color={PRIMARY} size={26} />
                <Text style={lc.assignedName}>{lead.assignedUser?.firstName || lead.assignedManager?.firstName}</Text>
                <View style={lc.roleBadge}><Text style={lc.roleBadgeText}>{lead.assignedUser?.role || lead.assignedManager?.role}</Text></View>
              </View>
            </View>
          ) : null}

          <View style={lc.actionRow}>
            <TouchableOpacity style={[lc.actionBtn, { backgroundColor: PRIMARY }]} onPress={() => onView(lead)}>
              <MaterialCommunityIcons name="eye-outline" size={16} color="#fff" />
            </TouchableOpacity>
            {permissions.edit && (
              <TouchableOpacity style={[lc.actionBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: alpha(PRIMARY, 0.3) }]} onPress={() => onEdit(lead)}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={PRIMARY} />
              </TouchableOpacity>
            )}
            {permissions.assign && (
              <TouchableOpacity style={[lc.actionBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: alpha('#00bcd4', 0.3) }]} onPress={() => onAssign(lead)}>
                <MaterialCommunityIcons name="account-arrow-right" size={16} color="#00838f" />
              </TouchableOpacity>
            )}
            {permissions.delete && (
              <TouchableOpacity style={[lc.actionBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: alpha('#f44336', 0.3) }]} onPress={handleDelete}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color="#f44336" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};
const lc = StyleSheet.create({
  wrap:         { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  header:       { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 8 },
  headerInfo:   { flex: 1, marginLeft: 12 },
  name:         { fontSize: 15, fontWeight: '700' },
  idText:       { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  metaRow:      { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 8, gap: 16 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText:     { fontSize: 11, color: '#64748b', flex: 1 },
  bottomRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  dateWrap:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText:     { fontSize: 11, color: '#64748b' },
  expanded:     { padding: 14, borderTopWidth: 1 },
  assignedWrap: { marginBottom: 12 },
  assignedLabel:{ fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  assignedName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  roleBadge:    { backgroundColor: alpha(PRIMARY, 0.08), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeText:{ fontSize: 10, color: PRIMARY, fontWeight: '700' },
  actionRow:    { flexDirection: 'row', gap: 10 },
  actionBtn:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10 },
});

/* ─────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────── */
const Toast = ({ visible, message, type }: { visible: boolean; message: string; type: 'success' | 'error' }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [visible]);
  const bg = type === 'success' ? '#4caf50' : '#f44336';
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  return (
    <Animated.View style={[toast.wrap, { backgroundColor: bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <MaterialCommunityIcons name={icon} size={18} color="#fff" />
      <Text style={toast.text}>{message}</Text>
    </Animated.View>
  );
};
const toast = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 90, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
});

/* ─────────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────────── */
interface Props {
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
  onAddLead?:      () => void;
}

export default function AllLeadsScreen({ onMenuPress, onSearchPress, onProfilePress, onAddLead }: Props) {
  const { fetchAPI, user } = useAuth();

  const [leads,        setLeads]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [totalLeads,   setTotalLeads]   = useState(0);
  const PAGE_SIZE = 10;

  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,       setSortBy]       = useState('-createdAt');
  const [filterOpen,   setFilterOpen]   = useState(false);

  const [viewOpen,     setViewOpen]     = useState(false);
  const [editOpen,     setEditOpen]     = useState(false);
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [activeLead,   setActiveLead]   = useState<any>(null);

  const [toastMsg,     setToastMsg]     = useState('');
  const [toastType,    setToastType]    = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 500);

  const userRole   = user?.role || 'TEAM';
  const perms      = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.TEAM;

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchTerm) c++;
    if (statusFilter !== 'all') c++;
    if (sortBy !== '-createdAt') c++;
    return c;
  }, [searchTerm, statusFilter, sortBy]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  /* ── Fetch leads ─────────────────────────────────────────── */
  const fetchLeads = useCallback(async (isRefresh = false, pg = 1) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const params = new URLSearchParams({
        page:      pg.toString(),
        limit:     PAGE_SIZE.toString(),
        sortBy:    sortBy.replace('-', ''),
        sortOrder: sortBy.startsWith('-') ? 'desc' : 'asc',
      });
      if (debouncedSearch)         params.append('search', debouncedSearch);
      if (statusFilter !== 'all')  params.append('status', statusFilter);
      const data = await fetchAPI(`/lead/getAll?${params.toString()}`);
      if (data.success) {
        const newLeads = data.result.leads || [];
        setLeads(pg === 1 ? newLeads : prev => [...prev, ...newLeads]);
        setTotalLeads(data.result.pagination?.total || 0);
      } else showToast(data.message || 'Failed to fetch leads', 'error');
    } catch (e: any) {
      showToast(e.message || 'Failed to fetch leads', 'error');
    } finally { setLoading(false); setRefreshing(false); }
  }, [fetchAPI, debouncedSearch, statusFilter, sortBy, showToast]);

  useEffect(() => { setPage(1); fetchLeads(false, 1); }, [debouncedSearch, statusFilter, sortBy]);

  const loadMore = () => {
    if (leads.length < totalLeads && !loading) {
      const next = page + 1;
      setPage(next);
      fetchLeads(false, next);
    }
  };

  /* ── Handlers ────────────────────────────────────────────── */
  const handleDeleteLead = useCallback(async (leadId: string) => {
    try {
      const res = await fetchAPI(`/lead/deleteLead/${leadId}`, { method: 'DELETE' });
      if (res.success) { showToast('Lead deleted successfully', 'success'); fetchLeads(false, 1); setPage(1); }
      else throw new Error(res.message || 'Failed to delete');
    } catch (e: any) { showToast(e.message || 'Failed to delete lead', 'error'); }
  }, [fetchAPI, fetchLeads, showToast]);

  const handleSaveLead   = useCallback(() => { showToast('Lead updated successfully', 'success'); fetchLeads(false, 1); setPage(1); }, [fetchLeads, showToast]);
  const handleAssignLead = useCallback(() => { fetchLeads(false, 1); setPage(1); }, [fetchLeads]);

  const handleClearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setSortBy('-createdAt'); };

  /* ── Empty state ─────────────────────────────────────────── */
  const renderEmpty = () => (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <MaterialCommunityIcons name={activeFilterCount > 0 ? 'magnify-remove-outline' : 'account-group-outline'} size={52} color={PRIMARY} />
      </View>
      <Text style={s.emptyTitle}>{activeFilterCount > 0 ? 'No matching leads found' : 'No leads yet'}</Text>
      <Text style={s.emptySub}>{activeFilterCount > 0 ? 'Try adjusting your filters' : 'Get started by adding your first lead'}</Text>
      {activeFilterCount > 0 && (
        <TouchableOpacity style={s.clearFiltersBtn} onPress={handleClearFilters}>
          <Text style={s.clearFiltersBtnText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  /* ── Footer loader (pagination) ──────────────────────────── */
  const renderFooter = () => {
    if (leads.length >= totalLeads || leads.length === 0) return null;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={PRIMARY} />
        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Loading more...</Text>
      </View>
    );
  };

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onMenuPress} style={s.topBarBtn}>
          <MaterialCommunityIcons name="menu" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarTitle}>Lead Management</Text>
          <Text style={s.topBarSub}>Total {totalLeads} leads · {perms.label}</Text>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity onPress={() => fetchLeads(true, 1)} style={s.topBarBtn}>
            <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onAddLead} style={[s.topBarBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search + Filter Row ── */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search leads..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={t => { setSearchTerm(t); setPage(1); }}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, activeFilterCount > 0 && { backgroundColor: PRIMARY }]}
          onPress={() => setFilterOpen(true)}>
          <MaterialCommunityIcons name="filter-variant" size={20} color={activeFilterCount > 0 ? '#fff' : PRIMARY} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Active filters strip ── */}
      {activeFilterCount > 0 && (
        <View style={s.activeFiltersStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            {searchTerm ? (
              <View style={s.filterChip}>
                <Text style={s.filterChipText}>Search: {searchTerm}</Text>
                <TouchableOpacity onPress={() => setSearchTerm('')}><MaterialCommunityIcons name="close" size={14} color={PRIMARY} /></TouchableOpacity>
              </View>
            ) : null}
            {statusFilter !== 'all' ? (
              <View style={s.filterChip}>
                <Text style={s.filterChipText}>{statusFilter}</Text>
                <TouchableOpacity onPress={() => setStatusFilter('all')}><MaterialCommunityIcons name="close" size={14} color={PRIMARY} /></TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={[s.filterChip, { borderStyle: 'dashed' }]} onPress={handleClearFilters}>
              <MaterialCommunityIcons name="close-circle-outline" size={14} color={PRIMARY} />
              <Text style={s.filterChipText}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* ── List ── */}
      {loading && page === 1 ? (
        <LoadingSkeleton />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLeads(true, 1)} colors={[PRIMARY]} />}
          ListHeaderComponent={
            <View style={s.listHeader}>
              <Text style={s.listHeaderText}>Lead Cards</Text>
              <View style={s.countBadge}><Text style={s.countBadgeText}>{totalLeads} total</Text></View>
            </View>
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <LeadCard
              lead={item}
              permissions={perms}
              onView={lead   => { setActiveLead(lead); setViewOpen(true);   }}
              onEdit={lead   => { setActiveLead(lead); setEditOpen(true);   }}
              onAssign={lead => { setActiveLead(lead); setAssignOpen(true); }}
              onDelete={handleDeleteLead}
            />
          )}
        />
      )}

      {/* ── Modals ── */}
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        searchQuery={searchTerm}
        setSearchQuery={setSearchTerm}
        onClear={handleClearFilters}
      />

      <ViewLeadModal
        visible={viewOpen}
        onClose={() => setViewOpen(false)}
        lead={activeLead}
        userRole={userRole}
      />

      <EditLeadModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        lead={activeLead}
        onSave={handleSaveLead}
        userRole={userRole}
      />

      <AssignLeadModal
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        lead={activeLead}
        onAssign={handleAssignLead}
        userRole={userRole}
        showToast={showToast}
      />

      {/* ── Toast ── */}
      <Toast visible={toastVisible} message={toastMsg} type={toastType} />
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: BG },

  // Top bar
  topBar:             { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 12, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12 },
  topBarBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topBarCenter:       { flex: 1, paddingHorizontal: 12 },
  topBarTitle:        { fontSize: 16, fontWeight: '800', color: '#fff' },
  topBarSub:          { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  topBarRight:        { flexDirection: 'row', gap: 6 },

  // Search row
  searchRow:          { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBox:          { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6, gap: 8 },
  searchInput:        { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  filterBtn:          { width: 46, height: 46, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(PRIMARY, 0.3) },
  filterBadge:        { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#f44336', alignItems: 'center', justifyContent: 'center' },
  filterBadgeText:    { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Active filters
  activeFiltersStrip: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: alpha(PRIMARY, 0.06), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: alpha(PRIMARY, 0.2) },
  filterChipText:     { fontSize: 11, color: PRIMARY, fontWeight: '500' },

  // List header
  listHeader:         { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  listHeaderText:     { fontSize: 16, fontWeight: '800', color: '#1a1a3e' },
  countBadge:         { backgroundColor: alpha(PRIMARY, 0.08), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:     { fontSize: 12, color: PRIMARY, fontWeight: '600' },

  // Empty state
  emptyWrap:          { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon:          { width: 110, height: 110, borderRadius: 55, backgroundColor: alpha(PRIMARY, 0.08), alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:         { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  emptySub:           { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  clearFiltersBtn:    { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  clearFiltersBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});