import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';
import DateField from '../components/DateField';

const CONCEPTOS = [
  { id: 'canon', nombre: 'Canon de arrendamiento' },
  { id: 'deposito', nombre: 'Depósito' },
  { id: 'administracion', nombre: 'Administración' },
  { id: 'servicios', nombre: 'Servicios' },
  { id: 'multa', nombre: 'Multa' },
  { id: 'otro', nombre: 'Otro' },
];

export default function NuevoPagoScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [contratos, setContratos] = useState([]);
  const [contratoId, setContratoId] = useState(null);
  const [concepto, setConcepto] = useState('canon');
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [monto, setMonto] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => { try { setContratos(await api.contratos()); } catch {} })();
  }, []);

  const sel = contratos.find(x => x.id === contratoId);
  useEffect(() => {
    if (sel && !monto) setMonto(String(sel.canon));
  }, [sel]);

  const guardar = async () => {
    setError('');
    if (!contratoId) return setError('Selecciona un contrato');
    if (!monto) return setError('Monto requerido');
    setLoading(true);
    try {
      await api.crearPago({ contrato_id: contratoId, concepto, periodo, monto: Number(monto), fecha_vencimiento: fechaVenc || null });
      navigation.goBack();
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.title, { color: c.text }]}>Nuevo pago</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Cada pago pertenece a un contrato. Si la fecha venció, queda en mora.</Text>

      <Picker label="Contrato" value={contratoId} options={contratos} onSelect={setContratoId} labelKey="unidad_codigo" placeholder="Seleccionar contrato..." />
      {sel && <Text style={[s.hint, { color: c.textSecondary }]}>Unidad {sel.unidad_codigo} · Inquilino {sel.inquilino_nombre} · Canon ${Number(sel.canon).toLocaleString('es-CO')}</Text>}

      <Picker label="Concepto" value={concepto} options={CONCEPTOS} onSelect={setConcepto} />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Periodo</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={periodo} onChangeText={setPeriodo} placeholder="2026-09" placeholderTextColor={c.placeholder} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Monto $</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={monto} onChangeText={setMonto} keyboardType="numeric" placeholder="900000" placeholderTextColor={c.placeholder} />
        </View>
      </View>

      <DateField label="Fecha vencimiento" value={fechaVenc} onChange={setFechaVenc} />

      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={guardar} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Guardar pago</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 12, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  hint: { fontSize: 12, marginBottom: 12 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
