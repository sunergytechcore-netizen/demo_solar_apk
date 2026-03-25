import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import VIcon from './VIcon';
import {StatCardData} from '../types';

const StatCard: React.FC<StatCardData> = ({
  value,
  label,
  change,
  changeType,
  subLabel,
  suffix,
  prefix,
  iconName,
  iconLib,
}) => {
  const arrowIcon =
    changeType === 'up'
      ? 'arrow-up-thin'
      : changeType === 'down'
      ? 'arrow-down-thin'
      : 'arrow-right-thin';

  const changeColor =
    changeType === 'up' ? '#2f9e44' : changeType === 'down' ? '#e03131' : '#888';

  return (
    <View style={styles.card}>
      {/* Top: value + icon */}
      <View style={styles.topRow}>
        <Text style={styles.value}>
          {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
          {value}
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </Text>
        <View style={styles.iconWrap}>
          <VIcon lib={iconLib} name={iconName} size={22} color="#3b5bdb" />
        </View>
      </View>

      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Bottom: change % + today/subLabel */}
      <View style={styles.bottomRow}>
        <View style={styles.changeRow}>
          <MaterialCommunityIcons name={arrowIcon} size={13} color={changeColor} />
          <Text style={[styles.change, {color: changeColor}]}> {change}</Text>
        </View>
        <Text style={styles.subLabel}>{subLabel ?? 'Today'}</Text>
      </View>
    </View>
  );
};

export default StatCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    width: 185,
    minHeight: 110,
    justifyContent: 'space-between',
    shadowColor: '#3b5bdb',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: '#3b5bdb',
    lineHeight: 30,
  },
  prefix: {fontSize: 20, fontWeight: '700', color: '#3b5bdb'},
  suffix: {fontSize: 18, fontWeight: '700', color: '#3b5bdb'},
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeRow: {flexDirection: 'row', alignItems: 'center'},
  change:    {fontSize: 12, fontWeight: '600'},
  subLabel:  {fontSize: 11, color: '#aaa'},
});