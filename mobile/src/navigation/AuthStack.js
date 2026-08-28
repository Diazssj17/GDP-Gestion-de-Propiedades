import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../theme/ThemeContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RecuperarScreen from '../screens/RecuperarScreen';

const Stack = createStackNavigator();

export default function AuthStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Registro" component={RegisterScreen} options={{ title: '' }} />
      <Stack.Screen name="Recuperar" component={RecuperarScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
