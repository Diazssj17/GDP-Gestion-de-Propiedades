import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function Card({ title, value, subtitle, color = '#0F172A' }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.card, { borderLeftColor: color, backgroundColor: c.card }]}>
      <Text style={[styles.title, { color: c.textSecondary }]}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 },
  title: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 12, marginTop: 2 },
});
