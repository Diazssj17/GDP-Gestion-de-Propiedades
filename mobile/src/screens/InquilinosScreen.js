import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

export default function InquilinosScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  // modal nuevo inquilino
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // modal gestionar cuenta
  const [gestionar, setGestionar] = useState(null);
  const [accEmail, setAccEmail] = useState('');
  const [accPass, setAccPass] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.inquilinos()); } catch { setData([]); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const crear = async () => {
    setError('');
    if (!nombre) return setError('Nombre requerido');
    setGuardando(true);
    try {
      await api.crearInquilino({ nombre, documento, telefono, email, password });
      setNuevo(false); setNombre(''); setDocumento(''); setTelefono(''); setEmail(''); setPassword('');
      load();
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setGuardando(false); }
  };

  const abrirGestionar = (inq) => { setGestionar(inq); setAccEmail(inq.email || ''); setAccPass(''); setError(''); };
  const ejecutarAccion = async (accion) => {
    setGuardando(true); setError('');
    try {
      const payload = { accion };
      if (accion === 'crear_cuenta') { payload.email = accEmail; payload.password = accPass; }
      if (accion === 'reset_password') { payload.password = accPass; }
      await api.gestionarInquilino(gestionar.id, payload);
      setGestionar(null);
      load();
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setGuardando(false); }
  };

  const tieneCuenta = (inq) => !!inq.usuario_id;
  const activo = (inq) => inq.usuario_activo !== 0;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Inquilinos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Administra inquilinos y sus cuentas de acceso</Text>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin inquilinos. Crea uno con el botón +</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => abrirGestionar(item)} activeOpacity={0.8}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.nombre}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>
                    {item.documento ? `CC ${item.documento}` : 'Sin documento'} {item.telefono ? `· ${item.telefono}` : ''}
                  </Text>
                  <Text style={[s.meta, { color: c.textMuted }]}>{item.email || '—'}</Text>
                </View>
                {tieneCuenta(item) ? (
                  <View style={[s.badge, { backgroundColor: activo(item) ? '#059669' : '#64748B' }]}>
                    <Text style={s.badgeText}>{activo(item) ? 'Con cuenta' : 'Inactivo'}</Text>
                  </View>
                ) : (
                  <View style={[s.badge, { backgroundColor: c.textMuted }]}><Text style={s.badgeText}>Sin cuenta</Text></View>
                )}
              </View>
              <Text style={[s.link, { color: c.accent }]}>Administrar →</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => setNuevo(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal nuevo inquilino */}
      <Modal visible={nuevo} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Nuevo inquilino</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nombre" placeholderTextColor={c.placeholder} value={nombre} onChangeText={setNombre} />
            <View style={s.row2}>
              <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Documento" placeholderTextColor={c.placeholder} value={documento} onChangeText={setDocumento} />
              <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Teléfono" placeholderTextColor={c.placeholder} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
            </View>
            <Text style={[s.label, { color: c.textSecondary }]}>Cuenta de acceso (opcional)</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Email" placeholderTextColor={c.placeholder} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Contraseña" placeholderTextColor={c.placeholder} value={password} onChangeText={setPassword} secureTextEntry />
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

      {/* Modal gestionar cuenta */}
      <Modal visible={!!gestionar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>{gestionar?.nombre}</Text>
            {!tieneCuenta(gestionar || {}) ? (
              <View>
                <Text style={[s.label, { color: c.textSecondary }]}>Crear cuenta de acceso</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Email" placeholderTextColor={c.placeholder} value={accEmail} onChangeText={setAccEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Contraseña" placeholderTextColor={c.placeholder} value={accPass} onChangeText={setAccPass} secureTextEntry />
                {error ? <Text style={s.error}>{error}</Text> : null}
                <View style={s.modalBtns}>
                  <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setGestionar(null)}><Text style={{ color: c.textSecondary }}>Cerrar</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={() => ejecutarAccion('crear_cuenta')} disabled={guardando}>
                    {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear cuenta</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={[s.meta, { color: c.textSecondary }]}>Estado: {activo(gestionar) ? 'Activa' : 'Inactiva'}</Text>
                <Text style={[s.label, { color: c.textSecondary }]}>Nueva contraseña</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nueva contraseña" placeholderTextColor={c.placeholder} value={accPass} onChangeText={setAccPass} secureTextEntry />
                {error ? <Text style={s.error}>{error}</Text> : null}
                <TouchableOpacity style={[s.actionBtn, { borderColor: c.accent }]} onPress={() => ejecutarAccion('reset_password')} disabled={guardando}>
                  <Text style={{ color: c.accent, fontWeight: '600' }}>Resetear contraseña</Text>
                </TouchableOpacity>
                <View style={s.modalBtns}>
                  <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setGestionar(null)}><Text style={{ color: c.textSecondary }}>Cerrar</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: activo(gestionar) ? c.danger : '#059669' }]} onPress={() => ejecutarAccion(activo(gestionar) ? 'desactivar' : 'activar')} disabled={guardando}>
                    <Text style={s.btnText}>{activo(gestionar) ? 'Desactivar' : 'Activar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 3 },
  link: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  actionBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 6, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
