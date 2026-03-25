import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const MissedLeadsEmpty: React.FC = () => (
  <View style={styles.wrap}>
    <View style={styles.iconCircle}>
      <MaterialCommunityIcons name="check-circle" size={34} color="#fff" />
    </View>
    <Text style={styles.title}>No Missed Leads</Text>
    <Text style={styles.subtitle}>Great job! No missed leads to show.</Text>
    <TouchableOpacity style={styles.btn} activeOpacity={0.8}>
      <Text style={styles.btnText}>View All</Text>
    </TouchableOpacity>
  </View>
);

export default MissedLeadsEmpty;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title:    {fontSize: 17, fontWeight: '700', color: '#1a1a3e', marginBottom: 6},
  subtitle: {fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20},
  btn: {
    backgroundColor: '#ff9800',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  btnText: {color: '#fff', fontSize: 14, fontWeight: '700'},
});