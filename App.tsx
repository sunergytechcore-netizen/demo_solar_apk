// App.tsx
// ─── BottomTabBar shown ONLY when onDashboard === true ───────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
 
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// ── Context ───────────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// ── Screens ───────────────────────────────────────────────────────────────────
import LoginScreen              from './src/screen/LoginScreen';
import HomeScreen               from './src/screen/HomeScreen';
import CreateLeadScreen         from './src/screen/CreateLeadScreen';
import AllLeadsScreen           from './src/screen/Allleadsscreen';


import LeadFunnelScreen         from './src/screen/LeadFunnelScreen';
import TotalVisitsScreen        from './src/screen/TotalVisitsScreen';
import RegistrationScreen       from './src/screen/Registrationscreen';

 // ← fixed: screen/, not components/

// ── Components ────────────────────────────────────────────────────────────────
import Sidebar           from './src/components/Sidebar';
import BottomTabBar      from './src/components/BottomTabBar';
import QuickActionsModal from './src/components/QuickActionsModal';
import ProfileDropdown   from './src/components/ProfileDropdown';
import SearchModal       from './src/components/SearchModal';
import TimePeriodModal   from './src/components/TimePeriodModal';
import DocumentSubmissionPage from './src/components/Documentsubmissionscreen';
import BankLoanPendingScreen from './src/screen/BankLoanPendingScreen';
import BankLoanApplyScreen from './src/screen/BankLoanApplyScreen';
import DisbursementPage from './src/screen/DisbursementScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import MissedLeadsPage from './src/screen/MissedLeadsScreen';
import InstallationPage from './src/screen/InstallationScreen';
import ExpensesScreen from './src/screen/ExpensesScreen';
import AttendanceScreen from './src/screen/Attendancescreen';
import CreateVisitScreen from './src/screen/Locationvisitscreen';


// ─── Types ────────────────────────────────────────────────────────────────────
type SubScreen = null | 'createLead';

type TabId =
  | 'home'
  | 'allLeads'
  | 'attendance'
  | 'locationVisit'
  | 'totalVisits'
  | 'actions';

