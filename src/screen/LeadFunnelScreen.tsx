// src/screen/LeadFunnelScreen.tsx
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
  FlatList,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
  RefreshControl,
 
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY   = '#4569ea';
const SECONDARY = '#1a237e';
const BG        = '#f8fafc';

/* ─────────────────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────────────────── */
const PERIOD_OPTIONS = [
  { value: 'Today',      label: 'Today'      },
  { value: 'This Week',  label: 'This Week'  },
  { value: 'This Month', label: 'This Month' },
  { value: 'All',        label: 'All Time'   },
];

const STAGE_CONFIG: Record<string, { color: string; icon: string; description: string; order: number }> = {
  'Visit':                 { color: PRIMARY, icon: 'account',               description: 'Initial contact and site visit scheduled', order: 1 },
  'Registration':          { color: PRIMARY, icon: 'clipboard-account',     description: 'Customer registration completed',          order: 2 },
  'Bank Loan Apply':       { color: PRIMARY, icon: 'bank',                  description: 'Bank loan application submitted',          order: 3 },
  'Document Submission':   { color: PRIMARY, icon: 'file-document',         description: 'Required documents submitted',             order: 4 },
  'Disbursement':          { color: PRIMARY, icon: 'trending-up',           description: 'Loan disbursed to customer',               order: 5 },
  'Installation Completion':{ color: PRIMARY, icon: 'check-circle',         description: 'Solar installation completed',             order: 6 },
  'Missed Leads':          { color: '#f44336', icon: 'alert-circle',        description: 'Lost or inactive leads',                   order: 7 },
};

const STAGE_ORDER = Object.keys(STAGE_CONFIG);

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const alpha = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

