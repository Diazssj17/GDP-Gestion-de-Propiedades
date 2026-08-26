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
      <Text style={[s.sub, { color: c.textSecondary }]}>Propietario → Propiedad → Unidad → Contrato → Pagos/Servicios</Text>
      <View style={s.grid}>
        <Card title="Ocupación" value={`${data.ocupacion_pct}%`} subtitle={`${data.ocupadas}/${data.total_unidades} unidades`} color={c.success} />
        <Card title="Propiedades" value={data.total_propiedades} subtitle={`${data.total_unidades} unidades totales`} color={c.text} />
        <Card title="Contratos activos" value={data.contratos_activos} color={c.accent} />
        <Card title="Pagos en mora" value={data.pagos_mora} subtitle={`${data.pagos_pendientes} pendientes`} color={c.danger} />
        <Card title="Disponibles" value={data.disponibles} color={c.info} />
        <Card title="Mantenimiento" value={data.mantenimiento_pendiente} subtitle="tickets pendientes" color={c.warning} />
      </View>
      <View style={[s.info, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF', borderColor: theme.dark ? '#1E3A5F' : '#DBEAFE' }]}>
        <Text style={[s.infoTitle, { color: c.accent }]}>Regla de oro</Text>
        <Text style={[s.infoText, { color: c.textSecondary }]}>Casa = Propiedad con 1 Unidad (código UNICA). Mismo código para 2 o 4.000 unidades.</Text>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 12, marginBottom: 16 },
  grid: { gap: 2 },
  info: { borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1 },
  infoTitle: { fontWeight: '700' },
  infoText: { marginTop: 4, fontSize: 12 },
});
