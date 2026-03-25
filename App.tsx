// App.tsx
// ─── No AsyncStorage import needed here — AuthContext handles all storage ──────

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// ── Context ────────────────────────────────────────────────────────────────────
import { AuthProvider } from './src/contexts/AuthContext';

// ── Screens ───────────────────────────────────────────────────────────────────
import LoginScreen         from './src/screen/LoginScreen';
import HomeScreen          from './src/screen/HomeScreen';
import CreateLeadScreen    from './src/screen/CreateLeadScreen';
import AllLeadsScreen      from './src/screen/Allleadsscreen';
import AttendanceScreen    from './src/screen/Attendancescreen';
import LocationVisitScreen from './src/screen/Locationvisitscreen';
import LeadFunnelScreen    from './src/screen/LeadFunnelScreen';

// ── Components ────────────────────────────────────────────────────────────────
import Sidebar           from './src/components/Sidebar';
import BottomTabBar      from './src/components/BottomTabBar';
import QuickActionsModal from './src/components/QuickActionsModal';
import ProfileDropdown   from './src/components/ProfileDropdown';
import SearchModal       from './src/components/SearchModal';
import TimePeriodModal   from './src/components/TimePeriodModal';

// ─── Types ────────────────────────────────────────────────────────────────────
type SubScreen = null | 'createLead';

interface UserData {
  name?:     string;
  role?:     string;
  email?:    string;
  token?:    string;
  initials?: string;
  [key: string]: any;
}

