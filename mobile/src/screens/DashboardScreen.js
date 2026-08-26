import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { api } from '../api/client';
import { mockResumen } from '../api/mock';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

export default function DashboardScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.resumen();
      setData(res);
    } catch (e) {
      console.log('usando mock', e.message);
      setData(mockResumen);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator size="large" color={c.accent} /></View>;
  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}>
      <Text style={[s.header, { color: c.text }]}>Hola, {user?.nombre?.split(' ')[0]}</Text>
      <View style={s.grid}>
        <Card title="Ocupación" value={`${data.ocupacion_pct}%`} subtitle={`${data.ocupadas}/${data.total_unidades} unidades`} color={c.success} />
        <Card title="Propiedades" value={data.total_propiedades} subtitle={`${data.total_unidades} unidades totales`} color={c.text} />
        <Card title="Contratos activos" value={data.contratos_activos} color={c.accent} />
        <Card title="Pagos en mora" value={data.pagos_mora} subtitle={`${data.pagos_pendientes} pendientes`} color={c.danger} />
        <Card title="Disponibles" value={data.disponibles} color={c.info} />
        <Card title="Mantenimiento" value={data.mantenimiento_pendiente} subtitle="tickets pendientes" color={c.warning} />
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: '900', marginBottom: 16 },
  grid: { gap: 2 },
});
