import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

import StatCard from '../components/StatCard';
import {VisitRow, RegistrationRow} from '../components/ListRows';
import MissedLeadsEmpty from '../components/MissedLeadsEmpty';
import {useAuth} from '../contexts/AuthContext';
import {StatCardData} from '../types';

interface HomeScreenProps {
  onMenuPress: () => void;
  onSearchPress: () => void;
  onProfilePress: () => void;
  onFilterPress: () => void;
  selectedPeriod: string;
  onViewTotalVisits?: () => void;
  onViewRegistrations?: () => void;
  onViewMissedLeads?: () => void;
  onViewAttendance?: () => void;
  onViewLocationVisit?: () => void;
  onViewBankLoans?: () => void;
  onViewDocuments?: () => void;
  onViewLocanPending?: () => void;
  onViewDisbursement?: () => void;
  onViewmissedLeads?: () => void;
}

interface DashboardPerson {
  id: string;
  name: string;
  phone: string;
}

interface DashboardStats {
  totalVisits: number;
  completedVisits: number;
  totalRegistrations: number;
  missedLeads: number;
}

interface VisitRecord {
  _id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  visitStatus?: string;
}

interface RegistrationRecord {
  _id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  registrationStatus?: string;
  assignedTo?: string;
  createdBy?: string;
  assignedUser?: {_id?: string};
}

