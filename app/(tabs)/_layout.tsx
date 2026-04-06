import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { theme } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
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
        options={{ title: '收藏', unmountOnBlur: true, tabBarIcon: ({ color }) => <TabIcon emoji="⭐" color={color} /> }}
      />
      <Tabs.Screen
        name="trash"
        options={{ title: '垃圾桶', unmountOnBlur: true, tabBarIcon: ({ color }) => <TabIcon emoji="🗑" color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: '统计', tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} /> }}
      />
      <Tabs.Screen
        name="similar"
        options={{ title: '相似', tabBarIcon: ({ color }) => <TabIcon emoji="👯" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, opacity: color === theme.colors.accent ? 1 : 0.45 }}>{emoji}</Text>;
}
