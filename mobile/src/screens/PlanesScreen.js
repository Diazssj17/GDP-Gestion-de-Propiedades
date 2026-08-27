import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

export default function PlanesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editar, setEditar] = useState(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [maxProps, setMaxProps] = useState('');
  const [maxUnis, setMaxUnis] = useState('');
  const [maxUsers, setMaxUsers] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.planes()); } catch { setData([]); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const abrirEditar = (p) => {
    setEditar(p);
    setNombre(p.nombre); setPrecio(String(p.precio_mensual)); setMaxProps(String(p.max_propiedades));
    setMaxUnis(String(p.max_unidades)); setMaxUsers(String(p.max_usuarios));
  };
  const guardar = async () => {
    setGuardando(true);
    try {
      await api.actualizarPlan(editar.id, { nombre, precio_mensual: Number(precio) || 0, max_propiedades: Number(maxProps) || 0, max_unidades: Number(maxUnis) || 0, max_usuarios: Number(maxUsers) || 0 });
      setEditar(null); load();
    } catch (e) { console.log(e.message); } finally { setGuardando(false); }
  };

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Planes</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Edita precios y límites de cada plan</Text>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: c.card }]}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.nombre}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>${Number(item.precio_mensual).toLocaleString('es-CO')}/mes</Text>
                  <Text style={[s.meta, { color: c.textMuted }]}>{item.max_propiedades} propiedades · {item.max_unidades} unidades · {item.max_usuarios} usuarios</Text>
                </View>
                <TouchableOpacity style={[s.editBtn, { borderColor: c.accent }]} onPress={() => abrirEditar(item)}>
                  <Ionicons name="create" size={15} color={c.accent} />
                  <Text style={{ color: c.accent, fontWeight: '600', fontSize: 12 }}>Editar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!editar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Editar plan</Text>
            <Text style={[s.label, { color: c.textSecondary }]}>Nombre</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={nombre} onChangeText={setNombre} />
            <Text style={[s.label, { color: c.textSecondary }]}>Precio mensual $</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={precio} onChangeText={setPrecio} keyboardType="numeric" />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.textSecondary }]}>Máx propiedades</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={maxProps} onChangeText={setMaxProps} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.textSecondary }]}>Máx unidades</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={maxUnis} onChangeText={setMaxUnis} keyboardType="numeric" />
              </View>
            </View>
            <Text style={[s.label, { color: c.textSecondary }]}>Máx usuarios</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={maxUsers} onChangeText={setMaxUsers} keyboardType="numeric" />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setEditar(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
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
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 3 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
