import React, {useRef, useState} from 'react';
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

const TIME_PERIODS = [
  {id: 'today',   label: 'Today',   icon: 'calendar-today'},
  {id: 'weekly',  label: 'Weekly',  icon: 'calendar-week'},
  {id: 'monthly', label: 'Monthly', icon: 'calendar-month'},
  {id: 'yearly',  label: 'Yearly',  icon: 'clock-outline'},
];

interface TimePeriodModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect?: (id: string) => void;
  selected?: string;
}

const TimePeriodModal: React.FC<TimePeriodModalProps> = ({
  visible,
  onClose,
  onSelect,
  selected = 'today',
}) => {
  const slideAnim   = useRef(new Animated.Value(height)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;

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

      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, {opacity: bgOpacity}]} />
      </TouchableWithoutFeedback>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, {transform: [{translateY: slideAnim}]}]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Time Period</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={20} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsList}>
          {TIME_PERIODS.map((period, index) => {
            const isActive = selected === period.id;
            const isLast   = index === TIME_PERIODS.length - 1;
            return (
              <React.Fragment key={period.id}>
                <TouchableOpacity
                  style={[styles.optionRow, isActive && styles.optionRowActive]}
                  activeOpacity={0.75}
                  onPress={() => {
                    onSelect?.(period.id);
                    onClose();
                  }}>
                  <MaterialCommunityIcons
                    name={period.icon}
                    size={22}
                    color={isActive ? '#3b5bdb' : '#555'}
                  />
                  <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
                {/* Divider between rows (not after last) */}
                {!isLast && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
};

export default TimePeriodModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
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
    paddingTop: 24,
    paddingBottom: 40,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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

  // Options
  optionsList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eef1ff',
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
  },
  optionRowActive: {
    backgroundColor: '#eef1ff',
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  optionLabelActive: {
    color: '#3b5bdb',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#eef1ff',
    marginHorizontal: 18,
  },
});