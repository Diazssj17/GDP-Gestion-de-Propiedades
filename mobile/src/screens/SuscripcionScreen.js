import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import Picker from '../components/Picker';

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;

export default function SuscripcionScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const [planes, setPlanes] = useState([]);
  const [miPlan, setMiPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagar, setPagar] = useState(null);
  const [metodo, setMetodo] = useState('pse');
  const [bancos, setBancos] = useState([]);
  const [banco, setBanco] = useState(null);
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState(user?.telefono || '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);
  const openedRef = useRef(false);

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

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const loadBancos = async () => {
    if (bancos.length) return;
    try { const r = await api.pseBancos(); setBancos(r.bancos || []); } catch {}
  };
  useEffect(() => { if (pagar && metodo === 'pse') loadBancos(); }, [pagar, metodo]);

  const startPolling = (referencia) => {
    setPolling(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const st = await api.estadoPago(referencia);
        if (st.async_payment_url && !openedRef.current) {
          openedRef.current = true;
          Linking.openURL(st.async_payment_url);
        }
        if (st.estado === 'aprobada') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setMsg('¡Pago aprobado! Tu plan está activo.');
          setPagar(null);
          await load();
        } else if (st.estado === 'rechazada') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setError('El pago fue rechazado. Intenta de nuevo.');
        }
      } catch {}
    }, 3000);
  };

  const pagarPlan = async () => {
    setError('');
    setMsg('');
    if (!pagar) return;

    if (metodo === 'whatsapp') {
      setGuardando(true);
      try {
        const cfg = await api.pagosConfig();
        const num = (cfg.whatsapp || '').replace(/\D/g, '');
        if (!num) { setError('No hay número de WhatsApp configurado.'); setGuardando(false); return; }
        const texto = encodeURIComponent(`Hola, soy ${user?.nombre || 'un cliente'}. Quiero organizar el pago del plan ${pagar.nombre} (${fmt(pagar.precio_mensual)}/mes).`);
        Linking.openURL(`https://wa.me/${num}?text=${texto}`);
        setMsg('Se abrió WhatsApp para organizar tu pago.');
      } catch { setError('No se pudo procesar el pago'); } finally { setGuardando(false); }
      return;
    }

    // PSE
    if (!banco) { setError('Selecciona tu banco'); return; }
    if (!cedula.trim()) { setError('Ingresa tu número de cédula'); return; }
    setGuardando(true);
    try {
      const res = await api.pagarPlan({
        plan_id: pagar.id,
        metodo: 'pse',
        banco,
        user_legal_id: cedula.trim(),
        telefono: telefono.trim(),
      });
      if (res.ok) {
        openedRef.current = false;
        setMsg('Procesando pago PSE...');
        if (res.async_payment_url) {
          openedRef.current = true;
          Linking.openURL(res.async_payment_url);
        }
        startPolling(res.referencia);
      } else {
        setError(res.error || 'No se pudo iniciar el pago');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo procesar el pago');
    } finally { setGuardando(false); }
  };

  const cancelar = () => {
    Alert.alert('Cancelar suscripción', 'Cancelarás y pasarás al plan Gratis.', [
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
          <TouchableOpacity style={[s.cancelBtn, { backgroundColor: c.danger }]} onPress={cancelar}>
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={s.cancelText}>Cancelar mi suscripción</Text>
          </TouchableOpacity>
        </View>
      ) : <Text style={[s.empty, { color: c.textMuted }]}>No tienes un plan activo</Text>}

      <Text style={[s.section, { color: c.text }]}>Cambiar de plan</Text>
      {planes.map(p => (
        <TouchableOpacity key={p.id} style={[s.plan, { backgroundColor: miPlan?.id === p.id ? c.accent : c.card, borderColor: c.border }]} onPress={() => { setPagar(p); setMetodo('pse'); setBanco(null); setCedula(''); setMsg(''); setError(''); }}>
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
              <Ionicons name="link" size={16} color={metodo === 'pse' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'pse' ? '#fff' : c.textSecondary }}>Pagar en línea (PSE)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.method, { backgroundColor: metodo === 'whatsapp' ? c.accent : c.input, borderColor: c.border }]} onPress={() => setMetodo('whatsapp')}>
              <Ionicons name="logo-whatsapp" size={16} color={metodo === 'whatsapp' ? '#fff' : c.textSecondary} />
              <Text style={{ color: metodo === 'whatsapp' ? '#fff' : c.textSecondary }}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {metodo === 'pse' ? (
            <View style={{ marginTop: 12 }}>
              <Picker label="Banco" value={banco} options={bancos} onSelect={setBanco} valueKey="financial_institution_code" labelKey="financial_institution_name" placeholder="Selecciona tu banco..." />
              <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Número de cédula" placeholderTextColor={c.placeholder} value={cedula} onChangeText={setCedula} keyboardType="number-pad" />
              <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Teléfono (opcional)" placeholderTextColor={c.placeholder} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
              <Text style={[s.hint, { color: c.textMuted }]}>Al continuar se abrirá la página de tu banco para completar el pago de forma segura.</Text>
            </View>
          ) : null}

          {msg ? <Text style={[s.msg, { color: c.success }]}>{msg}</Text> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={pagarPlan} disabled={guardando || polling}>
            {guardando || polling ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continuar</Text>}
          </TouchableOpacity>
          {polling ? <Text style={[s.hint, { color: c.textMuted, textAlign: 'center' }]}>Esperando confirmación del pago…</Text> : null}
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
  method: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  msg: { fontSize: 13, marginTop: 10 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
