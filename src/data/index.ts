import {StatCardData, MenuItem, BottomTab, PersonData} from '../types';

export const MENU_ITEMS: MenuItem[] = [
  {id: 'dashboard',    label: 'Dashboard',    icon: 'view-dashboard',        lib: 'mci'},
  {id: 'leadFunnel',   label: 'Lead Funnel',  icon: 'filter-variant',        lib: 'mci'},
  
  {id: 'totalVisits',  label: 'Total Visits', icon: 'account-multiple',      lib: 'mci'},
  {id: 'registration', label: 'Registration', icon: 'account-plus',          lib: 'mci'},
  {id: 'document',     label: 'Document',     icon: 'file-document-outline', lib: 'mci'},
  {id: 'bankLoan',     label: 'Bank Loan',    icon: 'bank',                  lib: 'mci'},
  {id: 'loanPending',  label: 'Loan Pending', icon: 'clock-outline',         lib: 'mci'},
  {id: 'disbursement', label: 'Disbursement', icon: 'credit-card-outline',   lib: 'mci'},
  {id: 'installation',   label: 'Installation',   icon: 'clipboard-check-outline', lib: 'mci'},
{id: 'missedLeads',    label: 'Missed Leads',    icon: 'alert-outline',           lib: 'mci'},


{id: 'expense',        label: 'Expense',         icon: 'currency-usd-circle-outline', lib: 'mci'},
];

export const BOTTOM_TABS: BottomTab[] = [
  {id: 'home',    label: 'Home',    icon: 'home',            lib: 'mci'},
{id: 'allLeads',     label: 'All Leads',    icon: 'account-filter',        lib: 'mci'},
{id: 'attendance',     label: 'Attendance',      icon: 'calendar-check-outline',  lib: 'mci'},
{id: 'locationVisit',  label: 'Location Visit',  icon: 'map-marker-outline',      lib: 'mci'},
  {id: 'actions', label: 'Actions', icon: 'lightning-bolt',  lib: 'mci'},
];

export const STAT_CARDS: StatCardData[] = [
  {value: 5, label: 'Total Visits',    change: '+8.2%',  changeType: 'up',      iconName: 'eye-outline',             iconLib: 'mci'},
  {value: 2, label: 'Registrations',   change: '+15.5%', changeType: 'up',      iconName: 'account-plus-outline',    iconLib: 'mci'},
  {value: 0, label: 'Missed Leads',    change: '0%',     changeType: 'down',    iconName: 'close-circle-outline',    iconLib: 'mci'},
  {value: 9, label: 'My Leads',        change: '0%',     changeType: 'neutral', iconName: 'clipboard-check-outline', iconLib: 'mci'},
  {value: 0, label: "Today's Target",  change: '+20%',   changeType: 'up',      iconName: 'target',                  iconLib: 'mci', suffix: '/5',  subLabel: 'Visits completed'},
  {value: 0, label: 'My Performance',  change: '+3.2%',  changeType: 'up',      iconName: 'chart-bar',               iconLib: 'mci', suffix: '%',   subLabel: 'This month'},
//   {value: 0, label: 'Documents',       change: '0%',     changeType: 'neutral', iconName: 'file-document-outline',   iconLib: 'mci'},
//   {value: 0, label: 'Disbursement',    change: '0%',     changeType: 'neutral', iconName: 'cash-multiple',           iconLib: 'mci', prefix: '₹'},
//   {value: 1, label: 'Installations',   change: '+8.7%',  changeType: 'up',      iconName: 'check-circle-outline',    iconLib: 'mci'},
//   {value: 8, label: 'Team Members',    change: '+3.1%',  changeType: 'up',      iconName: 'account-group-outline',   iconLib: 'mci', subLabel: 'Active members'},
];

export const RECENT_VISITS: PersonData[] = [
  {id: '1', name: 'Reddy .',       phone: '9937752236'},
  {id: '2', name: 'Tushar .',      phone: '8457852616'},
  {id: '3', name: 'ANANTA SAMAL',  phone: '7847867300'},
];

export const RECENT_REGISTRATIONS: PersonData[] = [
  {id: '1', name: 'tushar kumar',    phone: '7456778888'},
  {id: '2', name: 'chelai chm gha',  phone: '6373737378'},
];

// Empty = shows empty state UI; add items to show list rows
export const MISSED_LEADS: PersonData[] = [];