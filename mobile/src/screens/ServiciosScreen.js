import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function ServiciosScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Servicios & Recibos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Agua / Energía / Gas + Servicios compartidos</Text>
      <View style={[s.card, { backgroundColor: c.card }]}>
        <Text style={[s.title, { color: c.text }]}>Servicios base</Text>
        <Text style={[s.text, { color: c.textSecondary }]}>Catálogo: Agua, Energía, Gas, Internet, Administración, Aseo (tabla servicios)</Text>
      </View>
      <View style={[s.card, { backgroundColor: c.card }]}>
        <Text style={[s.title, { color: c.text }]}>Recibos</Text>
        <Text style={[s.text, { color: c.textSecondary }]}>Cada recibo: servicio + propiedad + periodo + valor + vencimiento + estado. Adjunta foto del recibo.</Text>
      </View>
      <View style={[s.card, s.highlight, { backgroundColor: theme.dark ? '#2A2410' : '#FFFBEB', borderColor: theme.dark ? '#4A3F1A' : '#FDE68A' }]}>
        <Text style={[s.title, { color: c.text }]}>⭐ Servicios compartidos</Text>
        <Text style={[s.text, { color: c.textSecondary }]}>Un recibo de $300.000 de Agua de una casa con 3 apartamentos se distribuye:</Text>
        <Text style={s.code}>Métodos: partes_iguales / porcentaje / consumo / valor_fijo / manual</Text>
        <Text style={[s.text, { color: c.textSecondary }]}>Tablas: recibos → distribucion_servicios (recibo_id, unidad_id, monto)</Text>
        <Text style={[s.link, { color: c.accent }]}>Ver docs/modelo.md §12</Text>
      </View>
      <View style={[s.card, { backgroundColor: c.card }]}>
        <Text style={[s.title, { color: c.text }]}>Próximo paso móvil</Text>
        <Text style={[s.text, { color: c.textSecondary }]}>• Crear recibo + seleccionar método de distribución{'\n'}• Cámara para foto del recibo{'\n'}• Listar recibos por propiedad/periodo</Text>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  highlight: { borderWidth: 1 },
  title: { fontWeight: '700' },
  text: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  code: { fontSize: 11, color: '#7C3AED', backgroundColor: '#F5F3FF', padding: 6, borderRadius: 6, marginTop: 6 },
  link: { fontSize: 11, marginTop: 6 },
});
