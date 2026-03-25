import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TopBar from '../components/TopBar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  name: string;
  initials: string;
  leadId: string;
  phone: string;
  email: string;
  date: string;
  stage: string;
  assignedTo: string;
  assignedInitial: string;
  assignedRole: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const ALL_LEADS: Lead[] = [
  {
    id: '1',
    name: 'Reddy .',
    initials: 'R.',
    leadId: '73498b28',
    phone: '9937752236',
    email: 'junny@gmail.com',
    date: '20 Mar 2026',
    stage: 'Visit',
    assignedTo: 'rati',
    assignedInitial: 'r',
    assignedRole: 'TEAM',
  },
  {
    id: '2',
    name: 'ragab .',
    initials: 'r.',
    leadId: '1aeb78c4',
    phone: '6655445566',
    email: 'alishanayak@gmail.com',
    date: '21 Mar 2026',
    stage: 'Visit',
    assignedTo: 'rati',
    assignedInitial: 'r',
    assignedRole: 'TEAM',
  },
];

// ─── Lead Card ────────────────────────────────────────────────────────────────
const LeadCard = ({lead}: {lead: Lead}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{lead.initials}</Text>
        </View>
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.leadName}>{lead.name}</Text>
          <Text style={styles.leadId}>ID: {lead.leadId}</Text>
        </View>
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded(!expanded)}>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#555"
          />
        </TouchableOpacity>
      </View>

      {/* Phone + Email */}
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="phone" size={13} color="#3b5bdb" />
        <Text style={styles.infoText}>{lead.phone}</Text>
        <View style={{width: 16}} />
        <MaterialCommunityIcons name="email-outline" size={13} color="#3b5bdb" />
        <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
          {lead.email}
        </Text>
      </View>

      {/* Date */}
      <View style={styles.dateRow}>
        <MaterialCommunityIcons name="calendar-outline" size={13} color="#888" />
        <Text style={styles.dateText}>{lead.date}</Text>
      </View>

      {/* Stage badge */}
      <View style={styles.stageBadge}>
        <MaterialCommunityIcons name="account-outline" size={12} color="#3b5bdb" />
        <Text style={styles.stageBadgeText}>{lead.stage}</Text>
      </View>

      {/* Expanded section */}
      {expanded && (
        <>
          <View style={styles.divider} />

          <Text style={styles.assignedLabel}>Assigned To</Text>
          <View style={styles.assignedRow}>
            <View style={styles.assignedAvatar}>
              <Text style={styles.assignedAvatarText}>{lead.assignedInitial}</Text>
            </View>
            <Text style={styles.assignedName}>{lead.assignedTo}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{lead.assignedRole}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.viewBtn} activeOpacity={0.85}>
              <MaterialCommunityIcons name="eye-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.85}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color="#555" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface AllLeadsScreenProps {
  onMenuPress:    () => void;
  onSearchPress:  () => void;
  onProfilePress: () => void;
  onAddLead:      () => void;   // ← navigates to CreateLeadScreen
}

const AllLeadsScreen: React.FC<AllLeadsScreenProps> = ({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onAddLead,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = ALL_LEADS.filter(
    l =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      l.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <View style={styles.root}>
      <TopBar
        onMenuPress={onMenuPress}
        onSearchPress={onSearchPress}
        onProfilePress={onProfilePress}
        initials="RS"
      />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero Banner ── */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconCircle}>
              <MaterialCommunityIcons name="account-group" size={26} color="#fff" />
            </View>
            <View style={{flex: 1, marginLeft: 14}}>
              <Text style={styles.heroTitle}>Lead Management</Text>
              <Text style={styles.heroSubtitle}>
                Total {ALL_LEADS.length} leads • Team Member view
              </Text>
            </View>
          </View>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.heroBtn}>
              <MaterialCommunityIcons name="filter-variant" size={14} color="#fff" />
              <Text style={styles.heroBtnText}>Filter</Text>
            </TouchableOpacity>
            {/* ← onAddLead wired here */}
            <TouchableOpacity style={styles.heroBtn} onPress={onAddLead}>
              <MaterialCommunityIcons name="plus" size={14} color="#fff" />
              <Text style={styles.heroBtnText}>Add Lead</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#aaa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Lead Cards header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lead Cards</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filtered.length} total</Text>
          </View>
        </View>

        {/* ── Lead list ── */}
        <View style={styles.cardList}>
          {filtered.length > 0 ? (
            filtered.map(lead => <LeadCard key={lead.id} lead={lead} />)
          ) : (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="account-search-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No leads found</Text>
            </View>
          )}
        </View>

        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
};

export default AllLeadsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   {flex: 1, backgroundColor: '#f0f4ff'},
  scroll: {flex: 1},

  heroBanner: {
    margin: 12, borderRadius: 16, backgroundColor: '#3b5bdb',
    padding: 18, paddingBottom: 20,
  },
  heroTop: {flexDirection: 'row', alignItems: 'center', marginBottom: 16},
  heroIconCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle:    {fontSize: 18, fontWeight: '800', color: '#fff'},
  heroSubtitle: {fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3},
  heroButtons:  {flexDirection: 'row', gap: 10},
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ff9800', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  heroBtnText: {color: '#fff', fontSize: 13, fontWeight: '700'},

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 24,
    marginHorizontal: 12, marginTop: 4,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 8,
  },
  searchInput: {flex: 1, fontSize: 14, color: '#222', paddingVertical: 0},

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16, marginBottom: 10, gap: 8,
  },
  sectionTitle:   {fontSize: 16, fontWeight: '800', color: '#1a1a3e'},
  countBadge:     {backgroundColor: '#eef1ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2},
  countBadgeText: {fontSize: 12, color: '#3b5bdb', fontWeight: '600'},

  cardList: {marginHorizontal: 12, gap: 12},
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#3b5bdb', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  leadName:   {fontSize: 15, fontWeight: '700', color: '#1a1a3e'},
  leadId:     {fontSize: 11, color: '#999', marginTop: 1},
  expandBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },

  infoRow:  {flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap'},
  infoText: {fontSize: 12, color: '#444', marginLeft: 4, flexShrink: 1},
  dateRow:  {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  dateText: {fontSize: 12, color: '#555', marginLeft: 4},

  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#eef1ff', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  stageBadgeText: {fontSize: 11, color: '#3b5bdb', fontWeight: '600'},

  divider:            {height: 1, backgroundColor: '#eef1ff', marginVertical: 12},
  assignedLabel:      {fontSize: 12, color: '#888', marginBottom: 8},
  assignedRow:        {flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8},
  assignedAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#3b5bdb', alignItems: 'center', justifyContent: 'center',
  },
  assignedAvatarText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  assignedName:       {fontSize: 13, color: '#1a1a3e', fontWeight: '600'},
  roleBadge:          {backgroundColor: '#eef1ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2},
  roleBadgeText:      {fontSize: 10, color: '#3b5bdb', fontWeight: '700'},

  actionRow: {flexDirection: 'row', gap: 10},
  viewBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ff9800', borderRadius: 10, paddingVertical: 11,
  },
  editBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#ddd', paddingVertical: 11,
  },

  emptyWrap: {alignItems: 'center', paddingVertical: 40},
  emptyText: {fontSize: 14, color: '#aaa', marginTop: 10},
});