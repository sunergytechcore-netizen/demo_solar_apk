import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface TopBarProps {
  onMenuPress:    () => void;
  onSearchPress:  () => void;
  onProfilePress: () => void;
  initials?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  onMenuPress,
  onSearchPress,
  onProfilePress,
  initials = 'RS',
}) => (
  <>
    <View style={styles.topBar}>
      {/* ☰ Hamburger */}
      <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
        <MaterialCommunityIcons name="menu" size={28} color="#3b5bdb" />
      </TouchableOpacity>

      <View style={styles.right}>
        {/* 🔍 Search */}
        <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress}>
          <Ionicons name="search-outline" size={22} color="#333" />
        </TouchableOpacity>

        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatar}
          onPress={onProfilePress}
          activeOpacity={0.8}>
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
    <View style={styles.blueLine} />
  </>
);

export default TopBar;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#f0f4ff',
  },
  menuBtn:  {padding: 4},
  iconBtn:  {padding: 4},
  right:    {flexDirection: 'row', alignItems: 'center', gap: 14},
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b5bdb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  blueLine:   {height: 3, backgroundColor: '#3b5bdb'},
});