import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const fmt = n => `$${Number(n).toLocaleString('es-CO')}/mes`;

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const { login } = useAuth();
  const c = theme.colors;
  const [planes, setPlanes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => { try { setPlanes(await api.planesPublico()); } catch {} })();
  }, []);

  const registrar = async () => {
    setError('');
    if (!nombre || !email || !password || !planId) return setError('Completa todos los campos y elige un plan');
    setLoading(true);
    try {
      const res = await api.register({ nombre, email, password, plan_id: planId });
      // auto-login
      const { token } = res;
      if (token) {
        await login(email, password);
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al registrar');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.title, { color: c.text }]}>Crear cuenta</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Elige el plan que mejor se adapte a ti</Text>

      <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nombre completo" placeholderTextColor={c.placeholder} value={nombre} onChangeText={setNombre} />
      <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Email" placeholderTextColor={c.placeholder} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Contraseña (mín 8, letras y números)" placeholderTextColor={c.placeholder} value={password} onChangeText={setPassword} secureTextEntry />

      <Text style={[s.section, { color: c.text }]}>Selecciona tu plan</Text>
      {planes.map(p => (
        <TouchableOpacity key={p.id} style={[s.plan, { backgroundColor: planId === p.id ? c.accent : c.card, borderColor: planId === p.id ? c.accent : c.border }]} onPress={() => setPlanId(p.id)}>
          <View style={{ flex: 1 }}>
            <Text style={[s.planName, { color: planId === p.id ? '#fff' : c.text }]}>{p.nombre}</Text>
            <Text style={[s.planDesc, { color: planId === p.id ? '#e2e8f0' : c.textSecondary }]}>{p.descripcion}</Text>
            <Text style={[s.planLimits, { color: planId === p.id ? '#e2e8f0' : c.textMuted }]}>{p.max_propiedades} propiedades · {p.max_unidades} unidades</Text>
          </View>
          <Text style={[s.planPrice, { color: planId === p.id ? '#fff' : c.accent }]}>{fmt(p.precio_mensual)}</Text>
        </TouchableOpacity>
      ))}

      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={registrar} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Registrarme</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
        <Text style={{ color: c.accent, textAlign: 'center' }}>Ya tengo cuenta — Iniciar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: '900' },
  sub: { fontSize: 12, marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  section: { fontWeight: '800', marginTop: 8, marginBottom: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  planName: { fontWeight: '800', fontSize: 16 },
  planDesc: { fontSize: 12, marginTop: 2 },
  planLimits: { fontSize: 11, marginTop: 2 },
  planPrice: { fontWeight: '800', fontSize: 15, marginLeft: 8 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 6, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