type MenuId =
  | 'dashboard'
  | 'leadFunnel'
  | 'totalVisits'
  | 'registration'
  | 'bankLoan'
  | 'document'     // ← added to union
  |'loanPending'
  |'disbursement'
  |'missedLeads'
  | string;

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

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { user, loading: authLoading, logout } = useAuth();
  const isLoggedIn = !!user;
  const currentUser = (user as UserData | null) ?? null;

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard');
  const [activeTab,  setActiveTab]  = useState<TabId>('home');
  const [subScreen,  setSubScreen]  = useState<SubScreen>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [profileOpen,      setProfileOpen]      = useState(false);
  const [searchOpen,       setSearchOpen]       = useState(false);
  const [timePeriodOpen,   setTimePeriodOpen]   = useState(false);
  const [selectedPeriod,   setSelectedPeriod]   = useState('today');

  // ── Boot ──────────────────────────────────────────────────────────────────
  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLoginSuccess = (userData: UserData) => {
    setActiveTab(userData.role === 'TEAM' ? 'attendance' : 'home');
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    setActiveMenu('dashboard');
    setActiveTab('home');
    setSubScreen(null);
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const backToDashboard = () => {
    setActiveMenu('dashboard');
    setActiveTab('home');
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
      setActiveTab(id as TabId);
    }
  };

  const handleMenuSelect = (id: string) => {
    setSubScreen(null);
    setActiveMenu(id as MenuId);
    if (id === 'dashboard') setActiveTab('home');
    setSidebarOpen(false);
  };

  const handleQuickActionPress = (id: string) => {
    setQuickActionsOpen(false);
    setSubScreen(null);

    switch (id) {
      case 'newVisit':
        setActiveMenu('dashboard');
        setActiveTab('locationVisit');
        break;
      case 'registration':
        setActiveMenu('registration');
        break;
      case 'bankLoan':
        setActiveMenu('bankLoan');
        break;
      case 'document':
        setActiveMenu('document');
        break;
      default:
        setActiveMenu('dashboard');
        setActiveTab('home');
        break;
    }
  };

  /* ── Splash ──────────────────────────────────────────────────────────────── */
  if (authLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#4569ea" />
      </View>
    );
  }

  /* ── Login ───────────────────────────────────────────────────────────────── */
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  /* ── Sub-screen ──────────────────────────────────────────────────────────── */
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

  /* ── Tab screens ─────────────────────────────────────────────────────────── */
  const renderTabScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            {...commonHandlers}
            onFilterPress={() => setTimePeriodOpen(true)}
            selectedPeriod={selectedPeriod}
            onViewTotalVisits={()     => setActiveTab('totalVisits')}
            onViewRegistrations={()   => setActiveMenu('registration')}
            onViewMissedLeads={()     => setActiveMenu('missedLeads')}
            onViewAttendance={()      => setActiveTab('attendance')}
            onViewLocationVisit={()   => setActiveTab('locationVisit')}
            onViewBankLoans={()       => setActiveMenu('bankLoan')}
            onViewDocuments={()       => setActiveMenu('document')} // ← optional shortcut
            onViewLocanPending={()       => setActiveMenu('loanPending')} 
            onViewDisbursement={()       => setActiveMenu('disbursement')} 
            onViewmissedLeads={()       => setActiveMenu('missedLeads')} 
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
          <CreateVisitScreen
            {...commonHandlers}
            onBackPress={() => setActiveTab('home')}
          />
        );
      case 'totalVisits':
        return (
          <TotalVisitsScreen
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

  /* ── Menu screens ────────────────────────────────────────────────────────── */
  const renderMenuScreen = () => {
    switch (activeMenu) {

      case 'leadFunnel':
        return <LeadFunnelScreen {...commonHandlers} />;

      case 'totalVisits':
        return (
          <TotalVisitsScreen
            {...commonHandlers}
            onBackPress={backToDashboard}
          />
        );

      case 'registration':
        return (
          <RegistrationScreen
            {...commonHandlers}
            onBackPress={backToDashboard}
          />
        );

      case 'loanPending':
        return (
          <BankLoanPendingScreen
            {...commonHandlers}
            onBackPress={backToDashboard}
          />
        );

      // ── Document Submission ────────────────────────────────────────────────
      case 'document':
        return (
          <DocumentSubmissionPage 
            onBackPress={backToDashboard}
            onMenuPress={() => setSidebarOpen(true)}
          />
        );

        case 'bankLoan':
        return (
          <BankLoanApplyScreen 
            onBackPress={backToDashboard}
            onMenuPress={() => setSidebarOpen(true)}
          />
        );

        case 'disbursement':
        return (
          <DisbursementPage 
            onBackPress={backToDashboard}
            onMenuPress={() => setSidebarOpen(true)}
          />
        );
        case 'missedLeads':
        return (
          <MissedLeadsPage
            onBackPress={backToDashboard}
            onMenuPress={() => setSidebarOpen(true)}
          />
        );

         case 'installation':
        return (
          <InstallationPage
            onBackPress={backToDashboard}
            onMenuPress={() => setSidebarOpen(true)}
          />
        )
          case 'expense':
        return (
          <ExpensesScreen
            onBackPress={backToDashboard}
            onMenuPress={() => setSidebarOpen(true)}
          />
        );
      // ───────────────────────────────────────────────────────────────────────

      default:
        return null;
    }
  };

  /* ── Initials ────────────────────────────────────────────────────────────── */
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

      {onDashboard ? (
        /*
         * ╔══════════════════════════╗
         * ║  Tab screen  (flex: 1)   ║
         * ║  SubScreen overlay (abs) ║
         * ╠══════════════════════════╣
         * ║  BottomTabBar            ║  ← ONLY on dashboard
         * ╚══════════════════════════╝
         */
        <View style={styles.dashboardLayout}>

          <View style={styles.fill}>
            {renderTabScreen()}

            {subScreen !== null && (
              <View style={styles.subScreenOverlay}>
                {renderSubScreen()}
              </View>
            )}
          </View>

          <BottomTabBar
            activeTab={activeTab}
            onTabPress={handleTabPress}
          />

        </View>
      ) : (
        /*
         * ╔══════════════════════════╗
         * ║  Menu screen (flex: 1)   ║  ← full screen, no bottom bar
         * ╚══════════════════════════╝
         */
        <View style={styles.fill}>
          {renderMenuScreen()}
        </View>
      )}

      {/*
       * FAB — always floats.
       *   onDashboard → bottom: 80  (clears ~64px tab bar + gap)
       *   menu screen → bottom: 24
       */}
      <TouchableOpacity
        style={[styles.fab, { bottom: onDashboard ? 80 : 24 }]}
        activeOpacity={0.85}
        onPress={() => setSidebarOpen(true)}
      >
        <MaterialCommunityIcons name="menu" size={26} color="#fff" />
      </TouchableOpacity>

      {/* ── Global modals ── */}
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem={activeMenu}
        onSelectItem={handleMenuSelect}
        onLogout={handleLogout}
      />

      <QuickActionsModal
        visible={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onActionPress={handleQuickActionPress}
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
   ROOT EXPORT
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8edff',
  },

  root: { flex: 1, backgroundColor: '#f0f4ff' },

  dashboardLayout: {
    flex: 1,
    flexDirection: 'column',
  },

  fill: { flex: 1 },

  subScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0f4ff',
    zIndex: 5,
  },

  fab: {
    position:        'absolute',
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
