import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface RowProps {
  name: string;
  phone: string;
}

// ─── Visit Row ────────────────────────────────────────────────────────────────
export const VisitRow: React.FC<RowProps> = ({name, phone}) => (
  <View style={styles.row}>
    <View style={{flex: 1}}>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.phoneRow}>
        <MaterialCommunityIcons name="phone" size={12} color="#888" />
        <Text style={styles.phone}>  {phone}</Text>
      </View>
    </View>
    <View style={styles.completedBadge}>
      <Text style={styles.completedText}>Completed</Text>
    </View>
  </View>
);

// ─── Registration Row ─────────────────────────────────────────────────────────
export const RegistrationRow: React.FC<RowProps> = ({name, phone}) => (
  <View style={styles.row}>
    <View style={{flex: 1}}>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.phoneRow}>
        <MaterialCommunityIcons name="phone" size={12} color="#888" />
        <Text style={styles.phone}>  {phone}</Text>
      </View>
    </View>
    <View style={styles.registeredBadge}>
      <Text style={styles.registeredText}>Registered</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef1ff',
  },
  name:     {fontSize: 14, fontWeight: '700', color: '#2b3a8c'},
  phoneRow: {flexDirection: 'row', alignItems: 'center', marginTop: 3},
  phone:    {fontSize: 12, color: '#666'},

  completedBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedText: {fontSize: 11, color: '#555', fontWeight: '500'},

  registeredBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  registeredText: {fontSize: 11, color: '#2e7d32', fontWeight: '600'},
});