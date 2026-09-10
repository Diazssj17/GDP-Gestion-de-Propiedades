import { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
import LegalScreen from '../screens/LegalScreen';
import { usePushNotifications } from '../notifications/usePushNotifications';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

const cardHeader = (theme) => ({ headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight />, headerTitle: '' });

function PropiedadesStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PropiedadesList" component={PropiedadesScreen} options={{ title: 'Propiedades', ...cardHeader(theme) }} />
      <Stack.Screen name="Unidades" component={UnidadesScreen} options={{ title: 'Unidades', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}

function PropietariosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PropietariosList" component={PropietariosScreen} options={{ title: 'Propietarios', ...cardHeader(theme) }} />
      <Stack.Screen name="Analisis" component={PropietarioAnalisisScreen} options={{ title: 'Análisis', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}

function ContratosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="ContratosList" component={ContratosScreen} options={{ title: 'Contratos', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoContrato" component={NuevoContratoScreen} options={{ title: 'Nuevo contrato', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
function PagosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="PagosList" component={PagosScreen} options={{ title: 'Pagos', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoPago" component={NuevoPagoScreen} options={{ title: 'Nuevo pago', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
function ServiciosStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="ServiciosList" component={ServiciosScreen} options={{ title: 'Servicios', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoRecibo" component={NuevoReciboScreen} options={{ title: 'Nuevo recibo', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}
function MantenimientoStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="MantenimientoList" component={MantenimientoScreen} options={{ title: 'Mantenimiento', ...cardHeader(theme) }} />
      <Stack.Screen name="NuevoMantenimiento" component={NuevoMantenimientoScreen} options={{ title: 'Nuevo ticket', ...cardHeader(theme) }} />
    </Stack.Navigator>
  );
}

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

function getTabItems(rol) {
  if (rol === 'superadmin') {
    return [
      { name: 'Panel', label: 'Panel', icon: 'speedometer', component: AdminDashboardScreen, stacked: false },
      { name: 'Propietarios', label: 'Propietarios', icon: 'people-circle', component: PropietariosStack, stacked: true },
      { name: 'Planes', label: 'Planes', icon: 'pricetags', component: PlanesScreen, stacked: false },
    ];
  }
  if (rol === 'inquilino') {
    return [
      { name: 'Contratos', label: 'Contratos', icon: 'document-text', component: ContratosStack, stacked: true },
      { name: 'Pagos', label: 'Pagos', icon: 'cash', component: PagosStack, stacked: true },
      { name: 'Servicios', label: 'Servicios', icon: 'water', component: ServiciosStack, stacked: true },
      { name: 'Mantenimiento', label: 'Mantenimiento', icon: 'construct', component: MantenimientoStack, stacked: true },
    ];
  }
  return [
    { name: 'Inicio', label: 'Inicio', icon: 'home', component: DashboardScreen, stacked: false },
    { name: 'Propiedades', label: 'Propiedades', icon: 'business', component: PropiedadesStack, stacked: true },
    { name: 'Inquilinos', label: 'Inquilinos', icon: 'people', component: InquilinosScreen, stacked: false },
    { name: 'Contratos', label: 'Contratos', icon: 'document-text', component: ContratosStack, stacked: true },
    { name: 'Pagos', label: 'Pagos', icon: 'cash', component: PagosStack, stacked: true },
    { name: 'Servicios', label: 'Servicios', icon: 'water', component: ServiciosStack, stacked: true },
    { name: 'Mantenimiento', label: 'Mantenimiento', icon: 'construct', component: MantenimientoStack, stacked: true },
    { name: 'Plan', label: 'Plan', icon: 'card', component: SuscripcionScreen, stacked: false },
  ];
}

// Encapsula una pantalla "plana" en un stack para darle cabecera + contexto de navegación
function ScreenHost({ title, component: Comp, theme }) {
  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: theme.colors.card },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { fontWeight: '700' },
      headerRight: () => <HeaderRight />,
    }}>
      <Stack.Screen name="Screen" component={Comp} options={{ title }} />
    </Stack.Navigator>
  );
}

function WebLayout({ items }) {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [active, setActive] = useState(items[0].name);
  const item = items.find(i => i.name === active) || items[0];
  const Comp = item.component;
  const c = theme.colors;

  return (
    <View style={styles.webRow}>
      <View style={[styles.sidebar, { backgroundColor: c.card, borderRightColor: c.border }]}>
        <Text style={[styles.brand, { color: c.accent }]}>GDP</Text>
        <Text style={[styles.brandSub, { color: c.textMuted }]}>Gestión de Propiedades</Text>
        <ScrollView style={styles.navScroll} contentContainerStyle={{ paddingBottom: 16 }}>
          {items.map(it => {
            const focused = it.name === active;
            return (
              <TouchableOpacity
                key={it.name}
                onPress={() => setActive(it.name)}
                style={[styles.navItem, focused && { backgroundColor: c.primary }]}
              >
                <Ionicons name={iconMap[it.name] || it.icon} size={20} color={focused ? '#fff' : c.textMuted} />
                <Text style={[styles.navLabel, { color: focused ? '#fff' : c.textMuted }]}>{it.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={[styles.sidebarFooter, { borderTopColor: c.border }]}>
          <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>{user?.nombre || user?.email}</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={c.textMuted} />
            <Text style={{ color: c.textMuted }}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.webContent}>
        {item.stacked ? <Comp /> : <ScreenHost title={item.label} component={Comp} theme={theme} />}
      </View>
    </View>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const rol = user?.rol;
  usePushNotifications();
  const navTheme = { ...(theme.dark ? DarkTheme : DefaultTheme), colors: { ...(theme.dark ? DarkTheme : DefaultTheme).colors, primary: theme.colors.accent, background: theme.colors.background, card: theme.colors.card, text: theme.colors.text, border: theme.colors.border } };

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

  const items = getTabItems(rol);

  // Tabs (móvil)
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

  const mainContent = Platform.OS === 'web' ? <WebLayout items={items} /> : tabs;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={() => mainContent} />
        <RootStack.Screen name="Alertas" component={AlertasScreen} options={{ headerShown: true, headerTitle: '', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text, headerRight: () => <HeaderRight /> }} />
        <RootStack.Screen name="Legal" component={LegalScreen} options={{ headerShown: true, title: 'Documentos legales', headerStyle: { backgroundColor: theme.colors.card }, headerTintColor: theme.colors.text }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  webRow: { flexDirection: 'row', flex: 1 },
  sidebar: { width: 240, borderRightWidth: 1, paddingTop: 20, paddingBottom: 16 },
  brand: { fontSize: 22, fontWeight: '900', paddingHorizontal: 20, letterSpacing: 0.5 },
  brandSub: { fontSize: 12, paddingHorizontal: 20, marginTop: 2, marginBottom: 18 },
  navScroll: { flex: 1 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  navLabel: { fontSize: 15, fontWeight: '600' },
  sidebarFooter: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16 },
  userName: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  webContent: { flex: 1 },
});
