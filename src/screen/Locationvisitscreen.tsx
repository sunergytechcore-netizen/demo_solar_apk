import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LocationVisit {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  area: string;
  checkIn?: string;
  checkOut?: string;
  status: 'Completed' | 'Ongoing' | 'Scheduled' | 'Cancelled';
  visitType: 'Site Visit' | 'Follow-up' | 'Demo' | 'Survey';
  date: string;
  distance?: string;
  notes?: string;
}

interface LocationVisitScreenProps {
  onBackPress?:    () => void;
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
  onNewVisit?:     () => void;   // ← opens CreateVisitScreen
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const VISITS: LocationVisit[] = [
  {id:'1', customerName:'ANANTA SAMAL',  phone:'7847867300', address:'Plot 42, Patia, Bhubaneswar', area:'Patia',       checkIn:'09:30 AM', checkOut:'11:00 AM', status:'Completed', visitType:'Site Visit', date:'Today',      distance:'3.2 km', notes:'Interested in 5kW panel'},
  {id:'2', customerName:'Tushar Kumar',  phone:'8457852616', address:'MIG-18, Cuttack Rd, BBSR',   area:'Nayapalli',   checkIn:'11:45 AM', checkOut:undefined,  status:'Ongoing',   visitType:'Demo',      date:'Today',      distance:'6.8 km'},
  {id:'3', customerName:'Ramesh Patel',  phone:'9876543210', address:'Sector-6, Rourkela',          area:'Sector 6',    checkIn:undefined,  checkOut:undefined,  status:'Scheduled', visitType:'Follow-up', date:'Today',      distance:'2.1 km', notes:'Call before arriving'},
  {id:'4', customerName:'Sunita Devi',   phone:'8765432109', address:'Gandhi Nagar, Sambalpur',     area:'Gandhi Nagar',checkIn:'09:00 AM', checkOut:'10:30 AM', status:'Completed', visitType:'Survey',    date:'Yesterday',  distance:'1.5 km'},
  {id:'5', customerName:'chelai chm gha',phone:'6373737378', address:'Marine Drive, Puri',          area:'Marine Drive',checkIn:'02:00 PM', checkOut:'03:15 PM', status:'Completed', visitType:'Site Visit',date:'Yesterday',  distance:'4.4 km'},
  {id:'6', customerName:'Ajay Singh',    phone:'7654321098', address:'Uditnagar, Rourkela',         area:'Uditnagar',   checkIn:undefined,  checkOut:undefined,  status:'Cancelled', visitType:'Demo',      date:'21 Jun',     distance:'7.1 km', notes:'Customer not available'},
  {id:'7', customerName:'Priya Nair',    phone:'6543210987', address:'Malkangiri, Odisha',          area:'Malkangiri',  checkIn:'10:00 AM', checkOut:'12:00 PM', status:'Completed', visitType:'Survey',    date:'20 Jun',     distance:'5.9 km'},
];

const STATUS_CFG: Record<string, {bg: string; text: string; icon: string; border: string}> = {
  Completed: {bg: '#e8f5e9', text: '#2e7d32', icon: 'check-circle-outline', border: '#a5d6a7'},
  Ongoing:   {bg: '#fff8e1', text: '#f57f17', icon: 'progress-clock',       border: '#ffe082'},
  Scheduled: {bg: '#e3f2fd', text: '#1565c0', icon: 'calendar-clock',       border: '#90caf9'},
  Cancelled: {bg: '#fafafa', text: '#9e9e9e', icon: 'cancel',               border: '#e0e0e0'},
};

const VISIT_TYPE_COLOR: Record<string, string> = {
  'Site Visit': '#3b5bdb',
  'Follow-up':  '#7b1fa2',
  'Demo':       '#00838f',
  'Survey':     '#bf360c',
};

const FILTER_TABS = ['All', 'Today', 'Completed', 'Ongoing', 'Scheduled'];

// ─── Component ────────────────────────────────────────────────────────────────
const LocationVisitScreen: React.FC<LocationVisitScreenProps> = ({
  onBackPress,
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onNewVisit,
}) => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeVisitId, setActiveVisitId] = useState<string | null>('2'); // "Ongoing" visit

  const filtered = VISITS.filter(v => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Today') return v.date === 'Today';
    return v.status === activeFilter;
  });

  const todayVisits    = VISITS.filter(v => v.date === 'Today');
  const completedToday = todayVisits.filter(v => v.status === 'Completed').length;

  return (
    <View style={styles.screen}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={28} color="#3b5bdb" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location Visit</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress}>
            <Ionicons name="search-outline" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialCommunityIcons name="map-outline" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatar} onPress={onProfilePress} activeOpacity={0.8}>
            <Text style={styles.avatarText}>NR</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.blueLine} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Map Placeholder ── */}
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapOverlay}>
            {/* Fake map grid lines */}
            {[0,1,2,3].map(i => (
              <View key={`h${i}`} style={[styles.mapGridH, {top: `${20 + i * 22}%` as any}]} />
            ))}
            {[0,1,2,3,4].map(i => (
              <View key={`v${i}`} style={[styles.mapGridV, {left: `${10 + i * 20}%` as any}]} />
            ))}
          </View>

          {/* Map pins */}
          <View style={[styles.mapPin, {top: '30%', left: '25%'}]}>
            <MaterialCommunityIcons name="map-marker" size={28} color="#3b5bdb" />
          </View>
          <View style={[styles.mapPin, {top: '55%', left: '60%'}]}>
            <MaterialCommunityIcons name="map-marker" size={28} color="#43a047" />
          </View>
          <View style={[styles.mapPin, {top: '40%', left: '70%'}]}>
            <MaterialCommunityIcons name="map-marker" size={28} color="#e65100" />
          </View>
          <View style={[styles.mapPin, {top: '25%', left: '50%'}]}>
            <MaterialCommunityIcons name="map-marker" size={28} color="#9e9e9e" />
          </View>

          {/* Route line (decorative) */}
          <View style={styles.mapRouteLine} />

          {/* My Location */}
          <View style={styles.myLocation}>
            <View style={styles.myLocationOuter}>
              <View style={styles.myLocationInner} />
            </View>
          </View>

          {/* Map controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity style={styles.mapControlBtn}>
              <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#3b5bdb" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapControlBtn}>
              <MaterialCommunityIcons name="layers-outline" size={20} color="#3b5bdb" />
            </TouchableOpacity>
          </View>

          {/* Map label */}
          <View style={styles.mapLabel}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color="#3b5bdb" />
            <Text style={styles.mapLabelText}>Bhubaneswar, Odisha</Text>
          </View>
        </View>

        {/* ── Today Summary ── */}
        <View style={styles.summaryRow}>
          <SummaryChip icon="map-marker-check-outline" value={completedToday} label="Completed" color="#2e7d32" bg="#e8f5e9" />
          <SummaryChip icon="map-marker-path"          value={todayVisits.length} label="Scheduled" color="#3b5bdb" bg="#eef1fb" />
          <SummaryChip icon="map-marker-distance"      value="18.4 km"            label="Distance"  color="#e65100" bg="#fff3e0" />
        </View>

        {/* ── Active Visit Banner ── */}
        {activeVisitId && (() => {
          const v = VISITS.find(x => x.id === activeVisitId);
          if (!v) return null;
          return (
            <View style={styles.activeBanner}>
              <View style={styles.activeBannerLeft}>
                <View style={styles.pulsingDot}>
                  <View style={styles.pulsingDotInner} />
                </View>
                <View>
                  <Text style={styles.activeBannerLabel}>Ongoing Visit</Text>
                  <Text style={styles.activeBannerName} numberOfLines={1}>{v.customerName}</Text>
                  <Text style={styles.activeBannerAddr} numberOfLines={1}>{v.area}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.checkOutBtn}
                onPress={() => setActiveVisitId(null)}
                activeOpacity={0.85}>
                <MaterialCommunityIcons name="logout" size={16} color="#fff" />
                <Text style={styles.checkOutBtnText}>Check Out</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Filter Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}>
          {FILTER_TABS.map(tab => {
            const isActive = activeFilter === tab;
            const count = tab === 'All' ? VISITS.length
              : tab === 'Today' ? VISITS.filter(v => v.date === 'Today').length
              : VISITS.filter(v => v.status === tab).length;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveFilter(tab)}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                activeOpacity={0.75}>
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Add Visit Button + Count ── */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listCount}>
            <Text style={styles.listCountNum}>{filtered.length}</Text> visits
          </Text>
          <TouchableOpacity style={styles.addBtn} onPress={onNewVisit}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.addBtnText}>New Visit</Text>
          </TouchableOpacity>
        </View>

        {/* ── Visit Cards ── */}
        <View style={styles.listContainer}>
          {filtered.map(visit => (
            <VisitCard
              key={visit.id}
              visit={visit}
              isExpanded={expandedId === visit.id}
              onToggle={() => setExpandedId(expandedId === visit.id ? null : visit.id)}
              isActive={activeVisitId === visit.id}
              onCheckIn={() => setActiveVisitId(visit.id)}
            />
          ))}
        </View>

        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
};

// ─── Visit Card ───────────────────────────────────────────────────────────────
const VisitCard: React.FC<{
  visit: LocationVisit;
  isExpanded: boolean;
  onToggle: () => void;
  isActive: boolean;
  onCheckIn: () => void;
}> = ({visit, isExpanded, onToggle, isActive, onCheckIn}) => {
  const cfg = STATUS_CFG[visit.status];
  const typeColor = VISIT_TYPE_COLOR[visit.visitType] ?? '#3b5bdb';
  const initials = visit.customerName.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('');

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={onToggle}
      activeOpacity={0.85}>

      {/* Active indicator strip */}
      {isActive && <View style={styles.activeStrip} />}

      <View style={styles.cardMain}>
        {/* Avatar */}
        <View style={[styles.cardAvatar, {backgroundColor: typeColor + '20'}]}>
          <Text style={[styles.cardAvatarText, {color: typeColor}]}>{initials}</Text>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardName} numberOfLines={1}>{visit.customerName}</Text>
            <View style={[styles.visitTypePill, {backgroundColor: typeColor + '18'}]}>
              <Text style={[styles.visitTypeText, {color: typeColor}]}>{visit.visitType}</Text>
            </View>
          </View>

          <View style={styles.cardMeta}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color="#aaa" />
            <Text style={styles.cardMetaText} numberOfLines={1}>{visit.address}</Text>
          </View>

          <View style={styles.cardBottomRow}>
            <View style={[styles.statusBadge, {backgroundColor: cfg.bg, borderColor: cfg.border}]}>
              <MaterialCommunityIcons name={cfg.icon} size={12} color={cfg.text} />
              <Text style={[styles.statusText, {color: cfg.text}]}>{visit.status}</Text>
            </View>

            <View style={styles.cardMetaRight}>
              {visit.checkIn && (
                <Text style={styles.timeText}>
                  {visit.checkIn}{visit.checkOut ? ` → ${visit.checkOut}` : ' →'}
                </Text>
              )}
              {visit.distance && (
                <View style={styles.distRow}>
                  <MaterialCommunityIcons name="map-marker-distance" size={12} color="#aaa" />
                  <Text style={styles.distText}>{visit.distance}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Expand chevron */}
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#ccc"
          style={{marginLeft: 4}}
        />
      </View>

      {/* ── Expanded Details ── */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          <View style={styles.expandedDivider} />

          <View style={styles.expandedGrid}>
            <DetailItem icon="phone-outline"     label="Phone"   value={visit.phone} />
            <DetailItem icon="calendar-outline"  label="Date"    value={visit.date} />
            {visit.checkIn  && <DetailItem icon="login"   label="Check In"  value={visit.checkIn} />}
            {visit.checkOut && <DetailItem icon="logout"  label="Check Out" value={visit.checkOut} />}
          </View>

          {visit.notes && (
            <View style={styles.notesBox}>
              <MaterialCommunityIcons name="note-text-outline" size={14} color="#3b5bdb" />
              <Text style={styles.notesText}>{visit.notes}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.expandedActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialCommunityIcons name="phone" size={16} color="#3b5bdb" />
              <Text style={styles.actionBtnText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialCommunityIcons name="navigation-outline" size={16} color="#3b5bdb" />
              <Text style={styles.actionBtnText}>Navigate</Text>
            </TouchableOpacity>
            {visit.status === 'Scheduled' && (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onCheckIn}>
                <MaterialCommunityIcons name="login" size={16} color="#fff" />
                <Text style={[styles.actionBtnText, {color: '#fff'}]}>Check In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const DetailItem: React.FC<{icon: string; label: string; value: string}> = ({icon, label, value}) => (
  <View style={styles.detailItem}>
    <MaterialCommunityIcons name={icon} size={14} color="#3b5bdb" />
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const SummaryChip: React.FC<{icon: string; value: number | string; label: string; color: string; bg: string}> = ({
  icon, value, label, color, bg,
}) => (
  <View style={[styles.summaryChip, {backgroundColor: bg}]}>
    <MaterialCommunityIcons name={icon} size={18} color={color} />
    <Text style={[styles.summaryValue, {color}]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

export default LocationVisitScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:     {flex: 1, backgroundColor: '#f0f4ff'},

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: '#f0f4ff',
  },
  menuBtn:      {padding: 4},
  headerTitle:  {fontSize: 18, fontWeight: '700', color: '#1a1a3e', flex: 1, marginLeft: 10},
  topBarRight:  {flexDirection: 'row', alignItems: 'center', gap: 8},
  iconBtn:      {padding: 4},
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#3b5bdb', alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   {color: '#fff', fontSize: 13, fontWeight: '700'},
  blueLine:     {height: 3, backgroundColor: '#3b5bdb'},

  // Map
  mapPlaceholder: {
    height: 200, backgroundColor: '#dce8f0', marginHorizontal: 12, marginTop: 14,
    borderRadius: 16, overflow: 'hidden', position: 'relative',
  },
  mapOverlay:  {...StyleSheet.absoluteFillObject, opacity: 0.4},
  mapGridH:    {position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#b0c4d8'},
  mapGridV:    {position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#b0c4d8'},
  mapPin:      {position: 'absolute'},
  mapRouteLine:{
    position: 'absolute', top: '38%', left: '25%', width: '40%', height: 2,
    backgroundColor: '#3b5bdb', opacity: 0.5, borderRadius: 1,
    transform: [{rotate: '15deg'}],
  },
  myLocation: {
    position: 'absolute', bottom: '30%', left: '43%',
    alignItems: 'center', justifyContent: 'center',
  },
  myLocationOuter: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(59,91,219,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  myLocationInner: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b5bdb'},
  mapControls: {
    position: 'absolute', right: 12, bottom: 12, gap: 8,
  },
  mapControlBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  mapLabel: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  mapLabelText: {fontSize: 12, fontWeight: '600', color: '#3b5bdb'},

  // Summary
  summaryRow:   {flexDirection: 'row', paddingHorizontal: 12, marginTop: 10, gap: 8},
  summaryChip:  {flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 10, gap: 2},
  summaryValue: {fontSize: 16, fontWeight: '800'},
  summaryLabel: {fontSize: 10, color: '#888', fontWeight: '500'},

  // Active banner
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff8e1', marginHorizontal: 12, marginTop: 10,
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#ffe082',
  },
  activeBannerLeft:  {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  pulsingDot: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(245,127,23,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  pulsingDotInner: {width: 9, height: 9, borderRadius: 5, backgroundColor: '#f57f17'},
  activeBannerLabel: {fontSize: 11, color: '#f57f17', fontWeight: '700', textTransform: 'uppercase'},
  activeBannerName:  {fontSize: 14, fontWeight: '700', color: '#1a1a3e'},
  activeBannerAddr:  {fontSize: 12, color: '#888'},
  checkOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#e53935', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  checkOutBtnText: {fontSize: 13, fontWeight: '700', color: '#fff'},

  // Filters
  filterScroll:  {maxHeight: 52, marginTop: 10},
  filterContent: {paddingHorizontal: 14, paddingVertical: 8, gap: 8, flexDirection: 'row'},
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.5, borderColor: '#e4e8f5',
  },
  filterTabActive:     {backgroundColor: '#3b5bdb', borderColor: '#3b5bdb'},
  filterTabText:       {fontSize: 13, fontWeight: '600', color: '#555'},
  filterTabTextActive: {color: '#fff'},
  filterBadge:         {backgroundColor: '#eef1fb', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1},
  filterBadgeActive:   {backgroundColor: 'rgba(255,255,255,0.25)'},
  filterBadgeText:     {fontSize: 11, fontWeight: '700', color: '#3b5bdb'},
  filterBadgeTextActive:{color: '#fff'},

  listHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  listCount:    {fontSize: 13, color: '#888'},
  listCountNum: {fontWeight: '700', color: '#3b5bdb'},
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#3b5bdb', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: {fontSize: 13, fontWeight: '700', color: '#fff'},

  listContainer: {paddingHorizontal: 12, gap: 10},

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    marginBottom: 0,
  },
  cardActive:    {borderWidth: 1.5, borderColor: '#ffe082'},
  activeStrip:   {position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#f57f17', borderTopLeftRadius: 14, borderBottomLeftRadius: 14},
  cardMain:      {flexDirection: 'row', alignItems: 'flex-start'},
  cardAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardAvatarText: {fontSize: 13, fontWeight: '700'},
  cardInfo:     {flex: 1},
  cardTopRow:   {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4},
  cardName:     {fontSize: 15, fontWeight: '700', color: '#1a1a3e', flex: 1, marginRight: 8},
  visitTypePill:{paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8},
  visitTypeText:{fontSize: 11, fontWeight: '700'},
  cardMeta:     {flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6},
  cardMetaText: {fontSize: 12, color: '#888', flex: 1},
  cardBottomRow:{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  statusBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  statusText:   {fontSize: 11, fontWeight: '700'},
  cardMetaRight:{alignItems: 'flex-end', gap: 2},
  timeText:     {fontSize: 11, color: '#888'},
  distRow:      {flexDirection: 'row', alignItems: 'center', gap: 3},
  distText:     {fontSize: 11, color: '#aaa'},

  // Expanded
  expandedSection: {marginTop: 12},
  expandedDivider: {height: 1, backgroundColor: '#f0f0f0', marginBottom: 12},
  expandedGrid:    {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10},
  detailItem:      {flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '45%'},
  detailLabel:     {fontSize: 10, color: '#aaa', fontWeight: '500'},
  detailValue:     {fontSize: 13, color: '#333', fontWeight: '600'},
  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#f8f9ff', borderRadius: 10, padding: 10, marginBottom: 12,
  },
  notesText: {fontSize: 12, color: '#555', flex: 1, lineHeight: 18},
  expandedActions: {flexDirection: 'row', gap: 8},
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#eef1fb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  actionBtnPrimary: {backgroundColor: '#3b5bdb'},
  actionBtnText:    {fontSize: 13, fontWeight: '600', color: '#3b5bdb'},
});