import { Tabs } from "expo-router";
import { Icon } from "react-native-paper";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#333333",
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 24,
        },
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: "#737373",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Icon source="view-dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <Icon source="receipt" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => (
            <Icon source="food" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tables"
        options={{
          title: "Tables",
          tabBarIcon: ({ color, size }) => (
            <Icon source="table" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Icon source="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
