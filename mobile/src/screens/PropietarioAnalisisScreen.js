import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;
const badges = { activo: '#059669', pendiente: '#EA580C', mora: '#DC2626', vencido: '#DC2626', pagado: '#059669', parcial: '#D97706', disponibile: '#059669', ocupada: '#DC2626', terminado: '#64748B', cancelado: '#64748B' };

export default function PropietarioAnalisisScreen({ route }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { id, nombre } = route.params || {};
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setD(await api.propietarioDatos(id)); } catch { setD(null); }
      setLoading(false);
    })();
  }, [id]);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;
  if (!d) return <View style={[s.center, { backgroundColor: c.background }]}><Text style={{ color: c.textMuted }}>Sin datos.</Text></View>;

  const Sec = ({ title, items, render }) => (
    <View style={{ marginTop: 16 }}>
      <Text style={[s.secTitle, { color: c.text }]}>{title} ({items.length})</Text>
      {items.length ? items.map((it, i) => (
        <View key={i} style={[s.row, { backgroundColor: c.card }]}>{render(it)}</View>
      )) : <Text style={{ color: c.textMuted, fontSize: 12 }}>Sin registros</Text>}
    </View>
  );

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>{nombre || 'Propietario'}</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Análisis de operación</Text>

      <Sec title="Propiedades" items={d.propiedades} render={p => (
        <><Text style={{ color: c.text, fontWeight: '700' }}>{p.nombre}</Text><Text style={{ color: c.textSecondary }}>{p.tipo} · {p.ciudad} · {p.num_unidades} unidades</Text></>
      )} />
      <Sec title="Unidades" items={d.unidades} render={u => (
        <><Text style={{ color: c.text, fontWeight: '700' }}>{u.codigo} · {u.propiedad_nombre}</Text><Text style={{ color: c.textSecondary }}>Canon {fmt(u.canon_base)} · {u.estado}</Text></>
      )} />
      <Sec title="Inquilinos" items={d.inquilinos} render={i => (
        <><Text style={{ color: c.text, fontWeight: '700' }}>{i.nombre}</Text><Text style={{ color: c.textSecondary }}>{i.documento} · {i.telefono || '—'}</Text></>
      )} />
      <Sec title="Contratos" items={d.contratos} render={ct => (
        <><Text style={{ color: c.text, fontWeight: '700' }}>{ct.unidad_codigo} → {ct.inquilino_nombre}</Text><Text style={{ color: c.textSecondary }}>{ct.fecha_inicio} → {ct.fecha_fin} · {fmt(ct.canon)} · {ct.estado}</Text></>
      )} />
      <Sec title="Pagos" items={d.pagos} render={p => {
        const color = badges[p.estado] || '#64748B';
        return (
          <><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>{fmt(p.monto)} · {p.periodo || p.concepto}</Text>
            <View style={[s.chip, { backgroundColor: color }]}><Text style={s.chipText}>{p.estado}</Text></View>
          </View>
          <Text style={{ color: c.textSecondary }}>{p.unidad_codigo} · {p.inquilino_nombre}</Text></>
        );
      }} />
      <Sec title="Servicios (recibos)" items={d.recibos} render={r => {
        const color = badges[r.estado] || '#64748B';
        return (
          <><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>{r.servicio_nombre} · {r.propiedad_nombre}</Text>
            <View style={[s.chip, { backgroundColor: color }]}><Text style={s.chipText}>{r.estado}</Text></View>
          </View>
          <Text style={{ color: c.textSecondary }}>{r.periodo} · {fmt(r.valor)}</Text></>
        );
      }} />
      <Sec title="Mantenimiento" items={d.mantenimientos} render={m => (
        <><Text style={{ color: c.text, fontWeight: '700' }}>{m.titulo}</Text><Text style={{ color: c.textSecondary }}>{m.unidad_codigo} · {m.prioridad} · {m.estado}</Text></>
      )} />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 4 },
  secTitle: { fontWeight: '800', marginBottom: 6 },
  row: { borderRadius: 10, padding: 12, marginBottom: 8 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
