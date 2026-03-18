import { StyleSheet, Text, View } from 'react-native';

export default function SimilarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>👯 相似照片</Text>
      <Text style={styles.sub}>即将推出</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  sub: { color: '#888', fontSize: 16 },
});