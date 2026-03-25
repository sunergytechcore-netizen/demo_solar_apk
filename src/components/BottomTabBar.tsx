import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import VIcon from './VIcon';
import {BOTTOM_TABS} from '../data';

interface BottomTabBarProps {
  activeTab: string;
  onTabPress: (id: string) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({activeTab, onTabPress}) => (
  <View style={styles.bar}>
    {BOTTOM_TABS.map(tab => {
      const isActive = activeTab === tab.id;
      return (
        <TouchableOpacity
          key={tab.id}
          style={styles.item}
          onPress={() => onTabPress(tab.id)}>
          <View>
            <VIcon
              lib={tab.lib}
              name={tab.icon}
              size={22}
              color={isActive ? '#3b5bdb' : '#888'}
            />
            {tab.id === 'actions' && <View style={styles.dot} />}
          </View>
          <Text style={[styles.label, isActive && styles.labelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default BottomTabBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef1ff',
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  label:       {fontSize: 10, color: '#888', marginTop: 2},
  labelActive: {color: '#3b5bdb', fontWeight: '600'},
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3b5bdb',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});