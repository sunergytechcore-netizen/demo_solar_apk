import React, {useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface ProfileDropdownProps {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
  user?: {
    name: string;
    role: string;
    email: string;
    initials: string;
  };
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  visible,
  onClose,
  onLogout,
  user = {
    name: 'narayan reedy',
    role: 'Field Executive',
    email: 'reddy@gmail.com',
    initials: 'NR',
  },
}) => {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Invisible backdrop — tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Dropdown card — top-right below the avatar */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: opacityAnim,
            transform: [{scale: scaleAnim}],
          },
        ]}>
        {/* User info row */}
        <View style={styles.userRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user.initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{user.role}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutRow}
          activeOpacity={0.7}
          onPress={() => {
            onClose();
            onLogout?.();
          }}>
          <MaterialCommunityIcons name="logout" size={20} color="#e03131" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

export default ProfileDropdown;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    top: 64,          // just below the top bar
    right: 12,
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.14,
    shadowRadius: 12,
    // scale origin = top-right
    transformOrigin: 'top right',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b5bdb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo:  {flex: 1},
  userName:  {fontSize: 15, fontWeight: '700', color: '#1a1a3e'},
  userRole:  {fontSize: 12, color: '#555', marginTop: 2},
  userEmail: {fontSize: 11, color: '#888', marginTop: 2},

  divider: {
    height: 1,
    backgroundColor: '#eef1ff',
    marginBottom: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e03131',
  },
});