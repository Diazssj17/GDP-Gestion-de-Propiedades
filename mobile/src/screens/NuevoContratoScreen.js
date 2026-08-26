import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';

export default function NuevoContratoScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [propiedades, setPropiedades] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [inquilinos, setInquilinos] = useState([]);
  const [propiedadId, setPropiedadId] = useState(null);
  const [unidadId, setUnidadId] = useState(null);
  const [inquilinoId, setInquilinoId] = useState(null);
  // crear inquilino inline
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDoc, setNuevoDoc] = useState('');
  const [nuevoTel, setNuevoTel] = useState('');
  const [crearInquilinoNuevo, setCrearInquilinoNuevo] = useState(false);

  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState('');
  const [canon, setCanon] = useState('');
  const [deposito, setDeposito] = useState('');
  const [diaLimite, setDiaLimite] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setPropiedades(await api.propiedades()); } catch {}
      try { setInquilinos(await api.inquilinos()); } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!propiedadId) return setUnidades([]);
    (async () => { try { setUnidades(await api.unidades({ propiedad_id: propiedadId })); } catch { setUnidades([]); } })();
  }, [propiedadId]);

  const disponibles = unidades.filter(u => u.estado === 'disponible');

  const guardar = async () => {
    setError('');
    if (!unidadId) return setError('Selecciona una unidad disponible');
    if (!inquilinoId && !nuevoNombre) return setError('Selecciona o crea un inquilino');
    if (!fechaFin || !canon) return setError('Fecha fin y canon son obligatorios');
    setLoading(true);
    try {
      let inqId = inquilinoId;
      if (crearInquilinoNuevo) {
        const nuevo = await api.crearInquilino({ nombre: nuevoNombre, documento: nuevoDoc, telefono: nuevoTel });
        inqId = nuevo.id;
      }
      await api.crearContrato({ unidad_id: unidadId, inquilino_id: inqId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, canon: Number(canon), deposito: Number(deposito || 0), dia_limite_pago: Number(diaLimite || 5) });
      navigation.goBack();
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.title, { color: c.text }]}>Nuevo contrato</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Unidad ↔ Inquilino · 1 contrato activo por unidad</Text>

      <Picker label="Propiedad" value={propiedadId} options={propiedades} onSelect={(id) => { setPropiedadId(id); setUnidadId(null); }} />
      <Picker label="Unidad (disponible)" value={unidadId} options={disponibles} onSelect={setUnidadId} labelKey="codigo" placeholder={disponibles.length ? 'Seleccionar unidad...' : 'Sin unidades disponibles'} />

      <Text style={[s.section, { color: c.text }]}>Inquilino</Text>
      <TouchableOpacity style={[s.toggle, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => setCrearInquilinoNuevo(v => !v)}>
        <Text style={{ color: c.accent }}>{crearInquilinoNuevo ? '← Elegir existente' : '+ Crear inquilino nuevo'}</Text>
      </TouchableOpacity>
      {crearInquilinoNuevo ? (
        <View>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nombre completo" placeholderTextColor={c.placeholder} value={nuevoNombre} onChangeText={setNuevoNombre} />
          <View style={s.row}>
            <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Documento" placeholderTextColor={c.placeholder} value={nuevoDoc} onChangeText={setNuevoDoc} />
            <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Teléfono" placeholderTextColor={c.placeholder} value={nuevoTel} onChangeText={setNuevoTel} keyboardType="phone-pad" />
          </View>
        </View>
      ) : (
        <Picker label="Inquilino" value={inquilinoId} options={inquilinos} onSelect={setInquilinoId} placeholder="Seleccionar inquilino..." />
      )}

      <Text style={[s.section, { color: c.text }]}>Vigencia y canon</Text>
      <View style={s.row}>
        <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Fecha inicio (2026-01-01)" placeholderTextColor={c.placeholder} value={fechaInicio} onChangeText={setFechaInicio} />
        <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Fecha fin (2026-12-31)" placeholderTextColor={c.placeholder} value={fechaFin} onChangeText={setFechaFin} />
      </View>
      <View style={s.row}>
        <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Canon $" placeholderTextColor={c.placeholder} value={canon} onChangeText={setCanon} keyboardType="numeric" />
        <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Depósito $" placeholderTextColor={c.placeholder} value={deposito} onChangeText={setDeposito} keyboardType="numeric" />
      </View>
      <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Día límite de pago (ej. 5)" placeholderTextColor={c.placeholder} value={diaLimite} onChangeText={setDiaLimite} keyboardType="numeric" />

      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={guardar} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear contrato</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 12, marginBottom: 16 },
  section: { fontWeight: '800', marginTop: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  toggle: { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
