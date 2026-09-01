import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import HeaderRight from '../components/HeaderRight';

import DashboardScreen from '../screens/DashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import PropiedadesScreen from '../screens/PropiedadesScreen';
import UnidadesScreen from '../screens/UnidadesScreen';
import InquilinosScreen from '../screens/InquilinosScreen';
import ContratosScreen from '../screens/ContratosScreen';
import NuevoContratoScreen from '../screens/NuevoContratoScreen';
import PagosScreen from '../screens/PagosScreen';
import NuevoPagoScreen from '../screens/NuevoPagoScreen';
import ServiciosScreen from '../screens/ServiciosScreen';
import NuevoReciboScreen from '../screens/NuevoReciboScreen';
import MantenimientoScreen from '../screens/MantenimientoScreen';
import NuevoMantenimientoScreen from '../screens/NuevoMantenimientoScreen';
import PropietariosScreen from '../screens/PropietariosScreen';
import PropietarioAnalisisScreen from '../screens/PropietarioAnalisisScreen';
import PlanesScreen from '../screens/PlanesScreen';
import SuscripcionScreen from '../screens/SuscripcionScreen';
import AlertasScreen from '../screens/AlertasScreen';
import { usePushNotifications } from '../notifications/usePushNotifications';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

const cardHeader = (theme) => ({ headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight />, headerTitle: '' });

function PropiedadesStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PropiedadesList" component={PropiedadesScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
      <Stack.Screen name="Unidades" component={UnidadesScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}

function PropietariosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PropietariosList" component={PropietariosScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
      <Stack.Screen name="Analisis" component={PropietarioAnalisisScreen} options={{ title: 'Análisis', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}

// Stacks de cada modulo (usados como pestanas directas para el inquilino)
function ContratosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="ContratosList" component={ContratosScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoContrato" component={NuevoContratoScreen} options={{ title: 'Nuevo contrato', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
function PagosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PagosList" component={PagosScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoPago" component={NuevoPagoScreen} options={{ title: 'Nuevo pago', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
function ServiciosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="ServiciosList" component={ServiciosScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoRecibo" component={NuevoReciboScreen} options={{ title: 'Nuevo recibo', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
function MantenimientoStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="MantenimientoList" component={MantenimientoScreen} options={{ headerTitle: '', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoMantenimiento" component={NuevoMantenimientoScreen} options={{ title: 'Nuevo ticket', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
export default function AppNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const rol = user?.rol;
  usePushNotifications();
  const navTheme = { ...(theme.dark ? DarkTheme : DefaultTheme), colors: { ...(theme.dark ? DarkTheme : DefaultTheme).colors, primary: theme.colors.accent, background: theme.colors.background, card: theme.colors.card, text: theme.colors.text, border: theme.colors.border } };

  const iconMap = {
    Inicio: 'home',
    Propiedades: 'business',
    Inquilinos: 'people',
    Contratos: 'document-text',
    Pagos: 'cash',
    Servicios: 'water',
    Mantenimiento: 'construct',
    Plan: 'card',
    Panel: 'speedometer',
    Propietarios: 'people-circle',
    Planes: 'pricetags',
  };

  const screenOptions = ({ route }) => {
    return {
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarIcon: ({ focused, color, size }) => (
        <Ionicons name={iconMap[route.name] || 'ellipse'} size={24} color={color} />
      ),
      headerRight: () => <HeaderRight />,
      headerStyle: { backgroundColor: theme.colors.card },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontWeight: '700' },
    };
  };

  // Tabs segun rol
  let tabs;
  if (rol === 'superadmin') {
    tabs = (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Panel" component={AdminDashboardScreen} options={{ headerTitle: '' }} />
        <Tab.Screen name="Propietarios" component={PropietariosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Planes" component={PlanesScreen} options={{ headerTitle: '' }} />
      </Tab.Navigator>
    );
  } else if (rol === 'inquilino') {
    tabs = (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Contratos" component={ContratosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Pagos" component={PagosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Servicios" component={ServiciosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Mantenimiento" component={MantenimientoStack} options={{ headerShown: false }} />
      </Tab.Navigator>
    );
  } else {
    tabs = (
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Inicio" component={DashboardScreen} options={{ headerTitle: '' }} />
        <Tab.Screen name="Propiedades" component={PropiedadesStack} options={{ headerShown: false }} />
        <Tab.Screen name="Inquilinos" component={InquilinosScreen} options={{ headerTitle: '' }} />
        <Tab.Screen name="Contratos" component={ContratosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Pagos" component={PagosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Servicios" component={ServiciosStack} options={{ headerShown: false }} />
        <Tab.Screen name="Mantenimiento" component={MantenimientoStack} options={{ headerShown: false }} />
        <Tab.Screen name="Plan" component={SuscripcionScreen} options={{ headerTitle: '' }} />
      </Tab.Navigator>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={() => tabs} />
        <RootStack.Screen name="Alertas" component={AlertasScreen} options={{ headerShown: true, title: 'Notificaciones', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight /> }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
