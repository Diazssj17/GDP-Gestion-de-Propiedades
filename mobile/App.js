import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthStack from './src/navigation/AuthStack';

function Root() {
  const { theme, isDark } = useTheme();
  const { user, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}><ActivityIndicator size="large" color={theme.colors.accent} /></View>;
  }
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {user ? <AppNavigator /> : <AuthStack />}
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
