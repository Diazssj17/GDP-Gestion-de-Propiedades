import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

export default function BlockedScreen() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const c = theme.colors;

  const cancelar = () => {
    Alert.alert('Cancelar suscripción', 'Cancelarás y pasarás al plan Gratis.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => { try { await api.cancelarSuscripcion(); logout(); } catch {} } },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.danger }]}>
        <Ionicons name="lock-closed" size={44} color={c.danger} />
        <Text style={[s.title, { color: c.text }]}>Suscripción bloqueada</Text>
        <Text style={[s.body, { color: c.textSecondary }]}>
          No se pudo cobrar tu plan. Para continuar usando GDP debes pagar tu plan o cancelar la suscripción.
        </Text>
        <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={cancelar}>
          <Text style={s.btnText}>Cancelar y pasar a Gratis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.linkBtn]} onPress={logout}>
          <Text style={{ color: c.textMuted }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 12 },
  body: { fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 19 },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20, alignSelf: 'stretch' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkBtn: { marginTop: 12 },
});
