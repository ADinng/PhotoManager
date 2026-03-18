import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '照片', tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} /> }}
      />
      <Tabs.Screen
        name="screenshots"
        options={{ title: '截图', tabBarIcon: ({ color }) => <TabIcon emoji="📱" color={color} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: '收藏', tabBarIcon: ({ color }) => <TabIcon emoji="⭐" color={color} /> }}
      />
      <Tabs.Screen
        name="trash"
        options={{ title: '垃圾桶', tabBarIcon: ({ color }) => <TabIcon emoji="🗑" color={color} /> }}
      />
      <Tabs.Screen
        name="similar"
        options={{ title: '相似', tabBarIcon: ({ color }) => <TabIcon emoji="👯" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, opacity: color === '#007AFF' ? 1 : 0.4 }}>{emoji}</Text>;
}