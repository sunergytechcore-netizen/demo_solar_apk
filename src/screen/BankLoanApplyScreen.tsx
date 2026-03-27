// src/screen/BankLoanApplyScreen.tsx
// Fixed: leads array extraction, summary computed safely, robust API shape handling

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
  Platform,
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useAuth } from "../contexts/AuthContext";

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const PRIMARY   = "#4569ea";
const SUCCESS   = "#2e7d32";
const WARNING   = "#e65100";
const DANGER    = "#c62828";
const PURPLE    = "#6a1b9a";
const BG        = "#f0f2f8";

const ITEMS_PER_PAGE = 10;
const ALLOWED_ROLES  = ["Head_office", "ZSM", "ASM", "TEAM"];

const PERIOD_OPTIONS = [
  { value: "Today",      label: "Today",      icon: "calendar-today"          },
  { value: "This Week",  label: "This Week",  icon: "calendar-week"           },
  { value: "This Month", label: "This Month", icon: "calendar-month"          },
  { value: "All",        label: "All Time",   icon: "calendar-blank-multiple" },
];

const LOAN_STATUS_OPTIONS = ["pending", "submitted"];

const LOAN_STATUS_CONFIG: Record<string, {
  bg: string; color: string; label: string; icon: string; order: number;
}> = {
  pending:   { bg: "#e8edfb", color: PRIMARY,   label: "Pending",   icon: "clock-outline",        order: 1 },
  submitted: { bg: "#e8f5e9", color: "#2e7d32", label: "Submitted", icon: "check-circle-outline", order: 2 },
};

const LEAD_STATUS_OPTIONS = ["Bank Loan Apply", "Bank at Pending", "Missed Leads"];

const LEAD_STATUS_CONFIG: Record<string, { bg: string; color: string; icon: string }> = {
  "Bank Loan Apply": { bg: "#e8edfb", color: PRIMARY,  icon: "bank-outline"         },
  "Bank at Pending": { bg: "#fff3e0", color: WARNING,  icon: "file-clock-outline"   },
  "Missed Leads":    { bg: "#ffebee", color: DANGER,   icon: "close-circle-outline" },
};

const BANK_LIST = [
  "State Bank of India","HDFC Bank","ICICI Bank","Axis Bank",
  "Punjab National Bank","Bank of Baroda","Canara Bank","Union Bank of India",
  "Bank of India","IndusInd Bank","Kotak Mahindra Bank","Yes Bank",
  "IDFC First Bank","Other",
];

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const hasAccess = (role: string) => ALLOWED_ROLES.includes(role);

const getUserPermissions = (role: string) => ({
  canView:         true,
  canEdit:         true,
  canDelete:       role === "Head_office",
  canManage:       ["Head_office","ZSM","ASM"].includes(role),
  canSeeAll:       ["Head_office","ZSM","ASM"].includes(role),
  canUpdateStatus: ["Head_office","ZSM","ASM"].includes(role),
});

const getLSC = (status: string) => {
  const k = status?.toLowerCase?.();
  return LOAN_STATUS_CONFIG[k] ?? { bg:"#e8edfb", color:PRIMARY, label:status||"Unknown", icon:"help-circle-outline", order:0 };
};

const getLdSC = (status: string) =>
  LEAD_STATUS_CONFIG[status] ?? { bg:"#e8edfb", color:PRIMARY, icon:"alert-circle-outline" };

