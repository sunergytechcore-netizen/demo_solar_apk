import React, {useState} from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// ── Screens ───────────────────────────────────────────────────────────────────
import HomeScreen          from './src/screen/HomeScreen';
// import LeadFunnelScreen    from './src/screen/LeadFunnelScreen';
import CreateLeadScreen    from './src/screen/CreateLeadScreen';
import PlaceholderScreen   from './src/screen/PlaceholderScreen';
import AllLeadsScreen      from './src/screen/Allleadsscreen';



// ── Components ────────────────────────────────────────────────────────────────
import Sidebar           from './src/components/Sidebar';
import BottomTabBar      from './src/components/BottomTabBar';
import QuickActionsModal from './src/components/QuickActionsModal';
import ProfileDropdown   from './src/components/ProfileDropdown';
import SearchModal       from './src/components/SearchModal';
import TimePeriodModal   from './src/components/TimePeriodModal';
import AttendanceScreen from './src/screen/Attendancescreen';
import LocationVisitScreen from './src/screen/Locationvisitscreen';
import LeadFunnelScreen from './src/screen/LeadFunnelScreen';

// ─── Types ────────────────────────────────────────────────────────────────────
// activeMenu  → controls sidebar-level screens (leadFunnel, etc.)
// activeTab   → controls bottom-tab screens when activeMenu === 'dashboard'
// subScreen   → overlays a screen ON TOP of the current tab WITHOUT hiding the tab bar
type SubScreen = null | 'createLead';

export default function App() {

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

  // BottomTabBar is visible whenever we are on the dashboard menu level
  const onDashboard = activeMenu === 'dashboard';

  // ── Common top-bar handlers ───────────────────────────────────────────────
  const commonHandlers = {
    onMenuPress:    () => setSidebarOpen(true),
    onSearchPress:  () => setSearchOpen(true),
    onProfilePress: () => setProfileOpen(true),
  };

  // ── Tab press ─────────────────────────────────────────────────────────────
  const handleTabPress = (id: string) => {
    // Tapping any tab dismisses any open subScreen first
    setSubScreen(null);
    if (id === 'actions') {
      setQuickActionsOpen(true);
    } else {
      setActiveTab(id);
    }
  };

  // ── Sidebar item press ────────────────────────────────────────────────────
  const handleMenuSelect = (id: string) => {
    setSubScreen(null); // clear any sub-screen overlay
    setActiveMenu(id);
    if (id === 'dashboard') setActiveTab('home');
    setSidebarOpen(false);
  };

  // ── Sub-screen renderer (overlays current tab, tab bar stays visible) ─────
  const renderSubScreen = () => {
    switch (subScreen) {
      case 'createLead':
        return (
          <CreateLeadScreen
            {...commonHandlers}
            onBack={() => setSubScreen(null)}
          />
        );

      default:
        return null;
    }
  };

  // ── Tab screen renderer ───────────────────────────────────────────────────
  const renderTabScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            {...commonHandlers}
            onFilterPress={() => setTimePeriodOpen(true)}
            selectedPeriod={selectedPeriod}
            // "View >" section buttons
            onViewVisits={()        => setActiveTab('allLeads')}
            onViewRegistrations={()  => setActiveTab('allLeads')}
            onViewMissedLeads={()    => setActiveTab('allLeads')}
            onViewAttendance={()     => setActiveTab('attendance')}
            onViewLocationVisit={()  => setActiveTab('locationVisit')}
          />
        );

      case 'allLeads':
        return (
          <AllLeadsScreen
            {...commonHandlers}
            // "Add Lead" opens createLead as a subScreen overlay — tab bar stays!
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

  // ── Menu-level screen renderer (sidebar navigation) ──────────────────────
  const renderMenuScreen = () => {
    switch (activeMenu) {
      case 'leadFunnel':
        return <LeadFunnelScreen {...commonHandlers} />;
      default:
        return null; // handled by tab renderer below
    }
  };

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4ff" />

      {/* ── Screen area ── */}
      <View style={styles.screenArea}>
        {onDashboard ? (
          <>
            {/* Base tab screen — always mounted */}
            <View style={styles.fill}>
              {renderTabScreen()}
            </View>

            {/* SubScreen overlay — sits on top, hides tab screen visually */}
            {subScreen !== null && (
              <View style={styles.subScreenOverlay}>
                {renderSubScreen()}
              </View>
            )}
          </>
        ) : (
          // Sidebar-level screen (no tab bar)
          renderMenuScreen()
        )}
      </View>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setSidebarOpen(true)}>
        <MaterialCommunityIcons name="menu" size={26} color="#fff" />
      </TouchableOpacity>

      {/* ── Bottom tab bar — dashboard only ── */}
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
        onActionPress={id => console.log('Quick action:', id)}
      />

      <ProfileDropdown
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={() => {
          setProfileOpen(false);
          console.log('Logout');
        }}
        user={{
          name:     'rati sir',
          role:     'Field Executive',
          email:    'rati@gmail.com',
          initials: 'RS',
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
        onSelect={id => {
          setSelectedPeriod(id);
          setTimePeriodOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        {flex: 1, backgroundColor: '#f0f4ff'},
  screenArea:  {flex: 1},
  fill:        {flex: 1},

  // Sits on top of the tab screen but BELOW the tab bar
  subScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0f4ff',
    zIndex: 5,
  },

  fab: {
    position:       'absolute',
    bottom:         80,
    right:          18,
    width:          54,
    height:         54,
    borderRadius:   27,
    backgroundColor:'#3b5bdb',
    alignItems:     'center',
    justifyContent: 'center',
    elevation:       6,
    shadowColor:    '#3b5bdb',
    shadowOffset:   {width: 0, height: 4},
    shadowOpacity:   0.35,
    shadowRadius:    8,
    zIndex:          10,
  },
});