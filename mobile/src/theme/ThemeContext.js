import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { light, dark } from '../theme';

const ThemeContext = createContext({ theme: light, isDark: false, toggle: () => {}, setDark: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setMode] = useState(null); // 'light' | 'dark' | null(auto)
  const isDark = mode ? mode === 'dark' : system === 'dark';
  const theme = isDark ? dark : light;

  useEffect(() => {
    SecureStore.getItemAsync('gdp_theme').then(v => setMode(v === 'dark' || v === 'light' ? v : null));
  }, []);

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    setMode(next);
    SecureStore.setItemAsync('gdp_theme', next);
  };
  const setDark = (v) => {
    const m = v ? 'dark' : 'light';
    setMode(m);
    SecureStore.setItemAsync('gdp_theme', m);
  };

  const value = useMemo(() => ({ theme, isDark, toggle, setDark }), [theme, isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
