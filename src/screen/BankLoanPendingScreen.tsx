// src/screen/BankLoanApplyScreen.tsx
// React Native — Bank at Pending Page
// Uses real backend API + react-native-vector-icons (MaterialIcons)
//
// Required packages:
//   npm install react-native-vector-icons
//   npm install react-native-safe-area-context
//   iOS: npx pod-install  |  Android: follow vector-icons gradle setup

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useAuth } from "../contexts/AuthContext"; // ← your existing AuthContext

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const PRIMARY_COLOR   = "#4569ea";
const SECONDARY_COLOR = "#1a237e";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEMS_PER_PAGE  = 10;
const ALLOWED_ROLES   = ["Head_office", "ZSM", "ASM", "TEAM"];

const PERIOD_OPTIONS = [
  { value: "Today",      label: "Today"      },
  { value: "This Week",  label: "This Week"  },
  { value: "This Month", label: "This Month" },
  { value: "All",        label: "All Time"   },
];

const BANK_STATUS_OPTIONS = ["pending", "approved", "rejected"];

const BANK_STATUS_CONFIG: Record<string, any> = {
  pending:  { bg: "#eef1fd", color: PRIMARY_COLOR,  label: "Pending",  icon: "hourglass-empty",  description: "Waiting for bank approval"   },
  approved: { bg: "#e8f5e9", color: "#2e7d32",       label: "Approved", icon: "check-circle",     description: "Bank approval received"      },
  rejected: { bg: "#fdeef1", color: "#e53935",       label: "Rejected", icon: "cancel",           description: "Bank rejected the application"},
};

const LEAD_STATUS_OPTIONS = ["Bank at Pending", "Disbursement", "Missed Leads"];

const LEAD_STATUS_CONFIG: Record<string, any> = {
  "Bank at Pending": { bg: "#eef1fd", color: PRIMARY_COLOR, icon: "account-balance",  description: "Awaiting bank approval"     },
  "Disbursement":   { bg: "#e8f5e9", color: "#2e7d32",      icon: "payments",         description: "Loan disbursement stage"    },
  "Missed Leads":   { bg: "#fdeef1", color: "#e53935",      icon: "cancel",           description: "Lead lost or not converted" },
};

const BANK_LIST = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
  "Punjab National Bank", "Bank of Baroda", "Canara Bank",
  "Union Bank of India", "Bank of India", "IndusInd Bank",
  "Kotak Mahindra Bank", "Yes Bank", "IDFC First Bank", "Federal Bank", "Other",
];

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const hasAccess = (role: string) => ALLOWED_ROLES.includes(role);

const getUserPermissions = (role: string) => ({
  canView:         ["Head_office","ZSM","ASM","TEAM"].includes(role),
  canEdit:         ["Head_office","ZSM","ASM","TEAM"].includes(role),
  canDelete:       role === "Head_office",
  canManage:       ["Head_office","ZSM","ASM"].includes(role),
  canSeeAll:       ["Head_office","ZSM","ASM"].includes(role),
  canSeeOwn:       role === "TEAM",
  canUpdateStatus: ["Head_office","ZSM","ASM","TEAM"].includes(role),
});

// ID comparison helper — handles both string and populated-object _id
const matchesUserId = (field: any, userId: string) => {
  if (!field || !userId) return false;
  if (typeof field === "string") return field === userId;
  if (typeof field === "object" && field._id)
    return field._id === userId || String(field._id) === String(userId);
  return String(field) === String(userId);
};

const getBankStatusConfig  = (s: string) => BANK_STATUS_CONFIG[s?.toLowerCase()]  || { bg:"#eef1fd", color:PRIMARY_COLOR, label:s||"Unknown", icon:"help", description:"" };
const getLeadStatusConfig  = (s: string) => LEAD_STATUS_CONFIG[s] || { bg:"#eef1fd", color:PRIMARY_COLOR, icon:"help", description:"Unknown" };

const formatCurrency = (amount: any) => {
  const n = parseFloat(amount);
  if (!amount && amount !== 0 || isNaN(n)) return "₹0";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const formatDate = (ds: string, short = false) => {
  if (!ds) return "Not set";
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString("en-IN", short
      ? { day:"2-digit", month:"short" }
      : { day:"2-digit", month:"short", year:"numeric" });
  } catch { return "Invalid Date"; }
};

const getInitials = (f: string, l: string) =>
  `${f?.charAt(0)||""}${l?.charAt(0)||""}`.toUpperCase();

