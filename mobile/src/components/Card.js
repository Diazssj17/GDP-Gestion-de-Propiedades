import { View, Text, StyleSheet } from 'react-native';

export function Card({ title, value, subtitle, color = '#0F172A' }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 },
  title: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
