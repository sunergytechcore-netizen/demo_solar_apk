// src/screens/DocumentSubmissionPage.tsx
// React Native conversion of DocumentSubmissionPage.jsx
//
// Required packages:
//   npm install react-native-vector-icons
//   npm install react-native-safe-area-context
//   npm install react-native-document-picker
//   npm install @react-native-community/datetimepicker
//
// iOS: npx pod-install
// Android: follow vector-icons gradle setup

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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import {
  errorCodes as documentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerError,
  pick as pickDocument,
  types as documentPickerTypes,
} from '@react-native-documents/picker';
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "../contexts/AuthContext";

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const PRIMARY_COLOR   = "#4569ea";
const SECONDARY_COLOR = "#1a237e";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_ITEMS_PER_PAGE = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_ROLES = ["Head_office", "ZSM", "ASM", "TEAM"];

const PERIOD_OPTIONS = [
  { value: "Today",      label: "Today"      },
  { value: "This Week",  label: "This Week"  },
  { value: "This Month", label: "This Month" },
  { value: "All",        label: "All Time"   },
];

const LEAD_STATUS_OPTIONS = [
  "Document Submission",
  "Bank Loan Apply",
  "Missed Leads",
];

const LEAD_STATUS_CONFIG: Record<string, any> = {
  "Document Submission": {
    bg: "rgba(69,105,234,0.08)", color: PRIMARY_COLOR,
    icon: "description",  description: "Documents submitted for verification",
  },
  "Bank Loan Apply": {
    bg: "rgba(69,105,234,0.08)", color: PRIMARY_COLOR,
    icon: "pending-actions", description: "Waiting for bank approval",
  },
  "Missed Leads": {
    bg: "rgba(239,68,68,0.08)", color: "#ef4444",
    icon: "cancel", description: "Lead lost or not converted",
  },
};

const DOCUMENT_STATUS_CONFIG: Record<string, any> = {
  submitted: {
    bg: "rgba(16,185,129,0.08)", color: "#10b981",
    label: "Submitted", icon: "check-circle", order: 1,
  },
  pending: {
    bg: "rgba(245,158,11,0.08)", color: "#f59e0b",
    label: "Pending", icon: "hourglass-empty", order: 2,
  },
  rejected: {
    bg: "rgba(239,68,68,0.08)", color: "#ef4444",
    label: "Rejected", icon: "cancel", order: 3,
  },
};

