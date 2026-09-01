import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthStack from './src/navigation/AuthStack';
import BlockedScreen from './src/screens/BlockedScreen';

function Root() {
  const { theme, isDark } = useTheme();
  const { user, plan, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}><ActivityIndicator size="large" color={theme.colors.accent} /></View>;
  }
  const bloqueada = user?.rol === 'propietario' && plan?.bloqueada === 1;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {user ? (bloqueada ? <BlockedScreen /> : <AppNavigator />) : <AuthStack />}
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
