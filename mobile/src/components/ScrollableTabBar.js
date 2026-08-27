import { ScrollView, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const ICONS = {
  Inicio: 'home',
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: 62 }}
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 6 }}
      >
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
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={6}
              style={[
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 66,
                  height: 54,
                  paddingHorizontal: 8,
                  marginRight: 2,
                  borderRadius: 12,
                },
                focused && { backgroundColor: c.accent },
              ]}
            >
              <Ionicons name={ICONS[route.name] || 'ellipse'} size={20} color={focused ? '#fff' : c.textMuted} />
              <Text style={{ fontSize: 10, fontWeight: focused ? '700' : '500', color: focused ? '#fff' : c.textMuted, marginTop: 2 }}>
                {String(label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
