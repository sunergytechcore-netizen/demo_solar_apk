// InstallationPage.jsx — React Native
// ─────────────────────────────────────────────────────
// Required dependencies:
//   npm install date-fns
//   npm install react-native-vector-icons
//   npm install react-native-document-picker   (for file upload)
//   npm install @react-navigation/native       (if using navigation)
//
//   iOS:  cd ios && pod install
//   Android: auto-linked in RN ≥ 0.60
// ─────────────────────────────────────────────────────

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Animated,
  RefreshControl,
  Linking,
} from 'react-native';
import {
  format,
  isValid,
  parseISO,
  subWeeks,
  subMonths,
} from 'date-fns';
import Ionicons               from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons          from 'react-native-vector-icons/MaterialIcons';
import { useAuth }            from '../contexts/AuthContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════
//  THEME TOKENS
// ═══════════════════════════════════════════════════════
const C = {
  primary:   '#4569ea',
  secondary: '#1a237e',
  success:   '#22c55e',
  warning:   '#f59e0b',
  error:     '#ef4444',
  violet:    '#8b5cf6',
  cyan:      '#06b6d4',
  bg:        '#f8fafc',
  card:      '#ffffff',
  border:    '#e8edf5',
  textMain:  '#1a2340',
  textSec:   '#7a8599',
};

