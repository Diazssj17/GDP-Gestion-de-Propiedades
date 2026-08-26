import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import HeaderRight from '../components/HeaderRight';

import DashboardScreen from '../screens/DashboardScreen';
import PropiedadesScreen from '../screens/PropiedadesScreen';
import UnidadesScreen from '../screens/UnidadesScreen';
import ContratosScreen from '../screens/ContratosScreen';
import NuevoContratoScreen from '../screens/NuevoContratoScreen';
import PagosScreen from '../screens/PagosScreen';
import NuevoPagoScreen from '../screens/NuevoPagoScreen';
import ServiciosScreen from '../screens/ServiciosScreen';
import NuevoReciboScreen from '../screens/NuevoReciboScreen';
import MantenimientoScreen from '../screens/MantenimientoScreen';
import NuevoMantenimientoScreen from '../screens/NuevoMantenimientoScreen';
import InquilinosScreen from '../screens/InquilinosScreen';

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

function ServiciosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="ServiciosList" component={ServiciosScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NuevoRecibo" component={NuevoReciboScreen} options={{ title: 'Nuevo recibo', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight /> }} />
    </Stack.Navigator>
  );
}

function ContratosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="ContratosList" component={ContratosScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NuevoContrato" component={NuevoContratoScreen} options={{ title: 'Nuevo contrato', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight /> }} />
    </Stack.Navigator>
  );
}

function PagosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PagosList" component={PagosScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NuevoPago" component={NuevoPagoScreen} options={{ title: 'Nuevo pago', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight /> }} />
    </Stack.Navigator>
  );
}

function MantenimientoStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="MantenimientoList" component={MantenimientoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NuevoMantenimiento" component={NuevoMantenimientoScreen} options={{ title: 'Nuevo ticket', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight /> }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const esInquilino = user?.rol === 'inquilino';
  const navTheme = { ...(theme.dark ? DarkTheme : DefaultTheme), colors: { ...(theme.dark ? DarkTheme : DefaultTheme).colors, primary: theme.colors.accent, background: theme.colors.background, card: theme.colors.card, text: theme.colors.text, border: theme.colors.border } };

  const screenOptions = ({ route }) => ({
    tabBarIcon: ({ color, size }) => {
      const map = { Dashboard: 'analytics', Propiedades: 'business', Inquilinos: 'people', Contratos: 'document-text', Pagos: 'cash', Servicios: 'water', Mantenimiento: 'construct' };
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
        {!esInquilino && <Tab.Screen name="Inquilinos" component={InquilinosScreen} />}
        <Tab.Screen name="Contratos" component={ContratosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Pagos" component={PagosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Servicios" component={ServiciosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Mantenimiento" component={MantenimientoStack} options={{ headerShown: false }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
