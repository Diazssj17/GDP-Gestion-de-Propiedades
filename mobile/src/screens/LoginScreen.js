import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Switch } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const { theme, isDark, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      const msg = e?.response?.data?.error || 'No se pudo conectar. ¿Backend en 10.0.2.2:5001?';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const c = theme.colors;
  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.topRight}>
        <Text style={[s.modeLabel, { color: c.textMuted }]}>{isDark ? 'Oscuro' : 'Claro'}</Text>
        <Switch value={isDark} onValueChange={toggle} trackColor={{ true: c.accent }} />
      </View>
      <View style={s.body}>
        <View style={[s.logo, { backgroundColor: c.primary }]}><Text style={s.logoText}>GDP</Text></View>
        <Text style={[s.title, { color: c.text }]}>Gestión de Propiedades</Text>

        <TextInput
          style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
          placeholder="Email" placeholderTextColor={c.placeholder}
          autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}
        />
        <TextInput
          style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
          placeholder="Contraseña" placeholderTextColor={c.placeholder}
          secureTextEntry value={password} onChangeText={setPassword}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={doLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ingresar</Text>}
        </TouchableOpacity>

        <View style={[s.hint, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.hintTitle, { color: c.text }]}>Credenciales de prueba</Text>
          <Text style={[s.hintText, { color: c.textSecondary }]}>admin@gdp.com / admin123 (superadmin)</Text>
          <Text style={[s.hintText, { color: c.textSecondary }]}>demo@propietario.com / demo123 (propietario)</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  topRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  modeLabel: { fontSize: 12, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  logo: { width: 72, height: 72, borderRadius: 18, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  error: { color: '#DC2626', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 20 },
  hintTitle: { fontWeight: '700', fontSize: 12, marginBottom: 4 },
  hintText: { fontSize: 11, lineHeight: 18 },
});
