import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';
import { useAuth } from '../auth/AuthContext';

const TIPOS = [
  { id: 'casa', nombre: 'Casa' }, { id: 'apartamento', nombre: 'Apartamento' },
  { id: 'edificio', nombre: 'Edificio' }, { id: 'conjunto', nombre: 'Conjunto' },
  { id: 'local', nombre: 'Local' }, { id: 'bodega', nombre: 'Bodega' },
  { id: 'lote', nombre: 'Lote' }, { id: 'finca', nombre: 'Finca' }, { id: 'otro', nombre: 'Otro' },
];

export default function PropiedadesScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const esPropietario = user?.rol === 'propietario';
  const [data, setData] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  // modal crear/editar
  const [form, setForm] = useState(null); // null | {} crear | {id} editar
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('casa');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.propiedades()); } catch { setData([]); }
    if (esPropietario) {
      try { const me = await api.me(); setPlan(me.plan || null); } catch {}
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrirNueva = () => { setForm({}); setNombre(''); setTipo('casa'); setDireccion(''); setCiudad(''); setError(''); };
  const abrirEditar = (p) => { setForm(p); setNombre(p.nombre); setTipo(p.tipo); setDireccion(p.direccion); setCiudad(p.ciudad); setError(''); };
  const guardar = async () => {
    setError('');
    if (!nombre) return setError('Nombre requerido');
    setGuardando(true);
    try {
      const payload = { nombre, tipo, direccion, ciudad };
      if (form?.id) await api.actualizarPropiedad(form.id, payload);
      else await api.crearPropiedad(payload);
      setForm(null); load();
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setGuardando(false); }
  };
  const eliminar = (p) => {
    Alert.alert('Eliminar propiedad', `¿Eliminar "${p.nombre}" y su información?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await api.eliminarPropiedad(p.id); load(); } catch (e) { console.log(e.message); } } },
    ]);
  };

  const limite = plan ? `${data.length}/${plan.max_propiedades} propiedades` : '';

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Propiedades</Text>
      {esPropietario && plan ? <Text style={[s.sub, { color: c.textSecondary }]}>Plan: {plan.nombre} · {limite}</Text> : null}
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin propiedades. Crea una con el botón +</Text>}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: c.card }]}>
              <TouchableOpacity onPress={() => navigation.navigate('Unidades', { propiedad_id: item.id, nombre: item.nombre })}>
                <Text style={[s.title, { color: c.text }]}>{item.nombre}</Text>
                <Text style={[s.meta, { color: c.textSecondary }]}>{item.tipo} · {item.ciudad} · {item.num_unidades} unidad(es)</Text>
                <Text style={[s.dir, { color: c.textMuted }]}>{item.direccion}</Text>
              </TouchableOpacity>
              <View style={s.actions}>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.accent }]} onPress={() => navigation.navigate('Unidades', { propiedad_id: item.id, nombre: item.nombre })}>
                  <Ionicons name="albums" size={15} color={c.accent} /><Text style={{ color: c.accent, fontSize: 12, fontWeight: '600' }}>Unidades</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.textMuted }]} onPress={() => abrirEditar(item)}>
                  <Ionicons name="create" size={15} color={c.textMuted} /><Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.danger }]} onPress={() => eliminar(item)}>
                  <Ionicons name="trash" size={15} color={c.danger} /><Text style={{ color: c.danger, fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      {esPropietario && (
        <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={abrirNueva}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={!!form} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>{form?.id ? 'Editar propiedad' : 'Nueva propiedad'}</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nombre" placeholderTextColor={c.placeholder} value={nombre} onChangeText={setNombre} />
            <Picker label="Tipo" value={tipo} options={TIPOS} onSelect={setTipo} />
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Dirección" placeholderTextColor={c.placeholder} value={direccion} onChangeText={setDireccion} />
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Ciudad" placeholderTextColor={c.placeholder} value={ciudad} onChangeText={setCiudad} />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setForm(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={guardar} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 2 },
  dir: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  empty: { textAlign: 'center', marginTop: 20 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 6, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
