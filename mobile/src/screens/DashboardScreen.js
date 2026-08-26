import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { api } from '../api/client';
import { mockResumen } from '../api/mock';

export default function DashboardScreen() {
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
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;
  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={styles.header}>GDP — Resumen</Text>
      <Text style={styles.sub}>Propietario → Propiedad → Unidad → Contrato → Pagos/Servicios</Text>
      <View style={styles.grid}>
        <Card title="Ocupación" value={`${data.ocupacion_pct}%`} subtitle={`${data.ocupadas}/${data.total_unidades} unidades`} color="#059669" />
        <Card title="Propiedades" value={data.total_propiedades} subtitle={`${data.total_unidades} unidades totales`} color="#0F172A" />
        <Card title="Contratos activos" value={data.contratos_activos} color="#2563EB" />
        <Card title="Pagos en mora" value={data.pagos_mora} subtitle={`${data.pagos_pendientes} pendientes`} color="#DC2626" />
        <Card title="Disponibles" value={data.disponibles} color="#0891B2" />
        <Card title="Mantenimiento" value={data.mantenimiento_pendiente} subtitle="tickets pendientes" color="#EA580C" />
      </View>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Regla de oro</Text>
        <Text style={styles.infoText}>Casa = Propiedad con 1 Unidad (código UNICA). Mismo código para 2 o 4.000 unidades.</Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  grid: { gap: 2 },
  info: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  infoTitle: { fontWeight: '700', color: '#1E40AF' },
  infoText: { color: '#334155', marginTop: 4, fontSize: 12 },
});
