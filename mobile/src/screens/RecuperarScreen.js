import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

export default function RecuperarScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [paso, setPaso] = useState(1); // 1 email, 2 token+clave
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const solicitar = async () => {
    setError('');
    if (!email) return setError('Ingresa tu email');
    setLoading(true);
    try {
      const res = await api.recuperar(email);
      setMsg(res.mensaje);
      if (res.token_dev) setToken(res.token_dev);
      setPaso(2);
    } catch (e) { setError('No se pudo enviar'); } finally { setLoading(false); }
  };

  const restablecer = async () => {
    setError('');
    if (!token || !password) return setError('Ingresa el código y la nueva contraseña');
    setLoading(true);
    try {
      const res = await api.restablecer(token, password);
      setMsg(res.mensaje);
      setError('');
      navigation.navigate('Login');
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setLoading(false); }
  };

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.title, { color: c.text }]}>Recuperar contraseña</Text>
      {paso === 1 ? (
        <>
          <Text style={[s.sub, { color: c.textSecondary }]}>Te enviaremos un código para restablecerla</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Email" placeholderTextColor={c.placeholder} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {msg ? <Text style={[s.msg, { color: c.success }]}>{msg}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={solicitar} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar código</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[s.sub, { color: c.textSecondary }]}>Ingresa el código recibido y tu nueva contraseña</Text>
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Código" placeholderTextColor={c.placeholder} value={token} onChangeText={setToken} autoCapitalize="none" />
          <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Nueva contraseña (mín 8, letras y números)" placeholderTextColor={c.placeholder} value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={restablecer} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Restablecer</Text>}
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 14 }}>
        <Text style={{ color: c.accent, textAlign: 'center' }}>Volver al inicio de sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  sub: { fontSize: 12, marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  msg: { fontSize: 13, marginBottom: 10 },
  error: { color: '#DC2626', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
