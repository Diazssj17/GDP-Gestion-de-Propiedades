import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;

export default function SuscripcionScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const [planes, setPlanes] = useState([]);
  const [miPlan, setMiPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagar, setPagar] = useState(null); // plan seleccionado para pagar
  const [metodo, setMetodo] = useState('pse');
  const [autorizaDebito, setAutorizaDebito] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pls, me] = await Promise.all([api.planesPublico(), api.me()]);
      setPlanes(pls);
      setMiPlan(me.plan || null);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const pagarPlan = async () => {
    setError('');
    if (!pagar) return;
    if (!autorizaDebito) { setError('Debes autorizar el débito mensual recurrente'); return; }
    setGuardando(true);
    try {
      const cfg = await api.pagosConfig();
      // WhatsApp: abrir chat para organizar el pago
      if (metodo === 'whatsapp') {
        const numero = (cfg.whatsapp || '').replace(/\D/g, '');
        if (!numero) {
          setError('No hay número de WhatsApp configurado.');
          setGuardando(false);
          return;
        }
        const texto = encodeURIComponent(`Hola, soy ${user?.nombre || 'un cliente'}. Quiero organizar el pago del plan ${pagar.nombre} (${fmt(pagar.precio_mensual)}/mes).`);
        Linking.openURL(`https://wa.me/${numero}?text=${texto}`);
        setMsg('Se abrió WhatsApp para organizar tu pago.');
        setGuardando(false);
        return;
      }
      // Pago en linea: abrir link de Wompi
      if (!cfg.wompi_link) {
        setError('No hay link de pago configurado.');
        setGuardando(false);
        return;
      }
      Linking.openURL(cfg.wompi_link);
      setMsg('Se abrió el enlace de pago de Wompi.');
    } catch (e) { setError('No se pudo procesar el pago'); } finally { setGuardando(false); }
  };

  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.header, { color: c.text }]}>Mi plan</Text>
      {miPlan ? (
        <View style={[s.current, { backgroundColor: c.card, borderColor: c.accent }]}>
          <Text style={[s.curName, { color: c.text }]}>{miPlan.nombre}</Text>
          <Text style={[s.curPrice, { color: c.accent }]}>{fmt(miPlan.precio_mensual)}/mes</Text>
          <Text style={[s.curLimits, { color: c.textSecondary }]}>{miPlan.max_propiedades} propiedades · {miPlan.max_unidades} unidades</Text>
        </View>
      ) : <Text style={[s.empty, { color: c.textMuted }]}>No tienes un plan activo</Text>}

      <Text style={[s.section, { color: c.text }]}>Cambiar de plan</Text>
      {planes.map(p => (
        <TouchableOpacity key={p.id} style={[s.plan, { backgroundColor: miPlan?.id === p.id ? c.accent : c.card, borderColor: c.border }]} onPress={() => { setPagar(p); setMetodo('pse'); setMsg(''); setError(''); }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.planName, { color: miPlan?.id === p.id ? '#fff' : c.text }]}>{p.nombre}</Text>
            <Text style={[s.planDesc, { color: miPlan?.id === p.id ? '#e2e8f0' : c.textSecondary }]}>{p.descripcion}</Text>
            <Text style={[s.planLimits, { color: miPlan?.id === p.id ? '#e2e8f0' : c.textMuted }]}>{p.max_propiedades} propiedades · {p.max_unidades} unidades</Text>
          </View>
          <Text style={[s.planPrice, { color: miPlan?.id === p.id ? '#fff' : c.accent }]}>{fmt(p.precio_mensual)}</Text>
        </TouchableOpacity>
      ))}

      {pagar && (
        <View style={[s.pay, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.payTitle, { color: c.text }]}>Pagar {pagar.nombre}</Text>
          <Text style={[s.meta, { color: c.textSecondary }]}>Elige el método de pago</Text>
          <View style={s.methods}>
            <TouchableOpacity style={[s.method, { backgroundColor: metodo === 'pse' ? c.accent : c.input, borderColor: c.border }]} onPress={() => setMetodo('pse')}>
              <Ionicons name="card" size={16} color={metodo === 'pse' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'pse' ? '#fff' : c.textSecondary }}>Pagar en línea</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.method, { backgroundColor: metodo === 'whatsapp' ? c.accent : c.input, borderColor: c.border }]} onPress={() => setMetodo('whatsapp')}>
              <Ionicons name="logo-whatsapp" size={16} color={metodo === 'whatsapp' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'whatsapp' ? '#fff' : c.textSecondary }}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.checkRow} onPress={() => setAutorizaDebito(v => !v)}>
            <Ionicons name={autorizaDebito ? 'checkbox' : 'square-outline'} size={20} color={autorizaDebito ? c.accent : c.textMuted} />
            <Text style={[s.checkText, { color: c.textSecondary }]}>Autorizo el débito mensual recurrente de mi plan</Text>
          </TouchableOpacity>
          {msg ? <Text style={[s.msg, { color: c.success }]}>{msg}</Text> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={pagarPlan} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Pagar {fmt(pagar.precio_mensual)}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: '900' },
  current: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 12 },
  curName: { fontWeight: '800', fontSize: 18 },
  curPrice: { fontWeight: '800', fontSize: 15, marginTop: 4 },
  curLimits: { fontSize: 12, marginTop: 4 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  empty: { fontSize: 13, marginTop: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  planName: { fontWeight: '800', fontSize: 16 },
  planDesc: { fontSize: 12, marginTop: 2 },
  planLimits: { fontSize: 11, marginTop: 2 },
  planPrice: { fontWeight: '800', fontSize: 15, marginLeft: 8 },
  pay: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  payTitle: { fontWeight: '800', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 4 },
  methods: { flexDirection: 'row', gap: 8, marginTop: 12 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  checkText: { fontSize: 12, flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 12 },
  msg: { fontSize: 13, marginTop: 10 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
