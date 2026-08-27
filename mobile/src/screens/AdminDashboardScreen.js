import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { setData(await api.adminResumen()); } catch (e) { console.log(e.message); setData(null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator size="large" color={c.accent} /></View>;
  const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;
  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}>
      <Text style={[s.header, { color: c.text }]}>Panel de administración</Text>
      <View style={s.grid}>
        <Card title="Propietarios" value={data?.propietarios} color={c.accent} />
        <Card title="Propiedades" value={data?.propiedades} subtitle={`${data?.unidades} unidades`} color={c.text} />
        <Card title="Contratos activos" value={data?.contratos_activos} subtitle={`${data?.unidades_ocupadas}/${data?.unidades} ocupadas`} color={c.success} />
        <Card title="Inquilinos" value={data?.inquilinos} color={c.info} />
        <Card title="Pagos en mora" value={data?.pagos_mora} subtitle={`${data?.pagos_pendientes} pendientes`} color={c.danger} />
        <Card title="Ingresos cobrados" value={fmt(data?.ingresos_cobrados || 0)} subtitle={`por cobrar ${fmt(data?.ingresos_por_cobrar || 0)}`} color={c.success} />
        <Card title="Suscripciones" value={data?.suscripciones_activas} subtitle="activas" color={c.warning} />
        <Card title="Mantenimiento" value={data?.mantenimiento_pendiente} subtitle="tickets abiertos" color={c.warning} />
      </View>
      <Text style={[s.section, { color: c.text }]}>Suscriptores por plan</Text>
      <View style={[s.plans, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF' }]}>
        {(data?.planes || []).map(p => (
          <Text key={p.nombre} style={[s.planRow, { color: c.textSecondary }]}>{p.nombre}: {p.suscriptores}</Text>
        ))}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: '900', marginBottom: 16 },
  grid: { gap: 2 },
  section: { fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  plans: { borderRadius: 10, padding: 12 },
  planRow: { fontSize: 13, marginTop: 2 },
});
