import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';

const TIPOS = [
  { id: 'correctivo', nombre: 'Correctivo' },
  { id: 'preventivo', nombre: 'Preventivo' },
];
const PRIORIDADES = [
  { id: 'baja', nombre: 'Baja' },
  { id: 'media', nombre: 'Media' },
  { id: 'alta', nombre: 'Alta' },
  { id: 'critica', nombre: 'Crítica' },
];

export default function NuevoMantenimientoScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [propiedades, setPropiedades] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [propiedadId, setPropiedadId] = useState(null);
  const [unidadId, setUnidadId] = useState(null);
  const [tipo, setTipo] = useState('correctivo');
  const [prioridad, setPrioridad] = useState('media');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [responsable, setResponsable] = useState('');
  const [costoEstimado, setCostoEstimado] = useState('');
  const [foto, setFoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { (async () => { try { setPropiedades(await api.propiedades()); } catch {} })(); }, []);
  useEffect(() => {
    if (!propiedadId) return setUnidades([]);
    (async () => { try { setUnidades(await api.unidades({ propiedad_id: propiedadId })); } catch { setUnidades([]); } })();
  }, [propiedadId]);

  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError('Permiso de cámara denegado');
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (!res.canceled) setFoto(res.assets[0]);
  };

  const guardar = async () => {
    setError('');
    if (!unidadId) return setError('Selecciona una unidad');
    if (!titulo || !descripcion) return setError('Título y descripción son obligatorios');
    setLoading(true);
    try {
      await api.crearMantenimiento({ unidad_id: unidadId, tipo, prioridad, titulo, descripcion, responsable, costo_estimado: Number(costoEstimado || 0), foto_base64: foto?.base64 || null });
      navigation.goBack();
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al guardar');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.title, { color: c.text }]}>Nuevo ticket</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Reporta un problema o mantenimiento de una unidad</Text>

      <Picker label="Propiedad" value={propiedadId} options={propiedades} onSelect={(id) => { setPropiedadId(id); setUnidadId(null); }} />
      <Picker label="Unidad" value={unidadId} options={unidades} onSelect={setUnidadId} labelKey="codigo" />
      <Picker label="Tipo" value={tipo} options={TIPOS} onSelect={setTipo} />
      <Picker label="Prioridad" value={prioridad} options={PRIORIDADES} onSelect={setPrioridad} />

      <Text style={[s.label, { color: c.textSecondary }]}>Título</Text>
      <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={titulo} onChangeText={setTitulo} placeholder="Grifo roto, fuga..." placeholderTextColor={c.placeholder} />

      <Text style={[s.label, { color: c.textSecondary }]}>Descripción</Text>
      <TextInput style={[s.input, s.area, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={descripcion} onChangeText={setDescripcion} placeholder="Describe el problema..." placeholderTextColor={c.placeholder} multiline />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Responsable</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={responsable} onChangeText={setResponsable} placeholder="Plomero, etc." placeholderTextColor={c.placeholder} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: c.textSecondary }]}>Costo estimado $</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={costoEstimado} onChangeText={setCostoEstimado} keyboardType="numeric" placeholder="0" placeholderTextColor={c.placeholder} />
        </View>
      </View>

      <TouchableOpacity style={[s.photoBtn, { backgroundColor: c.card, borderColor: c.border }]} onPress={tomarFoto}>
        <Ionicons name="camera" size={18} color={c.accent} />
        <Text style={{ color: c.textSecondary }}>{foto ? 'Cambiar foto' : 'Adjuntar foto'}</Text>
      </TouchableOpacity>
      {foto && <Image source={{ uri: foto.uri }} style={s.foto} />}

      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={guardar} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear ticket</Text>}
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
  area: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 4, justifyContent: 'center' },
  foto: { width: '100%', height: 180, borderRadius: 10, marginTop: 10 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
