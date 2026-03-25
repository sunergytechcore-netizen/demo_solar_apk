import React, {useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import VIcon from './VIcon';
import {MENU_ITEMS} from '../data';

const {width} = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.78;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  activeItem: string;
  onSelectItem: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  visible,
  onClose,
  activeItem,
  onSelectItem,
}) => {
  const translateX     = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {toValue: 0, useNativeDriver: true, tension: 65, friction: 11}),
        Animated.timing(overlayOpacity, {toValue: 1, duration: 250, useNativeDriver: true}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true}),
        Animated.timing(overlayOpacity, {toValue: 0, duration: 220, useNativeDriver: true}),
      ]).start();
    }
  }, [visible]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, {opacity: overlayOpacity}]} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View style={[styles.drawer, {transform: [{translateX}]}]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logo}>
              <MaterialCommunityIcons name="solar-power" size={22} color="#fff" />
            </View>
            <View style={{marginLeft: 12}}>
              <Text style={styles.title}>SunergyTech</Text>
              <Text style={styles.subtitle}>Solar Management</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
          {MENU_ITEMS.map(item => {
            const isActive = activeItem === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => { onSelectItem(item.id); onClose(); }}
                activeOpacity={0.75}>
                <View style={styles.menuItemInner}>
                  <VIcon
                    lib={item.lib}
                    name={item.icon}
                    size={20}
                    color={isActive ? '#fff' : 'rgba(255,255,255,0.75)'}
                  />
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerAvatar}>
            <Text style={styles.footerAvatarText}>ST</Text>
          </View>
          <View style={{flex: 1, marginLeft: 10}}>
            <Text style={styles.footerName}>Sunergy tech</Text>
            <Text style={styles.footerVersion}>v2.2.0</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

export default Sidebar;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#3b5bdb',
    zIndex: 100,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  logoRow:  {flexDirection: 'row', alignItems: 'center'},
  logo: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    {color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3},
  subtitle: {color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1},
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  menu:          {flex: 1, paddingTop: 10, paddingHorizontal: 12},
  menuItem:      {borderRadius: 10, marginBottom: 4},
  menuItemActive:{backgroundColor: 'rgba(255,255,255,0.2)'},
  menuItemInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14, gap: 14,
  },
  menuLabel:       {color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500'},
  menuLabelActive: {color: '#fff', fontWeight: '700'},
  footer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  footerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  footerAvatarText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  footerName:       {color: '#fff', fontSize: 13, fontWeight: '700'},
  footerVersion:    {color: 'rgba(255,255,255,0.6)', fontSize: 11},
  logoutBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
});