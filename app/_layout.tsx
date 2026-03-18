import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="month" />
        {/* <Stack.Screen name="trash" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="screenshots" /> */}
      </Stack>
    </GestureHandlerRootView>
  );
}