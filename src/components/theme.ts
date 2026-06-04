// Shared palette. WCAG-AA contrast, warm low-stimulation light theme plus a
// true dark theme. Used across the tracker screens.

import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  card: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  accentText: string;
  doneBg: string;
  warnBg: string;
  warnText: string;
  redBg: string;
  redText: string;
  okBg: string;
  okText: string;
}

export const LIGHT: Palette = {
  bg: '#FBF7F0',
  card: '#FFFFFF',
  text: '#2A2622',
  sub: '#6E665C',
  line: '#E7DFD3',
  accent: '#155656',
  accentText: '#FFFFFF',
  doneBg: '#E2EFEF',
  warnBg: '#F6E8CC',
  warnText: '#7A4A00',
  redBg: '#F6E0DB',
  redText: '#9A2A16',
  okBg: '#E4F2E9',
  okText: '#1F5E40',
};

export const DARK: Palette = {
  bg: '#0E1413',
  card: '#16201F',
  text: '#ECEDEE',
  sub: '#9BA9A6',
  line: '#26302E',
  accent: '#4FB7B0',
  accentText: '#04201E',
  doneBg: '#13302E',
  warnBg: '#3A2E12',
  warnText: '#F2CE84',
  redBg: '#3A1A14',
  redText: '#F0A593',
  okBg: '#13301F',
  okText: '#7FD3A2',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
