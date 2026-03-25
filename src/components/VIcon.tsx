import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface VIconProps {
  lib: string;
  name: string;
  size?: number;
  color?: string;
}

const VIcon: React.FC<VIconProps> = ({lib, name, size = 20, color = '#fff'}) => {
  if (lib === 'ion') {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
};

export default VIcon;