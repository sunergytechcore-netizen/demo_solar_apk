
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Platform, PermissionsAndroid, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

// ─── Constants ────────────────────────────────────────────────────────────────
const API     = 'https://solar-backend-4bsb.onrender.com';
const PRIMARY = '#4569ea';
const SUCCESS = '#22c55e';
const DANGER  = '#ef4444';
const WARNING = '#f59e0b';

const STATUS_CFG: Record<string, {bg: string; text: string; icon: string; label: string}> = {
  present: {bg: '#dcfce7', text: '#16a34a', icon: 'check-circle',       label: 'Present'},
  absent:  {bg: '#fee2e2', text: '#dc2626', icon: 'close-circle',        label: 'Absent'},
  late:    {bg: '#fef9c3', text: '#d97706', icon: 'clock-alert-outline', label: 'Late'},
  leave:   {bg: '#f3e8ff', text: '#9333ea', icon: 'account-outline',     label: 'Leave'},
  holiday: {bg: '#dbeafe', text: '#2563eb', icon: 'beach',               label: 'Holiday'},
};

const PERIOD_OPTIONS = ['Today', 'This Week', 'This Month', 'All'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  _id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  punchIn?:  {time: string; address?: any; location?: {lat: number; lng: number}};
  punchOut?: {time: string; address?: any; location?: {lat: number; lng: number}};
  workHoursFormatted?: string;
  workHours?: number;
  _isAbsentRow?: boolean;
}

interface GeoState {
  latitude: number | null; longitude: number | null;
  accuracy: number | null; address: string | null;
  loading: boolean; error: string | null;
}

interface AttendanceScreenProps {
  onBackPress?:    () => void; onMenuPress?:    () => void;
  onSearchPress?:  () => void; onProfilePress?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (ts?: string) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true});
};
const resolveAddr = (addr: any): string => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return addr.short || addr.full?.split(',')[0] || '';
};
const getPeriodDates = (period: string) => {
  const now = new Date();
  if (period === 'Today') {
    const s = new Date(now); s.setHours(0,0,0,0);
    return {startDate: s.toISOString().split('T')[0], endDate: new Date(now).toISOString().split('T')[0]};
  }
  if (period === 'This Week') {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0,0,0,0);
    return {startDate: s.toISOString().split('T')[0], endDate: new Date(now).toISOString().split('T')[0]};
  }
  if (period === 'This Month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return {startDate: s.toISOString().split('T')[0], endDate: new Date(now).toISOString().split('T')[0]};
  }
  return {};
};

// ─── Live Timer ───────────────────────────────────────────────────────────────
const useLiveTimer = (running: boolean, startTs?: string) => {
  const [secs, setSecs] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) {
      const base = startTs ? Math.floor((Date.now() - new Date(startTs).getTime()) / 1000) : 0;
      setSecs(Math.max(0, base));
      ref.current = setInterval(() => setSecs(s => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
      setSecs(0);
    }
    return () => {if (ref.current) clearInterval(ref.current);};
  }, [running, startTs]);
  const h = Math.floor(secs / 3600).toString().padStart(2,'0');
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2,'0');
  const s = (secs % 60).toString().padStart(2,'0');
  return `${h}:${m}:${s}`;
};

// ─── Geo Hook ─────────────────────────────────────────────────────────────────
const useGeo = () => {
  const [state, setState] = useState<GeoState>({latitude:null,longitude:null,accuracy:null,address:null,loading:false,error:null});
  const fetchLocation = useCallback(async () => {
    setState(s => ({...s, loading:true, error:null}));
    if (Platform.OS === 'android') {
      try {
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {title:'Location',message:'Required to verify attendance.',buttonPositive:'Allow',buttonNegative:'Deny'});
        if (res !== PermissionsAndroid.RESULTS.GRANTED) {setState(s => ({...s,loading:false,error:'Location permission denied'})); return;}
      } catch {setState(s => ({...s,loading:false,error:'Permission error'})); return;}
    }
    if (!navigator.geolocation) {setState(s => ({...s,loading:false,error:'Geolocation not available'})); return;}
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const d = await r.json();
          if (d?.display_name) address = d.display_name;
        } catch {}
        setState({latitude:lat,longitude:lng,accuracy:pos.coords.accuracy,address,loading:false,error:null});
      },
      err => setState(s => ({...s,loading:false,error:err.message||'Could not get location'})),
      {enableHighAccuracy:true,timeout:15000,maximumAge:0},
    );
  }, []);
  const reset = useCallback(() => setState({latitude:null,longitude:null,accuracy:null,address:null,loading:false,error:null}), []);
  return {...state, fetchLocation, reset};
};

