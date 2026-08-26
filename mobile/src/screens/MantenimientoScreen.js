import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function MantenimientoScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Mantenimiento</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Tickets por unidad. Crea propietario/inquilino.</Text>
      <View style={[s.card, { backgroundColor: c.card }]}><Text style={[s.title, { color: c.text }]}>Estados</Text><Text style={[s.text, { color: c.textSecondary }]}>reportado → pendiente → en_revision → en_proceso → resuelto / cancelado</Text></View>
      <View style={[s.card, { backgroundColor: c.card }]}><Text style={[s.title, { color: c.text }]}>Prioridades</Text><Text style={[s.text, { color: c.textSecondary }]}>baja · media · alta · critica</Text></View>
      <View style={[s.card, { backgroundColor: c.card }]}><Text style={[s.title, { color: c.text }]}>Campos</Text><Text style={[s.text, { color: c.textSecondary }]}>unidad_id, reportado_por, tipo (preventivo/correctivo), título, descripción, responsable, costo, fotos</Text></View>
      <View style={[s.card, { backgroundColor: c.card }]}><Text style={[s.title, { color: c.text }]}>Próximo paso móvil</Text><Text style={[s.text, { color: c.textSecondary }]}>• Formulario con cámara + selector de unidad{'\n'}• Lista filtrable por estado{'\n'}• Push via notificaciones</Text></View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { fontWeight: '700' },
  text: { fontSize: 12, marginTop: 6 },
});
