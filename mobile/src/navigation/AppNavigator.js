import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import HeaderRight from '../components/HeaderRight';
import ScrollableTabBar from '../components/ScrollableTabBar';

import DashboardScreen from '../screens/DashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import PropiedadesScreen from '../screens/PropiedadesScreen';
import UnidadesScreen from '../screens/UnidadesScreen';
import InquilinosScreen from '../screens/InquilinosScreen';
import MasMenuScreen from '../screens/MasMenuScreen';
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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

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
// Stack agrupado tras la pestana 'Mas' (para propietario/superadmin)
function MasStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="Menu" component={MasMenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Contratos" component={ContratosScreen} options={{ title: 'Contratos', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoContrato" component={NuevoContratoScreen} options={{ title: 'Nuevo contrato', ...cardHeader(theme) }} />
      <Stack.Screen name="Pagos" component={PagosScreen} options={{ title: 'Pagos', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoPago" component={NuevoPagoScreen} options={{ title: 'Nuevo pago', ...cardHeader(theme) }} />
      <Stack.Screen name="Servicios" component={ServiciosScreen} options={{ title: 'Servicios', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoRecibo" component={NuevoReciboScreen} options={{ title: 'Nuevo recibo', ...cardHeader(theme) }} />
      <Stack.Screen name="Mantenimiento" component={MantenimientoScreen} options={{ title: 'Mantenimiento', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoMantenimiento" component={NuevoMantenimientoScreen} options={{ title: 'Nuevo ticket', ...cardHeader(theme) }} />
      <Stack.Screen name="Inquilinos" component={InquilinosScreen} options={{ title: 'Inquilinos', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const rol = user?.rol;
  const navTheme = { ...(theme.dark ? DarkTheme : DefaultTheme), colors: { ...(theme.dark ? DarkTheme : DefaultTheme).colors, primary: theme.colors.accent, background: theme.colors.background, card: theme.colors.card, text: theme.colors.text, border: theme.colors.border } };

  const screenOptions = ({ route }) => ({
    tabBar: (props) => <ScrollableTabBar {...props} />,
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.colors.textMuted,
    headerRight: () => <HeaderRight />,
    headerStyle: { backgroundColor: theme.colors.card },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { fontWeight: '700' },
  });

  // Superadmin: enfocado en administracion
  if (rol === 'superadmin') {
    return (
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator screenOptions={screenOptions}>
          <Tab.Screen name="Panel" component={AdminDashboardScreen} options={{ headerTitle: '' }} />
          <Tab.Screen name="Propietarios" component={PropietariosStack} options={{ headerShown: false }} />
          <Tab.Screen name="Planes" component={PlanesScreen} options={{ headerTitle: '' }} />
        </Tab.Navigator>
      </NavigationContainer>
    );
  }

  // Inquilino: solo sus modulos
  if (rol === 'inquilino') {
    return (
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator screenOptions={screenOptions}>
          <Tab.Screen name="Contratos" component={ContratosStack} options={{ headerShown: false }} />
          <Tab.Screen name="Pagos" component={PagosStack} options={{ headerShown: false }} />
          <Tab.Screen name="Servicios" component={ServiciosStack} options={{ headerShown: false }} />
          <Tab.Screen name="Mantenimiento" component={MantenimientoStack} options={{ headerShown: false }} />
        </Tab.Navigator>
      </NavigationContainer>
    );
  }

  // Propietario
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Inicio" component={DashboardScreen} options={{ headerTitle: '' }} />
        <Tab.Screen name="Propiedades" component={PropiedadesStack} options={{ headerShown: false }} />
        <Tab.Screen name="Inquilinos" component={InquilinosScreen} options={{ headerTitle: '' }} />
        <Tab.Screen name="Más" component={MasStack} options={{ headerShown: false }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
