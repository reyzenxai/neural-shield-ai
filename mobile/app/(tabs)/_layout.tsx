import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

function TabIcon({ focused, emoji }: { focused: boolean; emoji: string }) {
  return (
    <View style={[styles.icon, focused && styles.iconActive]}>
      <View style={{ opacity: focused ? 1 : 0.5 }}>
        {/* fallback emoji icon */}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => <TabIconEmoji emoji="🔍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <TabIconEmoji emoji="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIconEmoji emoji="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIconEmoji({ emoji, color }: { emoji: string; color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={{ opacity: color === colors.primary ? 1 : 0.45 }}>
        <View style={[styles.iconBg, color === colors.primary && styles.iconBgActive]}>
          <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconActive: { backgroundColor: colors.primaryDim },
  iconContainer: { alignItems: "center", justifyContent: "center" },
  iconBg: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  iconBgActive: { backgroundColor: colors.primaryDim },
});