// ─── Mock Fallback ────────────────────────────────────────────────────────────
const MOCK: AttendanceRecord[] = [
  {_id:'1',date:new Date().toISOString(),status:'present',punchIn:{time:new Date(Date.now()-3600000).toISOString(),address:'8J2P+75W, Paradeep, Odisha 754120'},workHoursFormatted:'01:00'},
  {_id:'2',date:new Date(Date.now()-86400000).toISOString(),status:'present',punchIn:{time:'2026-03-22T09:11:00Z',address:'73, Dani Ghosh Sarani, Kolkata'},punchOut:{time:'2026-03-22T17:30:00Z',address:'73, Dani Ghosh Sarani'},workHoursFormatted:'08:19'},
  {_id:'3',date:new Date(Date.now()-172800000).toISOString(),status:'late',punchIn:{time:'2026-03-21T10:30:00Z',address:'69C, Jharapada, Bhubaneswar'},punchOut:{time:'2026-03-21T18:00:00Z',address:''},workHoursFormatted:'07:30'},
  {_id:'4',date:new Date(Date.now()-259200000).toISOString(),status:'present',punchIn:{time:'2026-03-20T09:05:00Z',address:'376, Cuttack Rd, Bhubaneswar'},punchOut:{time:'2026-03-20T18:00:00Z',address:''},workHoursFormatted:'08:55'},
  {_id:'5',date:new Date(Date.now()-345600000).toISOString(),status:'absent'},
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
const AttendanceScreen: React.FC<AttendanceScreenProps> = ({onMenuPress, onSearchPress, onProfilePress}) => {
  const token = ''; // TODO: get from AsyncStorage / AuthContext

  // Data
  const [attendances,  setAttendances]  = useState<AttendanceRecord[]>([]);
  const [calendarAtts, setCalendarAtts] = useState<AttendanceRecord[]>([]);
  const [summary,      setSummary]      = useState<any>({});
  const [loading,      setLoading]      = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [todayAtt,     setTodayAtt]     = useState<AttendanceRecord | null>(null);

  // Punch
  const [punchLoading,       setPunchLoading]       = useState(false);
  const [punchStage,         setPunchStage]         = useState<null|'permission'|'confirm'>(null);
  const [punchMode,          setPunchMode]          = useState<'in'|'out'>('in');
  const [locationRequesting, setLocationRequesting] = useState(false);

  // Geo
  const geo = useGeo();

  // Timer
  const isRunning = !!todayAtt?.punchIn && !todayAtt?.punchOut;
  const timer     = useLiveTimer(isRunning, todayAtt?.punchIn?.time);

  // Filters
  const [period,       setPeriod]       = useState('This Month');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterModal,  setFilterModal]  = useState(false);

  // Calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Snack
  const [snack, setSnack] = useState<{msg:string;type:'success'|'error'|'info'}|null>(null);
  const showSnack = useCallback((msg:string, type:'success'|'error'|'info'='success') => {
    setSnack({msg,type});
    setTimeout(() => setSnack(null), 3000);
  },[]);

  // API
  const fetchAttendances = useCallback(async (isRefresh=false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const dates  = getPeriodDates(period);
      const params = new URLSearchParams({limit:'50',...(statusFilter&&{status:statusFilter}),...(dates.startDate&&{startDate:dates.startDate}),...(dates.endDate&&{endDate:dates.endDate})});
      const res    = await fetch(`${API}/api/v1/attendance?${params}`, {headers:{Authorization:`Bearer ${token}`}});
      const data   = await res.json();
      const list   = data?.result?.attendances || data?.attendances || [];
      setAttendances(list);
      setSummary(data?.result?.summary || data?.summary || {});
      const ts = new Date().toDateString();
      setTodayAtt(list.find((a:any) => new Date(a.date).toDateString() === ts) || null);
    } catch {
      setAttendances(MOCK);
      setTodayAtt(MOCK[0]);
    } finally {setLoading(false); setRefreshing(false);}
  },[period,statusFilter,token]);

  const fetchCalendarMonth = useCallback(async (d:Date) => {
    const y=d.getFullYear(), m=d.getMonth();
    const startDate=new Date(y,m,1).toISOString().split('T')[0];
    const endDate  =new Date(y,m+1,0).toISOString().split('T')[0];
    try {
      const res  = await fetch(`${API}/api/v1/attendance?startDate=${startDate}&endDate=${endDate}&limit=200`,{headers:{Authorization:`Bearer ${token}`}});
      const data = await res.json();
      setCalendarAtts(data?.result?.attendances || data?.attendances || []);
    } catch {setCalendarAtts(MOCK);}
  },[token]);

  const doPunch = useCallback(async (mode:'in'|'out') => {
    if (!geo.latitude) {showSnack('Could not get location. Retry.','error'); return;}
    setPunchLoading(true);
    try {
      const ep  = mode==='in' ? 'punch-in' : 'punch-out';
      const res = await fetch(`${API}/api/v1/attendance/${ep}`, {
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({latitude:geo.latitude,longitude:geo.longitude,accuracy:geo.accuracy,address:geo.address}),
      });
      const data = await res.json();
      if (data?.success||res.ok) {
        showSnack(`Punch ${mode==='in'?'In':'Out'} successful!`);
        setPunchStage(null); geo.reset();
        await fetchAttendances(); await fetchCalendarMonth(currentMonth);
      } else showSnack(data?.message||`Punch ${mode} failed`,'error');
    } catch {showSnack('Network error. Try again.','error');}
    finally {setPunchLoading(false);}
  },[geo,token,fetchAttendances,fetchCalendarMonth,currentMonth,showSnack]);

  useEffect(() => {fetchAttendances();}, [period,statusFilter]);
  useEffect(() => {fetchCalendarMonth(currentMonth);}, [currentMonth]);

  const hasPunchedIn  = !!todayAtt?.punchIn;
  const hasPunchedOut = !!todayAtt?.punchOut;

  const openPunch = (mode:'in'|'out') => {
    if (mode==='in'  && hasPunchedIn)  {showSnack(hasPunchedOut?'Day complete!':'Already punched in.','info'); return;}
    if (mode==='out' && hasPunchedOut) {showSnack('Already punched out.','info'); return;}
    setPunchMode(mode); setPunchStage('permission');
  };

  const handleAllowLocation = async () => {
    setLocationRequesting(true);
    await geo.fetchLocation();
    setLocationRequesting(false);
    setPunchStage('confirm');
  };

  // Calendar days
  const calendarDays = useMemo(() => {
    const y=currentMonth.getFullYear(), m=currentMonth.getMonth();
    const firstDay=new Date(y,m,1).getDay(), daysInMonth=new Date(y,m+1,0).getDate();
    const todayMs = (() => {const d=new Date(); d.setHours(0,0,0,0); return d.getTime();})();
    const days:any[]=[];
    for (let i=firstDay-1;i>=0;i--) {const d=new Date(y,m,-i); days.push({day:d.getDate(),isPrev:true});}
    for (let i=1;i<=daysInMonth;i++) {
      const date=new Date(y,m,i); date.setHours(0,0,0,0);
      const isWeekend=[0,6].includes(date.getDay()), isFuture=date.getTime()>todayMs;
      const att=calendarAtts.find(a=>new Date(a.date).toDateString()===date.toDateString());
      let status:string|undefined;
      if (!isWeekend&&!isFuture) {
        if (att)                         status=att.status;
        else if (date.getTime()<todayMs) status='absent';
      }
      days.push({day:i,date,status,att,isWeekend,isFuture});
    }
    return days;
  },[currentMonth,calendarAtts]);

  const filteredLog = useMemo(() => {
    if (!searchQuery) return attendances;
    const q=searchQuery.toLowerCase();
    return attendances.filter(a=>new Date(a.date).toDateString().toLowerCase().includes(q)||(a.status||'').includes(q));
  },[attendances,searchQuery]);

  const stats = useMemo(() => {
    const total   = filteredLog.length;
    const present = filteredLog.filter(a=>a.status==='present').length;
    const late    = filteredLog.filter(a=>a.status==='late').length;
    const absent  = filteredLog.filter(a=>a.status==='absent').length;
    const wh      = (summary?.totalWorkHours||0).toFixed(1);
    return [
      {icon:'calendar-month-outline',iconBg:'#dbeafe',iconColor:PRIMARY,  val:String(total),  lbl:'Total Days', sub:'All records',   bar:PRIMARY},
      {icon:'clock-outline',         iconBg:'#dcfce7',iconColor:'#16a34a',val:`${wh}h`,       lbl:'Work Hours', sub:'Total logged',  bar:SUCCESS},
      {icon:'check-circle-outline',  iconBg:'#dcfce7',iconColor:'#16a34a',val:String(present),lbl:'Present',    sub:'Days attended', bar:SUCCESS},
      {icon:'clock-alert-outline',   iconBg:'#fef9c3',iconColor:'#d97706',val:String(late),   lbl:'Late',       sub:'Late arrivals', bar:WARNING},
      {icon:'alert-circle-outline',  iconBg:'#fee2e2',iconColor:'#dc2626',val:String(absent), lbl:'Absent',     sub:'Days missed',   bar:DANGER},
    ];
  },[filteredLog,summary]);

  return (
    <View style={s.screen}>
      {/* Top Bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onMenuPress} style={s.menuBtn}>
          <MaterialCommunityIcons name="menu" size={28} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Attendance</Text>
        <View style={s.topRight}>
          <TouchableOpacity style={s.iconBtn} onPress={onSearchPress}>
            <Ionicons name="search-outline" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={s.avatar} onPress={onProfilePress} activeOpacity={0.8}>
            <Text style={s.avatarText}>RS</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.blueLine} />

      {/* Snack */}
      {snack && (
        <View style={[s.snackBar,snack.type==='error'?s.snackError:snack.type==='info'?s.snackInfo:s.snackSuccess]}>
          <Text style={s.snackText}>{snack.msg}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:100}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>fetchAttendances(true)} colors={[PRIMARY]} tintColor={PRIMARY} />}>

        {/* ── Hero ── */}
        <View style={s.heroCard}>
          <Text style={s.heroTitle}>Attendance Dashboard</Text>
          <View style={s.heroStatusRow}>
            <View style={[s.onlineDot,isRunning&&s.onlineDotActive]} />
            <Text style={s.heroStatusTxt}>
              {hasPunchedIn&&!hasPunchedOut?'Currently clocked in':hasPunchedOut?'Clocked out for today':'Not clocked in today'}
            </Text>
          </View>

          <View style={s.heroBtns}>
            {!hasPunchedIn&&(
              <TouchableOpacity style={[s.heroBtn,s.heroBtnGreen]} onPress={()=>openPunch('in')} activeOpacity={0.85}>
                <MaterialCommunityIcons name="login" size={15} color="#fff" />
                <Text style={s.heroBtnTxt}>Punch In</Text>
              </TouchableOpacity>
            )}
            {hasPunchedIn&&!hasPunchedOut&&(
              <TouchableOpacity style={[s.heroBtn,s.heroBtnRed]} onPress={()=>openPunch('out')} activeOpacity={0.85}>
                <MaterialCommunityIcons name="logout" size={15} color="#fff" />
                <Text style={s.heroBtnTxt}>Punch Out</Text>
              </TouchableOpacity>
            )}
            {hasPunchedIn&&hasPunchedOut&&(
              <View style={[s.heroBtn,{backgroundColor:'rgba(255,255,255,0.1)'}]}>
                <MaterialCommunityIcons name="check-circle" size={15} color="rgba(255,255,255,0.6)" />
                <Text style={[s.heroBtnTxt,{opacity:0.6}]}>Day Complete</Text>
              </View>
            )}
            <TouchableOpacity style={s.heroBtn} onPress={()=>fetchAttendances(true)} activeOpacity={0.85}>
              <MaterialCommunityIcons name="refresh" size={15} color="#fff" />
              <Text style={s.heroBtnTxt}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.heroBtn} onPress={()=>setFilterModal(true)} activeOpacity={0.85}>
              <MaterialCommunityIcons name="filter-variant" size={15} color="#fff" />
              <Text style={s.heroBtnTxt}>Filter</Text>
            </TouchableOpacity>
          </View>

          <View style={s.sessionBox}>
            <View style={s.sessionIconWrap}>
              <MaterialCommunityIcons name="timer-outline" size={28} color="#69f0ae" />
            </View>
            <View style={{flex:1}}>
              <Text style={s.sessionLbl}>Current Session Duration</Text>
              <Text style={s.sessionTimer}>{timer}</Text>
            </View>
            {isRunning&&(
              <View style={s.liveBadge}>
                <MaterialCommunityIcons name="play" size={10} color="#69f0ae" />
                <Text style={s.liveTxt}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={s.heroBotRow}>
            {[
              {lbl:'Punch In',    val:todayAtt?.punchIn?fmtTime(todayAtt.punchIn.time):'--:--'},
              null,
              {lbl:'Work Hours',  val:todayAtt?.workHoursFormatted||'00:00'},
              null,
              {lbl:'Status',      val:hasPunchedIn?'Present':'Absent', green:hasPunchedIn},
            ].map((item,i) =>
              item===null
                ? <View key={i} style={s.heroBotDiv} />
                : <View key={i} style={s.heroBotItem}>
                    <Text style={s.heroBotLbl}>{item.lbl}</Text>
                    <Text style={[s.heroBotVal,item.green&&s.heroBotGreen]}>{item.val}</Text>
                  </View>
            )}
          </View>
        </View>

        {/* ── Stats ── */}
        {loading
          ? <View style={s.loadingWrap}><ActivityIndicator size="large" color={PRIMARY} /></View>
          : (
            <View style={s.statGrid}>
              {stats.map((st,i) => (
                <View key={i} style={s.statCard}>
                  <View style={s.statCardTop}>
                    <View style={[s.statIconBox,{backgroundColor:st.iconBg}]}>
                      <MaterialCommunityIcons name={st.icon} size={22} color={st.iconColor} />
                    </View>
                    <Text style={[s.statVal,{color:st.iconColor}]}>{st.val}</Text>
                  </View>
                  <Text style={s.statLbl}>{st.lbl}</Text>
                  <Text style={s.statSub}>{st.sub}</Text>
                  <View style={[s.statBar,{backgroundColor:st.bar}]} />
                </View>
              ))}
            </View>
          )
        }

        {/* ── Period Chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodScroll} contentContainerStyle={s.periodContent}>
          {PERIOD_OPTIONS.map(p=>(
            <TouchableOpacity key={p} style={[s.periodChip,period===p&&s.periodChipActive]} onPress={()=>setPeriod(p)}>
              <Text style={[s.periodChipTxt,period===p&&s.periodChipTxtActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Search ── */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#aaa" style={{marginRight:8}} />
          <TextInput style={s.searchInput} placeholder="Search records..." placeholderTextColor="#bbb" value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length>0&&<TouchableOpacity onPress={()=>setSearchQuery('')}><MaterialCommunityIcons name="close-circle" size={16} color="#bbb" /></TouchableOpacity>}
        </View>

        {/* ── Calendar ── */}
        <View style={s.calCard}>
          <View style={s.calHeader}>
            <Text style={s.calMonth}>{currentMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</Text>
            <View style={s.calNav}>
              <TouchableOpacity style={s.calNavBtn} onPress={()=>setCurrentMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity style={s.calNavBtn} onPress={()=>setCurrentMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>
                <MaterialCommunityIcons name="chevron-right" size={20} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.calDayRow}>
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=>(
              <Text key={d} style={s.calDayHdr}>{d}</Text>
            ))}
          </View>

          <View style={s.calGrid}>
            {calendarDays.map((c,i) => {
              const isToday=c.date&&c.date.toDateString()===new Date().toDateString();
              return (
                <View key={i} style={s.calCell}>
                  <View style={[
                    s.calCircle,
                    c.isPrev&&s.calCirclePrev,
                    c.status==='present'&&s.calCirclePresent,
                    c.status==='late'   &&s.calCircleLate,
                    c.status==='absent' &&s.calCircleAbsent,
                    c.status==='holiday'&&s.calCircleHoliday,
                    isToday&&s.calCircleToday,
                  ]}>
                    <Text style={[
                      s.calNum,
                      c.isPrev&&s.calNumPrev,
                      c.status==='present'&&s.calNumPresent,
                      c.status==='late'   &&s.calNumLate,
                      c.status==='absent' &&s.calNumAbsent,
                      isToday&&s.calNumToday,
                    ]}>{c.day}</Text>
                    {c.status&&!c.isPrev&&(
                      <View style={[s.calDot,{backgroundColor:
                        isToday?'#fff':
                        c.status==='present'?SUCCESS:
                        c.status==='late'   ?WARNING:
                        c.status==='absent' ?DANGER:'#3b82f6'}]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={s.calLegend}>
            {[{lbl:'Present',clr:SUCCESS},{lbl:'Late',clr:WARNING},{lbl:'Absent',clr:DANGER},{lbl:'Holiday',clr:'#3b82f6'}].map(l=>(
              <View key={l.lbl} style={s.legendItem}>
                <View style={[s.legendDot,{backgroundColor:l.clr}]} />
                <Text style={s.legendTxt}>{l.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Attendance Log ── */}
        <View style={s.logSection}>
          <View style={s.logHeader}>
            <View>
              <Text style={s.logTitle}>Attendance Log</Text>
              <Text style={s.logSub}>{filteredLog.length} total records</Text>
            </View>
            <TouchableOpacity style={s.exportBtn}>
              <MaterialCommunityIcons name="download" size={15} color="#fff" />
              <Text style={s.exportTxt}>Export</Text>
              <MaterialCommunityIcons name="chevron-down" size={15} color="#fff" />
            </TouchableOpacity>
          </View>

          {filteredLog.length===0&&!loading&&(
            <View style={s.emptyWrap}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#c5cfe8" />
              <Text style={s.emptyTitle}>No records found</Text>
              <Text style={s.emptySub}>Try changing the period or filter.</Text>
            </View>
          )}

          {filteredLog.map(log => {
            const cfg=STATUS_CFG[log.status]||STATUS_CFG.present;
            const isExp=expandedId===log._id;
            const d=new Date(log.date);
            return (
              <View key={log._id} style={[s.logCard,log._isAbsentRow&&s.logCardAbsent]}>
                <View style={s.logTop}>
                  <View style={[s.logDateCircle,{backgroundColor:cfg.bg}]}>
                    <Text style={[s.logMonth,{color:cfg.text}]}>{d.toLocaleString('default',{month:'short'}).toUpperCase()}</Text>
                    <Text style={[s.logDate,{color:cfg.text}]}>{d.getDate()}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <View style={s.logDayRow}>
                      <Text style={s.logDay}>{d.toLocaleDateString('en-US',{weekday:'long'})}</Text>
                      <TouchableOpacity style={s.expandBtn} onPress={()=>setExpandedId(isExp?null:log._id)}>
                        <MaterialCommunityIcons name={isExp?'chevron-up':'chevron-down'} size={18} color="#aaa" />
                      </TouchableOpacity>
                    </View>
                    <View style={[s.statusBadge,{backgroundColor:cfg.bg}]}>
                      <MaterialCommunityIcons name={cfg.icon} size={13} color={cfg.text} />
                      <Text style={[s.statusTxt,{color:cfg.text}]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>

                <View style={s.punchRow}>
                  <View style={s.punchItem}><Text style={s.punchLbl}>Punch In</Text><Text style={s.punchGreen}>{fmtTime(log.punchIn?.time)}</Text></View>
                  <View style={s.punchItem}><Text style={s.punchLbl}>Punch Out</Text><Text style={s.punchBlue}>{log.punchOut?fmtTime(log.punchOut.time):log.punchIn?'Ongoing':'—'}</Text></View>
                  <View style={s.punchItem}><Text style={s.punchLbl}>Hours</Text><Text style={s.punchBlue}>{log.workHoursFormatted||'—'}</Text></View>
                </View>

                {resolveAddr(log.punchIn?.address)!==''&&(
                  <View style={s.locRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#888" />
                    <Text style={s.locTxt} numberOfLines={isExp?0:1}><Text style={s.locLbl}>In: </Text>{resolveAddr(log.punchIn?.address)}</Text>
                  </View>
                )}
                {isExp&&resolveAddr(log.punchOut?.address)!==''&&(
                  <View style={[s.locRow,{marginTop:4}]}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#888" />
                    <Text style={s.locTxt}><Text style={s.locLbl}>Out: </Text>{resolveAddr(log.punchOut?.address)}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Location Permission Modal ── */}
      <Modal visible={punchStage==='permission'} transparent animationType="fade" statusBarTranslucent onRequestClose={()=>setPunchStage(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalStrip,{backgroundColor:punchMode==='in'?SUCCESS:DANGER}]} />
            <View style={[s.modalIconWrap,{backgroundColor:punchMode==='in'?'#dcfce7':'#fee2e2'}]}>
              {locationRequesting
                ?<ActivityIndicator size="large" color={punchMode==='in'?SUCCESS:DANGER} />
                :<MaterialCommunityIcons name="crosshairs-gps" size={36} color={punchMode==='in'?SUCCESS:DANGER} />}
            </View>
            <Text style={s.modalTitle}>{locationRequesting?'Getting your location…':'Allow Location Access'}</Text>
            <Text style={s.modalSubtitle}>
              {locationRequesting?'Please wait while we detect your current location.':`To ${punchMode==='in'?'punch in':'punch out'}, we need your current location to verify attendance.`}
            </Text>
            {!locationRequesting&&(
              <>
                <View style={s.modalInfoRow}>
                  <MaterialCommunityIcons name="map-marker" size={16} color={PRIMARY} />
                  <Text style={s.modalInfoTxt}>GPS location required for attendance verification</Text>
                </View>
                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.modalCancelBtn} onPress={()=>{setPunchStage(null);geo.reset();}} activeOpacity={0.8}>
                    <Text style={s.modalCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.modalAllowBtn,{backgroundColor:punchMode==='in'?SUCCESS:DANGER}]} onPress={handleAllowLocation} activeOpacity={0.85}>
                    <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#fff" />
                    <Text style={s.modalAllowTxt}>Allow Location</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Punch Confirm Modal ── */}
      <Modal visible={punchStage==='confirm'} transparent animationType="slide" statusBarTranslucent onRequestClose={()=>{if(!punchLoading){setPunchStage(null);geo.reset();}}}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard,{paddingTop:0}]}>
            <View style={[s.modalStrip,{backgroundColor:punchMode==='in'?SUCCESS:DANGER}]} />

            <View style={s.punchHeader}>
              <View style={[s.punchIconCircle,{backgroundColor:punchMode==='in'?'#dcfce7':'#fee2e2'}]}>
                <MaterialCommunityIcons name={punchMode==='in'?'login':'logout'} size={24} color={punchMode==='in'?SUCCESS:DANGER} />
              </View>
              <View style={{flex:1,marginLeft:12}}>
                <Text style={s.punchTitle}>{punchMode==='in'?'Punch In':'Punch Out'}</Text>
                <Text style={s.punchDate}>{new Date().toLocaleDateString('en-US',{weekday:'long',day:'2-digit',month:'short',year:'numeric'})}</Text>
              </View>
              <TouchableOpacity onPress={()=>{if(!punchLoading){setPunchStage(null);geo.reset();}}} disabled={punchLoading} style={s.punchClose}>
                <MaterialCommunityIcons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>

            <View style={[s.punchTimeBox,{borderColor:punchMode==='in'?SUCCESS:DANGER}]}>
              <Text style={[s.punchTimeDisplay,{color:punchMode==='in'?SUCCESS:DANGER}]}>
                {new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}
              </Text>
              <Text style={s.punchTimeLbl}>Current Time</Text>
            </View>

            {punchMode==='out'&&isRunning&&(
              <View style={s.sessionMini}>
                <MaterialCommunityIcons name="timer-outline" size={20} color={SUCCESS} />
                <View style={{flex:1,marginLeft:10}}>
                  <Text style={s.sessionMiniLbl}>Current Session</Text>
                  <Text style={s.sessionMiniTimer}>{timer}</Text>
                </View>
                <View style={s.liveBadgeSm}><Text style={s.liveTxtSm}>LIVE</Text></View>
              </View>
            )}

            <View style={[s.geoBox,{borderColor:geo.loading?PRIMARY:geo.error?DANGER:geo.latitude?SUCCESS:'#ccc'}]}>
              <View style={[s.geoIconCircle,{backgroundColor:geo.loading?'#eef1fb':geo.error?'#fee2e2':geo.latitude?'#dcfce7':'#f5f5f5'}]}>
                {geo.loading?<ActivityIndicator size="small" color={PRIMARY} />
                  :<MaterialCommunityIcons name={geo.error?'map-marker-off':geo.latitude?'map-marker-check':'map-marker-outline'} size={20} color={geo.error?DANGER:geo.latitude?SUCCESS:'#aaa'} />}
              </View>
              <View style={{flex:1,marginLeft:10}}>
                <Text style={s.geoTitle}>{geo.loading?'Detecting location…':geo.error?'Location unavailable':geo.latitude?'Location acquired':'No location'}</Text>
                {geo.address&&<Text style={s.geoAddr} numberOfLines={2}>{geo.address}</Text>}
                {geo.error  &&<Text style={s.geoErr}>{geo.error}</Text>}
              </View>
              {(geo.error||!geo.latitude)&&!geo.loading&&(
                <TouchableOpacity onPress={geo.fetchLocation} style={s.retryBtnSm}>
                  <MaterialCommunityIcons name="refresh" size={18} color={PRIMARY} />
                </TouchableOpacity>
              )}
            </View>

            {geo.error&&(
              <View style={s.geoAlert}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={DANGER} />
                <Text style={s.geoAlertTxt}>Location is required to punch {punchMode}. Please allow access and retry.</Text>
              </View>
            )}

            <View style={s.punchActions}>
              <TouchableOpacity style={s.punchCancelBtn} onPress={()=>{if(!punchLoading){setPunchStage(null);geo.reset();}}} disabled={punchLoading}>
                <Text style={s.punchCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.punchConfirmBtn,{backgroundColor:punchMode==='in'?SUCCESS:DANGER},(punchLoading||geo.loading||!geo.latitude)&&s.punchConfirmDisabled]}
                onPress={()=>doPunch(punchMode)}
                disabled={punchLoading||geo.loading||!geo.latitude}
                activeOpacity={0.85}>
                {punchLoading?<ActivityIndicator size="small" color="#fff" />:<MaterialCommunityIcons name={punchMode==='in'?'login':'logout'} size={18} color="#fff" />}
                <Text style={s.punchConfirmTxt}>{punchLoading?'Processing…':punchMode==='in'?'Confirm Punch In':'Confirm Punch Out'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Filter Modal ── */}
      <Modal visible={filterModal} transparent animationType="slide" statusBarTranslucent onRequestClose={()=>setFilterModal(false)}>
        <TouchableOpacity style={s.filterOverlay} activeOpacity={1} onPress={()=>setFilterModal(false)}>
          <View style={s.filterSheet}>
            <View style={s.filterHandle} />
            <Text style={s.filterTitle}>Filter Attendance</Text>
            <Text style={s.filterLabel}>Period</Text>
            <View style={s.filterOpts}>
              {PERIOD_OPTIONS.map(p=>(
                <TouchableOpacity key={p} style={[s.filterOpt,period===p&&s.filterOptActive]} onPress={()=>setPeriod(p)}>
                  <Text style={[s.filterOptTxt,period===p&&s.filterOptTxtActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.filterLabel}>Status</Text>
            <View style={s.filterOpts}>
              {['','present','late','absent','holiday'].map(st=>(
                <TouchableOpacity key={st} style={[s.filterOpt,statusFilter===st&&s.filterOptActive]} onPress={()=>setStatusFilter(st)}>
                  <Text style={[s.filterOptTxt,statusFilter===st&&s.filterOptTxtActive]}>{st===''?'All':STATUS_CFG[st]?.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.filterActions}>
              <TouchableOpacity style={s.filterClearBtn} onPress={()=>{setStatusFilter('');setPeriod('This Month');setFilterModal(false);}}>
                <Text style={s.filterClearTxt}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filterApplyBtn} onPress={()=>setFilterModal(false)}>
                <Text style={s.filterApplyTxt}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

export default AttendanceScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f4f6fb'},
  topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingTop:10,paddingBottom:6,backgroundColor:'#f4f6fb'},
  menuBtn:{padding:4}, topTitle:{fontSize:18,fontWeight:'700',color:'#1a1a3e',flex:1,marginLeft:10},
  topRight:{flexDirection:'row',alignItems:'center',gap:10}, iconBtn:{padding:4},
  avatar:{width:36,height:36,borderRadius:18,backgroundColor:PRIMARY,alignItems:'center',justifyContent:'center'},
  avatarText:{color:'#fff',fontSize:13,fontWeight:'700'}, blueLine:{height:3,backgroundColor:PRIMARY},

  snackBar:{marginHorizontal:12,marginTop:8,padding:12,borderRadius:12},
  snackSuccess:{backgroundColor:'#dcfce7'}, snackError:{backgroundColor:'#fee2e2'}, snackInfo:{backgroundColor:'#dbeafe'},
  snackText:{fontSize:13,fontWeight:'600',color:'#1a1a3e'},

  heroCard:{margin:12,borderRadius:20,backgroundColor:PRIMARY,padding:18,shadowColor:PRIMARY,shadowOffset:{width:0,height:6},shadowOpacity:0.3,shadowRadius:12,elevation:8},
  heroTitle:{fontSize:20,fontWeight:'800',color:'#fff',marginBottom:6},
  heroStatusRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:16},
  onlineDot:{width:9,height:9,borderRadius:5,backgroundColor:'rgba(255,255,255,0.4)'},
  onlineDotActive:{backgroundColor:'#69f0ae'}, heroStatusTxt:{fontSize:13,color:'rgba(255,255,255,0.85)'},
  heroBtns:{flexDirection:'row',gap:8,marginBottom:16,flexWrap:'wrap'},
  heroBtn:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.15)',borderRadius:20,paddingHorizontal:14,paddingVertical:8},
  heroBtnGreen:{backgroundColor:SUCCESS}, heroBtnRed:{backgroundColor:DANGER}, heroBtnTxt:{fontSize:13,fontWeight:'700',color:'#fff'},
  sessionBox:{backgroundColor:'rgba(255,255,255,0.12)',borderRadius:14,padding:14,flexDirection:'row',alignItems:'center',gap:12,marginBottom:16},
  sessionIconWrap:{width:46,height:46,borderRadius:23,backgroundColor:'rgba(105,240,174,0.15)',alignItems:'center',justifyContent:'center'},
  sessionLbl:{fontSize:12,color:'rgba(255,255,255,0.7)',fontWeight:'600'},
  sessionTimer:{fontSize:26,fontWeight:'800',color:'#69f0ae',letterSpacing:1},
  liveBadge:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(105,240,174,0.15)',borderRadius:12,paddingHorizontal:8,paddingVertical:4,borderWidth:1,borderColor:'rgba(105,240,174,0.3)'},
  liveTxt:{fontSize:11,fontWeight:'800',color:'#69f0ae'},
  heroBotRow:{flexDirection:'row',alignItems:'center'}, heroBotItem:{flex:1,alignItems:'center'},
  heroBotDiv:{width:1,height:32,backgroundColor:'rgba(255,255,255,0.2)'},
  heroBotLbl:{fontSize:11,color:'rgba(255,255,255,0.6)',marginBottom:4},
  heroBotVal:{fontSize:15,fontWeight:'800',color:'#fff'}, heroBotGreen:{color:'#69f0ae'},

  loadingWrap:{paddingVertical:40,alignItems:'center'},
  statGrid:{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:12,gap:8,marginTop:12},
  statCard:{width:'47%',backgroundColor:'#fff',borderRadius:16,padding:14,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.06,shadowRadius:6,elevation:2,overflow:'hidden'},
  statCardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8},
  statIconBox:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center'},
  statVal:{fontSize:24,fontWeight:'800'}, statLbl:{fontSize:13,fontWeight:'700',color:'#1a1a3e',marginBottom:2},
  statSub:{fontSize:11,color:'#aaa',marginBottom:8}, statBar:{height:3,borderRadius:2,marginHorizontal:-14,marginBottom:-14},

  periodScroll:{marginTop:10,maxHeight:48},
  periodContent:{paddingHorizontal:12,paddingVertical:6,gap:8,flexDirection:'row'},
  periodChip:{paddingHorizontal:16,paddingVertical:6,borderRadius:20,backgroundColor:'#fff',borderWidth:1.5,borderColor:'#e4e8f5'},
  periodChipActive:{backgroundColor:PRIMARY,borderColor:PRIMARY},
  periodChipTxt:{fontSize:13,fontWeight:'600',color:'#555'}, periodChipTxtActive:{color:'#fff'},

  searchWrap:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:28,marginHorizontal:12,marginVertical:8,paddingHorizontal:16,paddingVertical:10,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4,elevation:2},
  searchInput:{flex:1,fontSize:14,color:'#333',paddingVertical:0},

  calCard:{backgroundColor:'#fff',marginHorizontal:12,marginBottom:12,borderRadius:16,padding:16,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.06,shadowRadius:6,elevation:2},
  calHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14},
  calMonth:{fontSize:18,fontWeight:'800',color:'#1a1a3e'}, calNav:{flexDirection:'row',gap:6},
  calNavBtn:{width:32,height:32,borderRadius:16,backgroundColor:'#eef1fb',alignItems:'center',justifyContent:'center'},
  calDayRow:{flexDirection:'row',marginBottom:8}, calDayHdr:{flex:1,textAlign:'center',fontSize:10,fontWeight:'700',color:'#aaa'},
  calGrid:{flexDirection:'row',flexWrap:'wrap'}, calCell:{width:'14.28%',alignItems:'center',paddingVertical:3},
  calCircle:{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center'},
  calCirclePrev:{opacity:0.2}, calCirclePresent:{backgroundColor:'#dcfce7'}, calCircleLate:{backgroundColor:'#fef9c3'},
  calCircleAbsent:{backgroundColor:'#fee2e2'}, calCircleHoliday:{backgroundColor:'#dbeafe'}, calCircleToday:{backgroundColor:PRIMARY},
  calNum:{fontSize:12,color:'#555',fontWeight:'500'}, calNumPrev:{color:'#aaa'},
  calNumPresent:{color:'#16a34a',fontWeight:'700'}, calNumLate:{color:'#d97706',fontWeight:'700'},
  calNumAbsent:{color:'#dc2626',fontWeight:'700'}, calNumToday:{color:'#fff',fontWeight:'800'},
  calDot:{width:4,height:4,borderRadius:2,marginTop:1},
  calLegend:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:'#f0f0f0'},
  legendItem:{flexDirection:'row',alignItems:'center',gap:5}, legendDot:{width:9,height:9,borderRadius:5}, legendTxt:{fontSize:12,color:'#555'},

  logSection:{backgroundColor:'#fff',marginHorizontal:12,borderRadius:16,padding:16,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.06,shadowRadius:6,elevation:2},
  logHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14},
  logTitle:{fontSize:18,fontWeight:'800',color:'#1a1a3e'}, logSub:{fontSize:12,color:'#aaa',marginTop:2},
  exportBtn:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#ff9800',borderRadius:20,paddingHorizontal:12,paddingVertical:8},
  exportTxt:{fontSize:13,fontWeight:'700',color:'#fff'},
  emptyWrap:{alignItems:'center',paddingVertical:40,gap:10}, emptyTitle:{fontSize:16,fontWeight:'700',color:'#888'}, emptySub:{fontSize:13,color:'#aaa'},
  logCard:{borderWidth:1,borderColor:'#eef1ff',borderRadius:14,padding:14,marginBottom:10},
  logCardAbsent:{borderColor:'#fee2e2',borderLeftWidth:3,borderLeftColor:DANGER},
  logTop:{flexDirection:'row',alignItems:'flex-start',marginBottom:12,gap:12},
  logDateCircle:{width:52,height:52,borderRadius:26,alignItems:'center',justifyContent:'center'},
  logMonth:{fontSize:10,fontWeight:'800'}, logDate:{fontSize:18,fontWeight:'900',lineHeight:20},
  logDayRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6},
  logDay:{fontSize:16,fontWeight:'700',color:'#1a1a3e'}, expandBtn:{padding:4},
  statusBadge:{flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  statusTxt:{fontSize:12,fontWeight:'700'},
  punchRow:{flexDirection:'row',marginBottom:10,paddingBottom:10,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  punchItem:{flex:1}, punchLbl:{fontSize:11,color:'#aaa',marginBottom:3},
  punchGreen:{fontSize:14,fontWeight:'700',color:'#16a34a'}, punchBlue:{fontSize:14,fontWeight:'700',color:PRIMARY},
  locRow:{flexDirection:'row',alignItems:'flex-start',gap:4}, locTxt:{flex:1,fontSize:12,color:'#666',lineHeight:18}, locLbl:{fontWeight:'700',color:'#555'},

  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  modalCard:{backgroundColor:'#fff',borderRadius:24,padding:28,width:'100%',alignItems:'center',shadowColor:'#000',shadowOffset:{width:0,height:10},shadowOpacity:0.25,shadowRadius:20,elevation:16,overflow:'hidden'},
  modalStrip:{height:5,width:'150%',marginBottom:20},
  modalIconWrap:{width:80,height:80,borderRadius:40,alignItems:'center',justifyContent:'center',marginBottom:16},
  modalTitle:{fontSize:20,fontWeight:'800',color:'#1a1a3e',marginBottom:8,textAlign:'center'},
  modalSubtitle:{fontSize:14,color:'#666',textAlign:'center',lineHeight:22,marginBottom:16},
  modalInfoRow:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#eef1fb',borderRadius:30,paddingHorizontal:16,paddingVertical:12,marginBottom:20,width:'100%',borderWidth:1,borderColor:'#c5cfe8'},
  modalInfoTxt:{fontSize:13,color:PRIMARY,fontWeight:'600',flex:1},
  modalBtns:{flexDirection:'row',gap:12,width:'100%'},
  modalCancelBtn:{flex:1,paddingVertical:14,borderRadius:30,borderWidth:1.5,borderColor:'#e0e0e0',alignItems:'center',justifyContent:'center'},
  modalCancelTxt:{fontSize:15,fontWeight:'600',color:'#555'},
  modalAllowBtn:{flex:1.6,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:30,paddingVertical:14},
  modalAllowTxt:{fontSize:15,fontWeight:'800',color:'#fff'},

  punchHeader:{flexDirection:'row',alignItems:'center',width:'100%',paddingTop:20,paddingBottom:16,borderBottomWidth:1,borderBottomColor:'#f0f0f0',marginBottom:16},
  punchIconCircle:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'},
  punchTitle:{fontSize:18,fontWeight:'800',color:'#1a1a3e',lineHeight:22},
  punchDate:{fontSize:12,color:'#aaa',marginTop:2},
  punchClose:{width:32,height:32,borderRadius:16,backgroundColor:'#f5f5f5',alignItems:'center',justifyContent:'center'},
  punchTimeBox:{width:'100%',borderWidth:1,borderRadius:14,padding:16,alignItems:'center',marginBottom:12,backgroundColor:'#f9fafb'},
  punchTimeDisplay:{fontSize:36,fontWeight:'900',letterSpacing:-1}, punchTimeLbl:{fontSize:12,color:'#aaa',marginTop:4},
  sessionMini:{width:'100%',flexDirection:'row',alignItems:'center',backgroundColor:'#f0fdf4',borderRadius:12,padding:12,marginBottom:12,borderWidth:1,borderColor:'#bbf7d0'},
  sessionMiniLbl:{fontSize:11,color:'#aaa'}, sessionMiniTimer:{fontSize:20,fontWeight:'800',color:SUCCESS},
  liveBadgeSm:{backgroundColor:'rgba(34,197,94,0.15)',borderRadius:8,paddingHorizontal:8,paddingVertical:4},
  liveTxtSm:{fontSize:11,fontWeight:'800',color:SUCCESS},
  geoBox:{width:'100%',flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:12,padding:12,marginBottom:10},
  geoIconCircle:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',flexShrink:0},
  geoTitle:{fontSize:13,fontWeight:'700',color:'#333'}, geoAddr:{fontSize:12,color:'#666',marginTop:3,lineHeight:17},
  geoErr:{fontSize:12,color:DANGER,marginTop:3}, retryBtnSm:{padding:6},
  geoAlert:{width:'100%',flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:'#fee2e2',borderRadius:10,padding:10,marginBottom:12},
  geoAlertTxt:{flex:1,fontSize:12,color:DANGER,lineHeight:18},
  punchActions:{flexDirection:'row',gap:10,width:'100%',marginTop:8},
  punchCancelBtn:{flex:1,paddingVertical:14,borderRadius:30,borderWidth:1.5,borderColor:'#e0e0e0',alignItems:'center'},
  punchCancelTxt:{fontSize:14,fontWeight:'600',color:'#555'},
  punchConfirmBtn:{flex:1.8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:30,paddingVertical:14},
  punchConfirmDisabled:{opacity:0.5}, punchConfirmTxt:{fontSize:14,fontWeight:'800',color:'#fff'},

  filterOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'flex-end'},
  filterSheet:{backgroundColor:'#fff',borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:40},
  filterHandle:{width:40,height:4,backgroundColor:'#e0e0e0',borderRadius:2,alignSelf:'center',marginBottom:16},
  filterTitle:{fontSize:18,fontWeight:'800',color:PRIMARY,marginBottom:16},
  filterLabel:{fontSize:12,fontWeight:'700',color:'#888',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8,marginTop:12},
  filterOpts:{flexDirection:'row',flexWrap:'wrap',gap:8},
  filterOpt:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#f5f5f5',borderWidth:1.5,borderColor:'#f0f0f0'},
  filterOptActive:{backgroundColor:PRIMARY,borderColor:PRIMARY},
  filterOptTxt:{fontSize:13,fontWeight:'600',color:'#555'}, filterOptTxtActive:{color:'#fff'},
  filterActions:{flexDirection:'row',gap:12,marginTop:24},
  filterClearBtn:{flex:1,paddingVertical:14,borderRadius:30,borderWidth:1.5,borderColor:'#e0e0e0',alignItems:'center'},
  filterClearTxt:{fontSize:14,fontWeight:'600',color:'#555'},
  filterApplyBtn:{flex:1.5,paddingVertical:14,borderRadius:30,backgroundColor:PRIMARY,alignItems:'center'},
  filterApplyTxt:{fontSize:14,fontWeight:'800',color:'#fff'},
});