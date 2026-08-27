import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';

export default function PropietariosScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  // crear
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tipo, setTipo] = useState('persona');
  const [planId, setPlanId] = useState(null);
  // gestionar
  const [gestionar, setGestionar] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [nuevoPlanId, setNuevoPlanId] = useState(null);
  const [accPass, setAccPass] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [props, pls] = await Promise.all([api.propietarios(), api.planes()]);
      setData(props); setPlanes(pls);
    } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const crear = async () => {
    setError('');
    if (!nombre || !email || !password) return setError('Nombre, email y contraseña requeridos');
    setGuardando(true);
    try {
      await api.crearPropietario({ nombre, email, password, tipo, plan_id: planId });
      setNuevo(false); setNombre(''); setEmail(''); setPassword(''); setPlanId(null); setTipo('persona');
      load();
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setGuardando(false); }
  };

  const abrirGestionar = async (p) => {
    setGestionar(p);
    setNuevoPlanId(p.plan_id || null);
    setAccPass('');
    setError('');
    try { setDetalle(await api.detallePropietario(p.id)); } catch { setDetalle(p); }
  };
  const ejecutar = async (accion, payload = {}) => {
    setGuardando(true); setError('');
    try {
      await api.gestionarPropietario(gestionar.id, { accion, ...payload });
      setGestionar(null);
      load();
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setGuardando(false); }
  };

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Propietarios</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Administra cuentas de propietarios y sus planes</Text>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin propietarios.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => abrirGestionar(item)} activeOpacity={0.8}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.nombre}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.email}</Text>
                  <Text style={[s.meta, { color: c.textMuted }]}>{item.tipo} · {item.ciudad || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {item.plan_nombre ? <View style={[s.chip, { backgroundColor: c.accent }]}><Text style={s.chipText}>{item.plan_nombre}</Text></View> : null}
                  <View style={[s.chip, { backgroundColor: item.usuario_activo === 0 ? '#64748B' : '#059669' }]}><Text style={s.chipText}>{item.usuario_activo === 0 ? 'Inactivo' : 'Activo'}</Text></View>
                </View>
              </View>
              <Text style={[s.link, { color: c.accent }]}>Administrar →</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => setNuevo(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal crear */}
      <Modal visible={nuevo} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Nuevo propietario</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nombre" placeholderTextColor={c.placeholder} value={nombre} onChangeText={setNombre} />
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Email" placeholderTextColor={c.placeholder} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Contraseña" placeholderTextColor={c.placeholder} value={password} onChangeText={setPassword} secureTextEntry />
            <Picker label="Tipo" value={tipo} options={[{ id: 'persona', nombre: 'Persona' }, { id: 'empresa', nombre: 'Empresa' }, { id: 'inmobiliaria', nombre: 'Inmobiliaria' }]} onSelect={setTipo} />
            <Picker label="Plan" value={planId} options={planes} onSelect={setPlanId} />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setNuevo(false)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={crear} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal gestionar */}
      <Modal visible={!!gestionar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>{gestionar?.nombre}</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{gestionar?.email}</Text>
            {detalle?.stats ? (
              <View style={[s.stats, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF' }]}>
                <Text style={[s.stat, { color: c.text }]}>🏠 {detalle.stats.propiedades} propiedades</Text>
                <Text style={[s.stat, { color: c.text }]}>🏢 {detalle.stats.unidades} unidades</Text>
                <Text style={[s.stat, { color: c.text }]}>📄 {detalle.stats.contratos} contratos · {detalle.stats.inquilinos} inquilinos</Text>
              </View>
            ) : null}
            <Text style={[s.label, { color: c.textSecondary }]}>Asignar plan</Text>
            <Picker label="Plan" value={nuevoPlanId} options={planes} onSelect={setNuevoPlanId} />
            <Text style={[s.label, { color: c.textSecondary }]}>Nueva contraseña</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nueva contraseña" placeholderTextColor={c.placeholder} value={accPass} onChangeText={setAccPass} secureTextEntry />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.analizarBtn, { borderColor: c.info }]} onPress={() => navigation.navigate('Analisis', { id: gestionar.id, nombre: gestionar.nombre })}>
              <Ionicons name="analytics" size={16} color={c.info} />
              <Text style={{ color: c.info, fontWeight: '700' }}>Analizar propietario</Text>
            </TouchableOpacity>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setGestionar(null)}><Text style={{ color: c.textSecondary }}>Cerrar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={() => ejecutar('asignar_plan', { plan_id: nuevoPlanId })} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Asignar plan</Text>}
              </TouchableOpacity>
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel2, { borderColor: c.accent }]} onPress={() => ejecutar('reset_password', { password: accPass })} disabled={guardando}>
                <Text style={{ color: c.accent }}>Reset pass</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: gestionar?.usuario_activo === 0 ? '#059669' : c.danger }]} onPress={() => ejecutar(gestionar?.usuario_activo === 0 ? 'activar' : 'desactivar')} disabled={guardando}>
                <Text style={s.btnText}>{gestionar?.usuario_activo === 0 ? 'Activar' : 'Desactivar'}</Text>
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
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 3 },
  link: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  stats: { borderRadius: 10, padding: 12, marginTop: 10 },
  stat: { fontSize: 13, marginTop: 2 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 6, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  cancel2: { borderWidth: 1 },
  analizarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 12, marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
});
