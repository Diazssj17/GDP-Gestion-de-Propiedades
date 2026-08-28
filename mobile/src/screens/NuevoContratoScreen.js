import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';
import DateField from '../components/DateField';

const TIPOS_DOC = [
  { id: 'contrato', nombre: 'Contrato' },
  { id: 'cedula', nombre: 'Cédula' },
  { id: 'certificado_laboral', nombre: 'Certificado laboral' },
  { id: 'fiador', nombre: 'Fiador' },
  { id: 'otro', nombre: 'Otro' },
];

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
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPass, setNuevoPass] = useState('');
  const [crearInquilinoNuevo, setCrearInquilinoNuevo] = useState(false);

  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState('');
  const [canon, setCanon] = useState('');
  const [deposito, setDeposito] = useState('');
  const [diaLimite, setDiaLimite] = useState('5');
  const [tipoDoc, setTipoDoc] = useState('contrato');
  const [documentos, setDocumentos] = useState([]); // [{name, tipo, base64}]
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

  const adjuntarDocumento = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const mime = asset.mimeType || 'application/pdf';
      setDocumentos(prev => [...prev, { name: asset.name, tipo: tipoDoc, base64: `data:${mime};base64,${base64}` }]);
    } catch (e) { setError('No se pudo leer el documento'); }
  };
  const quitarDocumento = (i) => setDocumentos(prev => prev.filter((_, idx) => idx !== i));

  const guardar = async () => {
    setError('');
    if (!unidadId) return setError('Selecciona una unidad disponible');
    if (!inquilinoId && !nuevoNombre) return setError('Selecciona o crea un inquilino');
    if (!fechaFin || !canon) return setError('Fecha fin y canon son obligatorios');
    setLoading(true);
    try {
      let inqId = inquilinoId;
      if (crearInquilinoNuevo) {
        const nuevo = await api.crearInquilino({ nombre: nuevoNombre, documento: nuevoDoc, telefono: nuevoTel, email: nuevoEmail, password: nuevoPass });
        inqId = nuevo.id;
      }
      // El primer documento de tipo 'contrato' se guarda como documento principal; los demas como documentos extra
      const principal = documentos.find(d => d.tipo === 'contrato');
      const res = await api.crearContrato({ unidad_id: unidadId, inquilino_id: inqId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, canon: Number(canon), deposito: Number(deposito || 0), dia_limite_pago: Number(diaLimite || 5), documento_base64: principal?.base64 || null });
      for (const d of documentos) {
        if (d === principal) continue;
        await api.subirDocumento(res.id, { nombre: d.name, tipo: d.tipo, base64: d.base64 });
      }
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
          <Text style={[s.label, { color: c.textSecondary }]}>Cuenta de acceso (opcional)</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Email (para que el inquilino entre)" placeholderTextColor={c.placeholder} value={nuevoEmail} onChangeText={setNuevoEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Contraseña" placeholderTextColor={c.placeholder} value={nuevoPass} onChangeText={setNuevoPass} secureTextEntry />
          <Text style={[s.hint, { color: c.textMuted }]}>Si llenas email y contraseña, se crea un usuario que podrá entrar como inquilino.</Text>
        </View>
      ) : (
        <Picker label="Inquilino" value={inquilinoId} options={inquilinos} onSelect={setInquilinoId} placeholder="Seleccionar inquilino..." />
      )}

      <Text style={[s.section, { color: c.text }]}>Vigencia y canon</Text>
      <View style={s.row}>
        <View style={s.half}><DateField label="Fecha inicio" value={fechaInicio} onChange={setFechaInicio} /></View>
        <View style={s.half}><DateField label="Fecha fin" value={fechaFin} onChange={setFechaFin} /></View>
      </View>
      <View style={s.row}>
        <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Canon $" placeholderTextColor={c.placeholder} value={canon} onChangeText={setCanon} keyboardType="numeric" />
        <TextInput style={[s.input, s.half, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Depósito $" placeholderTextColor={c.placeholder} value={deposito} onChangeText={setDeposito} keyboardType="numeric" />
      </View>
      <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Día límite de pago (ej. 5)" placeholderTextColor={c.placeholder} value={diaLimite} onChangeText={setDiaLimite} keyboardType="numeric" />

      <Text style={[s.section, { color: c.text }]}>Documentación</Text>
      <Picker label="Tipo de documento" value={tipoDoc} options={TIPOS_DOC} onSelect={setTipoDoc} />
      <TouchableOpacity style={[s.photoBtn, { backgroundColor: c.card, borderColor: c.border }]} onPress={adjuntarDocumento}>
        <Ionicons name="document-attach" size={18} color={c.accent} />
        <Text style={{ color: c.textSecondary }}>Agregar documento (PDF / imagen)</Text>
      </TouchableOpacity>
      {documentos.map((d, i) => (
        <View key={i} style={[s.docRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="document" size={16} color={c.accent} />
          <Text style={[s.docName, { color: c.text }]} numberOfLines={1}>{d.name}</Text>
          <Text style={[s.docTipo, { color: c.textMuted }]}>{TIPOS_DOC.find(t => t.id === d.tipo)?.nombre || d.tipo}</Text>
          <TouchableOpacity onPress={() => quitarDocumento(i)}><Ionicons name="close-circle" size={18} color={c.danger} /></TouchableOpacity>
        </View>
      ))}
      {documentos.length === 0 ? <Text style={[s.docHint, { color: c.textMuted }]}>Cédula, certificado laboral, fiador, etc.</Text> : null}

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
  label: { fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  hint: { fontSize: 11, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  toggle: { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 4, justifyContent: 'center' },
  docHint: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 8 },
  docName: { flex: 1, fontSize: 13, fontWeight: '600' },
  docTipo: { fontSize: 11 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
