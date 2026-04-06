import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const ANDROID_APPS = [
  { label: "Chrome", pkg: "com.android.chrome", icon: "globe" as const },
  { label: "Google Maps", pkg: "com.google.android.apps.maps", icon: "map-pin" as const },
  { label: "Gmail", pkg: "com.google.android.gm", icon: "mail" as const },
  { label: "YouTube", pkg: "com.google.android.youtube", icon: "youtube" as const },
  { label: "Calculator", pkg: "com.android.calculator2", icon: "hash" as const },
  { label: "Settings", pkg: "com.android.settings", icon: "settings" as const },
];

function PermissionRow({
  label,
  description,
  enabled,
  onToggle,
  icon,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  icon: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.permRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.permIcon, { backgroundColor: enabled ? colors.primary + "22" : colors.secondary }]}>
        <Feather name={icon as "shield"} size={16} color={enabled ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={styles.permText}>
        <Text style={[styles.permLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(v);
        }}
        trackColor={{ false: "#2a2a3a", true: colors.primary }}
        thumbColor={enabled ? "#fff" : "#666"}
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedModel, setSelectedModel } = useAgent();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [perms, setPerms] = useState({
    accessibility: false,
    fileAccess: false,
    contacts: false,
    notifications: false,
    location: false,
  });
  const [bgService, setBgService] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const key = await AsyncStorage.getItem("rubyclaw_openai_key");
      if (key) setApiKey(key);
      const permsRaw = await AsyncStorage.getItem("rubyclaw_perms");
      if (permsRaw) setPerms(JSON.parse(permsRaw));
      const bg = await AsyncStorage.getItem("rubyclaw_bg_service");
      if (bg) setBgService(JSON.parse(bg));
    } catch {}
  }

  async function saveApiKey() {
    try {
      await AsyncStorage.setItem("rubyclaw_openai_key", apiKey.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "API key saved. Restart app to apply.");
    } catch {
      Alert.alert("Error", "Failed to save key.");
    }
  }

  async function updatePerm(key: keyof typeof perms, value: boolean) {
    const updated = { ...perms, [key]: value };
    setPerms(updated);
    await AsyncStorage.setItem("rubyclaw_perms", JSON.stringify(updated));
    if (value && Platform.OS !== "web") {
      Alert.alert(
        "Permission Required",
        `Grant ${key} permission in Android Settings > Apps > RubyClaw > Permissions`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async function toggleBgService(v: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBgService(v);
    await AsyncStorage.setItem("rubyclaw_bg_service", JSON.stringify(v));
    if (v) {
      Alert.alert(
        "Background Service",
        "RubyClaw will keep a persistent notification to stay active while minimized. This allows long-running tasks to complete.",
        [{ text: "OK" }]
      );
    }
  }

  function openApp(pkg: string, label: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "android") {
      Linking.openURL(`intent://#Intent;package=${pkg};end`).catch(() =>
        Alert.alert("Not Found", `${label} is not installed.`)
      );
    } else {
      Alert.alert("Android Only", "App launching is an Android-only feature.");
    }
  }

  const CLOUD_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "claude-3-haiku", "claude-3-sonnet"];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Configure RubyClaw</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* API Configuration */}
        <SectionHeader title="AI Model" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Cloud Model</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.modelChips}>
              {CLOUD_MODELS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setSelectedModel(m);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedModel === m ? colors.primary : colors.secondary,
                      borderColor: selectedModel === m ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selectedModel === m ? "#fff" : colors.mutedForeground }]}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>OpenAI API Key</Text>
          <View style={styles.keyRow}>
            <TextInput
              style={[
                styles.keyInput,
                { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground },
              ]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowKey(!showKey)}
              style={[styles.eyeBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Feather name={showKey ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Pressable
            onPress={saveApiKey}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.saveBtnText}>Save Key</Text>
          </Pressable>
          <Text style={[styles.apiNote, { color: colors.mutedForeground }]}>
            Key stored locally on device only. Without a key, RubyClaw uses a built-in local simulation engine.
          </Text>
        </View>

        {/* Permissions */}
        <SectionHeader title="Android Permissions" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PermissionRow
            label="Accessibility Service"
            description="Allows the agent to automate UI interactions"
            enabled={perms.accessibility}
            onToggle={(v) => updatePerm("accessibility", v)}
            icon="shield"
          />
          <PermissionRow
            label="File System Access"
            description="Read and write files to device storage"
            enabled={perms.fileAccess}
            onToggle={(v) => updatePerm("fileAccess", v)}
            icon="folder"
          />
          <PermissionRow
            label="Contacts Access"
            description="Allow agent to read/search contacts"
            enabled={perms.contacts}
            onToggle={(v) => updatePerm("contacts", v)}
            icon="users"
          />
          <PermissionRow
            label="Notifications"
            description="Send task status notifications"
            enabled={perms.notifications}
            onToggle={(v) => updatePerm("notifications", v)}
            icon="bell"
          />
          <PermissionRow
            label="Location"
            description="Access location for context-aware tasks"
            enabled={perms.location}
            onToggle={(v) => updatePerm("location", v)}
            icon="map-pin"
          />
        </View>

        {/* Background Service */}
        <SectionHeader title="Execution" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.permRow}>
            <View style={[styles.permIcon, { backgroundColor: bgService ? colors.primary + "22" : colors.secondary }]}>
              <Feather name="activity" size={16} color={bgService ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={styles.permText}>
              <Text style={[styles.permLabel, { color: colors.foreground }]}>Foreground Service</Text>
              <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
                Keeps RubyClaw active while minimized for long-running tasks
              </Text>
            </View>
            <Switch
              value={bgService}
              onValueChange={toggleBgService}
              trackColor={{ false: "#2a2a3a", true: colors.primary }}
              thumbColor={bgService ? "#fff" : "#666"}
            />
          </View>

          {bgService && (
            <View style={[styles.infoBox, { backgroundColor: colors.success + "11", borderColor: colors.success + "33" }]}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.success }]}>
                Background service active. RubyClaw will persist while running tasks.
              </Text>
            </View>
          )}
        </View>

        {/* Quick App Launcher */}
        <SectionHeader title="Quick App Launch" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Tap to test app launching (Android only)
          </Text>
          <View style={styles.appsGrid}>
            {ANDROID_APPS.map((app) => (
              <Pressable
                key={app.pkg}
                onPress={() => openApp(app.pkg, app.label)}
                style={({ pressed }) => [
                  styles.appBtn,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name={app.icon} size={18} color={colors.foreground} />
                <Text style={[styles.appLabel, { color: colors.foreground }]}>{app.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutKey, { color: colors.mutedForeground }]}>Version</Text>
            <Text style={[styles.aboutVal, { color: colors.foreground }]}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutKey, { color: colors.mutedForeground }]}>Build</Text>
            <Text style={[styles.aboutVal, { color: colors.foreground }]}>Phase 1+2</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutKey, { color: colors.mutedForeground }]}>Agent Loop</Text>
            <Text style={[styles.aboutVal, { color: colors.foreground }]}>ReAct (up to 5 steps)</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutKey, { color: colors.mutedForeground }]}>Browser Engine</Text>
            <Text style={[styles.aboutVal, { color: colors.foreground }]}>WebView + JS Injection</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.aboutKey, { color: colors.mutedForeground }]}>Local LLM</Text>
            <Text style={[styles.aboutVal, { color: colors.foreground }]}>GGUF / MLC-LLM ready</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  content: { padding: 16, gap: 12 },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", padding: 16, gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  modelChips: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  keyRow: { flexDirection: "row", gap: 8 },
  keyInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  eyeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  apiNote: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  permIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  permText: { flex: 1 },
  permLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  permDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  appsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  appBtn: {
    width: "30%",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  appLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aboutKey: { fontSize: 13, fontFamily: "Inter_400Regular" },
  aboutVal: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
