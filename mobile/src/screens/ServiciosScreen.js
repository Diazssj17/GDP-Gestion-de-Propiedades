import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ServiciosScreen() {
  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>Servicios & Recibos</Text>
      <Text style={s.sub}>Agua / Energía / Gas + Servicios compartidos</Text>
      <View style={s.card}>
        <Text style={s.title}>Servicios base</Text>
        <Text style={s.text}>Catálogo: Agua, Energía, Gas, Internet, Administración, Aseo (tabla servicios)</Text>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Recibos</Text>
        <Text style={s.text}>Cada recibo: servicio + propiedad + periodo + valor + vencimiento + estado. Adjunta foto del recibo.</Text>
      </View>
      <View style={[s.card, s.highlight]}>
        <Text style={s.title}>⭐ Servicios compartidos</Text>
        <Text style={s.text}>Un recibo de $300.000 de Agua de una casa con 3 apartamentos se distribuye:</Text>
        <Text style={s.code}>Métodos: partes_iguales / porcentaje / consumo / valor_fijo / manual</Text>
        <Text style={s.text}>Tablas: recibos → distribucion_servicios (recibo_id, unidad_id, monto)</Text>
        <Text style={s.link}>Ver docs/modelo.md §12</Text>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Próximo paso móvil</Text>
        <Text style={s.text}>• Crear recibo + seleccionar método de distribución{'\n'}• Cámara para foto del recibo{'\n'}• Listar recibos por propiedad/periodo</Text>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  header: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  highlight: { borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  title: { fontWeight: '700', color: '#0F172A' },
  text: { fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 18 },
  code: { fontSize: 11, color: '#7C3AED', backgroundColor: '#F5F3FF', padding: 6, borderRadius: 6, marginTop: 6 },
  link: { fontSize: 11, color: '#2563EB', marginTop: 6 },
});
