import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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
  return (
    <Stack.Navigator>
      <Stack.Screen name="PropiedadesList" component={PropiedadesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Unidades" component={UnidadesScreen} options={{ title: 'Unidades' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const map = { Dashboard: 'analytics', Propiedades: 'business', Contratos: 'document-text', Pagos: 'cash', Servicios: 'water', Mantenimiento: 'construct' };
          return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0F172A',
        headerShown: false,
        tabBarStyle: { paddingBottom: 4 },
      })}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Propiedades" component={PropiedadesStack} />
        <Tab.Screen name="Contratos" component={ContratosScreen} />
        <Tab.Screen name="Pagos" component={PagosScreen} />
        <Tab.Screen name="Servicios" component={ServiciosScreen} />
        <Tab.Screen name="Mantenimiento" component={MantenimientoScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
