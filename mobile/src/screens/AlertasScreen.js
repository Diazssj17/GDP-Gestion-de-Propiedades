import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const ICON = {
  vencimiento_contrato: 'document-text',
  mora: 'alert-circle',
  pago_proximo: 'cash',
  mantenimiento: 'construct',
  servicio: 'water',
  sistema: 'information-circle',
};
const COLOR = {
  vencimiento_contrato: '#D97706',
  mora: '#DC2626',
  pago_proximo: '#EA580C',
  mantenimiento: '#2563EB',
  servicio: '#0891B2',
  sistema: '#64748B',
};

export default function AlertasScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.alertas(); setData(r.alertas || []); } catch { setData([]); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const marcarTodas = async () => { try { await api.leerTodasAlertas(); load(); } catch {} };
  const marcarUna = async (id) => { try { await api.leerAlerta(id); load(); } catch {} };

  const noLeidas = data.filter(a => !a.leida).length;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.head}>
        <Text style={[s.header, { color: c.text }]}>Notificaciones</Text>
        {noLeidas > 0 && (
          <TouchableOpacity onPress={marcarTodas}><Text style={[s.markAll, { color: c.accent }]}>Marcar todas leídas</Text></TouchableOpacity>
        )}
      </View>
      {loading ? <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 30 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin notificaciones</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: item.leida ? c.card : theme.dark ? '#12243B' : '#EFF6FF' }]} onPress={() => !item.leida && marcarUna(item.id)}>
              <View style={[s.icon, { backgroundColor: (COLOR[item.tipo] || '#64748B') + '22' }]}>
                <Ionicons name={ICON[item.tipo] || 'notifications'} size={20} color={COLOR[item.tipo] || '#64748B'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: c.text, fontWeight: item.leida ? '500' : '800' }]}>{item.titulo}</Text>
                <Text style={[s.body, { color: c.textSecondary }]}>{item.mensaje}</Text>
                <Text style={[s.date, { color: c.textMuted }]}>{item.fecha_creacion}</Text>
              </View>
              {!item.leida && <View style={[s.dot, { backgroundColor: c.accent }]} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800' },
  markAll: { fontSize: 13, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 14 },
  body: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 10, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 4 },
  empty: { textAlign: 'center', marginTop: 30 },
});
