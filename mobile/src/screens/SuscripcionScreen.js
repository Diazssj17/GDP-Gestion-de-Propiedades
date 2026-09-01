import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, TextInput, Alert } from 'react-native';
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
  const [miTarjeta, setMiTarjeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagar, setPagar] = useState(null);
  const [metodo, setMetodo] = useState('card');
  const [autorizaDebito, setAutorizaDebito] = useState(false);
  // tarjeta
  const [numero, setNumero] = useState('');
  const [expMes, setExpMes] = useState('');
  const [expAnio, setExpAnio] = useState('');
  const [cvc, setCvc] = useState('');
  const [titular, setTitular] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pls, me, tc] = await Promise.all([api.planesPublico(), api.me(), api.miTarjeta()]);
      setPlanes(pls);
      setMiPlan(me.plan || null);
      setMiTarjeta(tc.tarjeta || null);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const pagarPlan = async () => {
    setError('');
    if (!pagar) return;
    setGuardando(true);
    try {
      // Tarjeta (cobro recurrente)
      if (metodo === 'card') {
        if (!numero || !expMes || !expAnio || !cvc || !titular) { setError('Completa los datos de la tarjeta'); setGuardando(false); return; }
        if (!autorizaDebito) { setError('Debes autorizar el débito mensual recurrente'); setGuardando(false); return; }
        const res = await api.pagarPlan({ plan_id: pagar.id, metodo: 'card', card: { number: numero.replace(/\s/g, ''), exp_month: expMes, exp_year: expAnio, cvc, holder: titular } });
        if (res.estado === 'aprobada') { setMsg('Pago aprobado. Tu plan quedó activo.'); setPagar(null); setNumero(''); setCvc(''); load(); }
        else { setMsg('Pago pendiente de aprobación.'); }
        setGuardando(false);
        return;
      }
      const cfg = await api.pagosConfig();
      // WhatsApp
      if (metodo === 'whatsapp') {
        const num = (cfg.whatsapp || '').replace(/\D/g, '');
        if (!num) { setError('No hay número de WhatsApp configurado.'); setGuardando(false); return; }
        const texto = encodeURIComponent(`Hola, soy ${user?.nombre || 'un cliente'}. Quiero organizar el pago del plan ${pagar.nombre} (${fmt(pagar.precio_mensual)}/mes).`);
        Linking.openURL(`https://wa.me/${num}?text=${texto}`);
        setMsg('Se abrió WhatsApp para organizar tu pago.');
      } else {
        // Pagar en línea (link Wompi)
        if (!cfg.wompi_link) { setError('No hay link de pago configurado.'); setGuardando(false); return; }
        Linking.openURL(cfg.wompi_link);
        setMsg('Se abrió el enlace de pago de Wompi.');
      }
    } catch (e) { setError(e?.response?.data?.error || 'No se pudo procesar el pago'); } finally { setGuardando(false); }
  };

  const cancelar = () => {
    Alert.alert('Cancelar suscripción', 'Se desactivará el cobro mensual y tu tarjeta. Podrás volver a suscribirte cuando quieras.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => { try { await api.cancelarSuscripcion(); setMsg('Suscripción cancelada.'); load(); } catch { setError('No se pudo cancelar'); } } },
    ]);
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
          {miTarjeta ? (
            <Text style={[s.curCard, { color: c.textSecondary }]}>💳 {miTarjeta.marca} •••• {miTarjeta.ultimos4} · {miTarjeta.exp_mes}/{miTarjeta.exp_anio}</Text>
          ) : <Text style={[s.curCard, { color: c.textMuted }]}>Sin tarjeta guardada</Text>}
          <TouchableOpacity style={[s.cancelBtn, { backgroundColor: c.danger }]} onPress={cancelar}>
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={s.cancelText}>Cancelar mi suscripción</Text>
          </TouchableOpacity>
        </View>
      ) : <Text style={[s.empty, { color: c.textMuted }]}>No tienes un plan activo</Text>}

      <Text style={[s.section, { color: c.text }]}>Cambiar de plan</Text>
      {planes.map(p => (
        <TouchableOpacity key={p.id} style={[s.plan, { backgroundColor: miPlan?.id === p.id ? c.accent : c.card, borderColor: c.border }]} onPress={() => { setPagar(p); setMetodo('card'); setMsg(''); setError(''); setAutorizaDebito(false); }}>
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
            <TouchableOpacity style={[s.method, { backgroundColor: metodo === 'card' ? c.accent : c.input, borderColor: c.border }]} onPress={() => setMetodo('card')}>
              <Ionicons name="card" size={16} color={metodo === 'card' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'card' ? '#fff' : c.textSecondary }}>Tarjeta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.method, { backgroundColor: metodo === 'pse' ? c.accent : c.input, borderColor: c.border }]} onPress={() => setMetodo('pse')}>
              <Ionicons name="link" size={16} color={metodo === 'pse' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'pse' ? '#fff' : c.textSecondary }}>Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.method, { backgroundColor: metodo === 'whatsapp' ? c.accent : c.input, borderColor: c.border }]} onPress={() => setMetodo('whatsapp')}>
              <Ionicons name="logo-whatsapp" size={16} color={metodo === 'whatsapp' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'whatsapp' ? '#fff' : c.textSecondary }}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {metodo === 'card' && (
            <View style={{ marginTop: 12 }}>
              <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Número de tarjeta" placeholderTextColor={c.placeholder} value={numero} onChangeText={setNumero} keyboardType="numeric" />
              <View style={s.row}>
                <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Mes (MM)" placeholderTextColor={c.placeholder} value={expMes} onChangeText={setExpMes} keyboardType="numeric" maxLength={2} />
                <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Año (AA)" placeholderTextColor={c.placeholder} value={expAnio} onChangeText={setExpAnio} keyboardType="numeric" maxLength={2} />
                <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="CVC" placeholderTextColor={c.placeholder} value={cvc} onChangeText={setCvc} keyboardType="numeric" maxLength={4} secureTextEntry />
              </View>
              <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Titular de la tarjeta" placeholderTextColor={c.placeholder} value={titular} onChangeText={setTitular} />
            </View>
          )}

          <TouchableOpacity style={s.checkRow} onPress={() => setAutorizaDebito(v => !v)}>
            <Ionicons name={autorizaDebito ? 'checkbox' : 'square-outline'} size={20} color={autorizaDebito ? c.accent : c.textMuted} />
            <Text style={[s.checkText, { color: c.textSecondary }]}>Autorizo el débito mensual recurrente de mi plan</Text>
          </TouchableOpacity>
          {msg ? <Text style={[s.msg, { color: c.success }]}>{msg}</Text> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={pagarPlan} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{metodo === 'card' ? `Pagar ${fmt(pagar.precio_mensual)}` : 'Continuar'}</Text>}
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
  curCard: { fontSize: 12, marginTop: 8 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 10, marginTop: 12 },
  cancelText: { color: '#fff', fontWeight: '700' },
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
  method: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  checkText: { fontSize: 12, flex: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  msg: { fontSize: 13, marginTop: 10 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