const rgba = (hex: string, a: number) => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${a})`
    : hex;
};

// ─────────────────────────────────────────────
//  REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────

/** Avatar circle */
const Avatar = ({ initials, size = 40 }: { initials:string; size?:number }) => (
  <View style={[u.avatar,{ width:size, height:size, borderRadius:size/2 }]}>
    <Text style={[u.avatarTxt,{ fontSize:size*0.35 }]}>{initials}</Text>
  </View>
);

/** Status chip */
const Chip = ({ label, bg, color, iconName, small=false }:
  { label:string; bg:string; color:string; iconName?:string; small?:boolean }) => (
  <View style={[u.chip,{ backgroundColor:bg }, small && u.chipSm]}>
    {iconName && <Icon name={iconName} size={small?11:13} color={color} style={{ marginRight:3 }} />}
    <Text style={[u.chipTxt,{ color }, small && u.chipTxtSm]}>{label}</Text>
  </View>
);

/** Animated toast */
const Toast = ({ visible, message, severity, onHide }:
  { visible:boolean; message:string; severity:string; onHide:()=>void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(opacity,{ toValue:1, duration:280, useNativeDriver:true }),
      Animated.delay(2800),
      Animated.timing(opacity,{ toValue:0, duration:280, useNativeDriver:true }),
    ]).start(()=>onHide());
  },[visible]);
  if (!visible) return null;
  const bg = severity==="success"?"#2e7d32": severity==="error"?"#c62828":"#1565c0";
  const iconName = severity==="success"?"check-circle":"error";
  return (
    <Animated.View style={[u.toast,{ backgroundColor:bg, opacity }]}>
      <Icon name={iconName} size={18} color="#fff" />
      <Text style={u.toastTxt}>{message}</Text>
    </Animated.View>
  );
};

/** Divider */
const Divider = () => <View style={{ height:1, backgroundColor:"#f0f0f0", marginVertical:6 }} />;

/** Info row used in view modal */
const InfoRow = ({ label, value, bold=false }:{ label:string;value:string;bold?:boolean }) => (
  <View style={u.infoRow}>
    <Text style={u.infoLabel}>{label}</Text>
    <Text style={[u.infoValue, bold && { fontWeight:"700" }]} numberOfLines={2}>{value}</Text>
  </View>
);

// ─────────────────────────────────────────────
//  SUMMARY CARD
// ─────────────────────────────────────────────
const SummaryCard = ({ label, value, subText, iconName, color }:
  { label:string; value:number|string; subText:string; iconName:string; color:string }) => (
  <View style={[s.summaryCard,{ borderColor:rgba(color,0.15) }]}>
    <View style={[s.summaryIconWrap,{ backgroundColor:rgba(color,0.1) }]}>
      <Icon name={iconName} size={22} color={color} />
    </View>
    <Text style={[s.summaryVal,{ color }]}>{value}</Text>
    <Text style={s.summaryLabel}>{label}</Text>
    <Text style={s.summarySub}>{subText}</Text>
  </View>
);

// ─────────────────────────────────────────────
//  BANK CARD  (list item)
// ─────────────────────────────────────────────
const BankCard = ({ lead, onView, onStatusUpdate, permissions }:
  { lead:any; onView:(l:any)=>void; onStatusUpdate:(l:any)=>void; permissions:any }) => {
  const [expanded, setExpanded] = useState(false);
  const bsCfg  = getBankStatusConfig(lead.bankAtPendingStatus);
  const lsCfg  = getLeadStatusConfig(lead.status);

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.cardHead}>
        <Avatar initials={getInitials(lead.firstName,lead.lastName)} size={46} />
        <View style={{ flex:1, marginLeft:10 }}>
          <Text style={s.cardName}>{lead.firstName} {lead.lastName}</Text>
          <Text style={s.cardId}>ID: {lead._id?.slice(-8)||"N/A"}</Text>
        </View>
        <TouchableOpacity style={s.expandBtn} onPress={()=>setExpanded(p=>!p)}>
          <Icon name={expanded?"expand-less":"expand-more"} size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {/* ── Contact row ── */}
      <View style={s.cardRow}>
        <View style={s.cardInfoItem}>
          <Icon name="phone" size={13} color="#9ca3af" />
          <Text style={s.cardInfoTxt} numberOfLines={1}>{lead.phone||"No phone"}</Text>
        </View>
        <View style={s.cardInfoItem}>
          <Icon name="email" size={13} color="#9ca3af" />
          <Text style={s.cardInfoTxt} numberOfLines={1}>{lead.email||"No email"}</Text>
        </View>
      </View>

      {/* ── Bank + amount ── */}
      <View style={[s.cardRow,{ marginTop:4 }]}>
        <Icon name="account-balance" size={14} color={PRIMARY_COLOR} />
        <Text style={s.cardBank} numberOfLines={1}>{lead.bank||"Not specified"}</Text>
        <Text style={s.cardAmount}>{formatCurrency(lead.loanAmount)}</Text>
        <Icon name="calendar-today" size={12} color="#9ca3af" style={{ marginLeft:6 }} />
        <Text style={s.cardDate}>{formatDate(lead.bankAtPendingDate,true)}</Text>
      </View>

      {/* ── Chips ── */}
      <View style={s.chipsRow}>
        <Chip label={bsCfg.label}           bg={bsCfg.bg}  color={bsCfg.color}  iconName={bsCfg.icon}  small />
        <Chip label={lead.status||"Unknown"} bg={lsCfg.bg}  color={lsCfg.color}  iconName={lsCfg.icon}  small />
      </View>

      {/* ── Expanded ── */}
      {expanded && (
        <View style={s.expandedBox}>
          <Divider />
          {lead.branchName ? (
            <View style={s.expandedRow}>
              <Icon name="location-on" size={14} color="#9ca3af" />
              <Text style={s.expandedLabel}>Branch: </Text>
              <Text style={s.expandedVal}>{lead.branchName}</Text>
            </View>
          ) : null}
          {lead.loanApprovalDate ? (
            <View style={s.expandedRow}>
              <Icon name="event-available" size={14} color="#9ca3af" />
              <Text style={s.expandedLabel}>Approval: </Text>
              <Text style={s.expandedVal}>{formatDate(lead.loanApprovalDate)}</Text>
            </View>
          ) : null}
          {lead.bankAtPendingNotes ? (
            <View style={[s.expandedRow,{ alignItems:"flex-start" }]}>
              <Icon name="notes" size={14} color="#9ca3af" style={{ marginTop:1 }} />
              <Text style={s.expandedLabel}>Notes: </Text>
              <Text style={[s.expandedVal,{ flex:1 }]}>{lead.bankAtPendingNotes}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={s.cardActions}>
            <TouchableOpacity style={s.actionPri} onPress={()=>onView(lead)}>
              <Icon name="visibility" size={15} color="#fff" />
              <Text style={s.actionPriTxt}>View</Text>
            </TouchableOpacity>
            {permissions.canUpdateStatus && (
              <TouchableOpacity style={s.actionOut} onPress={()=>onStatusUpdate(lead)}>
                <Icon name="trending-up" size={15} color={PRIMARY_COLOR} />
                <Text style={s.actionOutTxt}>Update Status</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
//  FILTER BOTTOM SHEET
// ─────────────────────────────────────────────
const FilterSheet = ({ visible, onClose, period, setPeriod, bankStatusFilter,
  setBankStatusFilter, leadStatusFilter, setLeadStatusFilter, bankFilter,
  setBankFilter, searchQuery, setSearchQuery, handleClearFilters, activeFilterCount }: any) => {

  const [section, setSection] = useState<string|null>("period");
  const toggle = (id:string) => setSection(p=>p===id?null:id);

  const Sec = ({ id, title, iconName, children }:
    { id:string; title:string; iconName:string; children:React.ReactNode }) => (
    <View style={f.section}>
      <TouchableOpacity style={f.secHead} onPress={()=>toggle(id)}>
        <View style={f.secHeadLeft}>
          <Icon name={iconName} size={18} color={PRIMARY_COLOR} />
          <Text style={f.secTitle}>{title}</Text>
        </View>
        <Icon name={section===id?"expand-less":"expand-more"} size={20} color="#9ca3af" />
      </TouchableOpacity>
      {section===id && <View style={f.secBody}>{children}</View>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={f.overlay}>
        <View style={f.sheet}>
          {/* handle */}
          <View style={f.handle} />

          {/* header */}
          <View style={f.header}>
            <View>
              <Text style={f.title}>Filter Leads</Text>
              <Text style={f.sub}>{activeFilterCount} active filter{activeFilterCount!==1?"s":""}</Text>
            </View>
            <TouchableOpacity style={f.closeBtn} onPress={onClose}>
              <Icon name="close" size={20} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight:"70%" }} showsVerticalScrollIndicator={false}>
            {/* Search */}
            <Sec id="search" title="Search" iconName="search">
              <View style={f.searchBox}>
                <Icon name="search" size={16} color="#9ca3af" />
                <TextInput
                  style={f.searchInput}
                  placeholder="Name, phone, bank…"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={()=>setSearchQuery("")}>
                    <Icon name="close" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Sec>

            {/* Period */}
            <Sec id="period" title="Time Period" iconName="date-range">
              <View style={f.periodGrid}>
                {PERIOD_OPTIONS.map(opt=>(
                  <TouchableOpacity key={opt.value}
                    style={[f.periodBtn, period===opt.value && f.periodBtnActive]}
                    onPress={()=>setPeriod(opt.value)}>
                    <Text style={[f.periodTxt, period===opt.value && f.periodTxtActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Sec>

            {/* Bank Status */}
            <Sec id="bankStatus" title="Bank Status" iconName="account-balance">
              {["All",...BANK_STATUS_OPTIONS].map(st=>{
                const cfg = st==="All" ? null : getBankStatusConfig(st);
                const active = bankStatusFilter===st;
                return (
                  <TouchableOpacity key={st} style={[f.option, active&&f.optionActive]}
                    onPress={()=>setBankStatusFilter(st)}>
                    {cfg && <Icon name={cfg.icon} size={15} color={active?"#fff":cfg.color} style={{ marginRight:7 }} />}
                    <Text style={[f.optionTxt, active&&f.optionTxtActive]}>
                      {st==="All"?"All Statuses":cfg?.label}
                    </Text>
                    {active && <Icon name="check" size={15} color="#fff" style={{ marginLeft:"auto" }} />}
                  </TouchableOpacity>
                );
              })}
            </Sec>

            {/* Lead Status */}
            <Sec id="leadStatus" title="Lead Status" iconName="trending-up">
              {["All",...LEAD_STATUS_OPTIONS].map(st=>{
                const cfg = st==="All" ? null : getLeadStatusConfig(st);
                const active = leadStatusFilter===st;
                return (
                  <TouchableOpacity key={st} style={[f.option, active&&f.optionActive]}
                    onPress={()=>setLeadStatusFilter(st)}>
                    {cfg && <Icon name={cfg.icon} size={15} color={active?"#fff":cfg.color} style={{ marginRight:7 }} />}
                    <Text style={[f.optionTxt, active&&f.optionTxtActive]}>
                      {st==="All"?"All Statuses":st}
                    </Text>
                    {active && <Icon name="check" size={15} color="#fff" style={{ marginLeft:"auto" }} />}
                  </TouchableOpacity>
                );
              })}
            </Sec>

            {/* Bank */}
            <Sec id="bank" title="Bank" iconName="account-balance-wallet">
              {["All",...BANK_LIST].map(bank=>{
                const active = bankFilter===bank;
                return (
                  <TouchableOpacity key={bank} style={[f.option, active&&f.optionActive]}
                    onPress={()=>setBankFilter(bank)}>
                    <Icon name="account-balance" size={14} color={active?"#fff":PRIMARY_COLOR} style={{ marginRight:7 }} />
                    <Text style={[f.optionTxt, active&&f.optionTxtActive]}>
                      {bank==="All"?"All Banks":bank}
                    </Text>
                    {active && <Icon name="check" size={15} color="#fff" style={{ marginLeft:"auto" }} />}
                  </TouchableOpacity>
                );
              })}
            </Sec>
          </ScrollView>

          {/* Footer */}
          <View style={f.footer}>
            <TouchableOpacity style={f.clearBtn} onPress={()=>{ handleClearFilters(); onClose(); }}>
              <Icon name="clear" size={16} color={PRIMARY_COLOR} />
              <Text style={f.clearTxt}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={f.applyBtn} onPress={onClose}>
              <Icon name="check" size={16} color="#fff" />
              <Text style={f.applyTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  VIEW LEAD MODAL
// ─────────────────────────────────────────────
const ViewLeadModal = ({ visible, onClose, lead }:
  { visible:boolean; onClose:()=>void; lead:any }) => {
  const [tab, setTab] = useState(0);
  if (!lead) return null;

  const TABS = [
    { label:"Bank Info",  iconName:"account-balance"  },
    { label:"Customer",   iconName:"person"            },
    { label:"Documents",  iconName:"folder-open"       },
    { label:"Notes",      iconName:"notes"             },
  ];

  const docs = [
    { title: 'Registration Doc', url: lead.uploadDocument?.url, iconName: 'description' },
    { title: 'Aadhaar Card', url: lead.aadhaar?.url, iconName: 'badge' },
    { title: 'PAN Card', url: lead.panCard?.url, iconName: 'credit-card' },
    { title: 'Bank Passbook', url: lead.passbook?.url, iconName: 'receipt-long' },
    { title: 'Installation Doc', url: lead.installationDocument?.url, iconName: 'construction' },
    ...(lead.otherDocuments?.map((d:any, i:number) => ({
      title: d.name || `Other Doc ${i + 1}`, url: d.url, iconName: 'insert-drive-file',
    })) || []),
    ...(lead.enhancementDocuments?.map((d:any, i:number) => ({
      title: d.name || `Enhancement Doc ${i + 1}`, url: d.url, iconName: 'bolt',
    })) || []),
  ].filter((d:any) => d.url);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:"#f8fafc" }}>
        {/* Header */}
        <View style={vm.header}>
          <Avatar initials={getInitials(lead.firstName,lead.lastName)} size={44} />
          <View style={{ flex:1, marginLeft:12 }}>
            <Text style={vm.name}>{lead.firstName} {lead.lastName}</Text>
            <Text style={vm.sub}>Bank Pending • {formatCurrency(lead.loanAmount)}</Text>
          </View>
          <TouchableOpacity style={vm.closeBtn} onPress={onClose}>
            <Icon name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={vm.tabs}>
          {TABS.map((t,i)=>(
            <TouchableOpacity key={i} style={[vm.tab, tab===i&&vm.tabActive]} onPress={()=>setTab(i)}>
              <Icon name={t.iconName} size={16} color={tab===i?PRIMARY_COLOR:"#9ca3af"} />
              <Text style={[vm.tabTxt, tab===i&&vm.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex:1, padding:14 }}>
          {tab===0 && (
            <>
              <View style={vm.card}>
                <View style={vm.cardTitle}>
                  <Icon name="account-balance" size={17} color={PRIMARY_COLOR} />
                  <Text style={vm.cardTitleTxt}>Bank Information</Text>
                </View>
                <InfoRow label="Bank"              value={lead.bank||"Not specified"}   />
                <InfoRow label="Branch"            value={lead.branchName||"Not specified"} />
                <InfoRow label="Loan Amount"       value={formatCurrency(lead.loanAmount)} bold />
                <InfoRow label="Approval Date"     value={formatDate(lead.loanApprovalDate)} />
              </View>
              <View style={[vm.card,{ marginTop:10 }]}>
                <View style={vm.cardTitle}>
                  <Icon name="trending-up" size={17} color={PRIMARY_COLOR} />
                  <Text style={vm.cardTitleTxt}>Status Information</Text>
                </View>
                <View style={u.infoRow}>
                  <Text style={u.infoLabel}>Bank Status</Text>
                  <Chip label={getBankStatusConfig(lead.bankAtPendingStatus).label}
                    bg={getBankStatusConfig(lead.bankAtPendingStatus).bg}
                    color={getBankStatusConfig(lead.bankAtPendingStatus).color}
                    iconName={getBankStatusConfig(lead.bankAtPendingStatus).icon} small />
                </View>
                <Divider />
                <View style={u.infoRow}>
                  <Text style={u.infoLabel}>Lead Status</Text>
                  <Chip label={lead.status||"Unknown"}
                    bg={getLeadStatusConfig(lead.status).bg}
                    color={getLeadStatusConfig(lead.status).color}
                    iconName={getLeadStatusConfig(lead.status).icon} small />
                </View>
                <InfoRow label="Bank at Pending Date" value={formatDate(lead.bankAtPendingDate)} />
                <InfoRow label="Last Updated"         value={formatDate(lead.updatedAt)} />
              </View>
            </>
          )}

          {tab===1 && (
            <View style={vm.card}>
              <View style={vm.cardTitle}>
                <Icon name="person" size={17} color={PRIMARY_COLOR} />
                <Text style={vm.cardTitleTxt}>Customer Information</Text>
              </View>
              <InfoRow label="Full Name"          value={`${lead.firstName} ${lead.lastName}`} bold />
              <InfoRow label="Email"              value={lead.email||"Not set"} />
              <InfoRow label="Phone"              value={lead.phone||"Not set"} />
              <InfoRow label="Address"            value={lead.address||"Not set"} />
              <InfoRow label="City"               value={lead.city||"Not set"} />
              <InfoRow label="Solar Requirement"  value={lead.solarRequirement||"Not specified"} />
            </View>
          )}

          {tab===2 && (
            <View>
              <View style={vm.cardTitle}>
                <Icon name="folder-open" size={17} color={PRIMARY_COLOR} />
                <Text style={vm.cardTitleTxt}>All Documents</Text>
              </View>
              {docs.length > 0 ? docs.map((doc:any, i:number) => (
                <View key={i} style={[vm.card, { flexDirection:'row', alignItems:'center', marginBottom:10 }]}>
                  <Icon name={doc.iconName} size={20} color={PRIMARY_COLOR} />
                  <Text style={{ flex:1, marginLeft:10, color:'#1f2937', fontWeight:'600' }} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(doc.url)}>
                    <Text style={{ color: PRIMARY_COLOR, fontWeight:'700' }}>View</Text>
                  </TouchableOpacity>
                </View>
              )) : (
                <View style={vm.card}>
                  <Text style={vm.notesEmpty}>No documents uploaded</Text>
                </View>
              )}
            </View>
          )}

          {tab===3 && (
            <View style={vm.card}>
              <View style={vm.cardTitle}>
                <Icon name="notes" size={17} color={PRIMARY_COLOR} />
                <Text style={vm.cardTitleTxt}>Bank Pending Notes</Text>
              </View>
              {lead.bankAtPendingNotes
                ? <Text style={vm.notesTxt}>{lead.bankAtPendingNotes}</Text>
                : <Text style={vm.notesEmpty}>No notes available</Text>}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={vm.closeFull} onPress={onClose}>
          <Text style={vm.closeFullTxt}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  STATUS UPDATE MODAL
// ─────────────────────────────────────────────
const StatusUpdateModal = ({ visible, onClose, lead, onStatusUpdate, showToast, fetchAPI }: any) => {
  const [selBank, setSelBank]   = useState("");
  const [selLead, setSelLead]   = useState("");
  const [reason, setReason]     = useState("");
  const [notes,  setNotes]      = useState("");
  const [loading, setLoading]   = useState(false);
  const [errors,  setErrors]    = useState<Record<string,string>>({});

  useEffect(()=>{
    if (visible && lead) {
      setSelBank(lead.bankAtPendingStatus||"");
      setSelLead(lead.status||"Bank at Pending");
      setReason(lead.reason||"");
      setNotes(lead.bankAtPendingNotes||"");
      setErrors({});
    }
  },[visible,lead]);

  const autoLeadStatus = (bs:string) => {
    if (bs==="approved") return "Disbursement";
    if (bs==="rejected") return "Missed Leads";
    return "Bank at Pending";
  };

  const handleSubmit = async () => {
    const errs: Record<string,string> = {};
    if (!selBank)                           errs.bankStatus = "Please select a bank status";
    if (selBank==="rejected"&&!reason.trim()) errs.reason = "Reason is required for rejection";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const payload = {
        bankAtPendingStatus: selBank,
        status:              selLead,
        reason:              selBank==="rejected" ? reason : undefined,
        bankAtPendingNotes:  notes || undefined,
      };

      const res = await fetchAPI(`/lead/updateLead/${lead._id}`, {
        method: "PUT",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        showToast("Bank status updated successfully","success");
        onStatusUpdate(res.result);
        onClose();
      } else {
        throw new Error(res?.message||"Failed to update");
      }
    } catch(e: any) {
      showToast(e.message||"Update failed","error");
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  const available = BANK_STATUS_OPTIONS.filter(st=>st!==lead.bankAtPendingStatus);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:"#f8fafc" }}>
        <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={{ flex:1 }}>
          {/* Header */}
          <View style={su.header}>
            <View style={su.headerIcon}>
              <Icon name="trending-up" size={22} color={PRIMARY_COLOR} />
            </View>
            <View style={{ flex:1, marginLeft:10 }}>
              <Text style={su.title}>Update Bank Status</Text>
              <Text style={su.sub}>{lead.firstName} {lead.lastName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Icon name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex:1, padding:16 }}>
            {/* Current */}
            <Text style={su.sectionLbl}>Current Status</Text>
            <View style={{ marginBottom:14 }}>
              <Chip label={getBankStatusConfig(lead.bankAtPendingStatus).label}
                bg={getBankStatusConfig(lead.bankAtPendingStatus).bg}
                color={getBankStatusConfig(lead.bankAtPendingStatus).color}
                iconName={getBankStatusConfig(lead.bankAtPendingStatus).icon} />
            </View>

            {/* New bank status */}
            <Text style={su.sectionLbl}>New Bank Status *</Text>
            {errors.bankStatus && <Text style={su.errTxt}>{errors.bankStatus}</Text>}
            {available.map(st=>{
              const cfg = getBankStatusConfig(st);
              const active = selBank===st;
              return (
                <TouchableOpacity key={st}
                  style={[su.option, active&&su.optionActive]}
                  onPress={()=>{ setSelBank(st); setSelLead(autoLeadStatus(st)); setErrors({}); }}>
                  <View style={[su.optIconWrap,{ backgroundColor:active?"rgba(255,255,255,0.2)":rgba(cfg.color,0.1) }]}>
                    <Icon name={cfg.icon} size={18} color={active?"#fff":cfg.color} />
                  </View>
                  <View style={{ flex:1, marginLeft:10 }}>
                    <Text style={[su.optLabel, active&&{ color:"#fff" }]}>{cfg.label}</Text>
                    <Text style={[su.optDesc,  active&&{ color:"rgba(255,255,255,0.8)" }]}>{cfg.description}</Text>
                  </View>
                  {active && <Icon name="check-circle" size={20} color="#fff" />}
                </TouchableOpacity>
              );
            })}

            {/* Auto lead status */}
            {selLead ? (
              <View style={{ marginTop:14, marginBottom:10 }}>
                <Text style={su.sectionLbl}>Lead Status (Auto-assigned)</Text>
                <Chip label={selLead}
                  bg={getLeadStatusConfig(selLead).bg}
                  color={getLeadStatusConfig(selLead).color}
                  iconName={getLeadStatusConfig(selLead).icon} />
              </View>
            ):null}

            {/* Rejection reason */}
            {selBank==="rejected" && (
              <View style={{ marginTop:10 }}>
                <Text style={su.sectionLbl}>Reason for Rejection *</Text>
                {errors.reason && <Text style={su.errTxt}>{errors.reason}</Text>}
                <TextInput style={[su.textarea, errors.reason&&su.textareaErr]}
                  placeholder="Enter reason…" value={reason} onChangeText={setReason}
                  multiline numberOfLines={3} placeholderTextColor="#9ca3af"
                  textAlignVertical="top" />
              </View>
            )}

            {/* Notes */}
            <View style={{ marginTop:14 }}>
              <Text style={su.sectionLbl}>Status Notes (optional)</Text>
              <TextInput style={su.textarea}
                placeholder="Add notes…" value={notes} onChangeText={setNotes}
                multiline numberOfLines={3} placeholderTextColor="#9ca3af"
                textAlignVertical="top" />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={su.footer}>
            <TouchableOpacity style={su.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={su.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[su.submitBtn,(!selBank||loading)&&su.submitDisabled]}
              onPress={handleSubmit} disabled={!selBank||loading}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Icon name="save" size={16} color="#fff" /><Text style={su.submitTxt}>Update Status</Text></>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────
const EmptyState = ({ onClearFilters, hasFilters }:{ onClearFilters:()=>void; hasFilters:boolean }) => (
  <View style={misc.empty}>
    <View style={misc.emptyIcon}>
      <Icon name="account-balance" size={48} color={PRIMARY_COLOR} />
    </View>
    <Text style={misc.emptyTitle}>No bank pending leads found</Text>
    <Text style={misc.emptySub}>
      {hasFilters
        ? "No leads match your current filters. Try adjusting your criteria."
        : "No leads are currently pending bank approval."}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={misc.emptyClearBtn} onPress={onClearFilters}>
        <Icon name="clear" size={15} color="#fff" />
        <Text style={misc.emptyClearTxt}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─────────────────────────────────────────────
//  LOADING SKELETON
// ─────────────────────────────────────────────
const SkeletonCard = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(()=>{
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(opacity,{ toValue:1, duration:700, useNativeDriver:true }),
      Animated.timing(opacity,{ toValue:0.3, duration:700, useNativeDriver:true }),
    ]));
    anim.start();
    return ()=>anim.stop();
  },[]);
  return (
    <Animated.View style={[misc.skeleton,{ opacity }]}>
      <View style={misc.skeletonHead} />
      <View style={misc.skeletonLine} />
      <View style={[misc.skeletonLine,{ width:"60%" }]} />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────
//  PROPS
// ─────────────────────────────────────────────
interface Props {
  onMenuPress?:    ()=>void;
  onBackPress?:    ()=>void;
}

// ─────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────
export default function BankLoanPendingScreen({ onMenuPress, onBackPress }: Props = {}) {
  // ── Auth ──────────────────────────────────
  const { fetchAPI, user, getUserRole } = useAuth();
  const userRole   = getUserRole();
  const perms      = useMemo(()=>getUserPermissions(userRole),[userRole]);

  // ── Core state ────────────────────────────
  const [period,      setPeriod]     = useState("Today");
  const [loading,     setLoading]    = useState(true);
  const [refreshing,  setRefreshing] = useState(false);
  const [error,       setError]      = useState<string|null>(null);

  // ── Toast ─────────────────────────────────
  const [toast, setToast] = useState({ visible:false, message:"", severity:"success" });
  const showToast = useCallback((message:string, severity="success") => {
    setToast({ visible:true, message, severity });
  },[]);

  // ── Data ──────────────────────────────────
  const [leads,   setLeads]   = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalLeads:0, pendingLeads:0, approvedLeads:0, rejectedLeads:0, totalLoanAmount:0
  });

  // ── Filters ───────────────────────────────
  const [searchQuery,       setSearchQuery]       = useState("");
  const [bankStatusFilter,  setBankStatusFilter]  = useState("All");
  const [leadStatusFilter,  setLeadStatusFilter]  = useState("All");
  const [bankFilter,        setBankFilter]        = useState("All");
  const [filterOpen,        setFilterOpen]        = useState(false);

  // ── Pagination ────────────────────────────
  const [page, setPage] = useState(0);

  // ── Modals ────────────────────────────────
  const [viewOpen,   setViewOpen]   = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selLead,    setSelLead]    = useState<any>(null);

  // ── Fetch from backend ────────────────────
  const fetchData = useCallback(async (isRefresh=false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      // Build date-range params
      const params = new URLSearchParams();
      const today  = new Date();
      if (period==="Today") {
        const d = today.toISOString().split("T")[0];
        params.append("startDate",d); params.append("endDate",d);
      } else if (period==="This Week") {
        const wk = new Date(today); wk.setDate(today.getDate()-7);
        params.append("startDate",wk.toISOString().split("T")[0]);
        params.append("endDate",today.toISOString().split("T")[0]);
      } else if (period==="This Month") {
        const mo = new Date(today); mo.setMonth(today.getMonth()-1);
        params.append("startDate",mo.toISOString().split("T")[0]);
        params.append("endDate",today.toISOString().split("T")[0]);
      }

      const qs = params.toString();
      const res = await fetchAPI(`/lead/bankingAtPending${qs?`?${qs}`:""}`);

      if (!res?.success) throw new Error(res?.message||"Failed to fetch data");

      const raw: any[] = res.result?.leads || res.result || [];

      // Role-based client-side filter (mirrors DocumentSubmissionPage logic)
      let filtered = raw;
      if (userRole==="TEAM" && user?._id) {
        const uid = String(user._id);
        filtered = raw.filter(d=>
          matchesUserId(d.createdBy,uid)||matchesUserId(d.assignedTo,uid)||
          matchesUserId(d.assignedManager,uid)||matchesUserId(d.assignedUser,uid)||
          matchesUserId(d.teamMember,uid)
        );
      } else if (userRole==="ASM" && user?._id) {
        const uid = String(user._id);
        filtered = raw.filter(d=>
          matchesUserId(d.createdBy,uid)||matchesUserId(d.assignedManager,uid)||
          matchesUserId(d.areaManager,uid)||matchesUserId(d.assignedTo,uid)
        );
      } else if (userRole==="ZSM" && user?._id) {
        const uid = String(user._id);
        filtered = raw.filter(d=>
          matchesUserId(d.createdBy,uid)||matchesUserId(d.zoneManager,uid)||
          matchesUserId(d.assignedManager,uid)
        );
      }
      // Head_office sees all

      setLeads(filtered);
      setSummary({
        totalLeads:     filtered.length,
        pendingLeads:   filtered.filter(l=>l.bankAtPendingStatus==="pending").length,
        approvedLeads:  filtered.filter(l=>l.bankAtPendingStatus==="approved").length,
        rejectedLeads:  filtered.filter(l=>l.bankAtPendingStatus==="rejected").length,
        totalLoanAmount:filtered.reduce((acc,l)=>acc+(parseFloat(l.loanAmount)||0),0),
      });
    } catch(e:any) {
      setError(e.message||"Network error");
      showToast(e.message||"Failed to fetch data","error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },[period, fetchAPI, userRole, user, showToast]);

  useEffect(()=>{ if(hasAccess(userRole)) fetchData(); },[fetchData,userRole]);

  // ── Client-side filter + sort ─────────────
  const filteredLeads = useMemo(()=>{
    let list = [...leads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(l=>
        (l.firstName?.toLowerCase()||"").includes(q)||
        (l.lastName?.toLowerCase() ||"").includes(q)||
        (l.phone||"").includes(q)||
        (l.bank?.toLowerCase()||"").includes(q)
      );
    }
    if (bankStatusFilter!=="All") list=list.filter(l=>l.bankAtPendingStatus===bankStatusFilter);
    if (leadStatusFilter!=="All") list=list.filter(l=>l.status===leadStatusFilter);
    if (bankFilter!=="All")       list=list.filter(l=>l.bank===bankFilter);
    // newest first
    list.sort((a,b)=>new Date(b.bankAtPendingDate||b.createdAt||0).getTime()
                    -new Date(a.bankAtPendingDate||a.createdAt||0).getTime());
    return list;
  },[leads,searchQuery,bankStatusFilter,leadStatusFilter,bankFilter]);

  const paginated   = useMemo(()=>filteredLeads.slice(page*ITEMS_PER_PAGE,(page+1)*ITEMS_PER_PAGE),[filteredLeads,page]);
  const totalPages  = Math.ceil(filteredLeads.length/ITEMS_PER_PAGE);

  const activeFilterCount = useMemo(()=>{
    let c=0;
    if (searchQuery)           c++;
    if (bankStatusFilter!=="All") c++;
    if (leadStatusFilter!=="All") c++;
    if (bankFilter!=="All")    c++;
    return c;
  },[searchQuery,bankStatusFilter,leadStatusFilter,bankFilter]);

  const handleClearFilters = useCallback(()=>{
    setSearchQuery(""); setBankStatusFilter("All");
    setLeadStatusFilter("All"); setBankFilter("All"); setPage(0);
  },[]);

  // ── Access guard ──────────────────────────
  if (!hasAccess(userRole)) {
    return (
      <SafeAreaView style={misc.denied}>
        <Icon name="block" size={52} color="#e53935" />
        <Text style={misc.deniedTitle}>Access Denied</Text>
        <Text style={misc.deniedSub}>You don't have permission to view this page.</Text>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────
  return (
    <SafeAreaView style={pg.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

      {/* Toast */}
      <Toast visible={toast.visible} message={toast.message} severity={toast.severity}
        onHide={()=>setToast(p=>({...p,visible:false}))} />

      {/* Modals */}
      <FilterSheet visible={filterOpen} onClose={()=>setFilterOpen(false)}
        period={period} setPeriod={setPeriod}
        bankStatusFilter={bankStatusFilter} setBankStatusFilter={setBankStatusFilter}
        leadStatusFilter={leadStatusFilter} setLeadStatusFilter={setLeadStatusFilter}
        bankFilter={bankFilter} setBankFilter={setBankFilter}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        handleClearFilters={handleClearFilters} activeFilterCount={activeFilterCount} />

      <ViewLeadModal visible={viewOpen} onClose={()=>setViewOpen(false)} lead={selLead} />

      <StatusUpdateModal visible={statusOpen} onClose={()=>setStatusOpen(false)}
        lead={selLead} onStatusUpdate={(updated:any)=>{
          setLeads(prev=>prev.map(l=>l._id===updated._id?updated:l));
        }} showToast={showToast} fetchAPI={fetchAPI} />

      {/* ── Header banner ── */}
      <View style={pg.header}>
        <View style={pg.headerLeft}>
          {onBackPress && (
            <TouchableOpacity style={pg.iconBtn} onPress={onBackPress}>
              <Icon name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={pg.headerTitle}>Bank at Pending</Text>
            <Text style={pg.headerSub}>Track and manage bank approval leads</Text>
          </View>
        </View>
        <View style={pg.headerRight}>
          <TouchableOpacity style={pg.iconBtn} onPress={()=>fetchData()} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Icon name="refresh" size={20} color="#fff" />}
          </TouchableOpacity>
          {onMenuPress && (
            <TouchableOpacity style={pg.iconBtn} onPress={onMenuPress}>
              <Icon name="menu" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Summary cards ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={pg.sumScroll} contentContainerStyle={pg.sumScrollContent}>
        <SummaryCard label="Total Pending" value={summary.totalLeads}    iconName="description"    color={PRIMARY_COLOR} subText="All bank pending" />
        <SummaryCard label="Pending"       value={summary.pendingLeads}  iconName="hourglass-empty" color="#f59e0b"       subText="Awaiting approval" />
        <SummaryCard label="Approved"      value={summary.approvedLeads} iconName="check-circle"   color="#2e7d32"       subText="Bank approved" />
        <SummaryCard label="Rejected"      value={summary.rejectedLeads} iconName="cancel"         color="#e53935"       subText="Bank rejected" />
        <SummaryCard label="Total Amount"  value={formatCurrency(summary.totalLoanAmount)} iconName="account-balance-wallet" color={SECONDARY_COLOR} subText="Loan amount" />
      </ScrollView>

      {/* ── Period tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={pg.periodScroll} contentContainerStyle={pg.periodScrollContent}>
        {PERIOD_OPTIONS.map(opt=>(
          <TouchableOpacity key={opt.value}
            style={[pg.periodTab, period===opt.value&&pg.periodTabActive]}
            onPress={()=>{ setPeriod(opt.value); setPage(0); }}>
            <Icon name="date-range" size={13}
              color={period===opt.value?"#fff":"#555"} style={{ marginRight:4 }} />
            <Text style={[pg.periodTabTxt, period===opt.value&&pg.periodTabTxtActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Search + filter ── */}
      <View style={pg.searchRow}>
        <View style={pg.searchBox}>
          <Icon name="search" size={17} color="#9ca3af" />
          <TextInput style={pg.searchInput}
            placeholder="Search by name, phone, bank…"
            value={searchQuery} onChangeText={t=>{ setSearchQuery(t); setPage(0); }}
            placeholderTextColor="#9ca3af" />
          {searchQuery
            ? <TouchableOpacity onPress={()=>setSearchQuery("")}>
                <Icon name="close" size={17} color="#9ca3af" />
              </TouchableOpacity>
            : null}
        </View>
        <TouchableOpacity style={pg.filterBtn} onPress={()=>setFilterOpen(true)}>
          <Icon name="filter-alt" size={20} color={PRIMARY_COLOR} />
          {activeFilterCount>0 && (
            <View style={pg.badge}>
              <Text style={pg.badgeTxt}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Active filter chips ── */}
      {activeFilterCount>0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal:12, paddingBottom:8 }}
          contentContainerStyle={{ gap:6, paddingRight:12 }}>
          {searchQuery && (
            <TouchableOpacity style={pg.chip} onPress={()=>setSearchQuery("")}>
              <Text style={pg.chipTxt}>Search: {searchQuery}</Text>
              <Icon name="close" size={12 }color={PRIMARY_COLOR} />
            </TouchableOpacity>
          )}
          {bankStatusFilter!=="All" && (
            <TouchableOpacity style={pg.chip} onPress={()=>setBankStatusFilter("All")}>
              <Text style={pg.chipTxt}>Bank: {bankStatusFilter}</Text>
              <Icon name="close" size={12} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          )}
          {leadStatusFilter!=="All" && (
            <TouchableOpacity style={pg.chip} onPress={()=>setLeadStatusFilter("All")}>
              <Text style={pg.chipTxt}>Lead: {leadStatusFilter}</Text>
              <Icon name="close" size={12} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          )}
          {bankFilter!=="All" && (
            <TouchableOpacity style={pg.chip} onPress={()=>setBankFilter("All")}>
              <Text style={pg.chipTxt}>{bankFilter}</Text>
              <Icon name="close" size={12} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[pg.chip,{ borderColor:"#e53935" }]} onPress={handleClearFilters}>
            <Text style={[pg.chipTxt,{ color:"#e53935" }]}>Clear All</Text>
            <Icon name="clear" size={12} color="#e53935" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Results header ── */}
      <View style={pg.resultsRow}>
        <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
          <Icon name="list" size={16} color={PRIMARY_COLOR} />
          <Text style={pg.resultsTxt}>
            Bank Pending Leads{" "}
            <Text style={{ color:PRIMARY_COLOR }}>({filteredLeads.length})</Text>
          </Text>
        </View>
        {activeFilterCount>0 && (
          <TouchableOpacity onPress={handleClearFilters} style={{ flexDirection:"row", alignItems:"center", gap:3 }}>
            <Icon name="clear" size={13} color="#e53935" />
            <Text style={pg.clearLink}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      {loading ? (
        <ScrollView contentContainerStyle={{ padding:14 }}>
          {[1,2,3,4,5].map(i=><SkeletonCard key={i} />)}
        </ScrollView>
      ) : error && leads.length===0 ? (
        <View style={misc.errBox}>
          <Icon name="error-outline" size={44} color="#e53935" />
          <Text style={misc.errTitle}>Failed to load data</Text>
          <Text style={misc.errSub}>{error}</Text>
          <TouchableOpacity style={misc.retryBtn} onPress={()=>fetchData()}>
            <Icon name="refresh" size={16} color={PRIMARY_COLOR} />
            <Text style={misc.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={paginated}
          keyExtractor={item=>item._id}
          contentContainerStyle={{ paddingHorizontal:12, paddingBottom:90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={()=>{ setRefreshing(true); fetchData(true); }}
              colors={[PRIMARY_COLOR]} tintColor={PRIMARY_COLOR} />
          }
          renderItem={({ item })=>(
            <BankCard lead={item}
              onView={l=>{ setSelLead(l); setViewOpen(true); }}
              onStatusUpdate={l=>{ setSelLead(l); setStatusOpen(true); }}
              permissions={perms} />
          )}
          ListEmptyComponent={<EmptyState onClearFilters={handleClearFilters} hasFilters={activeFilterCount>0} />}
        />
      )}

      {/* ── Pagination ── */}
      {filteredLeads.length>ITEMS_PER_PAGE && (
        <View style={pg.pagination}>
          <TouchableOpacity style={[pg.pageBtn,page===0&&pg.pageBtnDis]}
            onPress={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>
            <Icon name="chevron-left" size={20} color={page===0?"#ccc":"#fff"} />
          </TouchableOpacity>
          <View style={pg.pageInfo}>
            <Icon name="menu" size={14} color="#555" />
            <Text style={pg.pageInfoTxt}>{page+1} of {totalPages}</Text>
          </View>
          <TouchableOpacity style={[pg.pageBtn,page>=totalPages-1&&pg.pageBtnDis]}
            onPress={()=>setPage(p=>p+1)} disabled={page>=totalPages-1}>
            <Icon name="chevron-right" size={20} color={page>=totalPages-1?"#ccc":"#fff"} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

/** Utility / shared */
const u = StyleSheet.create({
  avatar: { backgroundColor:PRIMARY_COLOR, alignItems:"center", justifyContent:"center" },
  avatarTxt: { color:"#fff", fontWeight:"700" },
  chip: { flexDirection:"row", alignItems:"center", paddingHorizontal:10, paddingVertical:5, borderRadius:20 },
  chipSm: { paddingHorizontal:8, paddingVertical:3 },
  chipTxt: { fontSize:12, fontWeight:"600" },
  chipTxtSm: { fontSize:10 },
  toast: { position:"absolute", top:Platform.OS==="ios"?50:24, left:14, right:14, flexDirection:"row",
    alignItems:"center", gap:8, padding:13, borderRadius:12, zIndex:9999, elevation:12,
    shadowColor:"#000", shadowOffset:{width:0,height:3}, shadowOpacity:0.2, shadowRadius:6 },
  toastTxt: { color:"#fff", fontSize:13, fontWeight:"500", flex:1 },
  infoRow: { flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#f0f0f0" },
  infoLabel: { fontSize:13, color:"#888", flex:1 },
  infoValue: { fontSize:13, color:"#333", flex:1, textAlign:"right" },
});

/** Main page */
const pg = StyleSheet.create({
  container: { flex:1, backgroundColor:"#f8fafc" },
  header: { backgroundColor:PRIMARY_COLOR, paddingHorizontal:14, paddingVertical:14,
    flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  headerLeft: { flexDirection:"row", alignItems:"center", flex:1, gap:10 },
  headerRight: { flexDirection:"row", alignItems:"center", gap:8 },
  iconBtn: { backgroundColor:"rgba(255,255,255,0.18)", borderRadius:9, padding:8 },
  headerTitle: { fontSize:17, fontWeight:"800", color:"#fff" },
  headerSub: { fontSize:11, color:"rgba(255,255,255,0.85)", marginTop:1 },

  sumScroll: { backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#eee" },
  sumScrollContent: { paddingHorizontal:12, paddingVertical:12, gap:10 },

  periodScroll: { backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#eee" },
  periodScrollContent: { paddingHorizontal:12, paddingVertical:8, gap:8 },
  periodTab: { flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingVertical:7,
    borderRadius:20, borderWidth:1, borderColor:"#e0e4f8", backgroundColor:"#f5f6fa" },
  periodTabActive: { backgroundColor:PRIMARY_COLOR, borderColor:PRIMARY_COLOR },
  periodTabTxt: { fontSize:12, color:"#555", fontWeight:"500" },
  periodTabTxtActive: { color:"#fff", fontWeight:"700" },

  searchRow: { flexDirection:"row", paddingHorizontal:12, paddingVertical:10, gap:8,
    backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#eee" },
  searchBox: { flex:1, flexDirection:"row", alignItems:"center", backgroundColor:"#f5f6fa",
    borderRadius:10, paddingHorizontal:10, borderWidth:1, borderColor:"#e0e4f8", gap:7 },
  searchInput: { flex:1, height:42, fontSize:14, color:"#333", padding:0 },
  filterBtn: { padding:11, backgroundColor:rgba(PRIMARY_COLOR,0.08),
    borderRadius:10, borderWidth:1, borderColor:rgba(PRIMARY_COLOR,0.2), position:"relative" },
  badge: { position:"absolute", top:-4, right:-4, backgroundColor:"#e53935",
    borderRadius:8, minWidth:16, height:16, alignItems:"center", justifyContent:"center", paddingHorizontal:2 },
  badgeTxt: { fontSize:9, color:"#fff", fontWeight:"700" },

  chip: { flexDirection:"row", alignItems:"center", backgroundColor:rgba(PRIMARY_COLOR,0.07),
    borderWidth:1, borderColor:rgba(PRIMARY_COLOR,0.2), paddingHorizontal:10,
    paddingVertical:5, borderRadius:20, gap:4 },
  chipTxt: { fontSize:11, color:PRIMARY_COLOR, fontWeight:"500" },

  resultsRow: { flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:14, paddingVertical:10 },
  resultsTxt: { fontSize:14, fontWeight:"600", color:"#222" },
  clearLink: { fontSize:12, color:"#e53935", fontWeight:"600" },

  pagination: { flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:16, paddingVertical:12, backgroundColor:"#fff",
    borderTopWidth:1, borderTopColor:"#eee" },
  pageBtn: { backgroundColor:PRIMARY_COLOR, borderRadius:9, padding:8 },
  pageBtnDis: { backgroundColor:"#e5e7eb" },
  pageInfo: { flexDirection:"row", alignItems:"center", gap:6 },
  pageInfoTxt: { fontSize:14, color:"#555", fontWeight:"500" },
});

/** Summary card */
const s = StyleSheet.create({
  summaryCard: { backgroundColor:"#fff", borderRadius:14, padding:13, minWidth:120,
    alignItems:"center", borderWidth:1, elevation:2,
    shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4 },
  summaryIconWrap: { width:40, height:40, borderRadius:10, alignItems:"center",
    justifyContent:"center", marginBottom:8 },
  summaryVal: { fontSize:24, fontWeight:"800" },
  summaryLabel: { fontSize:11, fontWeight:"600", color:"#333", marginTop:2, textAlign:"center" },
  summarySub: { fontSize:10, color:"#888", marginTop:1, textAlign:"center" },

  // Bank card
  card: { backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10,
    borderWidth:1, borderColor:rgba(PRIMARY_COLOR,0.12), elevation:2,
    shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4 },
  cardHead: { flexDirection:"row", alignItems:"center", marginBottom:10 },
  cardName: { fontSize:15, fontWeight:"700", color:PRIMARY_COLOR },
  cardId:   { fontSize:11, color:"#9ca3af", marginTop:1 },
  expandBtn: { padding:6, backgroundColor:rgba(PRIMARY_COLOR,0.08), borderRadius:8 },
  cardRow: { flexDirection:"row", alignItems:"center", gap:5, marginBottom:5 },
  cardInfoItem: { flexDirection:"row", alignItems:"center", flex:1, gap:4 },
  cardInfoTxt: { fontSize:12, color:"#6b7280", flex:1 },
  cardBank: { flex:1, fontSize:13, fontWeight:"600", color:"#333" },
  cardAmount: { fontSize:13, fontWeight:"700", color:"#1f2937" },
  cardDate: { fontSize:11, color:"#9ca3af" },
  chipsRow: { flexDirection:"row", flexWrap:"wrap", gap:6, marginTop:4 },
  expandedBox: { marginTop:8, paddingTop:4 },
  expandedRow: { flexDirection:"row", alignItems:"center", gap:5, marginVertical:4 },
  expandedLabel: { fontSize:12, color:"#6b7280" },
  expandedVal: { fontSize:12, color:"#1f2937", fontWeight:"500" },
  cardActions: { flexDirection:"row", gap:8, marginTop:12 },
  actionPri: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center",
    backgroundColor:PRIMARY_COLOR, paddingVertical:10, borderRadius:10, gap:5 },
  actionPriTxt: { color:"#fff", fontSize:13, fontWeight:"600" },
  actionOut: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center",
    borderWidth:1, borderColor:PRIMARY_COLOR, paddingVertical:10, borderRadius:10, gap:5 },
  actionOutTxt: { color:PRIMARY_COLOR, fontSize:13, fontWeight:"600" },
});

/** Filter sheet */
const f = StyleSheet.create({
  overlay: { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  sheet: { backgroundColor:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24,
    paddingBottom:Platform.OS==="ios"?28:12 },
  handle: { width:38, height:4, backgroundColor:"#d1d5db", borderRadius:2,
    alignSelf:"center", marginTop:10, marginBottom:4 },
  header: { flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:16, paddingVertical:13,
    borderBottomWidth:1, borderBottomColor:rgba(PRIMARY_COLOR,0.1) },
  title: { fontSize:16, fontWeight:"700", color:PRIMARY_COLOR },
  sub: { fontSize:11, color:"#9ca3af", marginTop:1 },
  closeBtn: { padding:7, backgroundColor:rgba(PRIMARY_COLOR,0.08), borderRadius:8 },
  section: { borderBottomWidth:1, borderBottomColor:"#f3f4f6" },
  secHead: { flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:16, paddingVertical:13, backgroundColor:"#fafbff" },
  secHeadLeft: { flexDirection:"row", alignItems:"center", gap:8 },
  secTitle: { fontSize:14, fontWeight:"600", color:"#333" },
  secBody: { paddingHorizontal:14, paddingBottom:12, paddingTop:8 },
  searchBox: { flexDirection:"row", alignItems:"center", borderWidth:1, borderColor:"#d1d5db",
    borderRadius:10, paddingHorizontal:10, paddingVertical:9, backgroundColor:"#fff", gap:7 },
  searchInput: { flex:1, fontSize:14, color:"#1f2937", padding:0 },
  periodGrid: { flexDirection:"row", flexWrap:"wrap", gap:8 },
  periodBtn: { paddingHorizontal:14, paddingVertical:8, borderRadius:9,
    borderWidth:1, borderColor:PRIMARY_COLOR, width:"48%", alignItems:"center" },
  periodBtnActive: { backgroundColor:PRIMARY_COLOR },
  periodTxt: { fontSize:13, color:PRIMARY_COLOR, fontWeight:"500" },
  periodTxtActive: { color:"#fff", fontWeight:"700" },
  option: { flexDirection:"row", alignItems:"center", paddingHorizontal:12,
    paddingVertical:9, borderRadius:9, marginBottom:5, backgroundColor:"#f5f6fa" },
  optionActive: { backgroundColor:PRIMARY_COLOR },
  optionTxt: { fontSize:13, color:"#444", fontWeight:"500" },
  optionTxtActive: { color:"#fff", fontWeight:"600" },
  footer: { flexDirection:"row", padding:14, borderTopWidth:1, borderTopColor:"#f0f0f0", gap:10 },
  clearBtn: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center",
    borderWidth:1, borderColor:PRIMARY_COLOR, borderRadius:10, paddingVertical:12, gap:5 },
  clearTxt: { color:PRIMARY_COLOR, fontWeight:"600", fontSize:14 },
  applyBtn: { flex:2, flexDirection:"row", alignItems:"center", justifyContent:"center",
    backgroundColor:PRIMARY_COLOR, borderRadius:10, paddingVertical:12, gap:5 },
  applyTxt: { color:"#fff", fontWeight:"700", fontSize:14 },
});

/** View modal */
const vm = StyleSheet.create({
  header: { backgroundColor:PRIMARY_COLOR, flexDirection:"row", alignItems:"center", padding:16 },
  name: { fontSize:16, fontWeight:"700", color:"#fff" },
  sub: { fontSize:11, color:"rgba(255,255,255,0.85)", marginTop:2 },
  closeBtn: { padding:7, backgroundColor:"rgba(255,255,255,0.2)", borderRadius:8 },
  tabs: { flexDirection:"row", backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#eee" },
  tab: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center",
    paddingVertical:12, borderBottomWidth:2, borderBottomColor:"transparent", gap:4 },
  tabActive: { borderBottomColor:PRIMARY_COLOR },
  tabTxt: { fontSize:12, color:"#9ca3af", fontWeight:"500" },
  tabTxtActive: { color:PRIMARY_COLOR, fontWeight:"700" },
  card: { backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10,
    borderWidth:1, borderColor:rgba(PRIMARY_COLOR,0.1) },
  cardTitle: { flexDirection:"row", alignItems:"center", gap:6, marginBottom:12 },
  cardTitleTxt: { fontSize:14, fontWeight:"700", color:PRIMARY_COLOR },
  notesTxt: { fontSize:14, color:"#333", lineHeight:22 },
  notesEmpty: { fontSize:14, color:"#aaa", fontStyle:"italic" },
  closeFull: { margin:14, backgroundColor:PRIMARY_COLOR, borderRadius:12,
    paddingVertical:14, alignItems:"center" },
  closeFullTxt: { color:"#fff", fontWeight:"700", fontSize:15 },
});

/** Status update modal */
const su = StyleSheet.create({
  header: { flexDirection:"row", alignItems:"center", padding:16,
    borderBottomWidth:1, borderBottomColor:"#e5e7eb", backgroundColor:rgba(PRIMARY_COLOR,0.04) },
  headerIcon: { width:42, height:42, borderRadius:10, backgroundColor:rgba(PRIMARY_COLOR,0.1),
    alignItems:"center", justifyContent:"center" },
  title: { fontSize:15, fontWeight:"700", color:"#1f2937" },
  sub: { fontSize:12, color:"#6b7280", marginTop:1 },
  sectionLbl: { fontSize:13, fontWeight:"600", color:"#374151", marginBottom:8 },
  errTxt: { fontSize:11, color:"#ef4444", marginBottom:5 },
  option: { flexDirection:"row", alignItems:"center", padding:14, borderRadius:12,
    borderWidth:1, borderColor:"#e0e4f8", backgroundColor:"#f8f9ff", marginBottom:9 },
  optionActive: { backgroundColor:PRIMARY_COLOR, borderColor:PRIMARY_COLOR },
  optIconWrap: { width:38, height:38, borderRadius:9, alignItems:"center", justifyContent:"center" },
  optLabel: { fontSize:14, fontWeight:"600", color:"#333" },
  optDesc: { fontSize:11, color:"#888", marginTop:2 },
  textarea: { borderWidth:1, borderColor:"#e0e4f8", borderRadius:10, paddingHorizontal:12,
    paddingVertical:10, fontSize:14, color:"#333", backgroundColor:"#fff", minHeight:80 },
  textareaErr: { borderColor:"#ef4444" },
  footer: { flexDirection:"row", padding:14, borderTopWidth:1, borderTopColor:"#e5e7eb", gap:10 },
  cancelBtn: { flex:1, paddingVertical:13, borderRadius:10, borderWidth:1,
    borderColor:PRIMARY_COLOR, alignItems:"center" },
  cancelTxt: { color:PRIMARY_COLOR, fontWeight:"600", fontSize:15 },
  submitBtn: { flex:2, flexDirection:"row", alignItems:"center", justifyContent:"center",
    backgroundColor:PRIMARY_COLOR, borderRadius:10, paddingVertical:13, gap:6 },
  submitDisabled: { backgroundColor:"#ccc" },
  submitTxt: { color:"#fff", fontWeight:"700", fontSize:15 },
});

/** Misc */
const misc = StyleSheet.create({
  empty: { alignItems:"center", paddingVertical:56, paddingHorizontal:24 },
  emptyIcon: { width:96, height:96, borderRadius:48, backgroundColor:rgba(PRIMARY_COLOR,0.1),
    alignItems:"center", justifyContent:"center", marginBottom:14 },
  emptyTitle: { fontSize:16, fontWeight:"700", color:"#333", marginBottom:7, textAlign:"center" },
  emptySub: { fontSize:13, color:"#888", textAlign:"center", lineHeight:20 },
  emptyClearBtn: { marginTop:14, flexDirection:"row", alignItems:"center",
    backgroundColor:PRIMARY_COLOR, paddingHorizontal:20, paddingVertical:10, borderRadius:9, gap:6 },
  emptyClearTxt: { color:"#fff", fontWeight:"600", fontSize:13 },
  skeleton: { backgroundColor:"#e5e7eb", borderRadius:14, padding:16, marginBottom:10, height:110 },
  skeletonHead: { width:"60%", height:16, backgroundColor:"#d1d5db", borderRadius:8, marginBottom:10 },
  skeletonLine: { width:"80%", height:12, backgroundColor:"#d1d5db", borderRadius:6, marginBottom:7 },
  errBox: { flex:1, alignItems:"center", justifyContent:"center", padding:28 },
  errTitle: { fontSize:16, fontWeight:"700", color:"#e53935", marginTop:10 },
  errSub: { fontSize:13, color:"#888", textAlign:"center", marginTop:4 },
  retryBtn: { flexDirection:"row", alignItems:"center", marginTop:14, borderWidth:1,
    borderColor:PRIMARY_COLOR, paddingHorizontal:20, paddingVertical:10, borderRadius:9, gap:6 },
  retryTxt: { color:PRIMARY_COLOR, fontWeight:"600" },
  denied: { flex:1, alignItems:"center", justifyContent:"center", padding:24 },
  deniedTitle: { fontSize:20, fontWeight:"700", color:"#e53935", marginTop:10 },
  deniedSub: { fontSize:13, color:"#888", textAlign:"center", marginTop:5 },
});
