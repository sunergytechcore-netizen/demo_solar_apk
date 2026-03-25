export type ChangeType = 'up' | 'down' | 'neutral';
export type IconLib = 'mci' | 'ion';

export interface StatCardData {
  value: number;
  label: string;
  change: string;
  changeType: ChangeType;
  subLabel?: string;
  suffix?: string;
  prefix?: string;
  iconName: string;
  iconLib: IconLib;
}

export interface PersonData {
  id: string;
  name: string;
  phone: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  lib: string;
}

export interface BottomTab {
  id: string;
  label: string;
  icon: string;
  lib: string;
}