interface MissedLeadRecord {
  _id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

const buildDateParams = (selectedPeriod: string) => {
  const params = new URLSearchParams();
  const today = new Date();
  const toParam = (date: Date) => date.toISOString().split('T')[0];

  if (selectedPeriod === 'today') {
    const date = toParam(today);
    params.append('startDate', date);
    params.append('endDate', date);
  } else if (selectedPeriod === 'weekly') {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    params.append('startDate', toParam(weekStart));
    params.append('endDate', toParam(today));
  } else if (selectedPeriod === 'monthly') {
    const monthStart = new Date(today);
    monthStart.setMonth(monthStart.getMonth() - 1);
    params.append('startDate', toParam(monthStart));
    params.append('endDate', toParam(today));
  }

  return params;
};

const fullName = (firstName?: string, lastName?: string) =>
  `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown';

const normalizePhone = (phone?: string) => phone?.trim() || 'No phone';

const HomeScreen: React.FC<HomeScreenProps> = ({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onFilterPress,
  selectedPeriod,
  onViewTotalVisits,
  onViewRegistrations,
  onViewMissedLeads,
}) => {
  const {fetchAPI, user} = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalVisits: 0,
    completedVisits: 0,
    totalRegistrations: 0,
    missedLeads: 0,
  });
  const [recentVisits, setRecentVisits] = useState<DashboardPerson[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<DashboardPerson[]>([]);
  const [missedLeads, setMissedLeads] = useState<DashboardPerson[]>([]);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const periodLabel: Record<string, string> = {
    today: 'Today overview',
    weekly: 'Weekly overview',
    monthly: 'Monthly overview',
    yearly: 'Yearly overview',
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animateRefresh = useCallback(() => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      {iterations: 3},
    ).start();
  }, [spinAnim]);

  const mapPerson = useCallback(
    (item: VisitRecord | RegistrationRecord | MissedLeadRecord): DashboardPerson => ({
      id: item._id || Math.random().toString(36).slice(2),
      name: fullName(item.firstName, item.lastName),
      phone: normalizePhone(item.phone),
    }),
    [],
  );

  const loadDashboardData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
          animateRefresh();
        } else {
          setLoading(true);
        }
        setError(null);

        const params = buildDateParams(selectedPeriod);
        const query = params.toString();
        const suffix = query ? `?${query}` : '';

        const [visitRes, registrationRes, missedRes] = await Promise.all([
          fetchAPI(`/lead/visitSummary${suffix}`),
          fetchAPI(`/lead/registrationSummary${suffix}`),
          fetchAPI(`/lead/missed${suffix}`),
        ]);

        const visitList: VisitRecord[] =
          visitRes?.result?.visits ?? visitRes?.result ?? [];
        const registrationRaw: RegistrationRecord[] =
          registrationRes?.result?.registrations ?? [];
        const missedList: MissedLeadRecord[] =
          missedRes?.result?.missedLeads ?? [];

        const currentUserId = (user as any)?._id;
        const registrationList =
          currentUserId && (user as any)?.role === 'TEAM'
            ? registrationRaw.filter(
                item =>
                  item.assignedTo === currentUserId ||
                  item.assignedUser?._id === currentUserId ||
                  item.createdBy === currentUserId,
              )
            : registrationRaw;

        setStats({
          totalVisits: visitList.length,
          completedVisits: visitList.filter(
            item => item.visitStatus === 'Completed',
          ).length,
          totalRegistrations: registrationList.length,
          missedLeads: missedList.length,
        });

        setRecentVisits(visitList.slice(0, 5).map(mapPerson));
        setRecentRegistrations(registrationList.slice(0, 5).map(mapPerson));
        setMissedLeads(missedList.slice(0, 5).map(mapPerson));
      } catch (err: any) {
        setError(err?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [animateRefresh, fetchAPI, mapPerson, selectedPeriod, user],
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const statCards = useMemo<StatCardData[]>(
    () => [
      {
        value: stats.totalVisits,
        label: 'Total Visits',
        change: `${stats.completedVisits} done`,
        changeType: stats.completedVisits > 0 ? 'up' : 'neutral',
        subLabel: periodLabel[selectedPeriod] ?? 'Today overview',
        iconName: 'map-marker-check-outline',
        iconLib: 'mci',
      },
      {
        value: stats.completedVisits,
        label: 'Completed Visits',
        change: `${stats.totalVisits} total`,
        changeType: stats.completedVisits > 0 ? 'up' : 'neutral',
        subLabel: periodLabel[selectedPeriod] ?? 'Today overview',
        iconName: 'check-circle-outline',
        iconLib: 'mci',
      },
      {
        value: stats.totalRegistrations,
        label: 'Registrations',
        change: `${recentRegistrations.length} recent`,
        changeType: stats.totalRegistrations > 0 ? 'up' : 'neutral',
        subLabel: periodLabel[selectedPeriod] ?? 'Today overview',
        iconName: 'account-plus-outline',
        iconLib: 'mci',
      },
      {
        value: stats.missedLeads,
        label: 'Missed Leads',
        change: stats.missedLeads > 0 ? 'Needs follow-up' : 'All clear',
        changeType: stats.missedLeads > 0 ? 'down' : 'up',
        subLabel: periodLabel[selectedPeriod] ?? 'Today overview',
        iconName: 'alert-circle-outline',
        iconLib: 'mci',
      },
    ],
    [periodLabel, recentRegistrations.length, selectedPeriod, stats],
  );

  const userName = useMemo(() => {
    const name = (user as any)?.name || (user as any)?.firstName || 'Team';
    return String(name).trim() || 'Team';
  }, [user]);

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDashboardData(true)}
          colors={['#3b5bdb']}
          tintColor="#3b5bdb"
        />
      }>
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
            <Text style={styles.avatarText}>
              {userName.slice(0, 2).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.blueLine} />

      <View style={styles.greeting}>
        <View style={styles.greetingRow}>
          <Text style={styles.dashTitle}>Team Dashboard</Text>
          <View style={styles.greetingActions}>
            <TouchableOpacity style={styles.actionIconBtn} onPress={onFilterPress}>
              <MaterialCommunityIcons name="filter-variant" size={20} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => loadDashboardData(true)}>
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
        <Text style={styles.hiText}>Hi, {userName}!</Text>
        <Text style={styles.overviewText}>
          {periodLabel[selectedPeriod] ?? 'Today overview'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsRow}
        contentContainerStyle={{paddingLeft: 16, paddingRight: 8}}>
        {statCards.map((card, idx) => (
          <StatCard key={`${card.label}-${idx}`} {...card} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#3b5bdb" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.section}>
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#d94841" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadDashboardData(true)}
            activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Recent Visits" onPress={onViewTotalVisits} />
        {recentVisits.length > 0 ? (
          recentVisits.map(item => (
            <VisitRow key={item.id} name={item.name} phone={item.phone} />
          ))
        ) : (
          <EmptyMessage text="No recent visits found." />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent Registrations" onPress={onViewRegistrations} />
        {recentRegistrations.length > 0 ? (
          recentRegistrations.map(item => (
            <RegistrationRow key={item.id} name={item.name} phone={item.phone} />
          ))
        ) : (
          <EmptyMessage text="No recent registrations found." />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Missed Leads" onPress={onViewMissedLeads} />
        {missedLeads.length === 0 ? (
          <MissedLeadsEmpty />
        ) : (
          missedLeads.map(item => (
            <VisitRow key={item.id} name={item.name} phone={item.phone} />
          ))
        )}
      </View>
      <View style={{height: 100}} />
    </ScrollView>
  );
};

const SectionHeader = ({
  title,
  onPress,
}: {
  title: string;
  onPress?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress ? (
      <TouchableOpacity style={styles.viewAllLink} onPress={onPress}>
        <Text style={styles.viewAllLinkText}>View</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#3b5bdb" />
      </TouchableOpacity>
    ) : null}
  </View>
);

const EmptyMessage = ({text}: {text: string}) => (
  <View style={styles.emptyWrap}>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

export default HomeScreen;

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#f0f4ff'},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#f0f4ff',
  },
  menuBtn: {padding: 4},
  iconBtn: {padding: 4},
  topBarRight: {flexDirection: 'row', alignItems: 'center', gap: 14},
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b5bdb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  blueLine: {height: 3, backgroundColor: '#3b5bdb'},
  greeting: {paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6},
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingActions: {flexDirection: 'row', alignItems: 'center', marginTop: 2},
  actionIconBtn: {padding: 6, marginLeft: 6},
  dashTitle: {fontSize: 20, fontWeight: '700', color: '#1a1a3e', flex: 1},
  hiText: {fontSize: 14, color: '#444', marginTop: 4},
  overviewText: {fontSize: 12, color: '#888', marginTop: 2},
  statsRow: {marginTop: 12, marginBottom: 4},
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {fontSize: 16, fontWeight: '700', color: '#3b5bdb'},
  viewAllLink: {flexDirection: 'row', alignItems: 'center'},
  viewAllLinkText: {fontSize: 13, color: '#3b5bdb', fontWeight: '600'},
  loadingWrap: {paddingVertical: 24, alignItems: 'center', justifyContent: 'center'},
  loadingText: {marginTop: 10, color: '#555', fontSize: 13},
  emptyWrap: {
    borderWidth: 1,
    borderColor: '#eef1ff',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {fontSize: 13, color: '#777'},
  errorBox: {flexDirection: 'row', alignItems: 'center', gap: 10},
  errorText: {flex: 1, fontSize: 13, color: '#d94841', lineHeight: 18},
  retryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#3b5bdb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {color: '#fff', fontSize: 12, fontWeight: '700'},
});