const alpha = (hex, op) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${op})`;
};

// ═══════════════════════════════════════════════════════
//  ICON WRAPPERS
// ═══════════════════════════════════════════════════════
const IIcon  = ({name,size=18,color='#fff',style}) =>
  <Ionicons               name={name} size={size} color={color} style={style}/>;
const MIcon  = ({name,size=18,color='#fff',style}) =>
  <MaterialCommunityIcons name={name} size={size} color={color} style={style}/>;
const MdIcon = ({name,size=18,color='#fff',style}) =>
  <MaterialIcons          name={name} size={size} color={color} style={style}/>;

const CfgIcon = ({icon,size=14,color}) => {
  if (!icon) return null;
  const col = color || C.textMain;
  if (icon.lib==='M')  return <MIcon  name={icon.name} size={size} color={col}/>;
  if (icon.lib==='Md') return <MdIcon name={icon.name} size={size} color={col}/>;
  return                      <IIcon  name={icon.name} size={size} color={col}/>;
};

// ═══════════════════════════════════════════════════════
//  DOMAIN CONSTANTS
// ═══════════════════════════════════════════════════════
const ALLOWED_ROLES = ['Head_office','ZSM','ASM','TEAM'];
const DEFAULT_PAGE  = 10;

const PERIOD_OPTIONS = [
  {value:'Today',      label:'Today'     },
  {value:'This Week',  label:'This Week' },
  {value:'This Month', label:'This Month'},
  {value:'All',        label:'All Time'  },
];

const INSTALLATION_STATUS_OPTIONS = [
  'installation_progress',
  'installation_completed',
  'sent_for_jee_verification',
  'load_Enhancement',
  'jee_verified',
  'meter_charge',
  'final_payment',
];

const STATUS_CFG = {
  installation_progress:     {label:'In Progress',      color:C.primary, icon:{lib:'I', name:'build'},                  progress:40,  order:2},
  installation_completed:    {label:'Completed',        color:C.success, icon:{lib:'I', name:'checkmark-circle'},        progress:60,  order:3},
  sent_for_jee_verification: {label:'JEE Verification', color:C.violet,  icon:{lib:'I', name:'search'},                  progress:80,  order:4},
  load_Enhancement:          {label:'Load Enhancement', color:C.warning, icon:{lib:'I', name:'flash'},                   progress:10,  order:1},
  jee_verified:              {label:'JEE Verified',     color:C.success, icon:{lib:'I', name:'checkmark-done-circle'},   progress:90,  order:5},
  meter_charge:              {label:'Meter Charge',     color:C.cyan,    icon:{lib:'M', name:'meter-electric'},          progress:95,  order:6},
  final_payment:             {label:'Final Payment',    color:C.success, icon:{lib:'I', name:'cash'},                    progress:100, order:7},
};

const LEAD_STATUS_OPTIONS = ['Installation Completion','Missed Leads'];

const LEAD_CFG = {
  'Installation Completion': {label:'Installation Completion', color:C.success, icon:{lib:'I',name:'checkmark-circle'}, description:'Completed'    },
  'Missed Leads':            {label:'Missed Leads',            color:C.error,   icon:{lib:'I',name:'close-circle'},     description:'Not converted'},
};

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
const hasAccess    = r  => ALLOWED_ROLES.includes(r);
const getInitials  = (f,l) => `${f?.charAt(0)||''}${l?.charAt(0)||''}`.toUpperCase();
const getStatusCfg = s  => STATUS_CFG[s?.toString().trim()] ||
  {label:s||'Unknown', color:C.textSec, icon:{lib:'I',name:'help-circle'}, progress:0, order:0};
const getLeadCfg   = s  => LEAD_CFG[s] ||
  {label:s||'Unknown', color:C.textSec, icon:{lib:'I',name:'help-circle'}, description:''};

const formatDate = (ds, fmt='dd MMM yyyy') => {
  if (!ds) return 'Not set';
  try { const d=parseISO(ds); return isValid(d)?format(d,fmt):'—'; } catch { return '—'; }
};

const getUserPermissions = role => ({
  canView:              ['Head_office','ZSM','ASM','TEAM'].includes(role),
  canUpdateStatus:      ['Head_office','ZSM','ASM','TEAM'].includes(role),
  canUploadEnhancement: ['Head_office','ZSM','ASM','TEAM'].includes(role),
});

// ═══════════════════════════════════════════════════════
//  PRIMITIVE COMPONENTS
// ═══════════════════════════════════════════════════════
const ProgressBar = ({value, color=C.primary}) => (
  <View style={[st.progTrack,{backgroundColor:alpha(color,0.15)}]}>
    <View style={[st.progFill,{width:`${Math.min(100,value)}%`,backgroundColor:color}]}/>
  </View>
);

const Pill = ({label, color=C.primary, icon}) => (
  <View style={[st.pill,{backgroundColor:alpha(color,0.12)}]}>
    {icon && <View style={{marginRight:5}}><CfgIcon icon={icon} size={11} color={color}/></View>}
    <Text style={[st.pillText,{color}]}>{label}</Text>
  </View>
);

const Avy = ({initials, size=40, bg=C.primary}) => (
  <View style={[st.avy,{width:size,height:size,borderRadius:size/2,backgroundColor:bg}]}>
    <Text style={[st.avyText,{fontSize:size*0.36}]}>{initials}</Text>
  </View>
);

const Divider = () => <View style={st.divider}/>;

const InfoRow = ({label, value, right}) => (
  <>
    <View style={st.infoRow}>
      <Text style={st.infoLabel}>{label}</Text>
      {right || <Text style={st.infoValue}>{value||'Not set'}</Text>}
    </View>
    <Divider/>
  </>
);

// ── Snackbar ────────────────────────────────────────────
const SNACK_ICON  = {success:'checkmark-circle',error:'close-circle',warning:'warning',info:'information-circle'};
const SNACK_COLOR = {success:C.success,error:C.error,warning:C.warning,info:C.primary};

const Snackbar = ({visible,message,severity='success',onDismiss}) => {
  const y = useRef(new Animated.Value(80)).current;
  useEffect(()=>{
    if (visible) {
      Animated.spring(y,{toValue:0,useNativeDriver:true}).start();
      const t=setTimeout(()=>Animated.timing(y,{toValue:80,duration:300,useNativeDriver:true}).start(onDismiss),3500);
      return ()=>clearTimeout(t);
    }
  },[visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[st.snackbar,{backgroundColor:SNACK_COLOR[severity]||C.primary,transform:[{translateY:y}]}]}>
      <IIcon name={SNACK_ICON[severity]||'information-circle'} size={18} color="#fff" style={{marginRight:8}}/>
      <Text style={st.snackText} numberOfLines={2}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <IIcon name="close" size={18} color="rgba(255,255,255,0.8)"/>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Skeleton ────────────────────────────────────────────
const Skel = ({h=80,r=12,mb=12}) => {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.timing(op,{toValue:1,   duration:700,useNativeDriver:true}),
      Animated.timing(op,{toValue:0.4, duration:700,useNativeDriver:true}),
    ])).start();
  },[]);
  return <Animated.View style={{height:h,borderRadius:r,marginBottom:mb,backgroundColor:'#e2e8f0',opacity:op}}/>;
};

const LoadingSkeleton = () => (
  <View style={{padding:16}}>
    <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:16}}>
      {[1,2,3,4,5,6,7,8].map(i=><View key={i} style={{width:'48%',marginBottom:8}}><Skel h={90}/></View>)}
    </View>
    {[1,2,3].map(i=><Skel key={i} h={120}/>)}
  </View>
);

// ─────────────────────────────────────────────────────────
//  SUMMARY CARD
// ─────────────────────────────────────────────────────────
const SummaryCard = ({label,value,iconDef,subText,color=C.primary}) => (
  <View style={[st.sumCard,{borderLeftColor:color,borderLeftWidth:3}]}>
    <View style={st.sumTop}>
      <View style={[st.sumIconBox,{backgroundColor:alpha(color,0.12)}]}>
        <CfgIcon icon={iconDef} size={20} color={color}/>
      </View>
      <Text style={[st.sumValue,{color}]}>{value}</Text>
    </View>
    <Text style={st.sumLabel}>{label}</Text>
    <Text style={st.sumSub}>{subText}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────
//  INSTALLATION CARD
// ─────────────────────────────────────────────────────────
const InstallationCard = ({lead,onView,onStatusUpdate,onEnhancementUpload,permissions}) => {
  const [expanded,setExpanded] = useState(false);
  const cfg   = getStatusCfg(lead.installationStatus);
  const ldCfg = getLeadCfg(lead.status);
  const isEnh = lead.installationStatus==='load_Enhancement';

  return (
    <View style={st.card}>
      {/* header row */}
      <TouchableOpacity style={st.cardRow} onPress={()=>setExpanded(e=>!e)} activeOpacity={0.8}>
        <Avy initials={getInitials(lead.firstName,lead.lastName)} size={44}/>
        <View style={{marginLeft:12,flex:1}}>
          <Text style={st.cardName}>{lead.firstName} {lead.lastName}</Text>
          <Text style={st.cardSub}>{lead.phoneNumber||lead.phone||'No phone'}</Text>
        </View>
        <IIcon name={expanded?'chevron-up':'chevron-down'} size={16} color={C.textSec}/>
      </TouchableOpacity>

      {/* status pills */}
      <View style={st.pillRow}>
        <Pill label={cfg.label}   color={cfg.color}   icon={cfg.icon}/>
        <Pill label={ldCfg.label} color={ldCfg.color} icon={ldCfg.icon}/>
        {isEnh && <Pill label="Enhancement" color={C.warning} icon={{lib:'I',name:'warning'}}/>}
      </View>

      {/* progress bar */}
      <View style={st.cardProgRow}>
        <ProgressBar value={cfg.progress} color={cfg.color}/>
        <Text style={[st.progPct,{color:cfg.color}]}>{cfg.progress}%</Text>
      </View>

      {/* date row */}
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
        <IIcon name="calendar-outline" size={13} color={C.textSec}/>
        <Text style={st.cardDate}>
          {formatDate(lead.installationDate)}  •  Created {formatDate(lead.createdAt)}
        </Text>
      </View>

      {/* expanded */}
      {expanded && (
        <View style={st.expanded}>
          {lead.city && (
            <View style={st.expRow}>
              <IIcon name="location-outline" size={13} color={C.textSec}/>
              <Text style={[st.expText,{marginLeft:5}]}>{lead.city}{lead.state?`, ${lead.state}`:''}</Text>
            </View>
          )}
          {lead.email && (
            <View style={st.expRow}>
              <IIcon name="mail-outline" size={13} color={C.textSec}/>
              <Text style={[st.expText,{marginLeft:5}]}>{lead.email}</Text>
            </View>
          )}
          {lead.installationNotes && (
            <View style={st.expRow}>
              <IIcon name="document-text-outline" size={13} color={C.textSec}/>
              <Text style={[st.expText,{marginLeft:5,flex:1}]}>{lead.installationNotes}</Text>
            </View>
          )}

          <View style={st.cardActions}>
            <TouchableOpacity style={st.actBtn} onPress={()=>onView(lead)}>
              <IIcon name="eye-outline" size={15} color="#fff"/>
              <Text style={[st.actBtnTxt,{marginLeft:5}]}>View</Text>
            </TouchableOpacity>

            {permissions.canUpdateStatus && (
              <TouchableOpacity style={[st.actBtn,st.actBtnOut]} onPress={()=>onStatusUpdate(lead)}>
                <IIcon name="create-outline" size={15} color={C.primary}/>
                <Text style={[st.actBtnTxt,{color:C.primary,marginLeft:5}]}>Status</Text>
              </TouchableOpacity>
            )}

            {isEnh && permissions.canUploadEnhancement && (
              <TouchableOpacity
                style={[st.actBtn,{backgroundColor:alpha(C.warning,0.15),borderWidth:1,borderColor:C.warning}]}
                onPress={()=>onEnhancementUpload(lead)}>
                <IIcon name="cloud-upload-outline" size={15} color={C.warning}/>
                <Text style={[st.actBtnTxt,{color:C.warning,marginLeft:5}]}>Upload</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────
//  FILTER BOTTOM-SHEET
// ─────────────────────────────────────────────────────────
const FilterSheet = ({
  visible,onClose,
  period,setPeriod,
  instFilter,setInstFilter,
  leadFilter,setLeadFilter,
  search,setSearch,
  sortConfig,setSortConfig,
  onClear,activeCount,
}) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={st.sheet}>
      <View style={st.sheetHandle}/>

      <View style={st.sheetHead}>
        <View>
          <Text style={st.sheetTitle}>Filter Installations</Text>
          <Text style={st.sheetSub}>{activeCount} active filter{activeCount!==1?'s':''}</Text>
        </View>
        <TouchableOpacity style={st.closeCircle} onPress={onClose}>
          <IIcon name="close" size={16} color={C.primary}/>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{padding:16}}>

        {/* Search */}
        <Text style={st.fLabel}>Search</Text>
        <View style={st.searchBox}>
          <IIcon name="search" size={16} color={C.textSec} style={{marginRight:8}}/>
          <TextInput
            style={st.searchInput}
            placeholder="Name, email, phone…"
            placeholderTextColor={C.textSec}
            value={search}
            onChangeText={setSearch}
          />
          {search
            ? <TouchableOpacity onPress={()=>setSearch('')} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                <IIcon name="close-circle" size={16} color={C.textSec}/>
              </TouchableOpacity>
            : null}
        </View>

        {/* Period */}
        <Text style={st.fLabel}>Time Period</Text>
        <View style={st.chipRow}>
          {PERIOD_OPTIONS.map(o=>{
            const act = period===o.value;
            return (
              <TouchableOpacity key={o.value}
                style={[st.fChip,act&&{backgroundColor:C.primary,borderColor:C.primary}]}
                onPress={()=>setPeriod(o.value)}>
                <Text style={[st.fChipTxt,act&&{color:'#fff'}]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Installation status */}
        <Text style={st.fLabel}>Installation Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
          {['All',...INSTALLATION_STATUS_OPTIONS].map(s=>{
            const c   = s==='All' ? {label:'All',color:C.textSec,icon:{lib:'I',name:'list'}} : getStatusCfg(s);
            const act = instFilter===s;
            return (
              <TouchableOpacity key={s}
                style={[st.fChip,{flexDirection:'row',alignItems:'center',marginRight:8},act&&{backgroundColor:c.color,borderColor:c.color}]}
                onPress={()=>setInstFilter(s)}>
                <CfgIcon icon={c.icon} size={12} color={act?'#fff':c.color}/>
                <Text style={[st.fChipTxt,{marginLeft:5},act&&{color:'#fff'}]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lead status */}
        <Text style={st.fLabel}>Lead Status</Text>
        <View style={st.chipRow}>
          {['All',...LEAD_STATUS_OPTIONS].map(s=>{
            const act = leadFilter===s;
            const lc  = s==='All' ? null : getLeadCfg(s);
            return (
              <TouchableOpacity key={s}
                style={[st.fChip,{flexDirection:'row',alignItems:'center'},act&&{backgroundColor:C.primary,borderColor:C.primary}]}
                onPress={()=>setLeadFilter(s)}>
                {lc && <View style={{marginRight:5}}><CfgIcon icon={lc.icon} size={12} color={act?'#fff':lc.color}/></View>}
                <Text style={[st.fChipTxt,act&&{color:'#fff'}]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sort */}
        <Text style={st.fLabel}>Sort By</Text>
        {[
          {key:'firstName',          label:'Name',              icon:'person-outline'     },
          {key:'installationDate',   label:'Installation Date', icon:'calendar-outline'   },
          {key:'installationStatus', label:'Status',            icon:'layers-outline'     },
        ].map(o=>{
          const act = sortConfig.key===o.key;
          return (
            <TouchableOpacity key={o.key}
              style={[st.sortBtn,act&&{backgroundColor:C.primary}]}
              onPress={()=>setSortConfig(p=>({key:o.key,direction:p.key===o.key&&p.direction==='asc'?'desc':'asc'}))}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <IIcon name={o.icon} size={16} color={act?'#fff':C.textMain}/>
                <Text style={[st.sortTxt,act&&{color:'#fff'}]}>{o.label}</Text>
              </View>
              {act && <IIcon name={sortConfig.direction==='asc'?'arrow-up':'arrow-down'} size={14} color="#fff"/>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={st.sheetFoot}>
        <TouchableOpacity style={[st.btn,st.btnOut,{flexDirection:'row',gap:6}]}
          onPress={()=>{onClear();onClose();}}>
          <IIcon name="refresh" size={16} color={C.primary}/>
          <Text style={[st.btnTxt,{color:C.primary}]}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.btn,{backgroundColor:C.primary,flex:1,flexDirection:'row',gap:6}]}
          onPress={onClose}>
          <IIcon name="checkmark" size={16} color="#fff"/>
          <Text style={[st.btnTxt,{color:'#fff'}]}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─────────────────────────────────────────────────────────
//  VIEW LEAD MODAL
// ─────────────────────────────────────────────────────────
const ViewLeadModal = ({visible,onClose,lead,onViewDocument}) => {
  const [tab,setTab] = useState(0);
  if (!lead) return null;
  const cfg   = getStatusCfg(lead.installationStatus);
  const ldCfg = getLeadCfg(lead.status);

  const TABS = [
    {label:'Installation', icon:'build-outline'  },
    {label:'Customer',     icon:'person-outline' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={st.modal}>
        <View style={[st.modalHead,{backgroundColor:C.primary}]}>
          <Avy initials={getInitials(lead.firstName,lead.lastName)} size={48} bg="rgba(255,255,255,0.25)"/>
          <View style={{marginLeft:12,flex:1}}>
            <Text style={st.modalHeadName}>{lead.firstName} {lead.lastName}</Text>
            <Text style={st.modalHeadSub}>Installation Details • {cfg.label}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <IIcon name="close" size={22} color="#fff"/>
          </TouchableOpacity>
        </View>

        <View style={st.tabBar}>
          {TABS.map((t,i)=>(
            <TouchableOpacity key={t.label} style={[st.tab,tab===i&&st.tabAct]} onPress={()=>setTab(i)}>
              <IIcon name={t.icon} size={15} color={tab===i?C.primary:C.textSec}/>
              <Text style={[st.tabTxt,{marginLeft:5},tab===i&&st.tabTxtAct]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{padding:16}}>
          {tab===0 && (
            <>
              <View style={st.detCard}>
                <View style={st.detTitleRow}>
                  <IIcon name="build" size={15} color={C.primary}/>
                  <Text style={[st.detTitle,{marginLeft:6}]}>Installation Details</Text>
                </View>
                <InfoRow label="Installation Date" value={formatDate(lead.installationDate,'dd MMM yyyy, hh:mm a')}/>
                <InfoRow label="Installation Status" right={<Pill label={cfg.label}   color={cfg.color}   icon={cfg.icon}/>}/>
                <InfoRow label="Lead Status"         right={<Pill label={ldCfg.label} color={ldCfg.color} icon={ldCfg.icon}/>}/>
                <InfoRow label="Last Updated"        value={formatDate(lead.updatedAt,'dd MMM yyyy, hh:mm a')}/>
                <InfoRow label="Created"             value={formatDate(lead.createdAt,'dd MMM yyyy')}/>
              </View>

              {lead.installationNotes && (
                <View style={st.detCard}>
                  <View style={st.detTitleRow}>
                    <IIcon name="document-text" size={15} color={C.primary}/>
                    <Text style={[st.detTitle,{marginLeft:6}]}>Notes</Text>
                  </View>
                  <Text style={{color:C.textMain,fontSize:14,lineHeight:22}}>{lead.installationNotes}</Text>
                </View>
              )}

              {lead.installationDocument?.url && (
                <View style={st.detCard}>
                  <View style={st.detTitleRow}>
                    <IIcon name="document-attach" size={15} color={C.primary}/>
                    <Text style={[st.detTitle,{marginLeft:6}]}>Installation Document</Text>
                  </View>
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(lead.installationDocument.url) && (
                    <TouchableOpacity onPress={()=>onViewDocument?.(lead.installationDocument.url)}>
                      <Image source={{uri:lead.installationDocument.url}} style={st.docThumb}/>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={st.docBtn}
                    onPress={()=>onViewDocument?.(lead.installationDocument.url)}>
                    <IIcon name="open-outline" size={15} color={C.primary} style={{marginRight:6}}/>
                    <Text style={st.docBtnTxt}>View Document</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {tab===1 && (
            <View style={st.detCard}>
              <View style={st.detTitleRow}>
                <IIcon name="person" size={15} color={C.primary}/>
                <Text style={[st.detTitle,{marginLeft:6}]}>Customer Information</Text>
              </View>
              <InfoRow label="Full Name" value={`${lead.firstName} ${lead.lastName}`}/>
              <InfoRow label="Email"     value={lead.email}/>
              <InfoRow label="Phone"     value={lead.phoneNumber||lead.phone}/>
              <InfoRow label="Address"   value={lead.address}/>
              <InfoRow label="City"      value={lead.city}/>
              <InfoRow label="State"     value={lead.state}/>
            </View>
          )}
        </ScrollView>

        <View style={st.modalFoot}>
          <TouchableOpacity style={[st.btn,{backgroundColor:C.primary,flex:1,flexDirection:'row',gap:8}]}
            onPress={onClose}>
            <IIcon name="close-circle-outline" size={16} color="#fff"/>
            <Text style={[st.btnTxt,{color:'#fff'}]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────
//  STATUS UPDATE MODAL
// ─────────────────────────────────────────────────────────
const StatusUpdateModal = ({visible,onClose,lead,onStatusUpdate,showSnackbar}) => {
  const {fetchAPI,user} = useAuth();
  const [loading,setLoading] = useState(false);
  const [instSt,setInstSt]   = useState('');
  const [leadSt,setLeadSt]   = useState('');
  const [notes,setNotes]     = useState('');
  const [err,setErr]         = useState({});

  useEffect(()=>{
    if (visible&&lead){
      setInstSt(lead.installationStatus||'');
      setLeadSt(lead.status||'Installation Completion');
      setNotes(lead.installationNotes||'');
      setErr({});
    }
  },[visible,lead]);

  const available = useMemo(()=>
    INSTALLATION_STATUS_OPTIONS.filter(s=>s!==lead?.installationStatus),[lead]);

  const submit = async () => {
    const e={};
    if (!instSt) e.instSt='Select installation status';
    if (!leadSt) e.leadSt='Select lead status';
    if (Object.keys(e).length){setErr(e);return;}
    setLoading(true);
    try {
      const res = await fetchAPI(`/lead/updateLead/${lead._id}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          installationStatus:instSt,
          status:leadSt,
          installationNotes:notes.trim(),
          updatedBy:user?._id,
          updatedByRole:user?.role,
          updatedAt:new Date().toISOString(),
        }),
      });
      if (res.success){
        showSnackbar('Status updated successfully','success');
        onStatusUpdate(res.result);
        onClose();
      } else throw new Error(res.message||'Failed to update');
    } catch(e){
      showSnackbar(e.message||'Failed to update','error');
      setErr({submit:e.message});
    } finally {setLoading(false);}
  };

  if (!lead) return null;
  const curCfg = getStatusCfg(lead.installationStatus);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={st.modal}>
          <View style={st.updHead}>
            <View style={[st.updIconBox,{backgroundColor:alpha(C.primary,0.12)}]}>
              <IIcon name="build" size={24} color={C.primary}/>
            </View>
            <View style={{flex:1,marginLeft:12}}>
              <Text style={st.updTitle}>Update Installation Status</Text>
              <Text style={st.updSub}>{lead.firstName} {lead.lastName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <IIcon name="close" size={22} color={C.textSec}/>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{padding:16}}>
            {err.submit && (
              <View style={st.errBox}>
                <IIcon name="alert-circle" size={16} color={C.error} style={{marginRight:8}}/>
                <Text style={st.errTxt}>{err.submit}</Text>
              </View>
            )}

            <View style={{flexDirection:'row',gap:12,marginBottom:16}}>
              <View style={{flex:1}}>
                <Text style={st.fLabel}>Current Installation</Text>
                <Pill label={curCfg.label} color={curCfg.color} icon={curCfg.icon}/>
              </View>
              <View style={{flex:1}}>
                <Text style={st.fLabel}>Current Lead</Text>
                <Pill label={lead.status||'Unknown'} color={getLeadCfg(lead.status).color} icon={getLeadCfg(lead.status).icon}/>
              </View>
            </View>

            <Text style={st.fLabel}>New Installation Status *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:4}}>
              {available.map(s=>{
                const c   = getStatusCfg(s);
                const act = instSt===s;
                return (
                  <TouchableOpacity key={s}
                    style={[st.statusChip,act&&{backgroundColor:c.color,borderColor:c.color}]}
                    onPress={()=>{setInstSt(s);if(s==='final_payment')setLeadSt('Installation Completion');}}
                    disabled={loading}>
                    <CfgIcon icon={c.icon} size={15} color={act?'#fff':c.color}/>
                    <Text style={[st.statusChipTxt,{marginLeft:6},act&&{color:'#fff'}]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {err.instSt && <Text style={st.fieldErr}>{err.instSt}</Text>}

            <Text style={[st.fLabel,{marginTop:12}]}>Lead Status *</Text>
            <View style={{flexDirection:'row',gap:8,marginBottom:4}}>
              {LEAD_STATUS_OPTIONS.map(ls=>{
                const act = leadSt===ls;
                const lc  = getLeadCfg(ls);
                return (
                  <TouchableOpacity key={ls}
                    style={[st.statusChip,{flex:1,justifyContent:'center'},act&&{backgroundColor:lc.color,borderColor:lc.color}]}
                    onPress={()=>setLeadSt(ls)}
                    disabled={loading||!instSt}>
                    <CfgIcon icon={lc.icon} size={14} color={act?'#fff':lc.color}/>
                    <Text style={[st.statusChipTxt,{marginLeft:5},act&&{color:'#fff'}]}>{ls}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {err.leadSt && <Text style={st.fieldErr}>{err.leadSt}</Text>}

            <Text style={[st.fLabel,{marginTop:12}]}>Installation Notes</Text>
            <TextInput
              style={st.textArea}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholder="Add notes about this installation…"
              placeholderTextColor={C.textSec}
              editable={!loading}
            />

            {instSt && (
              <View style={[st.infoTip,{flexDirection:'row',alignItems:'flex-start'}]}>
                <IIcon name="information-circle-outline" size={16} color={C.primary} style={{marginRight:6,marginTop:1}}/>
                <Text style={[st.infoTipTxt,{flex:1}]}>
                  {instSt==='final_payment'
                    ? 'Final payment marks the installation as completed.'
                    : instSt==='load_Enhancement'
                    ? 'Enhancement status requires document upload.'
                    : 'Status will be updated on save.'}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={st.sheetFoot}>
            <TouchableOpacity style={[st.btn,st.btnOut,{flexDirection:'row',gap:6}]}
              onPress={onClose} disabled={loading}>
              <IIcon name="close" size={16} color={C.primary}/>
              <Text style={[st.btnTxt,{color:C.primary}]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btn,{backgroundColor:C.primary,flex:1,flexDirection:'row',gap:6},(!instSt||!leadSt||loading)&&{opacity:0.5}]}
              onPress={submit} disabled={!instSt||!leadSt||loading}>
              {loading
                ? <ActivityIndicator color="#fff" size="small"/>
                : <>
                    <IIcon name="checkmark-circle-outline" size={16} color="#fff"/>
                    <Text style={[st.btnTxt,{color:'#fff'}]}>Update Status</Text>
                  </>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────
//  ENHANCEMENT UPLOAD MODAL
// ─────────────────────────────────────────────────────────
const UploadModal = ({visible,onClose,lead,onUploadComplete,showSnackbar}) => {
  const {fetchAPI} = useAuth();
  const [loading,setLoading]   = useState(false);
  const [progress,setProgress] = useState(0);
  const [file,setFile]         = useState(null);
  const [err,setErr]           = useState('');

  useEffect(()=>{if(visible){setFile(null);setErr('');setProgress(0);}},[visible]);

  const pickFile = async () => {
    try {
      // ── requires: npm install react-native-document-picker ──
      // const DocumentPicker = require('react-native-document-picker').default;
      // const res = await DocumentPicker.pickSingle({
      //   type:[DocumentPicker.types.images, DocumentPicker.types.pdf],
      // });
      // setFile(res); setErr('');
      Alert.alert('Install required',
        'Run: npm install react-native-document-picker\nThen uncomment the picker code.',
        [{text:'OK'}]);
    } catch(e){
      if(e?.code!=='DOCUMENT_PICKER_CANCELED') setErr('Failed to pick document');
    }
  };

  const upload = async () => {
    if (!file){setErr('Please select a document');return;}
    setLoading(true);setProgress(0);
    try {
      const fd = new FormData();
      fd.append('document',{uri:file.uri,type:file.type||'application/octet-stream',name:file.name||'doc'});
      const iv = setInterval(()=>setProgress(p=>{if(p>=90){clearInterval(iv);return 90;}return p+10;}),400);
      const res = await fetchAPI(`/lead/installation/${lead._id}/document-upload`,{method:'POST',body:fd});
      clearInterval(iv);setProgress(100);
      if (res?.success){
        showSnackbar('Document uploaded successfully','success');
        onUploadComplete(res.result);
        setTimeout(onClose,500);
      } else throw new Error(res?.message||'Upload failed');
    } catch(e){
      showSnackbar(e.message||'Upload failed','error');
      setErr(e.message||'Upload failed');
    } finally {setLoading(false);}
  };

  if (!lead) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={st.modal}>
        <View style={st.updHead}>
          <View style={[st.updIconBox,{backgroundColor:alpha(C.primary,0.12)}]}>
            <IIcon name="cloud-upload" size={24} color={C.primary}/>
          </View>
          <View style={{flex:1,marginLeft:12}}>
            <Text style={st.updTitle}>Upload Enhancement Document</Text>
            <Text style={st.updSub}>{lead.firstName} {lead.lastName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} disabled={loading} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <IIcon name="close" size={22} color={C.textSec}/>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{padding:16}}>
          {loading&&progress>0 && (
            <View style={{marginBottom:12}}>
              <Text style={st.fLabel}>Uploading: {progress}%</Text>
              <ProgressBar value={progress}/>
            </View>
          )}
          <View style={[st.infoTip,{flexDirection:'row',alignItems:'flex-start'}]}>
            <IIcon name="information-circle-outline" size={16} color={C.primary} style={{marginRight:6,marginTop:1}}/>
            <Text style={[st.infoTipTxt,{flex:1}]}>
              Upload the required enhancement document. It will be reviewed by the team.
            </Text>
          </View>

          <TouchableOpacity style={file?st.filePicked:st.filePicker} onPress={pickFile} disabled={loading}>
            {file ? (
              <View style={{flexDirection:'row',alignItems:'center'}}>
                <IIcon name="document" size={32} color={C.primary}/>
                <View style={{flex:1,marginLeft:12}}>
                  <Text style={{fontWeight:'700',color:C.textMain}} numberOfLines={1}>{file.name}</Text>
                  <Text style={{color:C.textSec,fontSize:12}}>
                    {file.size?(file.size/1024).toFixed(1)+' KB':''}
                  </Text>
                </View>
                <TouchableOpacity onPress={()=>setFile(null)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                  <IIcon name="trash-outline" size={20} color={C.error}/>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <IIcon name="cloud-upload-outline" size={44} color={C.textSec}/>
                <Text style={st.pickerLabel}>Tap to select Enhancement Document</Text>
                <Text style={st.pickerSub}>JPG, PNG, PDF — Max 5 MB</Text>
              </>
            )}
          </TouchableOpacity>
          {err && (
            <View style={{flexDirection:'row',alignItems:'center',marginTop:4}}>
              <IIcon name="alert-circle" size={13} color={C.error} style={{marginRight:4}}/>
              <Text style={st.fieldErr}>{err}</Text>
            </View>
          )}

          {lead.enhancementDocuments?.length>0 && (
            <>
              <Text style={[st.fLabel,{marginTop:12}]}>Previously Uploaded</Text>
              {lead.enhancementDocuments.map((d,i)=>(
                <View key={i} style={st.prevDoc}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                    <IIcon name="document-outline" size={16} color={C.primary}/>
                    <Text style={{color:C.textMain}}>Document {i+1}</Text>
                  </View>
                  <Text style={{color:C.textSec,fontSize:12}}>{formatDate(d.uploadedAt,'dd MMM yyyy')}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        <View style={st.sheetFoot}>
          <TouchableOpacity style={[st.btn,st.btnOut,{flexDirection:'row',gap:6}]}
            onPress={onClose} disabled={loading}>
            <IIcon name="close" size={16} color={C.primary}/>
            <Text style={[st.btnTxt,{color:C.primary}]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.btn,{backgroundColor:C.primary,flex:1,flexDirection:'row',gap:6},(!file||loading)&&{opacity:0.5}]}
            onPress={upload} disabled={!file||loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small"/>
              : <>
                  <IIcon name="cloud-upload-outline" size={16} color="#fff"/>
                  <Text style={[st.btnTxt,{color:'#fff'}]}>Upload Document</Text>
                </>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────
//  IMAGE VIEWER MODAL
// ─────────────────────────────────────────────────────────
const ImgViewer = ({visible,onClose,url,title}) => (
  <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={st.imgModal}>
      <View style={st.imgHead}>
        <Text style={st.imgTitle} numberOfLines={1}>{title||'Document'}</Text>
        <View style={{flexDirection:'row',gap:8}}>
          {url && (
            <TouchableOpacity style={st.imgActBtn} onPress={()=>Linking.openURL(url)}>
              <IIcon name="download-outline" size={20} color="#fff"/>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={st.imgActBtn} onPress={onClose}>
            <IIcon name="close" size={20} color="#fff"/>
          </TouchableOpacity>
        </View>
      </View>
      <View style={st.imgBody}>
        {url&&/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url)
          ? <Image source={{uri:url}} style={{width:SCREEN_W,height:SCREEN_H*0.8}} resizeMode="contain"/>
          : (
            <View style={{alignItems:'center',padding:24}}>
              <IIcon name="document-outline" size={72} color="#555"/>
              <Text style={{color:'#aaa',fontSize:16,marginTop:12}}>Preview not available</Text>
              {url && (
                <TouchableOpacity
                  style={[st.btn,{backgroundColor:C.primary,marginTop:16,flexDirection:'row',gap:8}]}
                  onPress={()=>Linking.openURL(url)}>
                  <IIcon name="open-outline" size={16} color="#fff"/>
                  <Text style={[st.btnTxt,{color:'#fff'}]}>Open in Browser</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
      </View>
    </View>
  </Modal>
);

// ─────────────────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────────────────
const EmptyState = ({onClear,hasFilters}) => (
  <View style={st.empty}>
    <IIcon name="construct-outline" size={56} color={C.textSec}/>
    <Text style={st.emptyTitle}>No installations found</Text>
    <Text style={st.emptySub}>
      {hasFilters?'No results for current filters.':'No installations scheduled yet.'}
    </Text>
    {hasFilters && (
      <TouchableOpacity
        style={[st.btn,{backgroundColor:C.primary,marginTop:12,flexDirection:'row',gap:8}]}
        onPress={onClear}>
        <IIcon name="refresh" size={15} color="#fff"/>
        <Text style={[st.btnTxt,{color:'#fff'}]}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ══════════════════════════════════════════════════════════
//  ████████  MAIN PAGE  ████████
// ══════════════════════════════════════════════════════════

interface Props {
  onMenuPress?:    () => void;
  onSearchPress?:  () => void;
  onProfilePress?: () => void;
  onBackPress?:    () => void;
}

export default function InstallationPage({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  onBackPress,
}: Props = {}) {

  const {fetchAPI,user,getUserRole} = useAuth();
  const userRole = getUserRole();
  const perms    = useMemo(()=>getUserPermissions(userRole),[userRole]);

  const [period,setPeriod]   = useState('All');
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState(null);
  const [data,setData]       = useState({installations:[]});

  const [search,setSearch]         = useState('');
  const [instFilter,setInstFilter] = useState('All');
  const [leadFilter,setLeadFilter] = useState('All');
  const [sortConfig,setSortConfig] = useState({key:'installationDate',direction:'desc'});
  const [page,setPage]             = useState(0);

  const [filterOpen, setFilterOpen] = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [imgOpen,    setImgOpen]    = useState(false);
  const [selLead,    setSelLead]    = useState(null);
  const [imgUrl,     setImgUrl]     = useState('');

  const [snack,setSnack] = useState({visible:false,message:'',severity:'success'});
  const showSnackbar = useCallback((msg,sev='success')=>
    setSnack({visible:true,message:msg,severity:sev}),[]);

  const fetchData = useCallback(async()=>{
    try {
      setLoading(true);setError(null);
      const p=new URLSearchParams(), today=new Date();
      if (period==='Today')
        {p.append('startDate',format(today,'yyyy-MM-dd'));p.append('endDate',format(today,'yyyy-MM-dd'));}
      else if (period==='This Week')
        {p.append('startDate',format(subWeeks(today,1),'yyyy-MM-dd'));p.append('endDate',format(today,'yyyy-MM-dd'));}
      else if (period==='This Month')
        {p.append('startDate',format(subMonths(today,1),'yyyy-MM-dd'));p.append('endDate',format(today,'yyyy-MM-dd'));}

      const res = await fetchAPI(`/lead/installationSummary${p.toString()?`?${p}`:''}`);
      if (!res?.success) throw new Error(res?.message||'Failed to fetch');

      let list = res.result?.installations||[];

      // Role-based filtering
      if (userRole==='TEAM'&&user?._id)
        list=list.filter(l=>l.createdBy===user._id||l.assignedTo===user._id||
          l.assignedManager===user._id||l.assignedUser?._id===user._id);
      else if (userRole==='ASM'&&user?._id)
        list=list.filter(l=>l.createdBy===user._id||l.assignedManager===user._id||l.areaManager===user._id);
      else if (userRole==='ZSM'&&user?._id)
        list=list.filter(l=>l.createdBy===user._id||l.zoneManager===user._id);

      // ✅ FIX: store only installations; counts are derived live from this array
      setData({installations:list});
    } catch(e){
      setError(e.message||'Network error');
      showSnackbar(e.message||'Failed to fetch','error');
      setData({installations:[]});
    } finally {setLoading(false);}
  },[period,fetchAPI,userRole,user,showSnackbar]);

  useEffect(()=>{if(hasAccess(userRole))fetchData();},[fetchData,userRole]);

  const filtered = useMemo(()=>{
    let list=[...data.installations];
    if (search.trim()){
      const q=search.toLowerCase();
      list=list.filter(l=>
        (l.firstName?.toLowerCase()||'').includes(q)||
        (l.lastName?.toLowerCase()||'').includes(q)||
        (l.email?.toLowerCase()||'').includes(q)||
        (l.phoneNumber||l.phone||'').includes(q));
    }
    if (instFilter!=='All') list=list.filter(l=>l.installationStatus===instFilter);
    if (leadFilter!=='All') list=list.filter(l=>l.status===leadFilter);
    list.sort((a,b)=>{
      let av=a[sortConfig.key],bv=b[sortConfig.key];
      if (sortConfig.key==='installationDate'||sortConfig.key==='createdAt'){
        av=av?new Date(av):new Date(0);bv=bv?new Date(bv):new Date(0);
      } else if (sortConfig.key==='firstName'){
        av=`${a.firstName||''} ${a.lastName||''}`.toLowerCase();
        bv=`${b.firstName||''} ${b.lastName||''}`.toLowerCase();
      } else if (sortConfig.key==='installationStatus'){
        av=getStatusCfg(a.installationStatus)?.order||0;
        bv=getStatusCfg(b.installationStatus)?.order||0;
      }
      if(av<bv)return sortConfig.direction==='asc'?-1:1;
      if(av>bv)return sortConfig.direction==='asc'?1:-1;
      return 0;
    });
    return list;
  },[data.installations,search,instFilter,leadFilter,sortConfig]);

  const paginated  = useMemo(()=>filtered.slice(page*DEFAULT_PAGE,(page+1)*DEFAULT_PAGE),[filtered,page]);
  const totalPages = Math.ceil(filtered.length/DEFAULT_PAGE);
  const activeCount = useMemo(()=>
    [search,instFilter!=='All',leadFilter!=='All'].filter(Boolean).length,
    [search,instFilter,leadFilter]);

  const clearFilters = useCallback(()=>{
    setSearch('');setInstFilter('All');setLeadFilter('All');
    setSortConfig({key:'installationDate',direction:'desc'});setPage(0);
  },[]);

  // ✅ FIX: summaryCards derived directly from data.installations (always fresh, no stale summary object)
  const summaryCards = useMemo(()=>{
    const inst  = data.installations;
    const count = (status) => inst.filter(l => l.installationStatus === status).length;
    return [
      {label:'Total',         value:inst.length,                        iconDef:{lib:'M',name:'office-building'},       subText:'All',         color:C.primary},
      {label:'In Progress',   value:count('installation_progress'),     iconDef:{lib:'I',name:'build'},                 subText:'Ongoing',     color:C.primary},
      {label:'Completed',     value:count('installation_completed'),    iconDef:{lib:'I',name:'checkmark-circle'},      subText:'Done',        color:C.success},
      {label:'JEE Verify',    value:count('sent_for_jee_verification'), iconDef:{lib:'I',name:'search'},                subText:'Pending',     color:C.violet },
      {label:'JEE Verified',  value:count('jee_verified'),              iconDef:{lib:'I',name:'checkmark-done-circle'}, subText:'Approved',    color:C.success},
      {label:'Enhancement',   value:count('load_Enhancement'),          iconDef:{lib:'I',name:'flash'},                 subText:'Needs docs',  color:C.warning},
      {label:'Meter Charge',  value:count('meter_charge'),              iconDef:{lib:'M',name:'meter-electric'},        subText:'In progress', color:C.cyan   },
      {label:'Final Payment', value:count('final_payment'),             iconDef:{lib:'I',name:'cash'},                  subText:'Completed',   color:C.success},
    ];
  },[data.installations]);

  // ── access gate ──────────────────────────────────────
  if (!hasAccess(userRole))
    return (
      <View style={st.gate}>
        <MdIcon name="block" size={56} color={C.error}/>
        <Text style={st.gateTitle}>Access Denied</Text>
        <Text style={st.gateSub}>You don't have permission to view this page.</Text>
      </View>
    );

  if (loading&&data.installations.length===0) return <LoadingSkeleton/>;

  if (error&&data.installations.length===0)
    return (
      <View style={st.gate}>
        <IIcon name="warning" size={56} color={C.warning}/>
        <Text style={[st.gateTitle,{color:C.error}]}>Something went wrong</Text>
        <Text style={st.gateSub}>{error}</Text>
        <TouchableOpacity
          style={[st.btn,{backgroundColor:C.primary,marginTop:16,flexDirection:'row',gap:8}]}
          onPress={fetchData}>
          <IIcon name="refresh" size={16} color="#fff"/>
          <Text style={[st.btnTxt,{color:'#fff'}]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );

  // ─────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────
  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary}/>

      {/* ── MODALS ─────────────────────────────────── */}
      <FilterSheet
        visible={filterOpen} onClose={()=>setFilterOpen(false)}
        period={period}      setPeriod={v=>{setPeriod(v);setPage(0);}}
        instFilter={instFilter} setInstFilter={v=>{setInstFilter(v);setPage(0);}}
        leadFilter={leadFilter} setLeadFilter={v=>{setLeadFilter(v);setPage(0);}}
        search={search}      setSearch={v=>{setSearch(v);setPage(0);}}
        sortConfig={sortConfig} setSortConfig={setSortConfig}
        onClear={clearFilters}  activeCount={activeCount}
      />
      <ViewLeadModal
        visible={viewOpen} onClose={()=>setViewOpen(false)} lead={selLead}
        onViewDocument={u=>{setImgUrl(u);setImgOpen(true);}}
      />
      <StatusUpdateModal
        visible={statusOpen} onClose={()=>setStatusOpen(false)} lead={selLead}
        onStatusUpdate={()=>fetchData()} showSnackbar={showSnackbar}
      />
      <UploadModal
        visible={uploadOpen} onClose={()=>setUploadOpen(false)} lead={selLead}
        onUploadComplete={()=>fetchData()} showSnackbar={showSnackbar}
      />
      <ImgViewer visible={imgOpen} onClose={()=>setImgOpen(false)} url={imgUrl} title="Document Preview"/>

      {/* ── PAGE HEADER ────────────────────────────── */}
      <View style={st.pageHead}>

        {/* LEFT: back | menu | title */}
        <View style={st.hdrLeft}>
          {onBackPress ? (
            <TouchableOpacity style={st.hdrIconBtn} onPress={onBackPress}
              hitSlop={{top:8,bottom:8,left:8,right:8}}
              accessibilityLabel="Go back" accessibilityRole="button">
              <IIcon name="arrow-back" size={22} color="#fff"/>
            </TouchableOpacity>
          ) : onMenuPress ? (
            <TouchableOpacity style={st.hdrIconBtn} onPress={onMenuPress}
              hitSlop={{top:8,bottom:8,left:8,right:8}}
              accessibilityLabel="Open menu" accessibilityRole="button">
              <IIcon name="menu" size={24} color="#fff"/>
            </TouchableOpacity>
          ) : null}
          <View style={{marginLeft:(onBackPress||onMenuPress)?10:0}}>
            <Text style={st.pageTitle} numberOfLines={1}>Installation Management</Text>
            <Text style={st.pageSub}>Track solar panel installations</Text>
          </View>
        </View>

        {/* RIGHT: search · filter · refresh · profile */}
        <View style={st.hdrRight}>

          {/* Search */}
          <TouchableOpacity style={st.hdrIconBtn}
            onPress={onSearchPress??(() => setFilterOpen(true))}
            hitSlop={{top:8,bottom:8,left:8,right:8}}
            accessibilityLabel="Search" accessibilityRole="button">
            <IIcon name="search" size={20} color="#fff"/>
          </TouchableOpacity>

          {/* Filter with count badge */}
          <TouchableOpacity
            style={[st.hdrIconBtn,activeCount>0&&st.hdrIconBtnActive]}
            onPress={()=>setFilterOpen(true)}
            accessibilityLabel={`Filter${activeCount>0?`, ${activeCount} active`:''}`}>
            <IIcon name="options-outline" size={20} color={activeCount>0?C.primary:'#fff'}/>
            {activeCount>0 && (
              <View style={st.hdrBadge}>
                <Text style={st.hdrBadgeTxt}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Refresh */}
          <TouchableOpacity style={st.hdrIconBtn} onPress={fetchData} disabled={loading}
            hitSlop={{top:8,bottom:8,left:8,right:8}}
            accessibilityLabel="Refresh">
            {loading
              ? <ActivityIndicator size="small" color="#fff"/>
              : <IIcon name="refresh" size={20} color="#fff"/>}
          </TouchableOpacity>

          {/* Profile */}
          {onProfilePress && (
            <TouchableOpacity onPress={onProfilePress}
              hitSlop={{top:8,bottom:8,left:8,right:8}}
              accessibilityLabel="Profile" accessibilityRole="button">
              <Avy initials={getInitials(user?.firstName,user?.lastName)} size={34} bg="rgba(255,255,255,0.25)"/>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── SEARCH BAR ─────────────────────────────── */}
      <View style={st.searchWrap}>
        <View style={st.searchBox}>
          <TouchableOpacity onPress={onSearchPress} disabled={!onSearchPress}
            hitSlop={{top:6,bottom:6,left:6,right:6}}>
            <IIcon name="search" size={16} color={C.textSec} style={{marginRight:8}}/>
          </TouchableOpacity>
          <TextInput
            style={st.searchInput}
            placeholder="Search by name, email, phone…"
            placeholderTextColor={C.textSec}
            value={search}
            onChangeText={v=>{setSearch(v);setPage(0);}}
            onFocus={onSearchPress}
            returnKeyType="search"
          />
          {search
            ? <TouchableOpacity onPress={()=>setSearch('')} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                <IIcon name="close-circle" size={16} color={C.textSec}/>
              </TouchableOpacity>
            : null}
        </View>
      </View>

      {/* ── MAIN LIST ──────────────────────────────── */}
      <FlatList
        data={paginated}
        keyExtractor={item=>item._id}
        contentContainerStyle={{padding:12,paddingBottom:40}}
        refreshControl={
          <RefreshControl
            refreshing={loading&&data.installations.length>0}
            onRefresh={fetchData} colors={[C.primary]}
          />
        }
        ListHeaderComponent={()=>(
          <>
            {/* summary grid */}
            <View style={st.sumGrid}>
              {summaryCards.map(c=>(
                <View key={c.label} style={{width:'48%',marginBottom:10}}>
                  <SummaryCard {...c}/>
                </View>
              ))}
            </View>

            {/* active filter chips */}
            {activeCount>0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
                {search && (
                  <TouchableOpacity style={st.actChip} onPress={()=>setSearch('')}>
                    <IIcon name="search" size={12} color={C.primary}/>
                    <Text style={[st.actChipTxt,{marginHorizontal:4}]}>"{search}"</Text>
                    <IIcon name="close" size={12} color={C.primary}/>
                  </TouchableOpacity>
                )}
                {instFilter!=='All' && (
                  <TouchableOpacity style={st.actChip} onPress={()=>setInstFilter('All')}>
                    <CfgIcon icon={getStatusCfg(instFilter).icon} size={12} color={C.primary}/>
                    <Text style={[st.actChipTxt,{marginHorizontal:4}]}>{getStatusCfg(instFilter).label}</Text>
                    <IIcon name="close" size={12} color={C.primary}/>
                  </TouchableOpacity>
                )}
                {leadFilter!=='All' && (
                  <TouchableOpacity style={st.actChip} onPress={()=>setLeadFilter('All')}>
                    <CfgIcon icon={getLeadCfg(leadFilter).icon} size={12} color={C.primary}/>
                    <Text style={[st.actChipTxt,{marginHorizontal:4}]}>{leadFilter}</Text>
                    <IIcon name="close" size={12} color={C.primary}/>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            {/* section label */}
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <IIcon name="list" size={18} color={C.textMain}/>
                <Text style={{fontSize:16,fontWeight:'800',color:C.textMain}}>Installations</Text>
              </View>
              <View style={{backgroundColor:alpha(C.primary,0.12),paddingHorizontal:10,paddingVertical:3,borderRadius:20}}>
                <Text style={{color:C.primary,fontWeight:'700',fontSize:13}}>{filtered.length}</Text>
              </View>
            </View>
          </>
        )}
        ListEmptyComponent={<EmptyState onClear={clearFilters} hasFilters={activeCount>0}/>}
        renderItem={({item})=>(
          <InstallationCard
            lead={item} permissions={perms}
            onView={l=>{setSelLead(l);setViewOpen(true);}}
            onStatusUpdate={l=>{setSelLead(l);setStatusOpen(true);}}
            onEnhancementUpload={l=>{setSelLead(l);setUploadOpen(true);}}
          />
        )}
        ListFooterComponent={()=>filtered.length>0 ? (
          <View style={st.pager}>
            <TouchableOpacity style={[st.pgBtn,page===0&&{opacity:0.3}]}
              onPress={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>
              <IIcon name="chevron-back" size={14} color={C.primary}/>
              <Text style={[st.pgBtnTxt,{marginLeft:4}]}>Prev</Text>
            </TouchableOpacity>
            <Text style={st.pgInfo}>{page+1} / {totalPages}  •  {filtered.length} total</Text>
            <TouchableOpacity style={[st.pgBtn,page>=totalPages-1&&{opacity:0.3}]}
              onPress={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}>
              <Text style={[st.pgBtnTxt,{marginRight:4}]}>Next</Text>
              <IIcon name="chevron-forward" size={14} color={C.primary}/>
            </TouchableOpacity>
          </View>
        ) : null}
      />

      {/* ── SNACKBAR ───────────────────────────────── */}
      <Snackbar
        visible={snack.visible} message={snack.message} severity={snack.severity}
        onDismiss={()=>setSnack(p=>({...p,visible:false}))}
      />

      {/* ✅ FAB REMOVED — filter is accessible via header icon only */}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════
const st = StyleSheet.create({

  root:{flex:1,backgroundColor:C.bg},

  // ── header ──
  pageHead:{
    backgroundColor:C.primary,
    paddingHorizontal:16,paddingBottom:14,
    paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||0)+14:52,
    flexDirection:'row',justifyContent:'space-between',alignItems:'center',
  },
  hdrLeft:{flexDirection:'row',alignItems:'center',flex:1,minWidth:0},
  hdrRight:{flexDirection:'row',alignItems:'center',gap:6,flexShrink:0},
  hdrIconBtn:{
    width:36,height:36,borderRadius:18,
    backgroundColor:'rgba(255,255,255,0.18)',
    alignItems:'center',justifyContent:'center',
  },
  hdrIconBtnActive:{backgroundColor:'#fff'},
  hdrBadge:{
    position:'absolute',top:-3,right:-3,
    backgroundColor:C.error,
    width:16,height:16,borderRadius:8,
    alignItems:'center',justifyContent:'center',
    borderWidth:1.5,borderColor:C.primary,
  },
  hdrBadgeTxt:{color:'#fff',fontSize:9,fontWeight:'800'},
  pageTitle:{color:'#fff',fontSize:18,fontWeight:'800'},
  pageSub:  {color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:1},

  // ── search ──
  searchWrap:{paddingHorizontal:12,paddingVertical:10,backgroundColor:'#fff'},
  searchBox:{
    flexDirection:'row',alignItems:'center',
    backgroundColor:'#f1f5f9',borderRadius:12,
    paddingHorizontal:14,paddingVertical:10,
    borderWidth:1,borderColor:C.border,
  },
  searchInput:{flex:1,color:C.textMain,fontSize:15,padding:0},

  // ── summary ──
  sumGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},
  sumCard:{
    backgroundColor:C.card,borderRadius:14,padding:14,
    borderWidth:1,borderColor:C.border,
    shadowColor:'#000',shadowOpacity:0.04,shadowRadius:8,elevation:2,
  },
  sumTop:   {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},
  sumIconBox:{width:38,height:38,borderRadius:10,alignItems:'center',justifyContent:'center'},
  sumValue: {fontSize:24,fontWeight:'900'},
  sumLabel: {fontSize:13,fontWeight:'700',color:C.textMain},
  sumSub:   {fontSize:11,color:C.textSec,marginTop:2},

  // ── card ──
  card:{
    backgroundColor:C.card,borderRadius:16,marginBottom:10,padding:14,
    borderWidth:1,borderColor:C.border,
    shadowColor:'#000',shadowOpacity:0.04,shadowRadius:8,elevation:2,
  },
  cardRow:    {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  cardName:   {fontSize:15,fontWeight:'700',color:C.textMain},
  cardSub:    {fontSize:12,color:C.textSec,marginTop:2},
  pillRow:    {flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:10},
  cardProgRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  progTrack:  {flex:1,height:6,borderRadius:3,overflow:'hidden'},
  progFill:   {height:'100%',borderRadius:3},
  progPct:    {fontSize:12,fontWeight:'700',minWidth:34,textAlign:'right'},
  cardDate:   {fontSize:12,color:C.textSec},
  expanded:   {marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:C.border},
  expRow:     {flexDirection:'row',alignItems:'center',marginBottom:6},
  expText:    {fontSize:13,color:C.textSec},
  cardActions:{flexDirection:'row',gap:8,marginTop:10},
  actBtn:     {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:C.primary,borderRadius:10,paddingVertical:9},
  actBtnOut:  {backgroundColor:'transparent',borderWidth:1.5,borderColor:C.primary},
  actBtnTxt:  {color:'#fff',fontWeight:'700',fontSize:13},

  // ── pill ──
  pill:    {flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:4,borderRadius:20,alignSelf:'flex-start'},
  pillText:{fontSize:11,fontWeight:'700'},

  // ── avatar ──
  avy:    {alignItems:'center',justifyContent:'center'},
  avyText:{color:'#fff',fontWeight:'800'},

  // ── misc ──
  divider:{height:1,backgroundColor:alpha(C.primary,0.08)},
  infoRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10},
  infoLabel:{fontSize:13,color:C.textSec},
  infoValue:{fontSize:13,fontWeight:'600',color:C.textMain,maxWidth:'55%',textAlign:'right'},

  // ── modal ──
  modal:        {flex:1,backgroundColor:'#fff'},
  modalHead:    {flexDirection:'row',alignItems:'center',padding:20,paddingTop:Platform.OS==='ios'?50:20},
  modalHeadName:{color:'#fff',fontSize:18,fontWeight:'800'},
  modalHeadSub: {color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:2},
  modalFoot:    {padding:16,borderTopWidth:1,borderTopColor:C.border},

  // ── tabs ──
  tabBar: {flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.border},
  tab:    {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:14},
  tabAct: {borderBottomWidth:2.5,borderBottomColor:C.primary},
  tabTxt: {fontSize:14,color:C.textSec,fontWeight:'600'},
  tabTxtAct:{color:C.primary},

  // ── detail card ──
  detCard:    {backgroundColor:alpha(C.primary,0.025),borderRadius:14,padding:16,marginBottom:12,borderWidth:1,borderColor:alpha(C.primary,0.1)},
  detTitleRow:{flexDirection:'row',alignItems:'center',marginBottom:12},
  detTitle:   {fontSize:14,fontWeight:'800',color:C.primary},
  docThumb:   {width:'100%',height:160,borderRadius:10,marginBottom:10},
  docBtn:     {flexDirection:'row',alignItems:'center',justifyContent:'center',padding:12,borderRadius:10,backgroundColor:alpha(C.primary,0.08)},
  docBtnTxt:  {color:C.primary,fontWeight:'700',fontSize:14},

  // ── update modal ──
  updHead:   {flexDirection:'row',alignItems:'center',padding:16,paddingTop:Platform.OS==='ios'?50:16,borderBottomWidth:1,borderBottomColor:C.border},
  updIconBox:{width:48,height:48,borderRadius:12,alignItems:'center',justifyContent:'center'},
  updTitle:  {fontSize:16,fontWeight:'800',color:C.textMain},
  updSub:    {fontSize:13,color:C.textSec,marginTop:2},

  // ── status chips ──
  statusChip:   {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderRadius:10,borderWidth:1.5,borderColor:C.border,backgroundColor:'#fff',marginRight:8,marginBottom:4},
  statusChipTxt:{fontSize:13,fontWeight:'600',color:C.textMain},

  // ── filter sheet ──
  sheet:      {flex:1,backgroundColor:'#fff'},
  sheetHandle:{width:40,height:4,backgroundColor:'#e2e8f0',borderRadius:2,alignSelf:'center',marginTop:12},
  sheetHead:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.border},
  sheetTitle: {fontSize:18,fontWeight:'800',color:C.primary},
  sheetSub:   {fontSize:12,color:C.textSec,marginTop:2},
  closeCircle:{width:32,height:32,borderRadius:16,backgroundColor:alpha(C.primary,0.1),alignItems:'center',justifyContent:'center'},
  sheetFoot:  {flexDirection:'row',gap:10,padding:16,borderTopWidth:1,borderTopColor:C.border,backgroundColor:'#fff'},
  fLabel:     {fontSize:12,fontWeight:'700',color:C.textSec,marginBottom:8,textTransform:'uppercase',letterSpacing:0.5},
  chipRow:    {flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},
  fChip:      {paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:C.border,backgroundColor:'#fff',marginRight:8,marginBottom:4},
  fChipTxt:   {fontSize:13,color:C.textSec,fontWeight:'600'},
  sortBtn:    {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:14,borderRadius:12,borderWidth:1.5,borderColor:C.border,backgroundColor:'#fff',marginBottom:8},
  sortTxt:    {fontSize:14,fontWeight:'600',color:C.textMain},

  // ── buttons ──
  btn:   {paddingVertical:14,borderRadius:12,alignItems:'center',justifyContent:'center',paddingHorizontal:20},
  btnOut:{borderWidth:1.5,borderColor:C.primary,backgroundColor:'transparent'},
  btnTxt:{fontSize:15,fontWeight:'700'},

  // ── form ──
  fieldErr:{fontSize:12,color:C.error,marginTop:2,marginBottom:4},
  textArea :{borderWidth:1.5,borderColor:C.border,borderRadius:12,padding:12,color:C.textMain,fontSize:14,minHeight:100,textAlignVertical:'top'},
  errBox:  {flexDirection:'row',alignItems:'center',backgroundColor:alpha(C.error,0.1),borderRadius:10,padding:12,marginBottom:12},
  errTxt:  {color:C.error,fontSize:13,flex:1},
  infoTip: {backgroundColor:alpha(C.primary,0.06),borderRadius:10,padding:12,marginBottom:12},
  infoTipTxt:{color:C.primary,fontSize:13,lineHeight:20},

  // ── file picker ──
  filePicker: {borderWidth:2,borderStyle:'dashed',borderColor:C.border,borderRadius:14,padding:24,alignItems:'center',justifyContent:'center',backgroundColor:'#fafbff',marginBottom:8},
  pickerLabel:{fontSize:14,color:C.textSec,marginTop:10,fontWeight:'600'},
  pickerSub:  {fontSize:12,color:C.textSec,marginTop:4},
  filePicked: {borderWidth:1.5,borderColor:alpha(C.primary,0.3),borderRadius:14,padding:14,backgroundColor:alpha(C.primary,0.04),marginBottom:8},
  prevDoc:    {flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:12,borderWidth:1,borderColor:C.border,borderRadius:10,marginBottom:8},

  // ── image viewer ──
  imgModal:{flex:1,backgroundColor:'#000'},
  imgHead: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16,paddingTop:Platform.OS==='ios'?50:16,backgroundColor:'rgba(0,0,0,0.8)'},
  imgTitle:{color:'#fff',fontSize:15,fontWeight:'700',flex:1},
  imgActBtn:{padding:8},
  imgBody: {flex:1,alignItems:'center',justifyContent:'center'},

  // ── empty / gate ──
  empty:    {alignItems:'center',padding:40},
  emptyTitle:{fontSize:18,fontWeight:'700',color:C.textMain,marginTop:16},
  emptySub: {fontSize:14,color:C.textSec,textAlign:'center',marginTop:8,lineHeight:22},
  gate:     {flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:C.bg},
  gateTitle:{fontSize:22,fontWeight:'800',color:C.textMain,marginTop:16},
  gateSub:  {fontSize:15,color:C.textSec,textAlign:'center',marginTop:8},

  // ── pagination ──
  pager:   {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:16,paddingHorizontal:12,backgroundColor:C.card,borderRadius:14,borderWidth:1,borderColor:C.border,marginTop:8},
  pgBtn:   {flexDirection:'row',alignItems:'center',backgroundColor:alpha(C.primary,0.1),paddingHorizontal:12,paddingVertical:8,borderRadius:10},
  pgBtnTxt:{color:C.primary,fontWeight:'700',fontSize:13},
  pgInfo:  {fontSize:12,color:C.textSec,fontWeight:'600'},

  // ── active chips ──
  actChip:   {flexDirection:'row',alignItems:'center',backgroundColor:alpha(C.primary,0.1),paddingHorizontal:12,paddingVertical:6,borderRadius:20,marginRight:8},
  actChipTxt:{color:C.primary,fontWeight:'700',fontSize:12},

  // ── snackbar ──
  snackbar:{
    position:'absolute',bottom:24,left:16,right:16,
    flexDirection:'row',alignItems:'center',
    paddingHorizontal:16,paddingVertical:12,borderRadius:12,
    shadowColor:'#000',shadowOpacity:0.25,shadowRadius:10,elevation:8,zIndex:9999,
  },
  snackText:{color:'#fff',fontWeight:'600',flex:1,fontSize:14},

  // ── FAB styles removed ──
});