const fmt$ = (v: any): string => {
  const n = parseFloat(v);
  if (!v && v !== 0) return "₹0";
  if (isNaN(n)) return "₹0";
  if (n >= 10_000_000) return `₹${(n/10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `₹${(n/100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n/1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const fmtDate = (ds?: string|null): string => {
  if (!ds) return "Not set";
  try {
    const d = new Date(ds);
    return isNaN(d.getTime()) ? "Invalid" : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  } catch { return "Invalid"; }
};

const fmtRel = (ds?: string|null): string => {
  if (!ds) return "";
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return "";
    const sec = Math.floor((Date.now()-d.getTime())/1000);
    if (sec < 60)     return "Just now";
    if (sec < 3600)   return `${Math.floor(sec/60)}m ago`;
    if (sec < 86400)  return `${Math.floor(sec/3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec/86400)}d ago`;
    return fmtDate(ds);
  } catch { return ""; }
};

const initials = (f: string, l: string) =>
  `${f?.charAt(0)??""}${l?.charAt(0)??""}`.toUpperCase();

// ─────────────────────────────────────────────────────────────
//  KEY FIX: safely extract an array from any response shape
// ─────────────────────────────────────────────────────────────
const extractArray = (data: any): any[] => {
  // Ordered list of paths to check — returns first one that is a real array
  const candidates = [
    data?.result?.leads,
    data?.result?.data,
    data?.leads,
    data?.data?.leads,
    data?.data,
    data?.result,
    data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length >= 0) return c;
  }
  return [];
};

const extractSummary = (data: any) =>
  data?.result?.summary ?? data?.summary ?? data?.data?.summary ?? null;

// ─────────────────────────────────────────────────────────────
//  MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────

const Avatar = ({ text, size=40 }: { text:string; size?:number }) => (
  <View style={[s.avatar,{width:size,height:size,borderRadius:size/2}]}>
    <Text style={[s.avatarTxt,{fontSize:size*0.36}]}>{text}</Text>
  </View>
);

const Badge = ({
  label, bg, color, icon, sm,
}: {
  label:string; bg:string; color:string; icon?:string; sm?:boolean;
}) => (
  <View style={[s.badge,{backgroundColor:bg},sm&&s.badgeSm]}>
    {icon && <Icon name={icon} size={sm?9:11} color={color} style={{marginRight:3}}/>}
    <Text style={[s.badgeTxt,{color},sm&&s.badgeTxtSm]}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
const Toast = ({ visible, message, severity, onHide }:{
  visible:boolean; message:string; severity:string; onHide:()=>void;
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    let dead = false;
    const a = Animated.sequence([
      Animated.timing(opacity,{toValue:1,duration:220,useNativeDriver:true}),
      Animated.delay(2600),
      Animated.timing(opacity,{toValue:0,duration:220,useNativeDriver:true}),
    ]);
    a.start(() => { if (!dead) onHide(); });
    return () => { dead = true; a.stop(); };
  }, [visible]);
  if (!visible) return null;
  const bg = severity==="success"?SUCCESS:severity==="error"?DANGER:"#1565c0";
  const ic = severity==="success"?"check-circle":severity==="error"?"alert-circle":"information";
  return (
    <Animated.View style={[s.toast,{backgroundColor:bg,opacity}]}>
      <Icon name={ic} size={18} color="#fff" style={{marginRight:8}}/>
      <Text style={s.toastTxt} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
//  SUMMARY CARD
// ─────────────────────────────────────────────────────────────
const SummaryCard = ({
  label, value, sub, icon, color,
}:{
  label:string; value:string|number; sub:string; icon:string; color:string;
}) => (
  <View style={[s.sumCard,{borderLeftColor:color}]}>
    <View style={[s.sumIcon,{backgroundColor:color+"22"}]}>
      <Icon name={icon} size={22} color={color}/>
    </View>
    <Text style={[s.sumVal,{color}]} numberOfLines={1}>{value}</Text>
    <Text style={s.sumLabel} numberOfLines={1}>{label}</Text>
    <Text style={s.sumSub} numberOfLines={1}>{sub}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
//  PICKER MODAL
// ─────────────────────────────────────────────────────────────
const PickerModal = ({
  visible,title,options,optionValues,selected,onSelect,onClose,
}:{
  visible:boolean;title:string;options:string[];optionValues?:string[];
  selected:string;onSelect:(v:string)=>void;onClose:()=>void;
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={s.pmOverlay}>
      <View style={s.pmSheet}>
        <View style={s.pmBar}/>
        <View style={s.pmHead}>
          <Text style={s.pmTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Icon name="close" size={20} color="#666"/>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {options.map((opt,i)=>{
            const val = optionValues?optionValues[i]:opt;
            const sel = selected===val;
            return (
              <TouchableOpacity key={val} style={[s.pmOpt,sel&&s.pmOptSel]} onPress={()=>onSelect(val)}>
                <Text style={[s.pmOptTxt,sel&&s.pmOptTxtSel]}>{opt}</Text>
                {sel && <Icon name="check-bold" size={15} color="#fff"/>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// ─────────────────────────────────────────────────────────────
//  LOAN CARD
// ─────────────────────────────────────────────────────────────
const LoanCard = ({
  loan,onView,onEdit,permissions,
}:{
  loan:any;onView:(l:any)=>void;onEdit:(l:any)=>void;permissions:any;
}) => {
  const [open,setOpen] = useState(false);
  const lsc  = getLSC(loan.loanStatus);
  const ldsc = getLdSC(loan.status);
  return (
    <View style={s.card}>
      {/* Top row */}
      <View style={s.cardTop}>
        <Avatar text={initials(loan.firstName,loan.lastName)} size={44}/>
        <View style={s.cardMid}>
          <Text style={s.cardName} numberOfLines={1}>{loan.firstName} {loan.lastName}</Text>
          <Text style={s.cardId}>#{loan._id?.slice(-8)??"—"}</Text>
        </View>
        <TouchableOpacity onPress={()=>setOpen(!open)} style={s.cardChev}
          hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Icon name={open?"chevron-up":"chevron-down"} size={18} color={PRIMARY}/>
        </TouchableOpacity>
      </View>

      {/* Contact */}
      <View style={s.cardRow}>
        <View style={s.cardRowItem}>
          <Icon name="phone-outline" size={12} color="#94a3b8" style={{marginRight:4}}/>
          <Text style={s.cardRowTxt} numberOfLines={1}>{loan.phone||"—"}</Text>
        </View>
        <View style={s.cardRowItem}>
          <Icon name="email-outline" size={12} color="#94a3b8" style={{marginRight:4}}/>
          <Text style={s.cardRowTxt} numberOfLines={1}>{loan.email||"—"}</Text>
        </View>
      </View>

      {/* Bank + Amount */}
      <View style={s.cardBank}>
        <View style={{flexDirection:"row",alignItems:"center"}}>
          <Icon name="bank-outline" size={13} color="#64748b" style={{marginRight:5}}/>
          <Text style={s.cardBankName} numberOfLines={1}>
            {loan.bank||"No bank"}
            {loan.branchName?` · ${loan.branchName}`:""}
          </Text>
        </View>
        <View style={s.cardAmtRow}>
          <Text style={s.cardAmt}>{fmt$(loan.loanAmount)}</Text>
          {loan.loanApprovalDate && (
            <>
              <Text style={s.cardDot}> · </Text>
              <Icon name="calendar-check-outline" size={12} color="#94a3b8" style={{marginRight:3}}/>
              <Text style={s.cardDate}>{fmtDate(loan.loanApprovalDate)}</Text>
            </>
          )}
        </View>
      </View>

      {/* Badges */}
      <View style={s.cardBadges}>
        <Badge label={lsc.label}        bg={lsc.bg}  color={lsc.color}  icon={lsc.icon}  sm/>
        <Badge label={loan.status||"—"} bg={ldsc.bg} color={ldsc.color} icon={ldsc.icon} sm/>
      </View>

      {/* Expanded */}
      {open && (
        <View style={s.cardExpanded}>
          <View style={s.cardExpandGrid}>
            <View style={s.cardExpandItem}>
              <Text style={s.expandLbl}>Created</Text>
              <Text style={s.expandVal}>{fmtRel(loan.createdAt)}</Text>
            </View>
            <View style={s.cardExpandItem}>
              <Text style={s.expandLbl}>Updated</Text>
              <Text style={s.expandVal}>{fmtRel(loan.updatedAt)}</Text>
            </View>
          </View>
          {loan.loanNotes?(<View style={{marginBottom:10}}>
            <Text style={s.expandLbl}>Notes</Text>
            <Text style={s.expandVal}>{loan.loanNotes}</Text>
          </View>):null}
          <View style={s.cardActions}>
            <TouchableOpacity style={[s.cardBtn,s.cardBtnFill]} onPress={()=>onView(loan)}>
              <Icon name="eye-outline" size={14} color="#fff" style={{marginRight:5}}/>
              <Text style={s.cardBtnFillTxt}>View</Text>
            </TouchableOpacity>
            {permissions.canEdit&&(
              <TouchableOpacity style={[s.cardBtn,s.cardBtnOutline]} onPress={()=>onEdit(loan)}>
                <Icon name="pencil-outline" size={14} color={PRIMARY} style={{marginRight:5}}/>
                <Text style={s.cardBtnOutlineTxt}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  GRID CARD
// ─────────────────────────────────────────────────────────────
const GridCard = ({ loan,onView }:{ loan:any;onView:(l:any)=>void }) => {
  const cfg = getLSC(loan.loanStatus);
  return (
    <TouchableOpacity style={s.gridCard} onPress={()=>onView(loan)}>
      <Avatar text={initials(loan.firstName,loan.lastName)} size={40}/>
      <Text style={s.gridName} numberOfLines={1}>{loan.firstName} {loan.lastName}</Text>
      <View style={{flexDirection:"row",alignItems:"center",marginBottom:2}}>
        <Icon name="bank-outline" size={10} color="#94a3b8" style={{marginRight:3}}/>
        <Text style={s.gridBank} numberOfLines={1}>{loan.bank||"—"}</Text>
      </View>
      <Text style={s.gridAmt}>{fmt$(loan.loanAmount)}</Text>
      <Badge label={cfg.label} bg={cfg.bg} color={cfg.color} icon={cfg.icon} sm/>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────
//  INFO ROW
// ─────────────────────────────────────────────────────────────
const InfoRow = ({ label,value,bold }:{ label:string;value:string;bold?:boolean }) => (
  <View style={s.infoRow}>
    <Text style={s.infoLbl}>{label}</Text>
    <Text style={[s.infoVal,bold&&{fontWeight:"700"}]} numberOfLines={2}>{value}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
//  VIEW MODAL
// ─────────────────────────────────────────────────────────────
const ViewModal = ({ visible,onClose,loan,userRole }:{
  visible:boolean;onClose:()=>void;loan:any;userRole:string;
}) => {
  const [tab,setTab] = useState(0);
  if (!loan) return null;
  const lsc  = getLSC(loan.loanStatus);
  const ldsc = getLdSC(loan.status);
  const TABS = [
    {label:"Loan Info", icon:"bank-outline"      },
    {label:"Status",    icon:"chart-donut"       },
    {label:"Notes",     icon:"note-text-outline" },
  ];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.modalRoot}>
        <View style={s.modalHdr}>
          <Avatar text={initials(loan.firstName,loan.lastName)} size={40}/>
          <View style={{flex:1,marginLeft:10}}>
            <Text style={s.modalHdrTitle}>{loan.firstName} {loan.lastName}</Text>
            <Text style={s.modalHdrSub}>Loan · {fmt$(loan.loanAmount)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.modalClose}>
            <Icon name="close" size={18} color="#fff"/>
          </TouchableOpacity>
        </View>
        <View style={s.tabRow}>
          {TABS.map((t,i)=>(
            <TouchableOpacity key={t.label} style={[s.tab,tab===i&&s.tabActive]} onPress={()=>setTab(i)}>
              <Icon name={t.icon} size={14} color={tab===i?PRIMARY:"#94a3b8"} style={{marginBottom:2}}/>
              <Text style={[s.tabTxt,tab===i&&s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView style={{flex:1,padding:14}} contentContainerStyle={{paddingBottom:24}}>
          {tab===0&&<>
            <View style={s.infoCard}>
              <View style={s.infoCardHead}>
                <Icon name="bank-outline" size={14} color={PRIMARY} style={{marginRight:6}}/>
                <Text style={s.infoCardTitle}>Loan Details</Text>
              </View>
              <InfoRow label="Amount"        value={fmt$(loan.loanAmount)} bold/>
              <InfoRow label="Bank"          value={loan.bank||"Not set"}/>
              <InfoRow label="Branch"        value={loan.branchName||"Not set"}/>
              <InfoRow label="Approval Date" value={fmtDate(loan.loanApprovalDate)}/>
            </View>
            <View style={s.infoCard}>
              <View style={s.infoCardHead}>
                <Icon name="account-outline" size={14} color={PRIMARY} style={{marginRight:6}}/>
                <Text style={s.infoCardTitle}>Customer</Text>
              </View>
              <InfoRow label="Name"  value={`${loan.firstName} ${loan.lastName}`} bold/>
              <InfoRow label="Email" value={loan.email||"Not set"}/>
              <InfoRow label="Phone" value={loan.phone||"Not set"}/>
            </View>
          </>}
          {tab===1&&(
            <View style={s.infoCard}>
              <View style={s.infoCardHead}>
                <Icon name="chart-donut" size={14} color={PRIMARY} style={{marginRight:6}}/>
                <Text style={s.infoCardTitle}>Status</Text>
              </View>
              <View style={s.infoChipRow}>
                <Text style={s.infoLbl}>Loan Status</Text>
                <Badge label={lsc.label} bg={lsc.bg} color={lsc.color} icon={lsc.icon} sm/>
              </View>
              <View style={[s.infoChipRow,{marginTop:10}]}>
                <Text style={s.infoLbl}>Lead Status</Text>
                <Badge label={loan.status||"Unknown"} bg={ldsc.bg} color={ldsc.color} icon={ldsc.icon} sm/>
              </View>
              <InfoRow label="Created"  value={fmtDate(loan.createdAt)}/>
              <InfoRow label="Updated"  value={fmtDate(loan.updatedAt)}/>
            </View>
          )}
          {tab===2&&(
            <View style={s.infoCard}>
              <View style={s.infoCardHead}>
                <Icon name="note-text-outline" size={14} color={PRIMARY} style={{marginRight:6}}/>
                <Text style={s.infoCardTitle}>Notes</Text>
              </View>
              {loan.loanNotes
                ?<Text style={{fontSize:13,color:"#334155",lineHeight:20}}>{loan.loanNotes}</Text>
                :<View style={{alignItems:"center",paddingVertical:24,gap:8}}>
                  <Icon name="note-off-outline" size={36} color="#cbd5e1"/>
                  <Text style={{fontSize:13,color:"#94a3b8",fontStyle:"italic"}}>No notes</Text>
                </View>}
            </View>
          )}
        </ScrollView>
        <TouchableOpacity style={s.modalFootBtn} onPress={onClose}>
          <Text style={s.modalFootBtnTxt}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
//  EDIT MODAL
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  FIELD — module level (NOT inside EditModal)
// ─────────────────────────────────────────────────────────────
const Field = ({
  label,
  err,
  children,
}: {
  label: string;
  err?: string;
  children: React.ReactNode;
}) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={s.fieldLbl}>{label}</Text>
    {children}
    {!!err && <Text style={s.fieldErr}>{err}</Text>}
  </View>
);

// ─────────────────────────────────────────────────────────────
//  EDIT MODAL
// ─────────────────────────────────────────────────────────────
const EditModal = React.memo(({
  visible,
  onClose,
  loan,
  onSave,
  showToast,
  fetchAPI,
}: {
  visible: boolean;
  onClose: () => void;
  loan: any;
  onSave: (l: any) => void;
  showToast: (m: string, s: string) => void;
  fetchAPI: (ep: string, opts?: any) => Promise<any>;
}) => {
  const [loading,  setLoading]  = useState(false);
  const [amount,   setAmount]   = useState("");
  const [bank,     setBank]     = useState("");
  const [branch,   setBranch]   = useState("");
  const [loanSt,   setLoanSt]   = useState("pending");
  const [leadSt,   setLeadSt]   = useState("Bank Loan Apply");
  const [notes,    setNotes]    = useState("");
  const [errs,     setErrs]     = useState<Record<string, string>>({});
  const [bankPick, setBankPick] = useState(false);
  const [lsPick,   setLsPick]   = useState(false);
  const [ldPick,   setLdPick]   = useState(false);

  const amountRef = useRef<any>(null);
  const branchRef = useRef<any>(null);

  useEffect(() => {
    if (visible && loan) {
      setAmount(loan.loanAmount ? String(loan.loanAmount) : "");
      setBank(loan.bank ?? "");
      setBranch(loan.branchName ?? "");
      setLoanSt(loan.loanStatus ?? "pending");
      setLeadSt(loan.status ?? "Bank Loan Apply");
      setNotes(loan.loanNotes ?? "");
      setErrs({});
    }
  }, [visible, loan]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!amount.trim())                  e.amount = "Amount is required";
    else if (isNaN(parseFloat(amount)))  e.amount = "Enter a valid number";
    if (!bank)                           e.bank   = "Bank is required";
    if (!branch.trim())                  e.branch = "Branch is required";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) { showToast("Fix the errors", "error"); return; }
    setLoading(true);
    try {
      const payload = {
        loanAmount: parseFloat(amount),
        bank,
        branchName: branch,
        loanStatus: loanSt,
        status:     leadSt,
        loanNotes:  notes,
      };
      await fetchAPI(`/lead/updateLead/${loan._id}`, {
        method: "PUT",
        body:   JSON.stringify(payload),
      });
      showToast("Updated successfully", "success");
      onSave({ ...loan, ...payload });
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!loan) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.modalRoot}>

        {/* ── HEADER */}
        <View style={s.editHdr}>
          <View>
            <Text style={s.editHdrTitle}>Edit Application</Text>
            <Text style={s.editHdrSub}>{loan.firstName} {loan.lastName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.editClose}>
            <Icon name="close" size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* ── FORM */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            style={{ flex: 1, padding: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Loan Amount */}
            <Field label="Loan Amount *" err={errs.amount}>
              <View style={[s.inputWrap, !!errs.amount && s.inputErr]}>
                <Icon name="currency-inr" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <TextInput
                  ref={amountRef}
                  style={s.inputInner}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Enter amount"
                  placeholderTextColor="#cbd5e1"
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => branchRef.current?.focus()}
                  blurOnSubmit={false}
                  selectTextOnFocus={false}
                />
              </View>
            </Field>

            {/* Bank */}
            <Field label="Bank *" err={errs.bank}>
              <TouchableOpacity
                style={[s.inputWrap, !!errs.bank && s.inputErr]}
                onPress={() => setBankPick(true)}
                activeOpacity={0.7}
              >
                <Icon name="bank-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={[s.inputInner, !bank && { color: "#cbd5e1" }]}>
                  {bank || "Select bank"}
                </Text>
                <Icon name="chevron-down" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </Field>

            {/* Branch */}
            <Field label="Branch Name *" err={errs.branch}>
              <View style={[s.inputWrap, !!errs.branch && s.inputErr]}>
                <Icon name="map-marker-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <TextInput
                  ref={branchRef}
                  style={s.inputInner}
                  value={branch}
                  onChangeText={setBranch}
                  placeholder="Enter branch name"
                  placeholderTextColor="#cbd5e1"
                  returnKeyType="done"
                  selectTextOnFocus={false}
                />
              </View>
            </Field>

            {/* Loan Status */}
            <Field label="Loan Status">
              <TouchableOpacity
                style={s.inputWrap}
                onPress={() => setLsPick(true)}
                activeOpacity={0.7}
              >
                <Icon name={getLSC(loanSt).icon} size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={s.inputInner}>{getLSC(loanSt).label}</Text>
                <Icon name="chevron-down" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </Field>

            {/* Lead Status */}
            <Field label="Lead Status">
              <TouchableOpacity
                style={s.inputWrap}
                onPress={() => setLdPick(true)}
                activeOpacity={0.7}
              >
                <Icon name={getLdSC(leadSt).icon} size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={s.inputInner}>{leadSt}</Text>
                <Icon name="chevron-down" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <TextInput
                style={[
                  s.inputWrap,
                  { height: 90, alignItems: "flex-start", paddingTop: 10, textAlignVertical: "top" },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes..."
                placeholderTextColor="#cbd5e1"
                multiline
                numberOfLines={4}
              />
            </Field>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* ── ACTION BUTTONS */}
          <View style={s.editActions}>
            <TouchableOpacity
              style={s.editCancel}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={s.editCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.editSave, loading && { backgroundColor: "#94a3b8" }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Icon name="content-save-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={s.editSaveTxt}>Save Changes</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* ── PICKER MODALS */}
        <PickerModal
          visible={bankPick}
          title="Select Bank"
          options={BANK_LIST}
          selected={bank}
          onSelect={v => { setBank(v); setBankPick(false); }}
          onClose={() => setBankPick(false)}
        />
        <PickerModal
          visible={lsPick}
          title="Loan Status"
          options={LOAN_STATUS_OPTIONS.map(o => getLSC(o).label)}
          optionValues={LOAN_STATUS_OPTIONS}
          selected={loanSt}
          onSelect={v => { setLoanSt(v); setLsPick(false); }}
          onClose={() => setLsPick(false)}
        />
        <PickerModal
          visible={ldPick}
          title="Lead Status"
          options={LEAD_STATUS_OPTIONS}
          selected={leadSt}
          onSelect={v => { setLeadSt(v); setLdPick(false); }}
          onClose={() => setLdPick(false)}
        />

      </SafeAreaView>
    </Modal>
  );
});

EditModal.displayName = "EditModal";

// ─────────────────────────────────────────────────────────────
//  FILTER MODAL
// ─────────────────────────────────────────────────────────────
const FilterModal = ({
  visible,onClose,period,setPeriod,
  loanStatusFilter,setLoanStatusFilter,
  leadStatusFilter,setLeadStatusFilter,
  searchQuery,setSearchQuery,
  sortConfig,setSortConfig,
  viewMode,setViewMode,
  handleClearFilters,activeFilterCount,
}:any) => {
  const [sec,setSec] = useState<string|null>("search");
  const Sec = ({id,title,icon,children}:{id:string;title:string;icon:string;children:React.ReactNode})=>(
    <View style={s.fSec}>
      <TouchableOpacity style={s.fSecHead} onPress={()=>setSec(sec===id?null:id)}>
        <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
          <Icon name={icon} size={16} color={PRIMARY}/>
          <Text style={s.fSecTitle}>{title}</Text>
        </View>
        <Icon name={sec===id?"chevron-up":"chevron-down"} size={16} color="#94a3b8"/>
      </TouchableOpacity>
      {sec===id&&<View style={s.fSecBody}>{children}</View>}
    </View>
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.fOverlay}>
        <View style={s.fSheet}>
          <View style={s.fBar}/>
          <View style={s.fHead}>
            <View>
              <Text style={s.fTitle}>Filters</Text>
              <Text style={s.fSub}>{activeFilterCount} active</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.fClose}>
              <Icon name="close" size={18} color={PRIMARY}/>
            </TouchableOpacity>
          </View>
          <ScrollView style={{maxHeight:480}}>
            <Sec id="search" title="Search" icon="magnify">
              <TextInput style={s.fInput} placeholder="Name, phone, bank..."
                value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94a3b8"/>
            </Sec>
            <Sec id="period" title="Time Period" icon="calendar-range">
              <View style={s.fGrid}>
                {PERIOD_OPTIONS.map(o=>(
                  <TouchableOpacity key={o.value}
                    style={[s.fChip,period===o.value&&s.fChipActive]}
                    onPress={()=>setPeriod(o.value)}>
                    <Text style={[s.fChipTxt,period===o.value&&s.fChipTxtActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Sec>
            <Sec id="loanStatus" title="Loan Status" icon="credit-card-outline">
              {["All",...LOAN_STATUS_OPTIONS].map(st=>(
                <TouchableOpacity key={st}
                  style={[s.fOpt,loanStatusFilter===st&&s.fOptActive]}
                  onPress={()=>setLoanStatusFilter(st)}>
                  {st!=="All"&&<Icon name={getLSC(st).icon} size={14}
                    color={loanStatusFilter===st?"#fff":getLSC(st).color} style={{marginRight:6}}/>}
                  <Text style={[s.fOptTxt,loanStatusFilter===st&&s.fOptTxtActive]}>
                    {st==="All"?"All Statuses":getLSC(st).label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Sec>
            <Sec id="leadStatus" title="Lead Status" icon="tag-outline">
              {["All",...LEAD_STATUS_OPTIONS].map(st=>(
                <TouchableOpacity key={st}
                  style={[s.fOpt,leadStatusFilter===st&&s.fOptActive]}
                  onPress={()=>setLeadStatusFilter(st)}>
                  {st!=="All"&&<Icon name={getLdSC(st).icon} size={14}
                    color={leadStatusFilter===st?"#fff":getLdSC(st).color} style={{marginRight:6}}/>}
                  <Text style={[s.fOptTxt,leadStatusFilter===st&&s.fOptTxtActive]}>
                    {st==="All"?"All Statuses":st}
                  </Text>
                </TouchableOpacity>
              ))}
            </Sec>
            <Sec id="sort" title="Sort By" icon="sort">
              {[
                {key:"firstName",        label:"Name",   icon:"sort-alphabetical-ascending"},
                {key:"loanApprovalDate", label:"Date",   icon:"sort-calendar-ascending"    },
                {key:"loanAmount",       label:"Amount", icon:"sort-numeric-ascending"     },
                {key:"loanStatus",       label:"Status", icon:"sort-bool-ascending"        },
              ].map(o=>(
                <TouchableOpacity key={o.key}
                  style={[s.fOpt,sortConfig.key===o.key&&s.fOptActive]}
                  onPress={()=>setSortConfig((p:any)=>({key:o.key,direction:p.key===o.key&&p.direction==="asc"?"desc":"asc"}))}>
                  <Icon name={o.icon} size={14} color={sortConfig.key===o.key?"#fff":PRIMARY} style={{marginRight:6}}/>
                  <Text style={[s.fOptTxt,sortConfig.key===o.key&&s.fOptTxtActive]}>
                    {o.label}{sortConfig.key===o.key?(sortConfig.direction==="asc"?" ↑":" ↓"):""}
                  </Text>
                </TouchableOpacity>
              ))}
            </Sec>
            <Sec id="view" title="View Mode" icon="view-dashboard-outline">
              <View style={{flexDirection:"row",gap:10}}>
                {(["card","grid"] as const).map(v=>(
                  <TouchableOpacity key={v}
                    style={[s.fOpt,{flex:1,justifyContent:"center"},viewMode===v&&s.fOptActive]}
                    onPress={()=>setViewMode(v)}>
                    <Icon name={v==="card"?"view-list-outline":"view-grid-outline"} size={15}
                      color={viewMode===v?"#fff":PRIMARY} style={{marginRight:6}}/>
                    <Text style={[s.fOptTxt,viewMode===v&&s.fOptTxtActive]}>
                      {v==="card"?"List":"Grid"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Sec>
          </ScrollView>
          <View style={s.fFoot}>
            <TouchableOpacity style={s.fClear} onPress={()=>{handleClearFilters();onClose();}}>
              <Icon name="filter-remove-outline" size={15} color={PRIMARY} style={{marginRight:6}}/>
              <Text style={s.fClearTxt}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.fApply} onPress={onClose}>
              <Icon name="check" size={15} color="#fff" style={{marginRight:6}}/>
              <Text style={s.fApplyTxt}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────────────────────
const EmptyState = ({ onClear,hasFilters }:{ onClear:()=>void;hasFilters:boolean }) => (
  <View style={s.empty}>
    <View style={s.emptyIcon}>
      <Icon name="bank-outline" size={40} color="#94a3b8"/>
    </View>
    <Text style={s.emptyTitle}>No loan applications found</Text>
    <Text style={s.emptySub}>
      {hasFilters?"Try adjusting your filters":"No applications submitted yet"}
    </Text>
    {hasFilters&&(
      <TouchableOpacity style={s.emptyClear} onPress={onClear}>
        <Icon name="filter-remove-outline" size={14} color="#fff" style={{marginRight:5}}/>
        <Text style={s.emptyClearTxt}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────
interface LoanRecord {
  _id:string; firstName:string; lastName:string; email:string; phone:string;
  bank:string; branchName:string; loanAmount:number; loanStatus:string;
  status:string; loanApprovalDate:string|null; loanNotes:string;
  createdAt:string; updatedAt:string; createdBy?:string; assignedTo?:string;
}
interface SummaryData {
  totalLoans:number; pendingLoans:number; submittedLoans:number;
  totalLoanAmount:number; avgLoanAmount:number;
}
interface Props {
  onMenuPress?:()=>void; onSearchPress?:()=>void;
  onProfilePress?:()=>void; onBackPress?:()=>void;
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
export default function BankLoanApplyScreen({
  onMenuPress,onSearchPress,onProfilePress,onBackPress,
}:Props={}) {

  const { user, fetchAPI } = useAuth();
  const userRole = user?.role??"TEAM";
  const userId   = user?._id??user?.id??"";

  const perms = useMemo(()=>getUserPermissions(userRole),[userRole]);

  // ── state
  const [period,     setPeriod]     = useState("Today");
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg,   setToastMsg]   = useState("");
  const [toastSev,   setToastSev]   = useState("success");
  const [toastVis,   setToastVis]   = useState(false);
  const [loans,      setLoans]      = useState<LoanRecord[]>([]);
  const [summary,    setSummary]    = useState<SummaryData>({
    totalLoans:0,pendingLoans:0,submittedLoans:0,totalLoanAmount:0,avgLoanAmount:0,
  });
  const [search,    setSearch]    = useState("");
  const [loanFlt,   setLoanFlt]   = useState("All");
  const [leadFlt,   setLeadFlt]   = useState("All");
  const [sort,      setSort]      = useState<{key:string|null;direction:"asc"|"desc"}>({key:null,direction:"asc"});
  const [view,      setView]      = useState<"card"|"grid">("card");
  const [fOpen,     setFOpen]     = useState(false);
  const [page,      setPage]      = useState(0);
  const [viewOpen,  setViewOpen]  = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const [selLoan,   setSelLoan]   = useState<LoanRecord|null>(null);

  const toast = useCallback((m:string,sv="success")=>{
    setToastMsg(m);setToastSev(sv);setToastVis(true);
  },[]);

  // ── FETCH ────────────────────────────────────────────────
  // THE FIX: use extractArray() which checks Array.isArray() before
  // accepting any candidate — prevents a plain object (e.g. the
  // summary block) from silently becoming the "leads" value.
  // ─────────────────────────────────────────────────────────
const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    const today = new Date();

    if (period === "Today") {
      params.append("startDate", today.toISOString().split("T")[0]);
      params.append("endDate",   today.toISOString().split("T")[0]);
    } else if (period === "This Week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      params.append("startDate", weekAgo.toISOString().split("T")[0]);
      params.append("endDate",   today.toISOString().split("T")[0]);
    } else if (period === "This Month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      params.append("startDate", monthAgo.toISOString().split("T")[0]);
      params.append("endDate",   today.toISOString().split("T")[0]);
    }

    const response = await fetchAPI(`/lead/bankLoanSummary?${params.toString()}`);

    console.log("API RESPONSE:", JSON.stringify(response, null, 2)); // remove after debugging

    if (response?.success) {
      const data      = response.result ?? {};
      let rawLoans    = data.bankLoans ?? [];

      // TEAM role: filter to own leads only
      if (userRole === "TEAM" && userId) {
        rawLoans = rawLoans.filter(
          (loan: LoanRecord) =>
            loan.assignedTo   === userId ||
            loan.createdBy    === userId
        );
      }

      const totalLoans       = rawLoans.length;
      const pendingLoans     = rawLoans.filter((l: LoanRecord) => l.loanStatus?.toLowerCase() === "pending").length;
      const submittedLoans   = rawLoans.filter((l: LoanRecord) => l.loanStatus?.toLowerCase() === "submitted").length;
      const totalLoanAmount  = rawLoans.reduce((sum: number, l: LoanRecord) => sum + (parseFloat(String(l.loanAmount)) || 0), 0);
      const avgLoanAmount    = totalLoans > 0 ? totalLoanAmount / totalLoans : 0;

      setLoans(rawLoans);
      setSummary({ totalLoans, pendingLoans, submittedLoans, totalLoanAmount, avgLoanAmount });
    } else {
      throw new Error(response?.message ?? "Failed to fetch loan data");
    }
  } catch (e: any) {
    toast(e?.message ?? "Failed to load data", "error");
    console.error("fetchData error:", e);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [period, userRole, userId, fetchAPI, toast]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  // ── filtered + sorted list
  const filtered = useMemo(()=>{
    let r = [...loans];
    if (search.trim()){
      const q = search.toLowerCase();
      r = r.filter(l=>
        (l.firstName?.toLowerCase()??"").includes(q)||
        (l.lastName?.toLowerCase()??"").includes(q)||
        (l.phone??"").includes(q)||
        (l.bank?.toLowerCase()??"").includes(q)
      );
    }
    if (loanFlt !== "All") r = r.filter(l => l.loanStatus?.toLowerCase() === loanFlt.toLowerCase());
    if (leadFlt !== "All") r = r.filter(l => l.status === leadFlt);
    if (sort.key){
      r.sort((a:any,b:any)=>{
        let av=a[sort.key!], bv=b[sort.key!];
        if (sort.key==="firstName"){ av=`${a.firstName} ${a.lastName}`.toLowerCase();bv=`${b.firstName} ${b.lastName}`.toLowerCase(); }
        else if (sort.key==="loanAmount"){ av=parseFloat(av)||0;bv=parseFloat(bv)||0; }
        else if (sort.key==="loanApprovalDate"){ av=av?new Date(av).getTime():0;bv=bv?new Date(bv).getTime():0; }
        else if (sort.key==="loanStatus"){ av=getLSC(av)?.order??0;bv=getLSC(bv)?.order??0; }
        return av<bv?(sort.direction==="asc"?-1:1):av>bv?(sort.direction==="asc"?1:-1):0;
      });
    }
    return r;
  },[loans,search,loanFlt,leadFlt,sort]);

  const paginated   = useMemo(()=>filtered.slice(page*ITEMS_PER_PAGE,(page+1)*ITEMS_PER_PAGE),[filtered,page]);
  const filterCount = useMemo(()=>[search,loanFlt!=="All",leadFlt!=="All"].filter(Boolean).length,[search,loanFlt,leadFlt]);

  const setS   = useCallback((v:string)=>{setSearch(v);setPage(0);},[]);
  const setLF  = useCallback((v:string)=>{setLoanFlt(v);setPage(0);},[]);
  const setLdF = useCallback((v:string)=>{setLeadFlt(v);setPage(0);},[]);
  const setP   = useCallback((v:string)=>{setPeriod(v);setPage(0);},[]);
  const clearFilters = useCallback(()=>{
    setSearch("");setLoanFlt("All");setLeadFlt("All");
    setSort({key:null,direction:"asc"});setPage(0);
  },[]);

  if (!hasAccess(userRole)){
    return (
      <SafeAreaView style={s.denied}>
        <Icon name="shield-alert-outline" size={56} color={DANGER}/>
        <Text style={s.deniedTitle}>Access Denied</Text>
        <Text style={s.deniedSub}>You don't have permission to view this page.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY}/>

      <Toast visible={toastVis} message={toastMsg} severity={toastSev} onHide={()=>setToastVis(false)}/>
      <ViewModal visible={viewOpen} onClose={()=>setViewOpen(false)} loan={selLoan} userRole={userRole}/>
      <EditModal visible={editOpen} onClose={()=>setEditOpen(false)} loan={selLoan}
        fetchAPI={fetchAPI}
        onSave={(u:LoanRecord)=>setLoans(prev=>prev.map(l=>l._id===u._id?u:l))}
        showToast={toast}/>
      <FilterModal visible={fOpen} onClose={()=>setFOpen(false)}
        period={period}           setPeriod={setP}
        loanStatusFilter={loanFlt} setLoanStatusFilter={setLF}
        leadStatusFilter={leadFlt} setLeadStatusFilter={setLdF}
        searchQuery={search}      setSearchQuery={setS}
        sortConfig={sort}         setSortConfig={setSort}
        viewMode={view}           setViewMode={setView}
        handleClearFilters={clearFilters} activeFilterCount={filterCount}/>

      {/* ── HEADER */}
      <View style={s.hdr}>
        <View style={s.hdrL}>
          {onBackPress&&(
            <TouchableOpacity onPress={onBackPress} style={s.hBtn}
              hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Icon name="arrow-left" size={20} color="#fff"/>
            </TouchableOpacity>
          )}
          <View style={{flex:1}}>
            <Text style={s.hdrTitle}>Bank Loan Apply</Text>
            <Text style={s.hdrSub} numberOfLines={1}>
              {user?.firstName?`${user.firstName} · `:""}
              {userRole} · Manage applications
            </Text>
          </View>
        </View>
        <View style={s.hdrR}>
          <TouchableOpacity onPress={fetchData} disabled={loading} style={s.hBtn}
            hitSlop={{top:10,bottom:10,left:6,right:6}}>
            {loading
              ?<ActivityIndicator color="#fff" size="small"/>
              :<Icon name="refresh" size={20} color="#fff"/>}
          </TouchableOpacity>
          {!!onSearchPress&&(
            <TouchableOpacity onPress={onSearchPress} style={s.hBtn}
              hitSlop={{top:10,bottom:10,left:6,right:6}}>
              <Icon name="magnify" size={20} color="#fff"/>
            </TouchableOpacity>
          )}
          {!!onProfilePress&&(
            <TouchableOpacity onPress={onProfilePress} style={s.hBtn}
              hitSlop={{top:10,bottom:10,left:6,right:6}}>
              <Icon name="account-circle-outline" size={20} color="#fff"/>
            </TouchableOpacity>
          )}
          {!!onMenuPress&&(
            <TouchableOpacity onPress={onMenuPress} style={s.hBtn}
              hitSlop={{top:10,bottom:10,left:6,right:6}}>
              <Icon name="menu" size={20} color="#fff"/>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── SUMMARY CARDS */}
      <View style={s.sumBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sumBarContent}>
          <SummaryCard label="Total Loans"  value={summary.totalLoans}
            sub="All applications"    icon="bank-outline"         color={PRIMARY}/>
          <SummaryCard label="Pending"      value={summary.pendingLoans}
            sub="Awaiting submission"  icon="clock-outline"        color={WARNING}/>
          <SummaryCard label="Submitted"    value={summary.submittedLoans}
            sub="Sent to bank"         icon="check-circle-outline" color={SUCCESS}/>
          <SummaryCard label="Total Amount" value={fmt$(summary.totalLoanAmount)}
            sub="Total loan value"     icon="currency-inr"         color={PURPLE}/>
        </ScrollView>
      </View>

      {/* ── SEARCH + FILTER */}
      <View style={s.toolbar}>
        <View style={s.searchWrap}>
          <Icon name="magnify" size={17} color="#94a3b8" style={{marginRight:6}}/>
          <TextInput style={s.searchInput} placeholder="Search name, phone, bank..."
            value={search} onChangeText={setS} placeholderTextColor="#94a3b8"/>
          {!!search&&(
            <TouchableOpacity onPress={()=>setS("")} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Icon name="close-circle" size={16} color="#94a3b8"/>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.filterBtn} onPress={()=>setFOpen(true)}>
          <Icon name="tune-variant" size={18} color="#fff"/>
          {filterCount>0&&(
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeTxt}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── PERIOD PILLS */}
      <View style={s.pillsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillsContent}>
          {PERIOD_OPTIONS.map(o=>{
            const active = period===o.value;
            return (
              <TouchableOpacity key={o.value}
                style={[s.pill,active&&s.pillActive]}
                onPress={()=>setP(o.value)}>
                <Icon name={o.icon} size={12} color={active?"#fff":"#64748b"} style={{marginRight:4}}/>
                <Text style={[s.pillTxt,active&&s.pillTxtActive]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LIST HEADER */}
      <View style={s.listHdr}>
        <View>
          <Text style={s.listHdrTitle}>Loan Applications</Text>
          <Text style={s.listHdrCount}>
            {filtered.length} record{filtered.length!==1?"s":""}
            {filterCount>0?" · filtered":""}
          </Text>
        </View>
        <View style={s.vtWrap}>
          {(["card","grid"] as const).map(v=>(
            <TouchableOpacity key={v}
              style={[s.vtBtn,view===v&&s.vtBtnActive]}
              onPress={()=>setView(v)}>
              <Icon name={v==="card"?"view-list-outline":"view-grid-outline"}
                size={17} color={view===v?"#fff":"#64748b"}/>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── LIST */}
      {loading&&loans.length===0?(
        <View style={s.loaderWrap}>
          <ActivityIndicator size="large" color={PRIMARY}/>
          <Text style={s.loaderTxt}>Loading loans...</Text>
        </View>
      ):view==="card"?(
        <FlatList data={paginated} keyExtractor={i=>i._id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[PRIMARY]}
            onRefresh={()=>{setRefreshing(true);fetchData();}}/>}
          renderItem={({item})=>(
            <LoanCard loan={item}
              onView={l=>{setSelLoan(l);setViewOpen(true);}}
              onEdit={l=>{setSelLoan(l);setEditOpen(true);}}
              permissions={perms}/>
          )}
          ListEmptyComponent={<EmptyState onClear={clearFilters} hasFilters={filterCount>0}/>}/>
      ):(
        <FlatList data={paginated} keyExtractor={i=>i._id}
          numColumns={2} columnWrapperStyle={{gap:10}}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[PRIMARY]}
            onRefresh={()=>{setRefreshing(true);fetchData();}}/>}
          renderItem={({item})=>(
            <GridCard loan={item} onView={l=>{setSelLoan(l);setViewOpen(true);}}/>
          )}
          ListEmptyComponent={<EmptyState onClear={clearFilters} hasFilters={filterCount>0}/>}/>
      )}

      {/* ── PAGINATION */}
      {filtered.length>ITEMS_PER_PAGE&&(
        <View style={s.pagRow}>
          <TouchableOpacity style={[s.pagBtn,page===0&&s.pagBtnDis]}
            disabled={page===0} onPress={()=>setPage(p=>Math.max(0,p-1))}>
            <Icon name="chevron-left" size={16} color="#fff"/>
            <Text style={s.pagBtnTxt}>Prev</Text>
          </TouchableOpacity>
          <Text style={s.pagInfo}>{page+1} / {Math.ceil(filtered.length/ITEMS_PER_PAGE)}</Text>
          <TouchableOpacity
            style={[s.pagBtn,(page+1)*ITEMS_PER_PAGE>=filtered.length&&s.pagBtnDis]}
            disabled={(page+1)*ITEMS_PER_PAGE>=filtered.length}
            onPress={()=>setPage(p=>p+1)}>
            <Text style={s.pagBtnTxt}>Next</Text>
            <Icon name="chevron-right" size={16} color="#fff"/>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:BG },
  denied:      { flex:1, alignItems:"center", justifyContent:"center", padding:24, gap:12 },
  deniedTitle: { fontSize:20, fontWeight:"700", color:DANGER },
  deniedSub:   { fontSize:14, color:"#64748b", textAlign:"center" },

  hdr: {
    backgroundColor:PRIMARY,
    paddingHorizontal:14, paddingVertical:12,
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    elevation:6, shadowColor:"#000",
    shadowOffset:{width:0,height:3}, shadowOpacity:0.15, shadowRadius:6,
  },
  hdrL:    { flexDirection:"row", alignItems:"center", flex:1, gap:8 },
  hdrR:    { flexDirection:"row", alignItems:"center", gap:6 },
  hdrTitle:{ fontSize:17, fontWeight:"700", color:"#fff", letterSpacing:0.2 },
  hdrSub:  { fontSize:11, color:"rgba(255,255,255,0.75)", marginTop:1 },
  hBtn: {
    backgroundColor:"rgba(255,255,255,0.18)",
    borderRadius:8, padding:7,
    alignItems:"center", justifyContent:"center",
  },

  sumBar:        { backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#e2e8f0" },
  sumBarContent: { paddingHorizontal:12, paddingVertical:10, gap:10 },
  sumCard: {
    backgroundColor:"#fff",
    borderRadius:12, padding:12,
    minWidth:110, alignItems:"center",
    borderWidth:1, borderColor:"#e2e8f0",
    borderLeftWidth:3,
    shadowColor:"#000", shadowOffset:{width:0,height:1},
    shadowOpacity:0.05, shadowRadius:3, elevation:1,
    gap:2,
  },
  sumIcon:  { borderRadius:20, padding:7, marginBottom:4 },
  sumVal:   { fontSize:22, fontWeight:"800", letterSpacing:-0.5 },
  sumLabel: { fontSize:11, fontWeight:"600", color:"#475569", textAlign:"center" },
  sumSub:   { fontSize:10, color:"#94a3b8", textAlign:"center" },

  toolbar: {
    flexDirection:"row", paddingHorizontal:12, paddingVertical:8,
    gap:8, backgroundColor:"#fff",
    borderBottomWidth:1, borderBottomColor:"#e2e8f0",
  },
  searchWrap: {
    flex:1, flexDirection:"row", alignItems:"center",
    backgroundColor:"#f1f5f9", borderRadius:10,
    paddingHorizontal:12, height:40,
    borderWidth:1, borderColor:"#e2e8f0",
  },
  searchInput: { flex:1, fontSize:13, color:"#334155" },
  filterBtn: {
    backgroundColor:PRIMARY, borderRadius:10,
    width:42, height:40, alignItems:"center", justifyContent:"center",
    position:"relative",
    shadowColor:PRIMARY, shadowOffset:{width:0,height:2},
    shadowOpacity:0.35, shadowRadius:4, elevation:4,
  },
  filterBadge: {
    position:"absolute", top:-4, right:-4,
    backgroundColor:DANGER, borderRadius:8,
    minWidth:16, height:16,
    alignItems:"center", justifyContent:"center",
    borderWidth:1.5, borderColor:"#fff",
  },
  filterBadgeTxt: { fontSize:9, color:"#fff", fontWeight:"800" },

  pillsWrap:    { backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#e2e8f0" },
  pillsContent: { paddingHorizontal:12, paddingVertical:6, gap:6 },
  pill: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:12, paddingVertical:5,
    borderRadius:20, borderWidth:1,
    borderColor:"#e2e8f0", backgroundColor:"#f8fafc",
  },
  pillActive:    { backgroundColor:PRIMARY, borderColor:PRIMARY },
  pillTxt:       { fontSize:12, color:"#64748b", fontWeight:"500" },
  pillTxtActive: { color:"#fff", fontWeight:"600" },

  listHdr: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:14, paddingVertical:10,
    backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#e2e8f0",
  },
  listHdrTitle: { fontSize:14, fontWeight:"700", color:"#1e293b" },
  listHdrCount: { fontSize:12, color:"#64748b", marginTop:1 },
  vtWrap:     { flexDirection:"row", gap:4 },
  vtBtn:      { padding:7, borderRadius:7, borderWidth:1, borderColor:"#e2e8f0", backgroundColor:"#f8fafc" },
  vtBtnActive:{ backgroundColor:PRIMARY, borderColor:PRIMARY },

  loaderWrap: { flex:1, alignItems:"center", justifyContent:"center", paddingVertical:40 },
  loaderTxt:  { marginTop:12, color:"#64748b", fontSize:14 },
  listContent:{ padding:12, paddingBottom:24 },

  card: {
    backgroundColor:"#fff", borderRadius:14, padding:14,
    marginBottom:10, borderWidth:1, borderColor:"#e2e8f0",
    shadowColor:"#000", shadowOffset:{width:0,height:2},
    shadowOpacity:0.05, shadowRadius:6, elevation:2,
  },
  cardTop:    { flexDirection:"row", alignItems:"center", marginBottom:10 },
  cardMid:    { flex:1, marginLeft:10 },
  cardName:   { fontSize:15, fontWeight:"700", color:"#1e293b" },
  cardId:     { fontSize:11, color:"#94a3b8", marginTop:2 },
  cardChev:   { backgroundColor:"#f1f5f9", borderRadius:7, padding:5 },
  cardRow:    { flexDirection:"row", gap:10, marginBottom:8 },
  cardRowItem:{ flexDirection:"row", alignItems:"center", flex:1 },
  cardRowTxt: { fontSize:11, color:"#64748b", flex:1 },
  cardBank:   { marginBottom:8 },
  cardBankName:{ fontSize:13, color:"#334155", fontWeight:"500" },
  cardAmtRow: { flexDirection:"row", alignItems:"center", marginTop:4 },
  cardAmt:    { fontSize:15, fontWeight:"800", color:PRIMARY },
  cardDot:    { color:"#cbd5e1", fontSize:14 },
  cardDate:   { fontSize:12, color:"#94a3b8" },
  cardBadges: { flexDirection:"row", gap:6, flexWrap:"wrap", marginTop:2 },
  cardExpanded:{
    marginTop:10, paddingTop:10,
    borderTopWidth:1, borderTopColor:"#f1f5f9",
  },
  cardExpandGrid:{ flexDirection:"row", flexWrap:"wrap", gap:10, marginBottom:10 },
  cardExpandItem:{ minWidth:"44%" },
  expandLbl:  { fontSize:11, color:"#94a3b8", marginBottom:2 },
  expandVal:  { fontSize:13, color:"#334155" },
  cardActions:{ flexDirection:"row", gap:10, marginTop:4 },
  cardBtn:    { flex:1, paddingVertical:9, borderRadius:9, flexDirection:"row", alignItems:"center", justifyContent:"center" },
  cardBtnFill:{ backgroundColor:PRIMARY },
  cardBtnFillTxt:   { color:"#fff", fontWeight:"600", fontSize:13 },
  cardBtnOutline:   { borderWidth:1.5, borderColor:PRIMARY },
  cardBtnOutlineTxt:{ color:PRIMARY, fontWeight:"600", fontSize:13 },

  gridCard: {
    flex:1, backgroundColor:"#fff", borderRadius:12, padding:12,
    alignItems:"center", gap:4, marginBottom:10,
    borderWidth:1, borderColor:"#e2e8f0",
    shadowColor:"#000", shadowOffset:{width:0,height:1},
    shadowOpacity:0.04, shadowRadius:3, elevation:1,
  },
  gridName: { fontSize:12, fontWeight:"700", color:"#1e293b", textAlign:"center" },
  gridBank: { fontSize:11, color:"#94a3b8", textAlign:"center" },
  gridAmt:  { fontSize:14, fontWeight:"800", color:PRIMARY },

  badge:      { flexDirection:"row", alignItems:"center", paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  badgeSm:    { paddingHorizontal:7, paddingVertical:3 },
  badgeTxt:   { fontSize:12, fontWeight:"600" },
  badgeTxtSm: { fontSize:10, fontWeight:"600" },

  avatar:    { backgroundColor:PRIMARY, alignItems:"center", justifyContent:"center" },
  avatarTxt: { color:"#fff", fontWeight:"700" },

  toast: {
    position:"absolute",
    top:Platform.OS==="ios"?54:16,
    left:14, right:14,
    borderRadius:12, paddingHorizontal:14, paddingVertical:12,
    zIndex:9999, elevation:14,
    flexDirection:"row", alignItems:"center",
    shadowColor:"#000", shadowOffset:{width:0,height:4},
    shadowOpacity:0.2, shadowRadius:8,
  },
  toastTxt: { color:"#fff", fontSize:13, fontWeight:"500", flex:1 },

  pagRow: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:14, paddingVertical:10,
    backgroundColor:"#fff", borderTopWidth:1, borderTopColor:"#e2e8f0",
  },
  pagBtn:    { backgroundColor:PRIMARY, paddingHorizontal:14, paddingVertical:7, borderRadius:8, flexDirection:"row", alignItems:"center", gap:4 },
  pagBtnDis: { backgroundColor:"#cbd5e1" },
  pagBtnTxt: { color:"#fff", fontWeight:"600", fontSize:13 },
  pagInfo:   { color:"#475569", fontSize:13, fontWeight:"600" },

  modalRoot: { flex:1, backgroundColor:BG },
  modalHdr: {
    backgroundColor:PRIMARY, flexDirection:"row",
    alignItems:"center", paddingHorizontal:16, paddingVertical:14,
  },
  modalHdrTitle:{ fontSize:16, fontWeight:"700", color:"#fff" },
  modalHdrSub:  { fontSize:11, color:"rgba(255,255,255,0.75)", marginTop:2 },
  modalClose:   { backgroundColor:"rgba(255,255,255,0.18)", borderRadius:8, padding:8 },
  tabRow:       { flexDirection:"row", backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#e2e8f0" },
  tab:          { flex:1, paddingVertical:10, alignItems:"center", borderBottomWidth:2, borderBottomColor:"transparent" },
  tabActive:    { borderBottomColor:PRIMARY },
  tabTxt:       { fontSize:11, color:"#94a3b8", fontWeight:"500" },
  tabTxtActive: { color:PRIMARY, fontWeight:"700" },
  infoCard: {
    backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:12,
    borderWidth:1, borderColor:"#e2e8f0",
  },
  infoCardHead: { flexDirection:"row", alignItems:"center", marginBottom:12 },
  infoCardTitle:{ fontSize:13, fontWeight:"700", color:PRIMARY },
  infoRow: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#f1f5f9",
  },
  infoLbl:     { fontSize:12, color:"#94a3b8", flex:1 },
  infoVal:     { fontSize:13, color:"#334155", flex:1, textAlign:"right" },
  infoChipRow: { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  modalFootBtn:   { margin:14, backgroundColor:PRIMARY, borderRadius:10, paddingVertical:14, alignItems:"center" },
  modalFootBtnTxt:{ color:"#fff", fontWeight:"700", fontSize:15 },

  editHdr: {
    backgroundColor:"#fff", paddingHorizontal:16, paddingVertical:14,
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    borderBottomWidth:1, borderBottomColor:"#e2e8f0",
  },
  editHdrTitle: { fontSize:16, fontWeight:"700", color:"#1e293b" },
  editHdrSub:   { fontSize:12, color:"#64748b", marginTop:2 },
  editClose:    { backgroundColor:"#f1f5f9", borderRadius:8, padding:7 },
  fieldLbl:     { fontSize:13, fontWeight:"600", color:"#475569", marginBottom:6 },
  inputWrap: {
    flexDirection:"row", alignItems:"center",
    borderWidth:1, borderColor:"#e2e8f0", borderRadius:10,
    paddingHorizontal:12, paddingVertical:11, backgroundColor:"#f8fafc",
  },
  inputInner: { flex:1, fontSize:14, color:"#334155" },
  inputErr:   { borderColor:DANGER, borderWidth:1.5 },
  fieldErr:   { fontSize:11, color:DANGER, marginTop:4 },
  editActions: {
    flexDirection:"row", padding:14, gap:10,
    borderTopWidth:1, borderTopColor:"#e2e8f0", backgroundColor:"#fff",
  },
  editCancel: {
    flex:1, paddingVertical:12, borderRadius:10,
    borderWidth:1.5, borderColor:PRIMARY, alignItems:"center",
  },
  editCancelTxt: { color:PRIMARY, fontWeight:"600", fontSize:14 },
  editSave: {
    flex:2, paddingVertical:12, borderRadius:10, backgroundColor:PRIMARY,
    flexDirection:"row", alignItems:"center", justifyContent:"center",
  },
  editSaveTxt: { color:"#fff", fontWeight:"700", fontSize:14 },

  pmOverlay: { flex:1, backgroundColor:"rgba(15,23,42,0.5)", justifyContent:"flex-end" },
  pmSheet:   { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:"70%" },
  pmBar:     { width:40, height:4, backgroundColor:"#e2e8f0", borderRadius:2, alignSelf:"center", marginTop:12 },
  pmHead: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:18, paddingVertical:14,
    borderBottomWidth:1, borderBottomColor:"#f1f5f9",
  },
  pmTitle:     { fontSize:16, fontWeight:"700", color:"#1e293b" },
  pmOpt: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:18, paddingVertical:14,
    borderBottomWidth:1, borderBottomColor:"#f8fafc",
  },
  pmOptSel:    { backgroundColor:PRIMARY },
  pmOptTxt:    { fontSize:14, color:"#334155" },
  pmOptTxtSel: { color:"#fff", fontWeight:"600" },

  fOverlay: { flex:1, backgroundColor:"rgba(15,23,42,0.5)", justifyContent:"flex-end" },
  fSheet:   { backgroundColor:"#fff", borderTopLeftRadius:22, borderTopRightRadius:22, maxHeight:"92%" },
  fBar:     { width:40, height:4, backgroundColor:"#e2e8f0", borderRadius:2, alignSelf:"center", marginTop:12 },
  fHead: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:"#f1f5f9",
  },
  fTitle: { fontSize:17, fontWeight:"700", color:"#1e293b" },
  fSub:   { fontSize:12, color:"#64748b", marginTop:2 },
  fClose: { backgroundColor:"#f1f5f9", borderRadius:8, padding:7 },
  fSec:   { borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  fSecHead: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:18, paddingVertical:12, backgroundColor:"#fafbff",
  },
  fSecTitle: { fontSize:14, fontWeight:"600", color:"#334155" },
  fSecBody:  { paddingHorizontal:14, paddingBottom:12, paddingTop:8 },
  fInput: {
    borderWidth:1, borderColor:"#e2e8f0", borderRadius:10,
    paddingHorizontal:12, paddingVertical:9,
    fontSize:13, color:"#334155", backgroundColor:"#f8fafc",
  },
  fGrid:  { flexDirection:"row", flexWrap:"wrap", gap:8 },
  fChip: {
    paddingHorizontal:14, paddingVertical:7, borderRadius:8,
    borderWidth:1, borderColor:"#e2e8f0", backgroundColor:"#f8fafc",
    width:"47%", alignItems:"center",
  },
  fChipActive:   { backgroundColor:PRIMARY, borderColor:PRIMARY },
  fChipTxt:      { fontSize:13, color:"#64748b", fontWeight:"500" },
  fChipTxtActive:{ color:"#fff", fontWeight:"600" },
  fOpt: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:12, paddingVertical:9,
    borderRadius:8, marginBottom:4, backgroundColor:"#f8fafc",
  },
  fOptActive:    { backgroundColor:PRIMARY },
  fOptTxt:       { fontSize:13, color:"#475569" },
  fOptTxtActive: { color:"#fff", fontWeight:"600" },
  fFoot: {
    flexDirection:"row", padding:14, gap:10,
    borderTopWidth:1, borderTopColor:"#e2e8f0", backgroundColor:"#fff",
  },
  fClear: {
    flex:1, paddingVertical:12, borderRadius:10,
    borderWidth:1.5, borderColor:PRIMARY,
    flexDirection:"row", alignItems:"center", justifyContent:"center",
  },
  fClearTxt:{ color:PRIMARY, fontWeight:"600", fontSize:14 },
  fApply: {
    flex:2, paddingVertical:12, borderRadius:10, backgroundColor:PRIMARY,
    flexDirection:"row", alignItems:"center", justifyContent:"center",
    shadowColor:PRIMARY, shadowOffset:{width:0,height:3},
    shadowOpacity:0.3, shadowRadius:5, elevation:4,
  },
  fApplyTxt:{ color:"#fff", fontWeight:"700", fontSize:14 },

  empty:      { alignItems:"center", paddingVertical:56, paddingHorizontal:24, gap:8 },
  emptyIcon:  { backgroundColor:"#f1f5f9", borderRadius:32, padding:18, marginBottom:4 },
  emptyTitle: { fontSize:16, fontWeight:"700", color:"#334155", textAlign:"center" },
  emptySub:   { fontSize:13, color:"#94a3b8", textAlign:"center", lineHeight:20 },
  emptyClear: {
    marginTop:8, backgroundColor:PRIMARY, paddingHorizontal:20, paddingVertical:9,
    borderRadius:8, flexDirection:"row", alignItems:"center",
  },
  emptyClearTxt:{ color:"#fff", fontWeight:"600", fontSize:13 },
});