const initials = (first?: string, last?: string) =>
  `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'L';

/* ─────────────────────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────────────────────── */
const Avatar = ({ label, color, size = 40 }: { label: string; color: string; size?: number }) => (
  <View style={[avatarS.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
    <Text style={[avatarS.text, { fontSize: size * 0.38 }]}>{label}</Text>
  </View>
);
const avatarS = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});

/* ─────────────────────────────────────────────────────────────
   SUMMARY CARD
───────────────────────────────────────────────────────────── */
const SummaryCard = ({ title, value, icon, color, trend }: any) => (
  <View style={[sc.card, { borderColor: alpha(color, 0.15) }]}>
    <View style={sc.row}>
      <View style={[sc.iconBox, { backgroundColor: alpha(color, 0.12) }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[sc.value, { color }]}>{value}</Text>
    </View>
    <Text style={sc.title}>{title}</Text>
    {trend && <Text style={sc.trend}>{trend}</Text>}
  </View>
);
const sc = StyleSheet.create({
  card:    { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, padding: 12, margin: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value:   { fontSize: 22, fontWeight: '800' },
  title:   { fontSize: 12, fontWeight: '600', color: '#334155' },
  trend:   { fontSize: 10, color: '#94a3b8', marginTop: 2 },
});

/* ─────────────────────────────────────────────────────────────
   STAGE ITEM (pipeline list)
───────────────────────────────────────────────────────────── */
const StageItem = ({ stage, config, isSelected, onPress, count, percentage }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={[
      si.wrap,
      { borderColor: isSelected ? config.color : 'transparent',backgroundColor: '#fff',},
    ]}
  >
    <View style={[si.iconCircle, { backgroundColor: config.color }]}>
      <MaterialCommunityIcons name={config.icon} size={18} color="#fff" />
    </View>
    <View style={si.info}>
      <Text style={si.name}>{stage}</Text>
      <Text style={si.sub}>{count} leads · {percentage}%</Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
  </TouchableOpacity>
);
const si = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 2, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  sub:        { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});

/* ─────────────────────────────────────────────────────────────
   MOBILE LEAD CARD
───────────────────────────────────────────────────────────── */
const LeadCard = ({ lead, stageColor, onView }: any) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[lc.wrap, { borderColor: alpha(stageColor, 0.15) }]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={lc.header}>
          <Avatar label={initials(lead.firstName, lead.lastName)} color={stageColor} size={44} />
          <View style={lc.headerInfo}>
            <Text style={[lc.name, { color: stageColor }]}>{lead.firstName} {lead.lastName}</Text>
            <Text style={lc.id}>ID: {lead._id?.slice(-8) || 'N/A'}</Text>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#94a3b8"
          />
        </View>

        <View style={lc.metaRow}>
          <View style={lc.metaItem}>
            <MaterialCommunityIcons name="phone" size={13} color={alpha(stageColor, 0.6)} />
            <Text style={lc.metaText} numberOfLines={1}>{lead.phone || 'No phone'}</Text>
          </View>
          <View style={lc.metaItem}>
            <MaterialCommunityIcons name="email" size={13} color={alpha(stageColor, 0.6)} />
            <Text style={lc.metaText} numberOfLines={1}>{lead.email || 'No email'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[lc.expanded, { borderTopColor: alpha(stageColor, 0.12) }]}>
          {lead.city ? (
            <View style={lc.expRow}>
              <Text style={lc.expLabel}>Location</Text>
              <Text style={lc.expValue}>{lead.city}</Text>
            </View>
          ) : null}
          <View style={lc.expRow}>
            <Text style={lc.expLabel}>Created</Text>
            <Text style={lc.expValue}>{fmtDate(lead.createdAt)}</Text>
          </View>
          <View style={lc.expRow}>
            <Text style={lc.expLabel}>Updated</Text>
            <Text style={lc.expValue}>{fmtDate(lead.updatedAt)}</Text>
          </View>
          <TouchableOpacity
            style={[lc.viewBtn, { backgroundColor: stageColor }]}
            onPress={() => onView(lead)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="eye" size={16} color="#fff" />
            <Text style={lc.viewBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
const lc = StyleSheet.create({
  wrap:        { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 8 },
  headerInfo:  { flex: 1, marginLeft: 12 },
  name:        { fontSize: 15, fontWeight: '700' },
  id:          { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  metaRow:     { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 12, gap: 16 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText:    { fontSize: 11, color: '#64748b' },
  expanded:    { padding: 14, borderTopWidth: 1, gap: 8 },
  expRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  expLabel:    { fontSize: 11, color: '#94a3b8' },
  expValue:    { fontSize: 12, fontWeight: '500', color: '#334155' },
  viewBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 8, marginTop: 6 },
  viewBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

/* ─────────────────────────────────────────────────────────────
   FILTER BOTTOM SHEET
───────────────────────────────────────────────────────────── */
const FilterSheet = ({
  visible, onClose, period, setPeriod,
  sortBy, setSortBy, searchQuery, setSearchQuery,
  onClear,
}: any) => {
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[fs.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={fs.handle} />

        {/* Header */}
        <View style={fs.sheetHeader}>
          <View>
            <Text style={fs.sheetTitle}>Filter Funnel</Text>
            <Text style={fs.sheetSub}>Refine lead results</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={fs.closeBtn}>
            <MaterialCommunityIcons name="close" size={18} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        <ScrollView style={fs.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Search */}
          <Text style={fs.sectionLabel}>Search</Text>
          <View style={fs.inputWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
            <TextInput
              style={fs.input}
              placeholder="Name, email, phone..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Period */}
          <Text style={fs.sectionLabel}>Time Period</Text>
          <View style={fs.chipRow}>
            {PERIOD_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPeriod(opt.value)}
                style={[fs.chip, period === opt.value && { backgroundColor: PRIMARY }]}
              >
                <Text style={[fs.chipText, period === opt.value && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort */}
          <Text style={fs.sectionLabel}>Sort By</Text>
          <View style={fs.chipRow}>
            {[
              { value: '-createdAt', label: 'Newest' },
              { value: 'createdAt',  label: 'Oldest' },
              { value: 'firstName',  label: 'A → Z'  },
              { value: '-firstName', label: 'Z → A'  },
            ].map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSortBy(opt.value)}
                style={[fs.chip, sortBy === opt.value && { backgroundColor: PRIMARY }]}
              >
                <Text style={[fs.chipText, sortBy === opt.value && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={fs.actions}>
          <TouchableOpacity style={fs.clearBtn} onPress={() => { onClear(); onClose(); }}>
            <Text style={fs.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fs.applyBtn} onPress={onClose}>
            <Text style={fs.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};
const fs = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 28 },
  handle:      { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetTitle:  { fontSize: 17, fontWeight: '700', color: PRIMARY },
  sheetSub:    { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: alpha(PRIMARY, 0.1), alignItems: 'center', justifyContent: 'center' },
  scrollArea:  { paddingHorizontal: 20 },
  sectionLabel:{ fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  input:       { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: alpha(PRIMARY, 0.3) },
  chipText:    { fontSize: 13, color: PRIMARY, fontWeight: '500' },
  actions:     { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  clearBtn:    { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, alignItems: 'center' },
  clearBtnText:{ color: PRIMARY, fontWeight: '600', fontSize: 14 },
  applyBtn:    { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  applyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   LEAD DETAIL MODAL
───────────────────────────────────────────────────────────── */
const LeadDetailModal = ({ visible, onClose, lead, stage, stageColor }: any) => {
  if (!lead) return null;
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.Visit;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={[ld.header, { backgroundColor: PRIMARY }]}>
          <Avatar label={initials(lead.firstName, lead.lastName)} color="rgba(255,255,255,0.25)" size={46} />
          <View style={ld.headerInfo}>
            <Text style={ld.headerName}>{lead.firstName} {lead.lastName}</Text>
            <Text style={ld.headerSub}>Lead Details · {stage}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={ld.closeBtn}>
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={ld.body} showsVerticalScrollIndicator={false}>
          {/* Status chip */}
          <View style={[ld.statusCard, { borderLeftColor: config.color }]}>
            <Text style={ld.statusLabel}>Current Stage</Text>
            <View style={[ld.chip, { backgroundColor: alpha(config.color, 0.1) }]}>
              <MaterialCommunityIcons name={config.icon} size={14} color={config.color} />
              <Text style={[ld.chipText, { color: config.color }]}>{stage}</Text>
            </View>
            <Text style={ld.statusDesc}>{config.description}</Text>
          </View>

          {/* Contact info */}
          <Text style={ld.sectionTitle}>Contact Information</Text>
          <View style={ld.infoCard}>
            {[
              { icon: 'phone',    label: 'Phone',    value: lead.phone },
              { icon: 'email',    label: 'Email',    value: lead.email },
              { icon: 'map-marker', label: 'Location', value: lead.city },
            ].map(row => (
              <View key={row.label} style={ld.infoRow}>
                <View style={[ld.infoIcon, { backgroundColor: alpha(PRIMARY, 0.1) }]}>
                  <MaterialCommunityIcons name={row.icon} size={16} color={PRIMARY} />
                </View>
                <View>
                  <Text style={ld.infoLabel}>{row.label}</Text>
                  <Text style={ld.infoValue}>{row.value || 'Not provided'}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Timeline */}
          <Text style={ld.sectionTitle}>Stage History</Text>
          <View style={ld.infoCard}>
            <View style={ld.timelineRow}>
              <View style={[ld.timelineDot, { backgroundColor: stageColor || config.color }]}>
                <MaterialCommunityIcons name={config.icon} size={14} color="#fff" />
              </View>
              <View>
                <Text style={ld.tlStage}>{stage}</Text>
                <Text style={ld.tlDate}>{fmtDate(lead.createdAt)}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <Text style={ld.sectionTitle}>Actions</Text>
          <View style={ld.actionGrid}>
            {[
              { icon: 'pencil',        label: 'Edit Lead'    },
              { icon: 'phone',         label: 'Call Lead'    },
              { icon: 'email-outline', label: 'Send Email'   },
            ].map(a => (
              <TouchableOpacity key={a.label} style={ld.actionBtn} activeOpacity={0.75}>
                <MaterialCommunityIcons name={a.icon} size={18} color={PRIMARY} />
                <Text style={ld.actionText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={ld.footer}>
          <TouchableOpacity style={ld.footerClose} onPress={onClose}>
            <Text style={ld.footerCloseText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ld.footerNext}>
            <Text style={ld.footerNextText}>Move to Next Stage</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
const ld = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerInfo:   { flex: 1 },
  headerName:   { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  body:         { padding: 16, gap: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 16, marginBottom: 8 },
  statusCard:   { backgroundColor: '#f8fafc', borderRadius: 12, borderLeftWidth: 4, padding: 14, gap: 6 },
  statusLabel:  { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText:     { fontSize: 13, fontWeight: '600' },
  statusDesc:   { fontSize: 12, color: '#64748b' },
  infoCard:     { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, gap: 14 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  infoLabel:    { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  infoValue:    { fontSize: 14, color: '#1e293b', fontWeight: '500', marginTop: 1 },
  timelineRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineDot:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tlStage:      { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  tlDate:       { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  actionGrid:   { flexDirection: 'row', gap: 10 },
  actionBtn:    { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: alpha(PRIMARY, 0.2), padding: 12, alignItems: 'center', gap: 6 },
  actionText:   { fontSize: 11, color: PRIMARY, fontWeight: '600', textAlign: 'center' },
  footer:       { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerClose:  { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: PRIMARY, alignItems: 'center' },
  footerCloseText:{ color: PRIMARY, fontWeight: '600', fontSize: 14 },
  footerNext:   { flex: 2, flexDirection: 'row', gap: 6, backgroundColor: PRIMARY, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footerNextText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────────── */
const EmptyState = ({ stage, hasFilters, onClearFilters }: any) => (
  <View style={es.wrap}>
    <View style={es.iconCircle}>
      <MaterialCommunityIcons name={stage ? 'account-group' : 'magnify'} size={44} color={PRIMARY} />
    </View>
    <Text style={es.title}>{stage ? `No leads in ${stage}` : 'No matching leads found'}</Text>
    <Text style={es.sub}>
      {stage
        ? 'Leads will appear here as they progress through the pipeline.'
        : 'Try adjusting your search or filter criteria.'}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={es.btn} onPress={onClearFilters}>
        <Text style={es.btnText}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);
const es = StyleSheet.create({
  wrap:       { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: alpha(PRIMARY, 0.1), alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title:      { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  sub:        { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn:        { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* ─────────────────────────────────────────────────────────────
   SKELETON LOADER
───────────────────────────────────────────────────────────── */
const SkeletonBox = ({ h, radius = 10, mb = 0 }: any) => (
  <View style={{ height: h, borderRadius: radius, backgroundColor: '#e2e8f0', marginBottom: mb }} />
);
const LoadingSkeleton = () => (
  <View style={{ padding: 16 }}>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
      {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1 }}><SkeletonBox h={80} /></View>)}
    </View>
    <SkeletonBox h={54} mb={12} />
    <SkeletonBox h={320} mb={12} />
    <SkeletonBox h={54} />
  </View>
);

/* ─────────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────────── */
interface Props {
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
}

export default function LeadFunnelScreen({ onMenuPress, onSearchPress, onProfilePress }: Props) {
  const { fetchAPI } = useAuth();

  const [funnelData,     setFunnelData]     = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [selectedStage,  setSelectedStage]  = useState('Visit');
  const [selectedLead,   setSelectedLead]   = useState<any>(null);
  const [detailVisible,  setDetailVisible]  = useState(false);
  const [filterVisible,  setFilterVisible]  = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [sortBy,         setSortBy]         = useState('-createdAt');
  const [period,         setPeriod]         = useState('Today');
  const [page,           setPage]           = useState(1);
  const PAGE_SIZE = 8;

  /* ── Fetch ─────────────────────────────────────────────── */
  const fetchFunnelData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      const response = await fetchAPI('/lead/funnel');
      if (!response?.success) throw new Error(response?.message || 'Failed to load');

      const ordered = STAGE_ORDER.map(name => {
        const s = response.result.funnel.find((f: any) => f.stage === name);
        return s || { stage: name, count: 0, leads: [], percentage: '0.0' };
      });

      setFunnelData({ ...response.result, funnel: ordered });
    } catch (err: any) {
      setError(err.message || 'Failed to load funnel data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAPI]);

  useEffect(() => { fetchFunnelData(); }, [fetchFunnelData]);

  /* ── Derived data ──────────────────────────────────────── */
  const currentStageData = useMemo(() =>
    funnelData?.funnel?.find((s: any) => s.stage === selectedStage) ||
    { stage: selectedStage, count: 0, leads: [], percentage: '0' },
    [funnelData, selectedStage],
  );

  const stageConfig = STAGE_CONFIG[selectedStage] || STAGE_CONFIG.Visit;

  const filteredLeads = useMemo(() => {
    if (!currentStageData.leads) return [];
    let leads = [...currentStageData.leads];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      leads = leads.filter((l: any) =>
        l.firstName?.toLowerCase().includes(q) ||
        l.lastName?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q),
      );
    }
    leads.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'firstName':   return (a.firstName || '').localeCompare(b.firstName || '');
        case '-firstName':  return (b.firstName || '').localeCompare(a.firstName || '');
        case 'createdAt':   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case '-createdAt':  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });
    return leads;
  }, [currentStageData.leads, searchQuery, sortBy]);

  const totalPages   = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const pagedLeads   = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters = useMemo(() => {
    let c = 0;
    if (searchQuery) c++;
    if (period !== 'Today') c++;
    if (sortBy !== '-createdAt') c++;
    return c;
  }, [searchQuery, period, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setPeriod('Today');
    setSortBy('-createdAt');
    setSelectedStage('Visit');
    setPage(1);
  };

  const handleStageSelect = (name: string) => {
    setSelectedStage(name);
    setPage(1);
  };

  /* ── Summary stats ─────────────────────────────────────── */
  const summaryStats = useMemo(() => {
    if (!funnelData) return { total: 0, conversion: '0%', missed: 0 };
    const total    = funnelData.totalLeads || 0;
    const visit    = funnelData.funnel?.find((s: any) => s.stage === 'Visit')?.count || 0;
    const reg      = funnelData.funnel?.find((s: any) => s.stage === 'Registration')?.count || 0;
    const missed   = funnelData.funnel?.find((s: any) => s.stage === 'Missed Leads')?.count || 0;
    const convRate = visit > 0 ? ((reg / visit) * 100).toFixed(1) + '%' : '0%';
    return { total, conversion: convRate, missed };
  }, [funnelData]);

  /* ── Render ─────────────────────────────────────────────── */
  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <View style={s.errorWrap}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#f44336" />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => fetchFunnelData()}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!funnelData) {
    return (
      <View style={s.errorWrap}>
        <Text style={s.errorText}>No funnel data available</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => fetchFunnelData()}>
          <Text style={s.retryText}>Load Data</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onMenuPress} style={s.topBarBtn}>
          <MaterialCommunityIcons name="menu" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarTitle}>Lead Funnel</Text>
          <Text style={s.topBarSub}>Sales pipeline overview</Text>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity onPress={onSearchPress} style={s.topBarBtn}>
            <MaterialCommunityIcons name="magnify" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => fetchFunnelData(true)} style={s.topBarBtn}>
            <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchFunnelData(true)} colors={[PRIMARY]} />
        }
      >
        {/* ── Summary Cards ── */}
    <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={s.summaryScroll}
  contentContainerStyle={s.summaryContainer}
>
          <SummaryCard title="Total Leads"     value={summaryStats.total}      icon="account-group"   color={PRIMARY}    trend="+12% from last month" />
          <SummaryCard title="Conversion"      value={summaryStats.conversion} icon="trending-up"     color="#4caf50"    trend="Visit → Registration"  />
          <SummaryCard title="Avg. Stage Time" value="3.2d"                    icon="clock-fast"      color="#ff9800"    trend="-0.5 days from last week" />
          <SummaryCard title="Missed Leads"    value={summaryStats.missed}     icon="alert-circle"    color="#f44336"    trend="Requires attention" />
        </ScrollView>

        {/* ── Search Bar ── */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search leads..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={txt => { setSearchQuery(txt); setPage(1); }}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[s.filterBtn, activeFilters > 0 && { backgroundColor: PRIMARY }]}
            onPress={() => setFilterVisible(true)}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color={activeFilters > 0 ? '#fff' : PRIMARY}
            />
            {activeFilters > 0 && (
              <View style={s.filterBadge}>
                <Text style={s.filterBadgeText}>{activeFilters}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Pipeline Section ── */}
        <View style={s.sectionCard}>
          <View style={[s.sectionHeader, { backgroundColor: PRIMARY }]}>
            <Text style={s.sectionHeaderTitle}>Lead Pipeline</Text>
            <Text style={s.sectionHeaderSub}>Tap a stage to view its leads</Text>
          </View>
          <View style={s.stageList}>
            {funnelData.funnel?.map((stage: any) => (
              <StageItem
                key={stage.stage}
                stage={stage.stage}
                config={STAGE_CONFIG[stage.stage] || STAGE_CONFIG.Visit}
                isSelected={selectedStage === stage.stage}
                onPress={() => handleStageSelect(stage.stage)}
                count={stage.count}
                percentage={stage.percentage}
              />
            ))}
          </View>
        </View>

        {/* ── Stage Detail Section ── */}
        <View style={s.sectionCard}>
          {/* Stage Header */}
          <View style={[s.stageDetailHeader, { borderLeftColor: stageConfig.color }]}>
            <View style={[s.stageAvatar, { backgroundColor: stageConfig.color }]}>
              <MaterialCommunityIcons name={stageConfig.icon} size={20} color="#fff" />
            </View>
            <View style={s.stageDetailInfo}>
              <Text style={s.stageDetailTitle}>{selectedStage}</Text>
              <Text style={s.stageDetailSub}>{stageConfig.description}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={s.stageStatsRow}>
            <View style={s.stageStat}>
              <Text style={[s.stageStatValue, { color: stageConfig.color }]}>
                {currentStageData.count}
              </Text>
              <Text style={s.stageStatLabel}>Total Leads</Text>
            </View>
            <View style={s.stageStatDivider} />
            <View style={s.stageStat}>
              <Text style={[s.stageStatValue, { color: '#1e293b' }]}>
                {currentStageData.percentage}%
              </Text>
              <Text style={s.stageStatLabel}>of Pipeline</Text>
            </View>
            <View style={s.stageStatDivider} />
            <View style={s.stageStat}>
              <Text style={[s.stageStatValue, { color: '#64748b' }]}>
                {filteredLeads.length}
              </Text>
              <Text style={s.stageStatLabel}>Filtered</Text>
            </View>
          </View>

          {/* Leads List */}
          <View style={s.leadsList}>
            {currentStageData.count === 0 ? (
              <EmptyState stage={selectedStage} hasFilters={activeFilters > 0} onClearFilters={handleClearFilters} />
            ) : filteredLeads.length === 0 ? (
              <EmptyState hasFilters={true} onClearFilters={handleClearFilters} />
            ) : (
              <>
                <View style={s.leadsCountRow}>
                  <Text style={s.leadsCountText}>
                    Showing {pagedLeads.length} of {filteredLeads.length} leads
                  </Text>
                </View>
                {pagedLeads.map((lead: any, idx: number) => (
                  <LeadCard
                    key={lead._id || idx}
                    lead={lead}
                    stageColor={stageConfig.color}
                    onView={(l: any) => { setSelectedLead(l); setDetailVisible(true); }}
                  />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <View style={s.pagination}>
                    <TouchableOpacity
                      style={[s.pageBtn, page === 1 && s.pageBtnDisabled]}
                      onPress={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={20} color={page === 1 ? '#cbd5e1' : PRIMARY} />
                    </TouchableOpacity>

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pg = i + 1;
                      return (
                        <TouchableOpacity
                          key={pg}
                          style={[s.pageNumBtn, page === pg && { backgroundColor: PRIMARY }]}
                          onPress={() => setPage(pg)}
                        >
                          <Text style={[s.pageNumText, page === pg && { color: '#fff' }]}>{pg}</Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]}
                      onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={20} color={page === totalPages ? '#cbd5e1' : PRIMARY} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Filter Sheet */}
      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        period={period}
        setPeriod={setPeriod}
        sortBy={sortBy}
        setSortBy={val => { setSortBy(val); setPage(1); }}
        searchQuery={searchQuery}
        setSearchQuery={txt => { setSearchQuery(txt); setPage(1); }}
        onClear={handleClearFilters}
      />

      {/* Lead Detail Modal */}
      <LeadDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        lead={selectedLead}
        stage={selectedStage}
        stageColor={stageConfig.color}
      />
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: BG },
  scroll:            { flex: 1 },
  scrollContent:     { padding: 12, paddingBottom: 40 },

  // Top Bar
  topBar:            { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 12, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 12 : 12 },
  topBarBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topBarCenter:      { flex: 1, paddingHorizontal: 12 },
  topBarTitle:       { fontSize: 16, fontWeight: '800', color: '#fff' },
  topBarSub:         { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  topBarRight:       { flexDirection: 'row', gap: 6 },

  // Summary Grid
 summaryScroll: {
  marginBottom: 12,
},
summaryContainer: {
  paddingHorizontal: 8,
},

  // Search Row
  searchRow:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchBox:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6, gap: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  searchInput:       { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  filterBtn:         { width: 46, height: 46, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(PRIMARY, 0.3), elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  filterBadge:       { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#f44336', alignItems: 'center', justifyContent: 'center' },
  filterBadgeText:   { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Section Card
  sectionCard:       { backgroundColor: '#fff', borderRadius: 16, marginBottom: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  sectionHeader:     { padding: 16, paddingBottom: 14 },
  sectionHeaderTitle:{ fontSize: 15, fontWeight: '800', color: '#fff' },
  sectionHeaderSub:  { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  stageList:         { padding: 12 },

  // Stage Detail
  stageDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderLeftWidth: 4, backgroundColor: '#fafbff' },
  stageAvatar:       { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stageDetailInfo:   { flex: 1 },
  stageDetailTitle:  { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  stageDetailSub:    { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  stageStatsRow:     { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stageStat:         { flex: 1, alignItems: 'center' },
  stageStatValue:    { fontSize: 22, fontWeight: '800' },
  stageStatLabel:    { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  stageStatDivider:  { width: 1, backgroundColor: '#f1f5f9' },

  // Leads
  leadsList:         { padding: 12 },
  leadsCountRow:     { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  leadsCountText:    { fontSize: 11, color: '#94a3b8' },

  // Pagination
  pagination:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  pageBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnDisabled:   { opacity: 0.4 },
  pageNumBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(PRIMARY, 0.2) },
  pageNumText:       { fontSize: 13, fontWeight: '600', color: PRIMARY },

  // Error
  errorWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText:         { fontSize: 15, color: '#64748b', textAlign: 'center' },
  retryBtn:          { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText:         { color: '#fff', fontWeight: '700', fontSize: 14 },
});