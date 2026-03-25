import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface PlaceholderScreenProps {
  title: string;
}

const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({title}) => (
  <View style={styles.wrap}>
    <Text style={styles.text}>{title}</Text>
  </View>
);

export default PlaceholderScreen;

const styles = StyleSheet.create({
  wrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  text: {fontSize: 22, fontWeight: '700', color: '#3b5bdb'},
});