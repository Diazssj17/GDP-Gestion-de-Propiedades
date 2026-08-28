import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, FlatList, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import DateField from '../components/DateField';

const METODOS = [
  { id: 'partes_iguales', label: 'Partes iguales' },
  { id: 'porcentaje', label: 'Porcentaje' },
  { id: 'consumo', label: 'Consumo' },
  { id: 'valor_fijo', label: 'Valor fijo' },
  { id: 'manual', label: 'Manual' },
];

function Picker({ label, value, options, onSelect, labelKey = 'nombre', valueKey = 'id' }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o[valueKey] === value);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text>
      <TouchableOpacity style={[s.input, { backgroundColor: c.input, borderColor: c.border }]} onPress={() => setOpen(true)}>
        <Text style={{ color: selected ? c.text : c.placeholder }}>{selected ? selected[labelKey] : 'Seleccionar...'}</Text>
        <Ionicons name="chevron-down" size={16} color={c.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[s.modalBox, { backgroundColor: c.card }]}>
            <FlatList
              data={options}
              keyExtractor={o => String(o[valueKey])}
              renderItem={({ item }) => (
                <TouchableOpacity style={[s.modalItem, { borderBottomColor: c.border }]} onPress={() => { onSelect(item[valueKey]); setOpen(false); }}>
                  <Text style={{ color: c.text }}>{item[labelKey]}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function NuevoReciboScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [servicios, setServicios] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [servicioId, setServicioId] = useState(null);
  const [propiedadId, setPropiedadId] = useState(null);
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [valor, setValor] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [metodo, setMetodo] = useState('partes_iguales');
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [dist, setDist] = useState({}); // {unidad_id: {porcentaje, consumo, monto}}
  const [foto, setFoto] = useState(null); // {uri, base64}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setServicios(await api.servicios()); } catch {}
      try { setPropiedades(await api.propiedades()); } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!propiedadId) return setUnidades([]);
    (async () => { try { setUnidades(await api.unidades({ propiedad_id: propiedadId })); } catch { setUnidades([]); } })();
  }, [propiedadId]);

  const toggleUnidad = (id) => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const setDistVal = (id, key, val) => setDist(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError('Permiso de cámara denegado');
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (!res.canceled) setFoto(res.assets[0]);
  };

  const preview = () => {
    const ids = [...seleccionadas];
    if (!ids.length || !valor) return [];
    const v = Number(valor) || 0;
    if (metodo === 'partes_iguales') {
      const base = Math.round((v / ids.length) * 100) / 100;
      let diff = Math.round((v - base * ids.length) * 100) / 100;
      return ids.map((id, i) => ({ id, monto: i === ids.length - 1 ? Math.round((base + diff) * 100) / 100 : base }));
    }
    if (metodo === 'porcentaje') return ids.map(id => ({ id, monto: Math.round(v * ((dist[id]?.porcentaje || 0) / 100) * 100) / 100 }));
    if (metodo === 'consumo') {
      const tot = ids.reduce((a, id) => a + (Number(dist[id]?.consumo) || 0), 0) || 1;
      return ids.map(id => ({ id, monto: Math.round(v * (Number(dist[id]?.consumo) || 0) / tot * 100) / 100 }));
    }
    return ids.map(id => ({ id, monto: Number(dist[id]?.monto) || 0 }));
  };

  const guardar = async () => {
    setError('');
    if (!servicioId || !propiedadId || !valor) return setError('Servicio, propiedad y valor son obligatorios');
    if (!seleccionadas.size) return setError('Selecciona al menos una unidad');
    setLoading(true);
    try {
      const distribucion = [...seleccionadas].map(id => ({
        unidad_id: id,
        porcentaje: Number(dist[id]?.porcentaje) || 0,
        consumo: Number(dist[id]?.consumo) || 0,
        monto: Number(dist[id]?.monto) || 0,
      }));
      const payload = {
        servicio_id: servicioId, propiedad_id: propiedadId, valor: Number(valor), periodo,
        fecha_vencimiento: fechaVenc || null, empresa_prestadora: empresa, numero_cuenta: cuenta,
        metodo, distribucion, foto_base64: foto?.base64 || null,
      };
      await api.crearRecibo(payload);
      navigation.goBack();
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const prev = preview();
  const totalDistribuido = prev.reduce((a, p) => a + p.monto, 0);

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.title, { color: c.text }]}>Nuevo recibo</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Crea un recibo y distribúyelo entre unidades (compartidos)</Text>

      <Picker label="Servicio" value={servicioId} options={servicios} onSelect={setServicioId} />
      <Picker label="Propiedad" value={propiedadId} options={propiedades} onSelect={(id) => { setPropiedadId(id); setSeleccionadas(new Set()); setDist({}); }} />

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Periodo</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={periodo} onChangeText={setPeriodo} placeholder="2026-08" placeholderTextColor={c.placeholder} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Valor total $</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={valor} onChangeText={setValor} keyboardType="numeric" placeholder="300000" placeholderTextColor={c.placeholder} />
        </View>
      </View>

      <DateField label="Fecha vencimiento" value={fechaVenc} onChange={setFechaVenc} />

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Empresa</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={empresa} onChangeText={setEmpresa} placeholder="Acueducto VC" placeholderTextColor={c.placeholder} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>N° cuenta</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={cuenta} onChangeText={setCuenta} placeholder="12345" placeholderTextColor={c.placeholder} />
        </View>
      </View>

      <Text style={[s.label, { color: c.textSecondary }]}>Método de distribución</Text>
      <View style={s.methods}>
        {METODOS.map(m => (
          <TouchableOpacity key={m.id} style={[s.chip, { backgroundColor: metodo === m.id ? c.primary : c.card, borderColor: c.border }]} onPress={() => setMetodo(m.id)}>
            <Text style={{ color: metodo === m.id ? '#fff' : c.textSecondary, fontSize: 12 }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {unidades.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Unidades a distribuir</Text>
          {unidades.map(u => {
            const sel = seleccionadas.has(u.id);
            return (
              <View key={u.id} style={[s.unit, { backgroundColor: c.card, borderColor: sel ? c.accent : c.border }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleUnidad(u.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={20} color={sel ? c.accent : c.textMuted} />
                    <Text style={{ color: c.text, fontWeight: '600' }}>{u.codigo}{u.nombre ? ` - ${u.nombre}` : ''}</Text>
                  </View>
                </TouchableOpacity>
                {sel && metodo === 'porcentaje' && (
                  <TextInput style={[s.miniInput, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} keyboardType="numeric" placeholder="%" placeholderTextColor={c.placeholder} value={dist[u.id]?.porcentaje?.toString() || ''} onChangeText={t => setDistVal(u.id, 'porcentaje', t)} />
                )}
                {sel && metodo === 'consumo' && (
                  <TextInput style={[s.miniInput, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} keyboardType="numeric" placeholder="consumo" placeholderTextColor={c.placeholder} value={dist[u.id]?.consumo?.toString() || ''} onChangeText={t => setDistVal(u.id, 'consumo', t)} />
                )}
                {sel && (metodo === 'valor_fijo' || metodo === 'manual') && (
                  <TextInput style={[s.miniInput, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} keyboardType="numeric" placeholder="$ monto" placeholderTextColor={c.placeholder} value={dist[u.id]?.monto?.toString() || ''} onChangeText={t => setDistVal(u.id, 'monto', t)} />
                )}
              </View>
            );
          })}
        </View>
      )}

      {prev.length > 0 && (
        <View style={[s.preview, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF' }]}>
          <Text style={[s.previewTitle, { color: c.accent }]}>Vista previa de distribución</Text>
          {prev.map(p => {
            const u = unidades.find(x => x.id === p.id);
            return <Text key={p.id} style={[s.distItem, { color: c.textSecondary }]}>{u?.codigo} → ${Number(p.monto).toLocaleString('es-CO')}</Text>;
          })}
          <Text style={[s.total, { color: c.text }]}>Total: ${Number(totalDistribuido).toLocaleString('es-CO')} (recibo: ${Number(valor || 0).toLocaleString('es-CO')})</Text>
        </View>
      )}

      <TouchableOpacity style={[s.photoBtn, { backgroundColor: c.card, borderColor: c.border }]} onPress={tomarFoto}>
        <Ionicons name="camera" size={18} color={c.accent} />
        <Text style={{ color: c.textSecondary }}>{foto ? 'Cambiar foto' : 'Adjuntar foto del recibo'}</Text>
      </TouchableOpacity>
      {foto && <Image source={{ uri: foto.uri }} style={s.foto} />}

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={guardar} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Guardar recibo</Text>}
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
  miniInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: 90, fontSize: 13, textAlign: 'center' },
  row2: { flexDirection: 'row', gap: 10 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  unit: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 8 },
  preview: { borderRadius: 10, padding: 12, marginTop: 8 },
  previewTitle: { fontWeight: '700', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 },
  distItem: { fontSize: 13, lineHeight: 20 },
  total: { fontWeight: '800', marginTop: 6, fontSize: 13 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 12, justifyContent: 'center' },
  foto: { width: '100%', height: 180, borderRadius: 10, marginTop: 10 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 12, maxHeight: 400, overflow: 'hidden' },
  modalItem: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