const ROLE_CONFIG: Record<string, any> = {
  Head_office: { label: "Head Office",        icon: "admin-panel-settings" },
  ZSM:         { label: "Zone Sales Manager", icon: "workspace-premium"    },
  ASM:         { label: "Area Sales Manager", icon: "supervisor-account"   },
  TEAM:        { label: "Team Member",        icon: "groups"               },
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const hasAccess = (role: string) => ALLOWED_ROLES.includes(role);

const getUserPermissions = (role: string) => ({
  canView:         ["Head_office","ZSM","ASM","TEAM"].includes(role),
  canEdit:         ["Head_office","ZSM","ASM","TEAM"].includes(role),
  canDelete:       role === "Head_office",
  canManage:       ["Head_office","ZSM","ASM","TEAM"].includes(role),
  canSeeAll:       ["Head_office","ZSM","ASM"].includes(role),
  canSeeOwn:       role === "TEAM",
  canUpdateStatus: ["Head_office","ZSM","ASM","TEAM"].includes(role),
});

const matchesUserId = (field: any, userId: string): boolean => {
  if (!field || !userId) return false;
  if (typeof field === "string") return field === userId;
  if (typeof field === "object" && field._id)
    return field._id === userId || String(field._id) === String(userId);
  return String(field) === String(userId);
};

const getDocumentStatusConfig = (status: string) =>
  DOCUMENT_STATUS_CONFIG[status?.toLowerCase()] || {
    bg: "rgba(69,105,234,0.08)", color: PRIMARY_COLOR,
    label: "Not Submitted", icon: "hourglass-empty", order: 0,
  };

const getLeadStatusConfig = (status: string) =>
  LEAD_STATUS_CONFIG[status] || {
    bg: "rgba(69,105,234,0.08)", color: PRIMARY_COLOR,
    icon: "warning", description: "Unknown status", label: status || "Unknown",
  };

const getRoleConfig = (role: string) =>
  ROLE_CONFIG[role] || { label: "Unknown", icon: "person" };

const rgba = (hex: string, alpha: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`
    : hex;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const isDocumentPickerCancel = (error: unknown) =>
  isDocumentPickerError(error) &&
  error.code === documentPickerErrorCodes.OPERATION_CANCELED;

const formatDate = (dateString: string, short = false): string => {
  if (!dateString) return "Not set";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString("en-IN", short
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "Invalid Date"; }
};

const getInitials = (f: string, l: string): string =>
  `${f?.charAt(0)||""}${l?.charAt(0)||""}`.toUpperCase();

// ─────────────────────────────────────────────
//  SHARED UI COMPONENTS
// ─────────────────────────────────────────────

/** Avatar circle */
const Avatar = ({ initials, size = 40 }: { initials: string; size?: number }) => (
  <View style={[u.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[u.avatarTxt, { fontSize: size * 0.35 }]}>{initials}</Text>
  </View>
);

/** Status chip */
const StatusChip = ({
  label, bg, color, iconName, small = false,
}: { label: string; bg: string; color: string; iconName?: string; small?: boolean }) => (
  <View style={[u.chip, { backgroundColor: bg }, small && u.chipSm]}>
    {iconName && (
      <Icon name={iconName} size={small ? 11 : 13} color={color} style={{ marginRight: 3 }} />
    )}
    <Text style={[u.chipTxt, { color }, small && u.chipTxtSm]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** Divider */
const Divider = () => <View style={u.divider} />;

/** Animated Toast */
const Toast = ({
  visible, message, severity, onHide,
}: { visible: boolean; message: string; severity: string; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [visible]);
  if (!visible) return null;
  const bg = severity === "success" ? "#10b981" : severity === "error" ? "#ef4444" : "#f59e0b";
  const iconName = severity === "success" ? "check-circle" : "error";
  return (
    <Animated.View style={[u.toast, { backgroundColor: bg, opacity }]}>
      <Icon name={iconName} size={18} color="#fff" />
      <Text style={u.toastTxt}>{message}</Text>
    </Animated.View>
  );
};

/** Animated skeleton box */
const SkeletonBox = ({ width, height, style }: { width: any; height: number; style?: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View
      style={[{ width, height, backgroundColor: "#d1d5db", borderRadius: 10, opacity }, style]}
    />
  );
};

/** Linear progress bar */
const LinearProgress = ({ value = 0 }: { value: number }) => (
  <View style={u.progressTrack}>
    <View style={[u.progressFill, { width: `${Math.min(value, 100)}%` }]} />
  </View>
);

/** Custom dropdown select */
const CustomSelect = ({
  value, options, onChange, placeholder = "Select…",
}: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  return (
    <>
      <TouchableOpacity style={sel_s.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[sel_s.triggerTxt, !sel && { color: "#9ca3af" }]}>
          {sel ? sel.label : placeholder}
        </Text>
        <Icon name="expand-more" size={20} color="#6b7280" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={sel_s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={sel_s.panel}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[sel_s.opt, value === opt.value && sel_s.optActive]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Text style={[sel_s.optTxt, value === opt.value && sel_s.optTxtActive]}>
                    {opt.label}
                  </Text>
                  {value === opt.value && <Icon name="check" size={15} color={PRIMARY_COLOR} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ─────────────────────────────────────────────
//  SUMMARY CARD
// ─────────────────────────────────────────────
const SummaryCard = ({
  label, value, subText, iconName, color,
}: { label: string; value: number; subText: string; iconName: string; color: string }) => (
  <View style={[sc.card, { borderColor: rgba(color, 0.12) }]}>
    <View style={sc.row}>
      <View style={[sc.iconWrap, { backgroundColor: rgba(color, 0.1) }]}>
        <Icon name={iconName} size={20} color={color} />
      </View>
      <Text style={[sc.val, { color }]}>{value}</Text>
    </View>
    <Text style={sc.label}>{label}</Text>
    <Text style={sc.sub}>{subText}</Text>
  </View>
);

// ─────────────────────────────────────────────
//  FILE UPLOAD FIELD
// ─────────────────────────────────────────────
const FileUploadField = ({
  label, field, value, onFileChange, onRemove, validationErrors,
}: any) => {
  const hasFile = value?.preview || value?.url;
  const handlePick = async () => {
    try {
      const res = await pickDocument({
        type: [documentPickerTypes.images, documentPickerTypes.pdf],
      });
      onFileChange(field, res[0]);
    } catch (e) {
      if (!isDocumentPickerCancel(e)) console.warn("File pick error", e);
    }
  };
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fu.label}>{label}</Text>
      {hasFile ? (
        <View style={[fu.fileBox, validationErrors?.[field] && fu.errBorder]}>
          {value.preview
            ? <Image source={{ uri: value.preview }} style={fu.thumb} />
            : <Icon name="description" size={34} color={PRIMARY_COLOR} />}
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={fu.fileName} numberOfLines={1}>
              {value.file?.name || value.uri?.split("/").pop() || label}
            </Text>
            <Text style={fu.fileSize}>
              {value.file?.size ? formatFileSize(value.file.size) : "Existing document"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(field)}>
            <Icon name="delete" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[fu.drop, validationErrors?.[field] && fu.errBorder]}
          onPress={handlePick}
          activeOpacity={0.7}
        >
          <Icon name="cloud-upload" size={36} color="#d1d5db" />
          <Text style={fu.dropTxt}>Tap to upload {label}</Text>
          <Text style={fu.dropHint}>JPG, PNG or PDF — max 5 MB</Text>
        </TouchableOpacity>
      )}
      {validationErrors?.[field] && (
        <Text style={fu.errTxt}>{validationErrors[field]}</Text>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
//  IMAGE VIEWER MODAL
// ─────────────────────────────────────────────
const ImageViewerModal = ({
  open, onClose, imageUrl, title,
}: { open: boolean; onClose: () => void; imageUrl: string; title: string }) => {
  const isImg = imageUrl && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(imageUrl);
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Header */}
        <View style={iv.header}>
          <Text style={iv.title} numberOfLines={1}>{title || "Document Viewer"}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={iv.btn} onPress={onClose}>
              <Icon name="close" size={22} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Content */}
        <View style={iv.body}>
          {isImg ? (
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={0.5}
              centerContent
              contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Image
                source={{ uri: imageUrl }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}
                resizeMode="contain"
              />
            </ScrollView>
          ) : (
            <View style={iv.noPrev}>
              <Icon name="description" size={64} color="#555" />
              <Text style={iv.noPrevTxt}>Preview not available</Text>
              <Text style={iv.noPrevSub}>This file type cannot be previewed inline.</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  DOCUMENT CARD (list item)
// ─────────────────────────────────────────────
const DocumentCard = ({
  document: doc, onView, onEdit, onStatusUpdate, permissions,
}: any) => {
  const [expanded, setExpanded] = useState(false);
  const dsCfg = getDocumentStatusConfig(doc.documentStatus);
  const lsCfg = getLeadStatusConfig(doc.status);

  return (
    <View style={dc.card}>
      {/* Header */}
      <View style={dc.head}>
        <Avatar initials={getInitials(doc.firstName, doc.lastName)} size={46} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={dc.name}>{doc.firstName} {doc.lastName}</Text>
          <Text style={dc.id}>ID: {doc._id?.slice(-8) || "N/A"}</Text>
        </View>
        <TouchableOpacity style={dc.expandBtn} onPress={() => setExpanded(p => !p)}>
          <Icon name={expanded ? "expand-less" : "expand-more"} size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Contact */}
      <View style={dc.infoRow}>
        <View style={dc.infoItem}>
          <Icon name="email" size={12} color="#9ca3af" />
          <Text style={dc.infoTxt} numberOfLines={1}>{doc.email || "No email"}</Text>
        </View>
        <View style={dc.infoItem}>
          <Icon name="phone" size={12} color="#9ca3af" />
          <Text style={dc.infoTxt} numberOfLines={1}>{doc.phone || "No phone"}</Text>
        </View>
      </View>

      {/* Date */}
      <View style={[dc.infoItem, { marginBottom: 8 }]}>
        <Icon name="calendar-today" size={12} color="#9ca3af" />
        <Text style={dc.infoTxt}>
          {formatDate(doc.documentSubmissionDate, true) !== "Not set"
            ? formatDate(doc.documentSubmissionDate, true)
            : "No submission date"}
        </Text>
      </View>

      {/* Status chips */}
      <View style={dc.chipsRow}>
        <StatusChip label={dsCfg.label}           bg={dsCfg.bg}  color={dsCfg.color}  iconName={dsCfg.icon}  small />
        <StatusChip label={lsCfg.label||doc.status||"Unknown"} bg={lsCfg.bg}  color={lsCfg.color}  iconName={lsCfg.icon}  small />
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={dc.expanded}>
          <Divider />
          {/* Doc indicators */}
          <View style={dc.docGrid}>
            {[
              { lbl: "Aadhaar", has: !!doc.aadhaar?.url },
              { lbl: "PAN",     has: !!doc.panCard?.url },
              { lbl: "Passbook",has: !!doc.passbook?.url },
            ].map(d => (
              <View key={d.lbl} style={dc.docCell}>
                <Text style={dc.docCellLbl}>{d.lbl}</Text>
                <Icon name={d.has ? "check-circle" : "radio-button-unchecked"}
                  size={18} color={d.has ? "#10b981" : "#d1d5db"} />
              </View>
            ))}
          </View>
          {/* Dates */}
          <View style={dc.infoRow}>
            <View style={dc.infoItem}>
              <Icon name="access-time" size={12} color="#9ca3af" />
              <Text style={dc.infoTxt}>Created: {formatDate(doc.createdAt, true)}</Text>
            </View>
            <View style={dc.infoItem}>
              <Icon name="update" size={12} color="#9ca3af" />
              <Text style={dc.infoTxt}>Updated: {formatDate(doc.updatedAt, true)}</Text>
            </View>
          </View>
          {/* Actions */}
          <View style={dc.actions}>
            <TouchableOpacity style={dc.btnPri} onPress={() => onView(doc)}>
              <Icon name="visibility" size={14} color="#fff" />
              <Text style={dc.btnPriTxt}>View</Text>
            </TouchableOpacity>
            {permissions.canEdit && (
              <TouchableOpacity style={dc.btnOut} onPress={() => onEdit(doc)}>
                <Icon name="cloud-upload" size={14} color={PRIMARY_COLOR} />
                <Text style={dc.btnOutTxt}>Upload</Text>
              </TouchableOpacity>
            )}
            {permissions.canUpdateStatus && (
              <TouchableOpacity style={dc.btnOut} onPress={() => onStatusUpdate(doc)}>
                <Icon name="trending-up" size={14} color={PRIMARY_COLOR} />
                <Text style={dc.btnOutTxt}>Status</Text>
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
const FilterBottomSheet = ({
  open, onClose, period, setPeriod, statusFilter, setStatusFilter,
  leadStatusFilter, setLeadStatusFilter, dateFilter, setDateFilter,
  handleClearFilters, searchQuery, setSearchQuery,
  sortConfig, setSortConfig, activeFilterCount,
}: any) => {
  const [section, setSection] = useState<string | null>("period");
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate,   setShowEndDate]   = useState(false);

  const toggle = (id: string) => setSection(p => p === id ? null : id);

  const Sec = ({
    id, title, iconName, children,
  }: { id: string; title: string; iconName: string; children: React.ReactNode }) => (
    <View style={fs.section}>
      <TouchableOpacity style={fs.secHead} onPress={() => toggle(id)}>
        <View style={fs.secLeft}>
          <Icon name={iconName} size={17} color={PRIMARY_COLOR} />
          <Text style={fs.secTitle}>{title}</Text>
        </View>
        <Icon name={section === id ? "expand-less" : "expand-more"} size={20} color="#9ca3af" />
      </TouchableOpacity>
      {section === id && <View style={fs.secBody}>{children}</View>}
    </View>
  );

  const docStatusOptions = [
    { value: "All", label: "All Statuses" },
    { value: "submitted", label: "Submitted" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Rejected" },
  ];
  const leadStatusOpts = [
    { value: "All", label: "All Statuses" },
    ...LEAD_STATUS_OPTIONS.map(s => ({ value: s, label: s })),
  ];

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fs.overlay}>
        <View style={fs.sheet}>
          <View style={fs.handle} />

          {/* Header */}
          <View style={fs.header}>
            <View>
              <Text style={fs.title}>Filter Documents</Text>
              <Text style={fs.sub}>
                {activeFilterCount} active filter{activeFilterCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity style={fs.closeBtn} onPress={onClose}>
              <Icon name="close" size={19} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: "65%" }} showsVerticalScrollIndicator={false}>
            {/* Search */}
            <Sec id="search" title="Search" iconName="search">
              <View style={fs.searchBox}>
                <Icon name="search" size={16} color="#9ca3af" />
                <TextInput
                  style={fs.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Name, email, phone…"
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Icon name="close" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Sec>

            {/* Period */}
            <Sec id="period" title="Time Period" iconName="date-range">
              <View style={fs.periodGrid}>
                {PERIOD_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[fs.periodBtn, period === opt.value && fs.periodBtnActive]}
                    onPress={() => setPeriod(opt.value)}
                  >
                    <Icon name="date-range" size={13}
                      color={period === opt.value ? "#fff" : PRIMARY_COLOR}
                      style={{ marginRight: 4 }} />
                    <Text style={[fs.periodTxt, period === opt.value && fs.periodTxtActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Sec>

            {/* Document Status */}
            <Sec id="docStatus" title="Document Status" iconName="description">
              <CustomSelect
                value={statusFilter}
                options={docStatusOptions}
                onChange={setStatusFilter}
              />
            </Sec>

            {/* Lead Status */}
            <Sec id="leadStatus" title="Lead Status" iconName="trending-up">
              <CustomSelect
                value={leadStatusFilter}
                options={leadStatusOpts}
                onChange={setLeadStatusFilter}
              />
            </Sec>

            {/* Custom Date Range */}
            <Sec id="date" title="Custom Date Range" iconName="event">
              <TouchableOpacity style={fs.dateBtn} onPress={() => setShowStartDate(true)}>
                <Icon name="calendar-today" size={15} color="#6b7280" />
                <Text style={{ marginLeft: 8, fontSize: 13,
                  color: dateFilter.startDate ? "#1f2937" : "#9ca3af" }}>
                  {dateFilter.startDate
                    ? new Date(dateFilter.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "Start Date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[fs.dateBtn, { marginTop: 8 }]} onPress={() => setShowEndDate(true)}>
                <Icon name="calendar-today" size={15} color="#6b7280" />
                <Text style={{ marginLeft: 8, fontSize: 13,
                  color: dateFilter.endDate ? "#1f2937" : "#9ca3af" }}>
                  {dateFilter.endDate
                    ? new Date(dateFilter.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "End Date"}
                </Text>
              </TouchableOpacity>
              {showStartDate && (
                <DateTimePicker
                  value={dateFilter.startDate ? new Date(dateFilter.startDate) : new Date()}
                  mode="date" display="default"
                  onChange={(_, d) => {
                    setShowStartDate(false);
                    if (d) setDateFilter((p: any) => ({ ...p, startDate: d }));
                  }}
                />
              )}
              {showEndDate && (
                <DateTimePicker
                  value={dateFilter.endDate ? new Date(dateFilter.endDate) : new Date()}
                  mode="date" display="default"
                  onChange={(_, d) => {
                    setShowEndDate(false);
                    if (d) setDateFilter((p: any) => ({ ...p, endDate: d }));
                  }}
                />
              )}
            </Sec>

            {/* Sort */}
            <Sec id="sort" title="Sort By" iconName="sort">
              {[
                { key: "firstName", label: "Name" },
                { key: "documentSubmissionDate", label: "Submission Date" },
                { key: "documentStatus", label: "Document Status" },
              ].map(opt => {
                const isActive = sortConfig?.key === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[fs.sortBtn, isActive && fs.sortBtnActive]}
                    onPress={() => setSortConfig?.((p: any) => ({
                      key: opt.key,
                      direction: p.key === opt.key && p.direction === "asc" ? "desc" : "asc",
                    }))}
                  >
                    <Text style={[fs.sortTxt, isActive && fs.sortTxtActive]}>{opt.label}</Text>
                    {isActive && (
                      <Icon
                        name={sortConfig?.direction === "asc" ? "arrow-upward" : "arrow-downward"}
                        size={14} color="#fff"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </Sec>
          </ScrollView>

          {/* Footer */}
          <View style={fs.footer}>
            <TouchableOpacity style={fs.clearBtn} onPress={() => { handleClearFilters(); onClose(); }}>
              <Icon name="clear" size={16} color={PRIMARY_COLOR} />
              <Text style={fs.clearTxt}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fs.applyBtn} onPress={onClose}>
              <Icon name="check" size={16} color="#fff" />
              <Text style={fs.applyTxt}>Apply</Text>
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
const ViewLeadModal = ({
  open, onClose, lead, userRole, onViewDocument,
}: any) => {
  const [tab, setTab] = useState(0);
  if (!lead) return null;

  const roleCfg = getRoleConfig(userRole);
  const TABS = [
    { label: "Basic Info",  iconName: "person"       },
    { label: "Documents",   iconName: "folder-open"  },
    { label: "Notes",       iconName: "notes"        },
  ];

  const docs = [
    { title: "Aadhaar Card",        url: lead.aadhaar?.url,         iconName: "badge"           },
    { title: "PAN Card",            url: lead.panCard?.url,         iconName: "credit-card"     },
    { title: "Bank Passbook",       url: lead.passbook?.url,        iconName: "receipt-long"    },
    { title: "Registration Doc",    url: lead.uploadDocument?.url,  iconName: "description"     },
    { title: "Installation Doc",    url: lead.installationDocument?.url, iconName: "construction" },
    ...(lead.otherDocuments?.map((d: any, i: number) => ({
      title: d.name || `Other Doc ${i + 1}`, url: d.url, iconName: "insert-drive-file",
    })) || []),
    ...(lead.enhancementDocuments?.map((d: any, i: number) => ({
      title: d.name || `Enhancement Doc ${i + 1}`, url: d.url, iconName: "bolt",
    })) || []),
  ].filter(d => d.url);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {/* Header */}
        <View style={vm.header}>
          <Avatar initials={getInitials(lead.firstName, lead.lastName)} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={vm.name}>{lead.firstName} {lead.lastName}</Text>
            <Text style={vm.sub}>Document Details • ID: {lead._id?.slice(-8)}</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={vm.tabBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={vm.tabBarContent}
          >
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={i} style={[vm.tab, tab === i && vm.tabActive]}
              onPress={() => setTab(i)}
            >
              <Icon name={t.iconName} size={16} color={tab === i ? PRIMARY_COLOR : "#9ca3af"} />
              <Text style={[vm.tabTxt, tab === i && vm.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={vm.content}>
          {/* Basic Info */}
          {tab === 0 && (
            <>
              <View style={vm.card}>
                <View style={vm.cardTitle}>
                  <Icon name="person" size={17} color={PRIMARY_COLOR} />
                  <Text style={vm.cardTitleTxt}>Personal Information</Text>
                </View>
                {[
                  { lbl: "Full Name", val: `${lead.firstName} ${lead.lastName}` },
                  { lbl: "Email",     val: lead.email || "Not set" },
                  { lbl: "Phone",     val: lead.phone || "Not set" },
                  { lbl: "Address",   val: lead.address || "Not set" },
                  { lbl: "City",      val: lead.city || "Not set" },
                ].map((r, i) => (
                  <View key={i}>
                    <View style={vm.infoRow}>
                      <Text style={vm.infoLbl}>{r.lbl}</Text>
                      <Text style={vm.infoVal} numberOfLines={2}>{r.val}</Text>
                    </View>
                    <Divider />
                  </View>
                ))}
              </View>

              <View style={[vm.card, { marginTop: 12 }]}>
                <View style={vm.cardTitle}>
                  <Icon name="description" size={17} color={PRIMARY_COLOR} />
                  <Text style={vm.cardTitleTxt}>Document Information</Text>
                </View>
                <View style={vm.infoRow}>
                  <Text style={vm.infoLbl}>Document Status</Text>
                  <StatusChip
                    label={getDocumentStatusConfig(lead.documentStatus).label}
                    bg={getDocumentStatusConfig(lead.documentStatus).bg}
                    color={getDocumentStatusConfig(lead.documentStatus).color}
                    iconName={getDocumentStatusConfig(lead.documentStatus).icon}
                    small
                  />
                </View>
                <Divider />
                <View style={vm.infoRow}>
                  <Text style={vm.infoLbl}>Lead Status</Text>
                  <StatusChip
                    label={lead.status || "Unknown"}
                    bg={getLeadStatusConfig(lead.status).bg}
                    color={getLeadStatusConfig(lead.status).color}
                    iconName={getLeadStatusConfig(lead.status).icon}
                    small
                  />
                </View>
                <Divider />
                <View style={vm.infoRow}>
                  <Text style={vm.infoLbl}>Submission Date</Text>
                  <Text style={vm.infoVal}>{formatDate(lead.documentSubmissionDate)}</Text>
                </View>
                <Divider />
                <View style={vm.infoRow}>
                  <Text style={vm.infoLbl}>Created</Text>
                  <Text style={vm.infoVal}>{formatDate(lead.createdAt)}</Text>
                </View>
              </View>
            </>
          )}

          {/* Documents */}
          {tab === 1 && (
            <View>
              <Text style={vm.sectionHeading}>Uploaded Documents</Text>
              {docs.length > 0 ? docs.map((doc, i) => (
                <View key={i} style={vm.docItem}>
                  <Icon name={doc.iconName} size={22} color={PRIMARY_COLOR} />
                  <Text style={vm.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <TouchableOpacity
                    style={vm.docViewBtn}
                    onPress={() => onViewDocument(doc.url, doc.title)}
                  >
                    <Icon name="visibility" size={14} color={PRIMARY_COLOR} />
                    <Text style={vm.docViewTxt}>View</Text>
                  </TouchableOpacity>
                </View>
              )) : (
                <View style={vm.emptyDocs}>
                  <Icon name="folder-open" size={52} color="#d1d5db" />
                  <Text style={vm.emptyTitle}>No Documents Uploaded</Text>
                  <Text style={vm.emptySub}>No documents have been uploaded yet.</Text>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {tab === 2 && (
            <View style={vm.card}>
              <View style={vm.cardTitle}>
                <Icon name="notes" size={17} color={PRIMARY_COLOR} />
                <Text style={vm.cardTitleTxt}>Document Notes</Text>
              </View>
              {lead.documentNotes
                ? <Text style={vm.notesTxt}>{lead.documentNotes}</Text>
                : <Text style={vm.notesEmpty}>No notes available</Text>}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={vm.footer}>
          <StatusChip
            label={roleCfg.label}
            bg={rgba(PRIMARY_COLOR, 0.08)}
            color={PRIMARY_COLOR}
            iconName={roleCfg.icon}
            small
          />
          <TouchableOpacity style={vm.closeBtn} onPress={onClose}>
            <Text style={vm.closeBtnTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  EDIT LEAD MODAL  (Upload Documents)
// ─────────────────────────────────────────────
const EditLeadModal = ({
  open, onClose, lead, onSave, showToast,
}: any) => {
  const { fetchAPI } = useAuth();
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [form, setForm] = useState<any>({
    documentStatus: "pending",
    aadhaar:  { file: null, url: "", preview: null },
    panCard:  { file: null, url: "", preview: null },
    passbook: { file: null, url: "", preview: null },
    otherDocuments: [],
    documentSubmissionDate: null,
    documentNotes: "",
  });
  const [errors,        setErrors]        = useState<any>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setForm({
        documentStatus: lead.documentStatus || "pending",
        aadhaar:  { file: null, url: lead.aadhaar?.url || "",  preview: lead.aadhaar?.url  || null },
        panCard:  { file: null, url: lead.panCard?.url || "",   preview: lead.panCard?.url  || null },
        passbook: { file: null, url: lead.passbook?.url || "",  preview: lead.passbook?.url || null },
        otherDocuments: lead.otherDocuments || [],
        documentSubmissionDate: lead.documentSubmissionDate ? new Date(lead.documentSubmissionDate) : null,
        documentNotes: lead.documentNotes || "",
      });
      setErrors({});
      setProgress(0);
    }
  }, [open, lead]);

  const handleFileChange = useCallback((field: string, file: any) => {
    if (file.size && file.size > MAX_FILE_SIZE) {
      showToast("File must be under 5 MB", "error");
      return;
    }
    const isImg = file.type?.startsWith("image/");
    setForm((p: any) => ({
      ...p,
      [field]: { file, url: file.uri, preview: isImg ? file.uri : null },
    }));
    setErrors((p: any) => ({ ...p, [field]: "" }));
  }, [showToast]);

  const handleRemove = useCallback((field: string) => {
    setForm((p: any) => ({ ...p, [field]: { file: null, url: "", preview: null } }));
  }, []);

  const handleAddOtherDoc = async () => {
    try {
      const res = await pickDocument({
        type: [documentPickerTypes.images, documentPickerTypes.pdf],
      });
      const file = res[0];
      if (!file) return;
      if (file.size && file.size > MAX_FILE_SIZE) {
        showToast("File must be under 5 MB", "error");
        return;
      }
      setForm((p: any) => ({
        ...p,
        otherDocuments: [
          ...p.otherDocuments,
          { file, name: file.name, url: file.uri, preview: file.type?.startsWith("image/") ? file.uri : null },
        ],
      }));
    } catch (e) {
      if (!isDocumentPickerCancel(e)) showToast("Failed to pick file", "error");
    }
  };

  const handleSubmit = async () => {
    if (!form.documentStatus) {
      setErrors({ documentStatus: "Document status is required" });
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      const jsonData: any = {};
      if (form.documentNotes)             jsonData.documentNotes = form.documentNotes;
      if (form.documentStatus)            jsonData.documentStatus = form.documentStatus;
      if (form.documentSubmissionDate)
        jsonData.documentSubmissionDate = new Date(form.documentSubmissionDate)
          .toISOString().split("T")[0];

      const appendFile = (key: string, f: any) =>
        fd.append(key, { uri: f.uri, type: f.type || "application/octet-stream", name: f.name } as any);

      if (form.aadhaar.file)  appendFile("aadhaar",  form.aadhaar.file);
      if (form.panCard.file)  appendFile("panCard",  form.panCard.file);
      if (form.passbook.file) appendFile("passbook", form.passbook.file);
      form.otherDocuments.forEach((d: any) => { if (d.file) appendFile("otherDocuments", d.file); });
      fd.append("data", JSON.stringify(jsonData));

      const interval = setInterval(() => {
        setProgress(p => { if (p >= 90) { clearInterval(interval); return 90; } return p + 10; });
      }, 400);

      const res = await fetchAPI(`/lead/upload/${lead._id}/upload-documents`, {
        method: "PUT",
        body: fd,
      });
      clearInterval(interval);
      setProgress(100);

      if (res?.success) {
        showToast("Documents uploaded successfully", "success");
        onSave(res.result);
        setTimeout(() => onClose(), 500);
      } else {
        throw new Error(res?.message || "Upload failed");
      }
    } catch (e: any) {
      showToast(e.message || "Upload failed", "error");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  if (!lead) return null;

  const statusOpts = [
    { value: "pending",   label: "Pending"   },
    { value: "submitted", label: "Submitted" },
    { value: "rejected",  label: "Rejected"  },
  ];

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          {/* Header */}
          <View style={em.header}>
            <View style={em.headerIcon}>
              <Icon name="cloud-upload" size={22} color={PRIMARY_COLOR} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={em.headerTitle}>Upload Documents</Text>
              <Text style={em.headerSub}>{lead.firstName} {lead.lastName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Icon name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {/* Progress */}
            {loading && progress > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>
                  Uploading… {progress}%
                </Text>
                <LinearProgress value={progress} />
              </View>
            )}

            {/* Status */}
            <Text style={em.fieldLbl}>Document Status *</Text>
            <CustomSelect
              value={form.documentStatus}
              options={statusOpts}
              onChange={v => setForm((p: any) => ({ ...p, documentStatus: v }))}
            />
            {errors.documentStatus && <Text style={em.errTxt}>{errors.documentStatus}</Text>}

            {/* Date */}
            <Text style={[em.fieldLbl, { marginTop: 14 }]}>Submission Date</Text>
            <TouchableOpacity style={em.dateRow} onPress={() => setShowDatePicker(true)}>
              <Icon name="calendar-today" size={16} color="#6b7280" />
              <Text style={{ marginLeft: 8, fontSize: 13,
                color: form.documentSubmissionDate ? "#1f2937" : "#9ca3af" }}>
                {form.documentSubmissionDate
                  ? new Date(form.documentSubmissionDate).toLocaleDateString("en-IN",
                      { day: "2-digit", month: "short", year: "numeric" })
                  : "Select date"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={form.documentSubmissionDate || new Date()}
                mode="date" display="default"
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setForm((p: any) => ({ ...p, documentSubmissionDate: d }));
                }}
              />
            )}

            {/* Required docs */}
            <Text style={[em.sectionTitle, { marginTop: 16 }]}>Required Documents</Text>
            <FileUploadField label="Aadhaar Card" field="aadhaar" value={form.aadhaar}
              onFileChange={handleFileChange} onRemove={handleRemove} validationErrors={errors} />
            <FileUploadField label="PAN Card"    field="panCard"  value={form.panCard}
              onFileChange={handleFileChange} onRemove={handleRemove} validationErrors={errors} />
            <FileUploadField label="Passbook"    field="passbook" value={form.passbook}
              onFileChange={handleFileChange} onRemove={handleRemove} validationErrors={errors} />

            {/* Other docs */}
            <Text style={[em.sectionTitle, { marginTop: 4 }]}>
              Other Documents ({form.otherDocuments.length})
            </Text>
            {form.otherDocuments.map((doc: any, i: number) => (
              <View key={i} style={em.otherItem}>
                <Icon name="description" size={26} color={PRIMARY_COLOR} />
                <Text style={em.otherName} numberOfLines={1}>{doc.name}</Text>
                <TouchableOpacity onPress={() => setForm((p: any) => ({
                  ...p, otherDocuments: p.otherDocuments.filter((_: any, j: number) => j !== i),
                }))}>
                  <Icon name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={em.addMoreBtn} onPress={handleAddOtherDoc} disabled={loading}>
              <Icon name="add-photo-alternate" size={18} color={PRIMARY_COLOR} />
              <Text style={{ color: PRIMARY_COLOR, fontWeight: "600", marginLeft: 6 }}>
                Add More Documents
              </Text>
            </TouchableOpacity>

            {/* Notes */}
            <Text style={[em.fieldLbl, { marginTop: 16 }]}>Document Notes</Text>
            <TextInput
              style={em.notesInput}
              value={form.documentNotes}
              onChangeText={t => setForm((p: any) => ({ ...p, documentNotes: t }))}
              multiline numberOfLines={4}
              placeholder="Add any comments or notes…"
              placeholderTextColor="#9ca3af"
              editable={!loading}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Footer */}
          <View style={em.footer}>
            <TouchableOpacity style={em.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={em.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[em.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="cloud-upload" size={16} color="#fff" />}
              <Text style={em.submitTxt}>{loading ? "Uploading…" : "Upload Documents"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  LEAD STATUS UPDATE MODAL
// ─────────────────────────────────────────────
const LeadStatusUpdateModal = ({
  open, onClose, lead, onStatusUpdate, showToast,
}: any) => {
  const { fetchAPI, user } = useAuth();
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState("");
  const [err,      setErr]      = useState("");

  useEffect(() => {
    if (open && lead) { setSelected(lead.status || ""); setErr(""); }
  }, [open, lead]);

  const available = useMemo(() =>
    LEAD_STATUS_OPTIONS
      .filter(s => s !== lead?.status)
      .map(s => ({ value: s, label: s })),
    [lead?.status]
  );

  const handleSubmit = async () => {
    if (!selected) { setErr("Please select a status"); return; }
    if (selected === lead?.status) { onClose(); return; }
    setLoading(true);
    try {
      const res = await fetchAPI(`/lead/updateLead/${lead._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selected,
          updatedBy: user?._id,
          updatedByRole: user?.role,
        }),
      });
      if (res?.success) {
        showToast("Lead status updated successfully", "success");
        onStatusUpdate(res.result);
        onClose();
      } else {
        throw new Error(res?.message || "Failed to update");
      }
    } catch (e: any) {
      setErr(e.message);
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;
  const cfg = getLeadStatusConfig(lead.status);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={su.sheet}>
          <View style={su.handle} />
          {/* Header */}
          <View style={su.header}>
            <View style={su.headerIcon}>
              <Icon name="trending-up" size={20} color={PRIMARY_COLOR} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={su.title}>Update Lead Status</Text>
              <Text style={su.sub}>{lead.firstName} {lead.lastName}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            {err ? (
              <View style={su.errBox}>
                <Icon name="error" size={15} color="#ef4444" />
                <Text style={{ fontSize: 13, color: "#ef4444", flex: 1, marginLeft: 5 }}>{err}</Text>
              </View>
            ) : null}
            <Text style={su.lbl}>Current Status</Text>
            <View style={{ marginBottom: 12 }}>
              <StatusChip
                label={lead.status || "Unknown"}
                bg={cfg.bg} color={cfg.color} iconName={cfg.icon}
              />
              <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                {cfg.description}
              </Text>
            </View>
            <Text style={su.lbl}>New Status *</Text>
            <CustomSelect
              value={selected}
              options={available}
              onChange={setSelected}
              placeholder="Select new status"
            />
          </View>

          <View style={su.footer}>
            <TouchableOpacity style={su.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={su.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[su.submitBtn, (!selected || selected === lead?.status || loading) && su.submitDis]}
              onPress={handleSubmit}
              disabled={!selected || selected === lead?.status || loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="save" size={15} color="#fff" />}
              <Text style={su.submitTxt}>{loading ? "Saving…" : "Update Status"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────
//  EMPTY STATE & LOADING SKELETON
// ─────────────────────────────────────────────
const EmptyState = ({ onClearFilters, hasFilters }: any) => (
  <View style={misc.empty}>
    <View style={misc.emptyIcon}>
      <Icon name="description" size={48} color={PRIMARY_COLOR} />
    </View>
    <Text style={misc.emptyTitle}>No documents found</Text>
    <Text style={misc.emptySub}>
      {hasFilters
        ? "No documents match your current filters. Try adjusting your search."
        : "No documents have been submitted yet."}
    </Text>
    {hasFilters && (
      <TouchableOpacity style={misc.clearBtn} onPress={onClearFilters}>
        <Icon name="clear" size={15} color="#fff" />
        <Text style={misc.clearTxt}>Clear All Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);

const LoadingSkeleton = () => (
  <View style={{ padding: 16 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
      {[1,2,3,4].map(i => (
        <SkeletonBox key={i} width={(SCREEN_WIDTH - 48) / 2} height={90} />
      ))}
    </View>
    <SkeletonBox width="100%" height={50} style={{ marginBottom: 12 }} />
    {[1,2,3,4].map(i => (
      <SkeletonBox key={i} width="100%" height={110} style={{ marginBottom: 10 }} />
    ))}
  </View>
);

// ─────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────
interface Props {
  navigation?: any;
  onBackPress?: () => void;
  onMenuPress?: () => void;
}

export default function DocumentSubmissionPage({ navigation, onBackPress, onMenuPress }: Props = {}) {
  const { fetchAPI, user, getUserRole } = useAuth();
  const userRole = getUserRole();
  const perms = useMemo(() => getUserPermissions(userRole), [userRole]);

  // Core state
  const [period,     setPeriod]     = useState("All");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "", severity: "success" });
  const showToast = useCallback((message: string, severity = "success") => {
    setToast({ visible: true, message, severity });
  }, []);

  // Data
  const [documents, setDocuments] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalDocuments: 0, submittedDocuments: 0,
    pendingDocuments: 0, rejectedDocuments: 0,
  });

  // Filters
  const [searchQuery,      setSearchQuery]      = useState("");
  const [statusFilter,     setStatusFilter]     = useState("All");
  const [leadStatusFilter, setLeadStatusFilter] = useState("All");
  const [filterOpen,       setFilterOpen]       = useState(false);
  const [dateFilter, setDateFilter] = useState<any>({ startDate: null, endDate: null });
  const [sortConfig, setSortConfig] = useState({ key: "documentSubmissionDate", direction: "desc" });

  // Pagination
  const [page, setPage] = useState(0);

  // Modals
  const [viewOpen,   setViewOpen]   = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [imgOpen,    setImgOpen]    = useState(false);
  const [imgUrl,     setImgUrl]     = useState("");
  const [imgTitle,   setImgTitle]   = useState("");
  const [selDoc,     setSelDoc]     = useState<any>(null);

  // ── Fetch from backend ──────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      const today = new Date();

      if (period === "Today") {
        const d = today.toISOString().split("T")[0];
        params.append("startDate", d); params.append("endDate", d);
      } else if (period === "This Week") {
        const wk = new Date(today); wk.setDate(today.getDate() - 7);
        params.append("startDate", wk.toISOString().split("T")[0]);
        params.append("endDate",   today.toISOString().split("T")[0]);
      } else if (period === "This Month") {
        const mo = new Date(today); mo.setMonth(today.getMonth() - 1);
        params.append("startDate", mo.toISOString().split("T")[0]);
        params.append("endDate",   today.toISOString().split("T")[0]);
      }

      const qs = params.toString();
      const res = await fetchAPI(`/lead/DocumentSummary${qs ? `?${qs}` : ""}`);

      if (!res?.success) throw new Error(res?.message || "Failed to fetch documents");

      const rawDocs: any[] = res.result?.documents || [];

      // Role-based client-side filter
      let filtered = rawDocs;
      if (userRole === "TEAM" && user?._id) {
        const uid = String(user._id);
        filtered = rawDocs.filter(d =>
          matchesUserId(d.createdBy, uid) || matchesUserId(d.assignedTo, uid) ||
          matchesUserId(d.assignedManager, uid) || matchesUserId(d.assignedUser, uid) ||
          matchesUserId(d.teamMember, uid)
        );
      } else if (userRole === "ASM" && user?._id) {
        const uid = String(user._id);
        filtered = rawDocs.filter(d =>
          matchesUserId(d.createdBy, uid) || matchesUserId(d.assignedManager, uid) ||
          matchesUserId(d.assignedTo, uid) || matchesUserId(d.assignedUser, uid) ||
          matchesUserId(d.areaManager, uid)
        );
      } else if (userRole === "ZSM" && user?._id) {
        const uid = String(user._id);
        filtered = rawDocs.filter(d =>
          matchesUserId(d.createdBy, uid) || matchesUserId(d.assignedManager, uid) ||
          matchesUserId(d.zoneManager, uid) || matchesUserId(d.assignedUser, uid)
        );
      }
      // Head_office sees all

      setDocuments(filtered);
      setSummary({
        totalDocuments:     filtered.length,
        submittedDocuments: filtered.filter(d => d.documentStatus?.toLowerCase() === "submitted").length,
        pendingDocuments:   filtered.filter(d => d.documentStatus?.toLowerCase() === "pending").length,
        rejectedDocuments:  filtered.filter(d => d.documentStatus?.toLowerCase() === "rejected").length,
      });
    } catch (e: any) {
      setError(e.message || "Network error");
      showToast(e.message || "Failed to fetch documents", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, fetchAPI, userRole, user, showToast]);

  useEffect(() => {
    if (hasAccess(userRole)) fetchData();
  }, [fetchData, userRole]);

  // ── Client-side filter + sort ──────────────
  const filtered = useMemo(() => {
    let list = [...documents];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        (d.firstName?.toLowerCase() || "").includes(q) ||
        (d.lastName?.toLowerCase()  || "").includes(q) ||
        (d.email?.toLowerCase()     || "").includes(q) ||
        (d.phone || "").includes(q)
      );
    }
    if (statusFilter !== "All")
      list = list.filter(d => (d.documentStatus?.toLowerCase() || "") === statusFilter.toLowerCase());
    if (leadStatusFilter !== "All")
      list = list.filter(d => (d.status || "") === leadStatusFilter);

    if (dateFilter.startDate && dateFilter.endDate) {
      const start = new Date(dateFilter.startDate); start.setHours(0,0,0,0);
      const end   = new Date(dateFilter.endDate);   end.setHours(23,59,59,999);
      list = list.filter(d => {
        const dd = d.documentSubmissionDate
          ? new Date(d.documentSubmissionDate)
          : d.createdAt ? new Date(d.createdAt) : null;
        return dd && dd >= start && dd <= end;
      });
    }

    if (sortConfig.key) {
      list.sort((a, b) => {
        let av = a[sortConfig.key], bv = b[sortConfig.key];
        if (["documentSubmissionDate","createdAt"].includes(sortConfig.key)) {
          av = av ? new Date(av) : new Date(0);
          bv = bv ? new Date(bv) : new Date(0);
        } else if (sortConfig.key === "firstName") {
          av = `${a.firstName||""} ${a.lastName||""}`.toLowerCase();
          bv = `${b.firstName||""} ${b.lastName||""}`.toLowerCase();
        } else if (sortConfig.key === "documentStatus") {
          av = getDocumentStatusConfig(a.documentStatus).order || 0;
          bv = getDocumentStatusConfig(b.documentStatus).order || 0;
        }
        if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
        if (av > bv) return sortConfig.direction === "asc" ?  1 : -1;
        return 0;
      });
    }
    return list;
  }, [documents, searchQuery, statusFilter, leadStatusFilter, dateFilter, sortConfig]);

  const paginated  = useMemo(() =>
    filtered.slice(page * DEFAULT_ITEMS_PER_PAGE, (page + 1) * DEFAULT_ITEMS_PER_PAGE),
    [filtered, page]
  );
  const totalPages = Math.ceil(filtered.length / DEFAULT_ITEMS_PER_PAGE);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchQuery)             c++;
    if (statusFilter !== "All")  c++;
    if (leadStatusFilter !== "All") c++;
    if (dateFilter.startDate)    c++;
    if (dateFilter.endDate)      c++;
    return c;
  }, [searchQuery, statusFilter, leadStatusFilter, dateFilter]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery(""); setStatusFilter("All");
    setLeadStatusFilter("All");
    setDateFilter({ startDate: null, endDate: null });
    setSortConfig({ key: "documentSubmissionDate", direction: "desc" });
    setPage(0);
  }, []);

  const handleViewDocument = useCallback((url: string, title = "Document") => {
    if (!url) { showToast("No document available", "error"); return; }
    setImgUrl(url); setImgTitle(title); setImgOpen(true);
  }, [showToast]);

  const summaryCards = useMemo(() => [
    { label: "Total Documents", value: summary.totalDocuments,     color: PRIMARY_COLOR, iconName: "description",    subText: "All submissions"         },
    { label: "Submitted",       value: summary.submittedDocuments,  color: "#10b981",     iconName: "check-circle",   subText: "Successfully submitted"  },
    { label: "Pending",         value: summary.pendingDocuments,    color: "#f59e0b",     iconName: "hourglass-empty",subText: "Awaiting verification"   },
    { label: "Rejected",        value: summary.rejectedDocuments,   color: "#ef4444",     iconName: "cancel",         subText: "Documents rejected"      },
  ], [summary]);

  // ── Access guard ──────────────────────────
  if (!hasAccess(userRole)) {
    return (
      <SafeAreaView style={misc.denied}>
        <Icon name="block" size={52} color="#ef4444" />
        <Text style={misc.deniedTitle}>Access Denied</Text>
        <Text style={misc.deniedSub}>You don't have permission to view this page.</Text>
      </SafeAreaView>
    );
  }

  if (loading && documents.length === 0) {
    return <SafeAreaView style={pg.container}><LoadingSkeleton /></SafeAreaView>;
  }

  if (error && documents.length === 0) {
    return (
      <SafeAreaView style={pg.container}>
        <View style={misc.errBox}>
          <Icon name="error-outline" size={52} color="#ef4444" />
          <Text style={misc.errTitle}>Failed to load</Text>
          <Text style={misc.errSub}>{error}</Text>
          <TouchableOpacity style={misc.retryBtn} onPress={() => fetchData()}>
            <Icon name="refresh" size={16} color={PRIMARY_COLOR} />
            <Text style={misc.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={pg.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

      {/* Toast */}
      <Toast
        visible={toast.visible} message={toast.message} severity={toast.severity}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Modals */}
      <ImageViewerModal open={imgOpen} onClose={() => setImgOpen(false)} imageUrl={imgUrl} title={imgTitle} />

      <ViewLeadModal
        open={viewOpen} onClose={() => setViewOpen(false)}
        lead={selDoc} userRole={userRole} onViewDocument={handleViewDocument}
      />

      <EditLeadModal
        open={editOpen} onClose={() => setEditOpen(false)}
        lead={selDoc}
        onSave={async () => fetchData()}
        showToast={showToast}
      />

      <LeadStatusUpdateModal
        open={statusOpen} onClose={() => setStatusOpen(false)}
        lead={selDoc}
        onStatusUpdate={async () => fetchData()}
        showToast={showToast}
      />

      <FilterBottomSheet
        open={filterOpen} onClose={() => setFilterOpen(false)}
        period={period} setPeriod={setPeriod}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        leadStatusFilter={leadStatusFilter} setLeadStatusFilter={setLeadStatusFilter}
        dateFilter={dateFilter} setDateFilter={setDateFilter}
        handleClearFilters={handleClearFilters}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        sortConfig={sortConfig} setSortConfig={setSortConfig}
        activeFilterCount={activeFilterCount}
      />

      <FlatList
        data={paginated}
        keyExtractor={item => item._id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[PRIMARY_COLOR]} tintColor={PRIMARY_COLOR}
          />
        }
        ListHeaderComponent={() => (
          <View>
            {/* ── Header banner ── */}
            <View style={pg.banner}>
              <View style={{ flex: 1 }}>
                <Text style={pg.bannerTitle}>Document Submission</Text>
                <Text style={pg.bannerSub}>Track and manage all document submissions</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={pg.iconBtn} onPress={() => setFilterOpen(true)}>
                  <View>
                    <Icon name="filter-alt" size={20} color="#fff" />
                    {activeFilterCount > 0 && (
                      <View style={pg.badgeDot}>
                        <Text style={pg.badgeTxt}>{activeFilterCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={pg.iconBtn} onPress={() => fetchData()} disabled={loading}>
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
            <View style={pg.cardGrid}>
              {summaryCards.map((c, i) => (
                <View key={i} style={{ width: (SCREEN_WIDTH - 44) / 2 }}>
                  <SummaryCard {...c} />
                </View>
              ))}
            </View>

            {/* ── Period tabs ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={pg.periodContent}>
              {PERIOD_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[pg.periodTab, period === opt.value && pg.periodTabActive]}
                  onPress={() => { setPeriod(opt.value); setPage(0); }}
                >
                  <Icon name="date-range" size={12}
                    color={period === opt.value ? "#fff" : "#555"} style={{ marginRight: 4 }} />
                  <Text style={[pg.periodTxt, period === opt.value && pg.periodTxtActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Search row ── */}
            <View style={pg.searchRow}>
              <View style={pg.searchBox}>
                <Icon name="search" size={17} color="#9ca3af" />
                <TextInput
                  style={pg.searchInput}
                  value={searchQuery}
                  onChangeText={t => { setSearchQuery(t); setPage(0); }}
                  placeholder="Search by name, email, phone…"
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery
                  ? <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Icon name="close" size={17} color="#9ca3af" />
                    </TouchableOpacity>
                  : null}
              </View>
              <TouchableOpacity style={pg.filterBtn} onPress={() => setFilterOpen(true)}>
                <Icon name="tune" size={20} color={PRIMARY_COLOR} />
                {activeFilterCount > 0 && (
                  <View style={pg.filterBadge}>
                    <Text style={pg.badgeTxt}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Active filter chips ── */}
            {activeFilterCount > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingHorizontal: 1, paddingBottom: 8 }}>
                {searchQuery && (
                  <TouchableOpacity style={pg.filterChip} onPress={() => setSearchQuery("")}>
                    <Text style={pg.filterChipTxt} numberOfLines={1}>Search: {searchQuery}</Text>
                    <Icon name="close" size={12} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                )}
                {statusFilter !== "All" && (
                  <TouchableOpacity style={pg.filterChip} onPress={() => setStatusFilter("All")}>
                    <Text style={pg.filterChipTxt}>Doc: {statusFilter}</Text>
                    <Icon name="close" size={12} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                )}
                {leadStatusFilter !== "All" && (
                  <TouchableOpacity style={pg.filterChip} onPress={() => setLeadStatusFilter("All")}>
                    <Text style={pg.filterChipTxt} numberOfLines={1}>Lead: {leadStatusFilter}</Text>
                    <Icon name="close" size={12} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[pg.filterChip, { borderColor: "#ef4444" }]}
                  onPress={handleClearFilters}
                >
                  <Text style={[pg.filterChipTxt, { color: "#ef4444" }]}>Clear All</Text>
                  <Icon name="clear" size={12} color="#ef4444" />
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* ── Results count ── */}
            <View style={pg.resultsRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="list" size={16} color={PRIMARY_COLOR} />
                <Text style={pg.resultsTxt}>
                  Document Submissions{" "}
                  <Text style={{ color: PRIMARY_COLOR }}>({filtered.length})</Text>
                </Text>
              </View>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={handleClearFilters}
                  style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Icon name="clear" size={13} color="#ef4444" />
                  <Text style={{ fontSize: 12, color: "#ef4444", fontWeight: "600" }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            onView={doc => { setSelDoc(doc); setViewOpen(true); }}
            onEdit={doc => { setSelDoc(doc); setEditOpen(true); }}
            onStatusUpdate={doc => { setSelDoc(doc); setStatusOpen(true); }}
            permissions={perms}
          />
        )}
        ListEmptyComponent={
          <EmptyState onClearFilters={handleClearFilters} hasFilters={activeFilterCount > 0} />
        }
        ListFooterComponent={() =>
          filtered.length > DEFAULT_ITEMS_PER_PAGE ? (
            <View style={pg.pagination}>
              <TouchableOpacity
                style={[pg.pageBtn, page === 0 && pg.pageBtnDis]}
                onPress={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <Icon name="chevron-left" size={22} color={page === 0 ? "#ccc" : "#fff"} />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="menu" size={14} color="#555" />
                <Text style={pg.pageInfo}>{page + 1} of {totalPages}</Text>
              </View>
              <TouchableOpacity
                style={[pg.pageBtn, page >= totalPages - 1 && pg.pageBtnDis]}
                onPress={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
              >
                <Icon name="chevron-right" size={22} color={page >= totalPages - 1 ? "#ccc" : "#fff"} />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Floating footer info */}
      <View style={pg.footerBar}>
        <Text style={pg.footerTxt}>
          Last updated: {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </Text>
        <Text style={pg.footerTxt}>
          {summary.totalDocuments} total • {summary.submittedDocuments} submitted
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

const u = StyleSheet.create({
  avatar: { backgroundColor: PRIMARY_COLOR, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "700" },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipSm: { paddingHorizontal: 8, paddingVertical: 3 },
  chipTxt: { fontSize: 12, fontWeight: "600" },
  chipTxtSm: { fontSize: 10 },
  toast: {
    position: "absolute", top: Platform.OS === "ios" ? 52 : 24,
    left: 14, right: 14, flexDirection: "row", alignItems: "center",
    gap: 8, padding: 13, borderRadius: 12, zIndex: 9999, elevation: 12,
  },
  toastTxt: { color: "#fff", fontSize: 13, fontWeight: "500", flex: 1 },
  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 5 },
  progressTrack: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", backgroundColor: PRIMARY_COLOR, borderRadius: 4 },
});

const sel_s = StyleSheet.create({
  trigger: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: "#fff",
  },
  triggerTxt: { fontSize: 14, color: "#1f2937", flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 20 },
  panel:   { backgroundColor: "#fff", borderRadius: 14, maxHeight: 320, overflow: "hidden", elevation: 10 },
  opt: {
    paddingHorizontal: 16, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  optActive: { backgroundColor: rgba(PRIMARY_COLOR, 0.07) },
  optTxt:   { fontSize: 14, color: "#374151" },
  optTxtActive: { color: PRIMARY_COLOR, fontWeight: "600" },
});

const sc = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 13,
    borderWidth: 1, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  row:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  iconWrap:{ width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  val:     { fontSize: 24, fontWeight: "800" },
  label:   { fontSize: 11, fontWeight: "600", color: "#1f2937" },
  sub:     { fontSize: 10, color: "#9ca3af", marginTop: 1 },
});

const fu = StyleSheet.create({
  label:    { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 7 },
  fileBox:  { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, backgroundColor: "#f9fafb" },
  thumb:    { width: 40, height: 40, borderRadius: 6, resizeMode: "cover" },
  fileName: { fontSize: 13, color: "#1f2937", fontWeight: "500" },
  fileSize: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  drop: {
    borderWidth: 2, borderColor: "#d1d5db", borderStyle: "dashed",
    borderRadius: 12, padding: 22, alignItems: "center", backgroundColor: "#f9fafb",
  },
  dropTxt:  { fontSize: 13, color: "#6b7280", marginTop: 7 },
  dropHint: { fontSize: 11, color: "#9ca3af", marginTop: 3 },
  errBorder:{ borderColor: "#ef4444" },
  errTxt:   { fontSize: 11, color: "#ef4444", marginTop: 3 },
});

const iv = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  title:  { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 10, color: "#1f2937" },
  btn:    { padding: 7, backgroundColor: "#f3f4f6", borderRadius: 8 },
  body:   { flex: 1, alignItems: "center", justifyContent: "center" },
  noPrev: { alignItems: "center", padding: 32 },
  noPrevTxt: { fontSize: 16, fontWeight: "600", color: "#9ca3af", marginTop: 12 },
  noPrevSub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
});

const dc = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: rgba(PRIMARY_COLOR, 0.12), elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  head:     { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  name:     { fontSize: 15, fontWeight: "700", color: PRIMARY_COLOR },
  id:       { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  expandBtn:{ padding: 6, backgroundColor: rgba(PRIMARY_COLOR, 0.08), borderRadius: 8 },
  infoRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  infoItem: { flexDirection: "row", alignItems: "center", flex: 1, gap: 4 },
  infoTxt:  { fontSize: 12, color: "#6b7280", flex: 1 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  expanded: { marginTop: 8, paddingTop: 4 },
  docGrid:  { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
  docCell:  { alignItems: "center", backgroundColor: rgba(PRIMARY_COLOR, 0.05), borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  docCellLbl: { fontSize: 10, color: "#9ca3af", marginBottom: 4 },
  actions:  { flexDirection: "row", gap: 8, marginTop: 10 },
  btnPri:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY_COLOR, paddingVertical: 10, borderRadius: 10, gap: 5 },
  btnPriTxt:{ color: "#fff", fontSize: 13, fontWeight: "600" },
  btnOut:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: PRIMARY_COLOR, paddingVertical: 10, borderRadius: 10, gap: 5 },
  btnOutTxt:{ color: PRIMARY_COLOR, fontSize: 13, fontWeight: "600" },
});

const fs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 28 : 12 },
  handle:  { width: 38, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, alignSelf: "center", marginTop: 10 },
  header:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: rgba(PRIMARY_COLOR, 0.1) },
  title:   { fontSize: 16, fontWeight: "700", color: PRIMARY_COLOR },
  sub:     { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  closeBtn:{ padding: 7, backgroundColor: rgba(PRIMARY_COLOR, 0.08), borderRadius: 8 },
  section: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, backgroundColor: "#fafbff" },
  secLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  secTitle:{ fontSize: 14, fontWeight: "600", color: "#333" },
  secBody: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8 },
  searchBox:  { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "#fff", gap: 7 },
  searchInput:{ flex: 1, fontSize: 13, color: "#1f2937", padding: 0 },
  periodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodBtn:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: PRIMARY_COLOR, width: "48%", justifyContent: "center" },
  periodBtnActive: { backgroundColor: PRIMARY_COLOR },
  periodTxt:  { fontSize: 13, color: PRIMARY_COLOR, fontWeight: "500" },
  periodTxtActive: { color: "#fff", fontWeight: "700" },
  sortBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: PRIMARY_COLOR, marginBottom: 6, backgroundColor: "#f5f6fa" },
  sortBtnActive: { backgroundColor: PRIMARY_COLOR },
  sortTxt:    { fontSize: 13, color: PRIMARY_COLOR, fontWeight: "500" },
  sortTxtActive: { color: "#fff", fontWeight: "600" },
  dateBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 9, padding: 10, backgroundColor: "#fff" },
  footer:   { flexDirection: "row", padding: 14, borderTopWidth: 1, borderTopColor: "#f0f0f0", gap: 10 },
  clearBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 12, gap: 5 },
  clearTxt: { color: PRIMARY_COLOR, fontWeight: "600", fontSize: 14 },
  applyBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 12, gap: 5 },
  applyTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const vm = StyleSheet.create({
  header: { backgroundColor: PRIMARY_COLOR, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  name:   { fontSize: 16, fontWeight: "700", color: "#fff" },
  sub:    { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  tabBar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tabBarContent: { paddingHorizontal: 6, alignItems: "center" },
  tab:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 5 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY_COLOR },
  tabTxt:    { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  tabTxtActive: { color: PRIMARY_COLOR, fontWeight: "700" },
  content: { padding: 14, paddingTop: 12, paddingBottom: 24 },
  card:   { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: rgba(PRIMARY_COLOR, 0.1) },
  cardTitle: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  cardTitleTxt: { fontSize: 14, fontWeight: "700", color: PRIMARY_COLOR },
  infoRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  infoLbl:  { fontSize: 13, color: "#6b7280", flex: 1 },
  infoVal:  { fontSize: 13, color: "#1f2937", fontWeight: "500", flex: 1, textAlign: "right" },
  sectionHeading: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 12 },
  docItem:  { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#eaeaea", marginBottom: 8, gap: 10, backgroundColor: "#fff" },
  docTitle: { flex: 1, fontSize: 13, fontWeight: "500", color: "#1f2937" },
  docViewBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: PRIMARY_COLOR, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, gap: 4 },
  docViewTxt: { fontSize: 12, color: PRIMARY_COLOR, fontWeight: "600" },
  emptyDocs:  { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#6b7280", marginTop: 10 },
  emptySub:   { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  notesTxt:   { fontSize: 14, color: "#333", lineHeight: 22 },
  notesEmpty: { fontSize: 14, color: "#aaa", fontStyle: "italic" },
  footer:   { padding: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  closeBtn: { backgroundColor: PRIMARY_COLOR, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  closeBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const em = StyleSheet.create({
  header:     { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: rgba(PRIMARY_COLOR, 0.04) },
  headerIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: rgba(PRIMARY_COLOR, 0.1), alignItems: "center", justifyContent: "center" },
  headerTitle:{ fontSize: 15, fontWeight: "700", color: "#1f2937" },
  headerSub:  { fontSize: 12, color: "#6b7280", marginTop: 1 },
  fieldLbl:   { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 7 },
  sectionTitle:{ fontSize: 14, fontWeight: "700", color: "#1f2937", marginBottom: 10 },
  errTxt:     { fontSize: 11, color: "#ef4444", marginTop: 4 },
  dateRow:    { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 11, backgroundColor: "#fff" },
  otherItem:  { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#eaeaea", borderRadius: 10, marginBottom: 8, gap: 8 },
  otherName:  { flex: 1, fontSize: 13, fontWeight: "500", color: "#1f2937" },
  addMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: PRIMARY_COLOR, borderStyle: "dashed", borderRadius: 10, padding: 14 },
  notesInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, fontSize: 14, color: "#1f2937", minHeight: 100, backgroundColor: "#fff" },
  footer:     { flexDirection: "row", padding: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb", gap: 10 },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  cancelTxt:  { color: PRIMARY_COLOR, fontWeight: "600", fontSize: 15 },
  submitBtn:  { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 13, gap: 7 },
  submitTxt:  { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const su = StyleSheet.create({
  sheet:  { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: Platform.OS === "ios" ? 28 : 14 },
  handle: { width: 38, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  headerIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: rgba(PRIMARY_COLOR, 0.1), alignItems: "center", justifyContent: "center" },
  title:  { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  sub:    { fontSize: 12, color: "#9ca3af" },
  lbl:    { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 7 },
  errBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef2f2", padding: 10, borderRadius: 9, marginBottom: 10 },
  footer: { flexDirection: "row", padding: 14, borderTopWidth: 1, borderTopColor: "#f0f0f0", gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelTxt: { color: PRIMARY_COLOR, fontWeight: "600", fontSize: 15 },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY_COLOR, borderRadius: 10, paddingVertical: 12, gap: 6 },
  submitDis: { backgroundColor: "#ccc" },
  submitTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const misc = StyleSheet.create({
  empty:      { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon:  { width: 96, height: 96, borderRadius: 48, backgroundColor: rgba(PRIMARY_COLOR, 0.1), alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 6 },
  emptySub:   { fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 18 },
  clearBtn:   { flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9, gap: 6 },
  clearTxt:   { color: "#fff", fontWeight: "600", fontSize: 13 },
  denied:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  deniedTitle:{ fontSize: 20, fontWeight: "700", color: "#ef4444", marginTop: 12 },
  deniedSub:  { fontSize: 13, color: "#9ca3af", textAlign: "center", marginTop: 6 },
  errBox:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  errTitle:   { fontSize: 16, fontWeight: "700", color: "#ef4444", marginTop: 10 },
  errSub:     { fontSize: 13, color: "#9ca3af", textAlign: "center", marginTop: 4 },
  retryBtn:   { flexDirection: "row", alignItems: "center", marginTop: 14, borderWidth: 1, borderColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9, gap: 6 },
  retryTxt:   { color: PRIMARY_COLOR, fontWeight: "600" },
});

const pg = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  banner:    { flexDirection: "row", alignItems: "center", padding: 18, paddingTop: 20, backgroundColor: PRIMARY_COLOR, marginHorizontal: -14, marginBottom: 14 },
  bannerTitle:{ fontSize: 18, fontWeight: "800", color: "#fff" },
  bannerSub:  { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  iconBtn:    { padding: 9, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 9 },
  badgeDot:   { position: "absolute", top: -5, right: -5, backgroundColor: "#ef4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  badgeTxt:   { fontSize: 9, color: "#fff", fontWeight: "700" },
  cardGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  periodContent: { paddingVertical: 8, gap: 8 },
  periodTab:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#e0e4f8", backgroundColor: "#f5f6fa" },
  periodTabActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  periodTxt:  { fontSize: 12, color: "#555", fontWeight: "500" },
  periodTxtActive: { color: "#fff", fontWeight: "700" },
  searchRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  searchBox:  { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "#fff", gap: 7 },
  searchInput:{ flex: 1, fontSize: 13, color: "#1f2937", padding: 0 },
  filterBtn:  { padding: 11, backgroundColor: rgba(PRIMARY_COLOR, 0.08), borderRadius: 10, borderWidth: 1, borderColor: rgba(PRIMARY_COLOR, 0.2), position: "relative" },
  filterBadge:{ position: "absolute", top: -4, right: -4, backgroundColor: "#ef4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  filterChip: { flexDirection: "row", alignItems: "center", backgroundColor: rgba(PRIMARY_COLOR, 0.07), borderWidth: 1, borderColor: rgba(PRIMARY_COLOR, 0.2), paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4 },
  filterChipTxt: { fontSize: 11, color: PRIMARY_COLOR, fontWeight: "500", maxWidth: 120 },
  resultsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  resultsTxt: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, gap: 18 },
  pageBtn:    { padding: 8, backgroundColor: PRIMARY_COLOR, borderRadius: 9 },
  pageBtnDis: { backgroundColor: "#e5e7eb" },
  pageInfo:   { fontSize: 14, color: "#374151", fontWeight: "500" },
  footerBar:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  footerTxt:  { fontSize: 11, color: "#9ca3af" },
});
