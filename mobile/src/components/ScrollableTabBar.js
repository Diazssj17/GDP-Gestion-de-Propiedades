import { ScrollView, TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const ICONS = {
  Dashboard: 'analytics',
  Propiedades: 'business',
  Inquilinos: 'people',
  Contratos: 'document-text',
  Pagos: 'cash',
  Servicios: 'water',
  Mantenimiento: 'construct',
};

export default function ScrollableTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6, paddingVertical: 6 }}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key]?.options?.tabBarLabel || route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={{
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 62,
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginRight: 2,
              borderRadius: 10,
              backgroundColor: focused ? c.accent : 'transparent',
            }}>
              <Ionicons name={ICONS[route.name] || 'ellipse'} size={20} color={focused ? '#fff' : c.textMuted} />
              <Text style={{ fontSize: 10, fontWeight: focused ? '700' : '500', color: focused ? '#fff' : c.textMuted, marginTop: 1 }}>
                {String(label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
