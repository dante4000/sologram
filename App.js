import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth';
import { theme } from './src/theme';
import PostsScreen from './src/screens/PostsScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import CreateScreen from './src/screens/CreateScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.bg,
    card: theme.bg,
    border: theme.border,
    text: theme.text,
    primary: theme.accent,
  },
};

const TAB_ICONS = {
  Posts: 'grid-outline',
  Create: 'add-circle-outline',
  Settings: 'settings-outline',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.sub,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}>
      <Tab.Screen name="Posts" component={PostsScreen} options={{ title: 'My Posts' }} />
      <Tab.Screen name="Create" component={CreateScreen} options={{ title: 'New Post' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Gate on auth loading so a user with a stored token doesn't briefly flash the
// "Not connected" screens on cold start while creds load from secure storage.
function Root() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="PostDetail"
          component={PostDetailScreen}
          options={{
            title: 'Post',
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
