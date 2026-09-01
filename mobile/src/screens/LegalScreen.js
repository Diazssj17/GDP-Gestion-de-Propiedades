import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

export default function LegalScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setDocs(await api.legal()); } catch { setDocs([]); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;

  return (
    <ScrollView style={[s.container, { backgroundColor: c.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[s.header, { color: c.text }]}>Documentos legales</Text>
      {docs.map(d => (
        <View key={d.clave} style={[s.card, { backgroundColor: c.card }]}>
          <Text style={[s.title, { color: c.text }]}>{d.titulo}</Text>
          <Text style={[s.version, { color: c.textMuted }]}>Versión {d.version} · {d.fecha_actualizacion}</Text>
          <Text style={[s.body, { color: c.textSecondary }]}>{d.contenido}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { fontWeight: '700', fontSize: 15 },
  version: { fontSize: 10, marginTop: 2 },
  body: { fontSize: 12, marginTop: 8, lineHeight: 18 },
});
