import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function MantenimientoScreen() {
  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>Mantenimiento</Text>
      <Text style={s.sub}>Tickets por unidad. Crea propietario/inquilino.</Text>
      <View style={s.card}><Text style={s.title}>Estados</Text><Text style={s.text}>reportado → pendiente → en_revision → en_proceso → resuelto / cancelado</Text></View>
      <View style={s.card}><Text style={s.title}>Prioridades</Text><Text style={s.text}>baja · media · alta · critica</Text></View>
      <View style={s.card}><Text style={s.title}>Campos</Text><Text style={s.text}>unidad_id, reportado_por, tipo (preventivo/correctivo), título, descripción, responsable, costo, fotos</Text></View>
      <View style={s.card}><Text style={s.title}>Próximo paso móvil</Text><Text style={s.text}>• Formulario con cámara + selector de unidad{'\n'}• Lista filtrable por estado{'\n'}• Push via notificaciones</Text></View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  header: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { fontWeight: '700', color: '#0F172A' },
  text: { fontSize: 12, color: '#475569', marginTop: 6 },
});
