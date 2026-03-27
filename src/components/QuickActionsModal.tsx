
import React, {useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const {height} = Dimensions.get('window');

const QUICK_ACTIONS = [
  {id: 'newVisit',      label: 'New Visit',    icon: 'eye-outline'},
  {id: 'registration',  label: 'Registration', icon: 'account-plus-outline'},
  {id: 'bankLoan',      label: 'Bank Loan',    icon: 'bank-outline'},
  {id: 'document',      label: 'Document',     icon: 'file-document-outline'},
];

interface QuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onActionPress?: (id: string) => void;
}

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  visible,
  onClose,
  onActionPress,
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 12,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 220,
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
      {/* Dark backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, {opacity: bgOpacity}]} />
      </TouchableWithoutFeedback>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.sheet, {transform: [{translateY: slideAnim}]}]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={20} color="#333" />
          </TouchableOpacity>
        </View>

        {/* 2x2 Grid */}
        <View style={styles.grid}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              activeOpacity={0.75}
              onPress={() => {
                onActionPress?.(action.id);
                onClose();
              }}>
              <MaterialCommunityIcons
                name={action.icon}
                size={32}
                color="#3b5bdb"
              />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
};

export default QuickActionsModal;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b5bdb',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#f0f4ff',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionLabel: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
});