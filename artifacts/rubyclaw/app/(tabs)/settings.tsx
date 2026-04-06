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
  { label: "Maps", pkg: "com.google.android.apps.maps", icon: "map-pin" as const },
  { label: "Gmail", pkg: "com.google.android.gm", icon: "mail" as const },
  { label: "YouTube", pkg: "com.google.android.youtube", icon: "youtube" as const },
  { label: "Calculator", pkg: "com.android.calculator2", icon: "hash" as const },
  { label: "Settings", pkg: "com.android.settings", icon: "settings" as const },
];

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

function PermissionRow({ label, description, enabled, onToggle, icon }: {
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
        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(v); }}
        trackColor={{ false: "#2a2a3a", true: colors.primary }}
        thumbColor={enabled ? "#fff" : "#666"}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { localServerUrl, setLocalServerUrl, webSearchEnabled, setWebSearchEnabled } = useAgent();
  const [serverInput, setServerInput] = useState(localServerUrl);
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
    setServerInput(localServerUrl);
  }, [localServerUrl]);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const permsRaw = await AsyncStorage.getItem("rubyclaw_perms");
      if (permsRaw) setPerms(JSON.parse(permsRaw));
      const bg = await AsyncStorage.getItem("rubyclaw_bg_service");
      if (bg) setBgService(JSON.parse(bg));
    } catch {}
  }

  function saveServerUrl() {
    const url = serverInput.trim().replace(/\/$/, "");
    setLocalServerUrl(url);
    AsyncStorage.setItem("rubyclaw_local_server", url).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      url ? "Local Server Set" : "Cleared",
      url
        ? `RubyClaw will use your llama.cpp server at:\n${url}\n\nChat requests will be sent to ${url}/v1/chat/completions`
        : "Switched back to Replit AI (cloud mode).",
      [{ text: "OK" }]
    );
  }

  async function updatePerm(key: keyof typeof perms, value: boolean) {
    const updated = { ...perms, [key]: value };
    setPerms(updated);
    await AsyncStorage.setItem("rubyclaw_perms", JSON.stringify(updated));
    if (value && Platform.OS !== "web") {
      Alert.alert(
        "Permission Required",
        `Grant ${key} permission in Android Settings → Apps → RubyClaw → Permissions`,
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
      Alert.alert("Background Service", "RubyClaw will keep a persistent notification to stay active while minimized.", [{ text: "OK" }]);
    }
  }

  function openApp(pkg: string, label: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "android") {
      Linking.openURL(`intent://#Intent;package=${pkg};end`).catch(() =>
        Alert.alert("Not Found", `${label} is not installed.`)
      );
    } else {
      Alert.alert("Android Only", "App launching works on Android only.");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Configure RubyClaw</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>

        {/* AI Backend */}
        <SectionHeader title="AI Backend" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoBox, { backgroundColor: colors.success + "11", borderColor: colors.success + "44" }]}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.infoText, { color: colors.success }]}>
              Replit AI active — no API key required. Using GPT-5.2 with tool calling.
            </Text>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Local llama.cpp Server URL</Text>
          <Text style={[styles.fieldNote, { color: colors.mutedForeground }]}>
            Leave blank to use Replit AI. Set to use a local model server for privacy.
          </Text>
          <View style={styles.keyRow}>
            <TextInput
              style={[styles.keyInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
              value={serverInput}
              onChangeText={setServerInput}
              placeholder="http://192.168.1.x:8080"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <View style={styles.serverRow}>
            <Pressable
              onPress={saveServerUrl}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, flex: 1 }, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.saveBtnText}>{serverInput.trim() ? "Set Local Server" : "Use Cloud (Default)"}</Text>
            </Pressable>
            {localServerUrl ? (
              <Pressable
                onPress={() => { setServerInput(""); setLocalServerUrl(""); AsyncStorage.removeItem("rubyclaw_local_server"); }}
                style={({ pressed }) => [styles.clearBtn, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          {localServerUrl ? (
            <View style={[styles.infoBox, { backgroundColor: colors.accent + "11", borderColor: colors.accent + "44" }]}>
              <Feather name="cpu" size={14} color={colors.accent} />
              <Text style={[styles.infoText, { color: colors.accent }]}>Local server: {localServerUrl}</Text>
            </View>
          ) : null}
        </View>

        {/* Web Search */}
        <SectionHeader title="Tools" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.permRow}>
            <View style={[styles.permIcon, { backgroundColor: webSearchEnabled ? colors.accent + "22" : colors.secondary }]}>
              <Feather name="globe" size={16} color={webSearchEnabled ? colors.accent : colors.mutedForeground} />
            </View>
            <View style={styles.permText}>
              <Text style={[styles.permLabel, { color: colors.foreground }]}>Web Search</Text>
              <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
                Enable real-time web search via DuckDuckGo + Jina Reader
              </Text>
            </View>
            <Switch
              value={webSearchEnabled}
              onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWebSearchEnabled(v); }}
              trackColor={{ false: "#2a2a3a", true: colors.accent }}
              thumbColor={webSearchEnabled ? "#fff" : "#666"}
            />
          </View>
        </View>

        {/* Permissions */}
        <SectionHeader title="Android Permissions" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PermissionRow label="Accessibility Service" description="Allows the agent to automate UI interactions" enabled={perms.accessibility} onToggle={(v) => updatePerm("accessibility", v)} icon="shield" />
          <PermissionRow label="File System Access" description="Read and write files to device storage" enabled={perms.fileAccess} onToggle={(v) => updatePerm("fileAccess", v)} icon="folder" />
          <PermissionRow label="Contacts Access" description="Allow agent to read/search contacts" enabled={perms.contacts} onToggle={(v) => updatePerm("contacts", v)} icon="users" />
          <PermissionRow label="Notifications" description="Send task status notifications" enabled={perms.notifications} onToggle={(v) => updatePerm("notifications", v)} icon="bell" />
          <PermissionRow label="Location" description="Access location for context-aware tasks" enabled={perms.location} onToggle={(v) => updatePerm("location", v)} icon="map-pin" />
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
            <Switch value={bgService} onValueChange={toggleBgService} trackColor={{ false: "#2a2a3a", true: colors.primary }} thumbColor={bgService ? "#fff" : "#666"} />
          </View>
          {bgService && (
            <View style={[styles.infoBox, { backgroundColor: colors.success + "11", borderColor: colors.success + "33" }]}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.success }]}>Background service active.</Text>
            </View>
          )}
        </View>

        {/* Quick App Launcher */}
        <SectionHeader title="Quick App Launch" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldNote, { color: colors.mutedForeground }]}>Tap to launch apps (Android only)</Text>
          <View style={styles.appsGrid}>
            {ANDROID_APPS.map((app) => (
              <Pressable key={app.pkg} onPress={() => openApp(app.pkg, app.label)} style={({ pressed }) => [styles.appBtn, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
                <Feather name={app.icon} size={18} color={colors.foreground} />
                <Text style={[styles.appLabel, { color: colors.foreground }]}>{app.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            ["Version", "2.0.0"],
            ["AI Backend", "Replit AI (GPT-5.2) + OpenAI tool calling"],
            ["Agent Loop", "Server-side ReAct (6 iterations)"],
            ["Web Search", "DuckDuckGo + Jina Reader"],
            ["Browser", "WebView + JS Injection"],
            ["Local LLM", "GGUF via llama.cpp server"],
          ].map(([k, v], i, arr) => (
            <View key={k} style={[styles.aboutRow, { borderBottomColor: colors.border, borderBottomWidth: i === arr.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
              <Text style={[styles.aboutKey, { color: colors.mutedForeground }]}>{k}</Text>
              <Text style={[styles.aboutVal, { color: colors.foreground }]}>{v}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  content: { padding: 16, gap: 12 },
  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", padding: 16, gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  keyRow: { flexDirection: "row", gap: 8 },
  keyInput: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  serverRow: { flexDirection: "row", gap: 8 },
  saveBtn: { paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  clearBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  permRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  permIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  permText: { flex: 1 },
  permLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  permDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  appsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  appBtn: { width: "30%", alignItems: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  appLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  aboutKey: { fontSize: 13, fontFamily: "Inter_400Regular" },
  aboutVal: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, textAlign: "right" },
});
