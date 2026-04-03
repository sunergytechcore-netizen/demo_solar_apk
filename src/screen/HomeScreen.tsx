import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

import StatCard                    from '../components/StatCard';
import {VisitRow, RegistrationRow} from '../components/ListRows';
import MissedLeadsEmpty            from '../components/MissedLeadsEmpty';
import {
  STAT_CARDS,
  RECENT_VISITS,
  RECENT_REGISTRATIONS,
  MISSED_LEADS,
} from '../data';

interface HomeScreenProps {
  onMenuPress:    () => void;
  onSearchPress:  () => void;
  onProfilePress: () => void;
  onFilterPress:  () => void;
  selectedPeriod: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onFilterPress,
  selectedPeriod,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const periodLabel: Record<string, string> = {
    today:   'Today overview',
    weekly:  'Weekly overview',
    monthly: 'Monthly overview',
    yearly:  'Yearly overview',
  };

  const spin = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRefresh = () => {
    setRefreshing(true);
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      {iterations: 3},
    ).start();
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#3b5bdb']}
          tintColor="#3b5bdb"
        />
      }>

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={28} color="#3b5bdb" />
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress}>
            <Ionicons name="search-outline" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatar}
            onPress={onProfilePress}
            activeOpacity={0.8}>
            <Text style={styles.avatarText}>NR</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.blueLine} />

      {/* ── Greeting ── */}
      <View style={styles.greeting}>
        <View style={styles.greetingRow}>
          <Text style={styles.dashTitle}>Head Office Dashboard</Text>
          <View style={styles.greetingActions}>
            <TouchableOpacity style={styles.actionIconBtn} onPress={onFilterPress}>
              <MaterialCommunityIcons name="filter-variant" size={20} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconBtn} onPress={handleRefresh}>
              <Animated.View style={{transform: [{rotate: spin}]}}>
                <MaterialCommunityIcons
                  name="refresh"
                  size={20}
                  color={refreshing ? '#3b5bdb' : '#555'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.hiText}>Hi, Sunergy! 👋</Text>
        <Text style={styles.overviewText}>{periodLabel[selectedPeriod] ?? 'Today overview'}</Text>
      </View>

      {/* ── Stat Cards ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsRow}
        contentContainerStyle={{paddingLeft: 16, paddingRight: 8}}>
        {STAT_CARDS.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </ScrollView>

      {/* ── Recent Visits ── */}
      <View style={styles.section}>
        <SectionHeader title="Recent Visits" />
        {RECENT_VISITS.map(v => (
          <VisitRow key={v.id} name={v.name} phone={v.phone} />
        ))}
      </View>

      {/* ── Recent Registrations ── */}
      <View style={styles.section}>
        <SectionHeader title="Recent Registrations" />
        {RECENT_REGISTRATIONS.map(r => (
          <RegistrationRow key={r.id} name={r.name} phone={r.phone} />
        ))}
      </View>

      {/* ── Missed Leads ── */}
      <View style={styles.section}>
        <SectionHeader title="Missed Leads" />
        {MISSED_LEADS.length === 0 ? (
          <MissedLeadsEmpty />
        ) : (
          MISSED_LEADS.map(m => (
            <VisitRow key={m.id} name={m.name} phone={m.phone} />
          ))
        )}
      </View>
      <View style={{height: 100}} />
    </ScrollView>
  );
};

const SectionHeader = ({title}: {title: string}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <TouchableOpacity style={styles.viewAllLink}>
      <Text style={styles.viewAllLinkText}>View</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color="#3b5bdb" />
    </TouchableOpacity>
  </View>
);

export default HomeScreen;

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#f0f4ff'},
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: '#f0f4ff',
  },
  menuBtn:       {padding: 4},
  iconBtn:       {padding: 4},
  topBarRight:   {flexDirection: 'row', alignItems: 'center', gap: 14},
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#3b5bdb', alignItems: 'center', justifyContent: 'center',
  },
  avatarText:    {color: '#fff', fontSize: 13, fontWeight: '700'},
  blueLine:      {height: 3, backgroundColor: '#3b5bdb'},
  greeting:        {paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6},
  greetingRow:     {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  greetingActions: {flexDirection: 'row', alignItems: 'center', marginTop: 2},
  actionIconBtn:   {padding: 6, marginLeft: 6},
  dashTitle:       {fontSize: 20, fontWeight: '700', color: '#1a1a3e', flex: 1},
  hiText:          {fontSize: 14, color: '#444', marginTop: 4},
  overviewText:    {fontSize: 12, color: '#888', marginTop: 2},
  statsRow:        {marginTop: 12, marginBottom: 4},
  section: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 16,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitle:    {fontSize: 16, fontWeight: '700', color: '#3b5bdb'},
  viewAllLink:     {flexDirection: 'row', alignItems: 'center'},
  viewAllLinkText: {fontSize: 13, color: '#3b5bdb', fontWeight: '600'},
});