/* ─────────────────────────────────────────────────────────────
   INNER APP  (must be a child of AuthProvider)
───────────────────────────────────────────────────────────── */
function AppInner() {

  // ── Auth state ────────────────────────────────────────────────────────────
  const [isLoggedIn,   setIsLoggedIn]   = useState(false);
  const [currentUser,  setCurrentUser]  = useState<UserData | null>(null);
  const [authLoading,  setAuthLoading]  = useState(true);

  // ── Navigation state ──────────────────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [activeTab,  setActiveTab]  = useState('home');
  const [subScreen,  setSubScreen]  = useState<SubScreen>(null);

  // ── Modal states ──────────────────────────────────────────────────────────
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [profileOpen,      setProfileOpen]      = useState(false);
  const [searchOpen,       setSearchOpen]       = useState(false);
  const [timePeriodOpen,   setTimePeriodOpen]   = useState(false);
  const [selectedPeriod,   setSelectedPeriod]   = useState('today');

  // ── Boot: just stop the splash — AuthContext restores session internally ──
  useEffect(() => {
    // AuthContext's useEffect already re-hydrates user from MemStore.
    // We only need to stop showing the splash after a short tick.
    const timer = setTimeout(() => setAuthLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Login success handler ─────────────────────────────────────────────────
  const handleLoginSuccess = (userData: UserData) => {
    setCurrentUser(userData);
    setIsLoggedIn(true);
    setActiveTab(userData.role === 'TEAM' ? 'attendance' : 'home');
  };

  // ── Logout handler ────────────────────────────────────────────────────────
  const handleLogout = () => {
    // AuthContext.logout() clears MemStore — called from ProfileDropdown
    setProfileOpen(false);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setActiveMenu('dashboard');
    setActiveTab('home');
    setSubScreen(null);
  };

  const onDashboard = activeMenu === 'dashboard';

  const commonHandlers = {
    onMenuPress:    () => setSidebarOpen(true),
    onSearchPress:  () => setSearchOpen(true),
    onProfilePress: () => setProfileOpen(true),
  };

  const handleTabPress = (id: string) => {
    setSubScreen(null);
    if (id === 'actions') {
      setQuickActionsOpen(true);
    } else {
      setActiveTab(id);
    }
  };

  const handleMenuSelect = (id: string) => {
    setSubScreen(null);
    setActiveMenu(id);
    if (id === 'dashboard') setActiveTab('home');
    setSidebarOpen(false);
  };

  /* ── Loading splash ──────────────────────────────────────────────────────── */
  if (authLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#4569ea" />
      </View>
    );
  }

  /* ── Login screen ────────────────────────────────────────────────────────── */
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  /* ── Sub-screen renderer ─────────────────────────────────────────────────── */
  const renderSubScreen = () => {
    if (subScreen === 'createLead') {
      return (
        <CreateLeadScreen
          {...commonHandlers}
          onBack={() => setSubScreen(null)}
        />
      );
    }
    return null;
  };

  /* ── Tab screen renderer ─────────────────────────────────────────────────── */
  const renderTabScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            {...commonHandlers}
            onFilterPress={() => setTimePeriodOpen(true)}
            selectedPeriod={selectedPeriod}
            onViewVisits={()           => setActiveTab('allLeads')}
            onViewRegistrations={()    => setActiveTab('allLeads')}
            onViewMissedLeads={()      => setActiveTab('allLeads')}
            onViewAttendance={()       => setActiveTab('attendance')}
            onViewLocationVisit={()    => setActiveTab('locationVisit')}
          />
        );
      case 'allLeads':
        return (
          <AllLeadsScreen
            {...commonHandlers}
            onAddLead={() => setSubScreen('createLead')}
          />
        );
      case 'attendance':
        return (
          <AttendanceScreen
            {...commonHandlers}
            onBackPress={() => setActiveTab('home')}
          />
        );
      case 'locationVisit':
        return (
          <LocationVisitScreen
            {...commonHandlers}
            onBackPress={() => setActiveTab('home')}
          />
        );
      default:
        return (
          <HomeScreen
            {...commonHandlers}
            onFilterPress={() => setTimePeriodOpen(true)}
            selectedPeriod={selectedPeriod}
          />
        );
    }
  };

  /* ── Menu screen renderer ────────────────────────────────────────────────── */
  const renderMenuScreen = () => {
    switch (activeMenu) {
      case 'leadFunnel':
        return <LeadFunnelScreen {...commonHandlers} />;
      default:
        return null;
    }
  };

  /* ── User initials helper ────────────────────────────────────────────────── */
  const getInitials = () => {
    if (!currentUser?.name) return 'U';
    return currentUser.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /* ── Main render ─────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4ff" />

      <View style={styles.screenArea}>
        {onDashboard ? (
          <>
            <View style={styles.fill}>{renderTabScreen()}</View>
            {subScreen !== null && (
              <View style={styles.subScreenOverlay}>{renderSubScreen()}</View>
            )}
          </>
        ) : (
          renderMenuScreen()
        )}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setSidebarOpen(true)}
      >
        <MaterialCommunityIcons name="menu" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Bottom tab bar */}
      {onDashboard && (
        <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />
      )}

      {/* ── Modals ── */}
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem={activeMenu}
        onSelectItem={handleMenuSelect}
      />

      <QuickActionsModal
        visible={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onActionPress={(id: string) => console.log('Quick action:', id)}
      />

      <ProfileDropdown
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        user={{
          name:     currentUser?.name     || 'User',
          role:     currentUser?.role     || 'Member',
          email:    currentUser?.email    || '',
          initials: getInitials(),
        }}
      />

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <TimePeriodModal
        visible={timePeriodOpen}
        onClose={() => setTimePeriodOpen(false)}
        selected={selectedPeriod}
        onSelect={(id: string) => {
          setSelectedPeriod(id);
          setTimePeriodOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROOT EXPORT  — wraps everything in AuthProvider
───────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  splash: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#e8edff',
  },
  root:       { flex: 1, backgroundColor: '#f0f4ff' },
  screenArea: { flex: 1 },
  fill:       { flex: 1 },

  subScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0f4ff',
    zIndex: 5,
  },

  fab: {
    position:        'absolute',
    bottom:          80,
    right:           18,
    width:           54,
    height:          54,
    borderRadius:    27,
    backgroundColor: '#3b5bdb',
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       6,
    shadowColor:     '#3b5bdb',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
    zIndex:          10,
  },
});