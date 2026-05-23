// src/theme/colors.ts
import { Theme } from '../types';

export const lightTheme: Theme = {
  primary: '#2E6B62',
  primaryLight: '#D7E8E3',
  background: '#F3F1EC',
  surface: '#FFFEFB',
  text: '#1F2A37',
  textSecondary: '#6B7280',
  border: '#D8DDD7',
  success: '#2F855A',
  successBackground: '#E8F6EE',
  shadow: '#111827',
  error: '#C25555',
};

export const darkTheme: Theme = {
  primary: '#8FC7BC',
  primaryLight: '#395D56',
  background: '#0E1618',
  surface: '#172226',
  text: '#EDF3F5',
  textSecondary: '#B8C6CB',
  border: '#2B3B3F',
  success: '#6DD59F',
  successBackground: '#173428',
  shadow: '#000000',
  error: '#F08C8C',
};

export const colors: Theme = lightTheme;
