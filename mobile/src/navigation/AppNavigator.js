import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeContext';
import HeaderRight from '../components/HeaderRight';

import DashboardScreen from '../screens/DashboardScreen';
import PropiedadesScreen from '../screens/PropiedadesScreen';
import UnidadesScreen from '../screens/UnidadesScreen';
import ContratosScreen from '../screens/ContratosScreen';
import PagosScreen from '../screens/PagosScreen';
import ServiciosScreen from '../screens/ServiciosScreen';
import MantenimientoScreen from '../screens/MantenimientoScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PropiedadesStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PropiedadesList" component={PropiedadesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Unidades" component={UnidadesScreen} options={{ title: 'Unidades', headerRight: () => <HeaderRight />, headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const navTheme = { ...(theme.dark ? DarkTheme : DefaultTheme), colors: { ...(theme.dark ? DarkTheme : DefaultTheme).colors, primary: theme.colors.accent, background: theme.colors.background, card: theme.colors.card, text: theme.colors.text, border: theme.colors.border } };

  const screenOptions = ({ route }) => ({
    tabBarIcon: ({ color, size }) => {
      const map = { Dashboard: 'analytics', Propiedades: 'business', Contratos: 'document-text', Pagos: 'cash', Servicios: 'water', Mantenimiento: 'construct' };
      return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
    },
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.colors.textMuted,
    headerRight: () => <HeaderRight />,
    headerStyle: { backgroundColor: theme.colors.card },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { fontWeight: '700' },
    tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
  });

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Propiedades" component={PropiedadesStack} options={{ headerShown: false }} />
        <Tab.Screen name="Contratos" component={ContratosScreen} />
        <Tab.Screen name="Pagos" component={PagosScreen} />
        <Tab.Screen name="Servicios" component={ServiciosScreen} />
        <Tab.Screen name="Mantenimiento" component={MantenimientoScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
