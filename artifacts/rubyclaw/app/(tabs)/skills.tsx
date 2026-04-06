import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomSkill } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const STORAGE_KEY = "rubyclaw_skills";

const BUILT_IN_SKILLS: CustomSkill[] = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search DuckDuckGo for real-time web results",
    type: "action",
    action: "web_search",
    createdAt: 0,
  },
  {
    id: "browser_automate",
    name: "Browser Automation",
    description: "Navigate and interact with websites via hidden WebView",
    type: "action",
    action: "browser_navigate",
    createdAt: 0,
  },
  {
    id: "create_note",
    name: "Create Note",
    description: "Save a note to local device storage",
    type: "action",
    action: "create_note",
    createdAt: 0,
  },
  {
    id: "set_alarm",
    name: "Set Alarm",
    description: "Set an Android system alarm",
    type: "action",
    action: "set_alarm",
    createdAt: 0,
  },
  {
    id: "open_app",
    name: "Open App",
    description: "Launch any installed Android application",
    type: "action",
    action: "open_app",
    createdAt: 0,
  },
];

const TEMPLATES = [
  {
    name: "Weather API",
    description: "Fetch current weather data",
    type: "api" as const,
    endpoint: "https://wttr.in/",
    action: "",
    promptTemplate: "",
  },
  {
    name: "Joke Generator",
    description: "Get a random programming joke",
    type: "api" as const,
    endpoint: "https://official-joke-api.appspot.com/jokes/programming/random",
    action: "",
    promptTemplate: "",
  },
  {
    name: "Custom Summarizer",
    description: "Summarize any text you provide",
    type: "prompt" as const,
    endpoint: "",
    action: "",
    promptTemplate: "Summarize the following in 3 bullet points:\n\n{{input}}",
  },
];

interface SkillCardProps {
  skill: CustomSkill;
  isBuiltIn?: boolean;
  onDelete?: () => void;
}

function SkillCard({ skill, isBuiltIn, onDelete }: SkillCardProps) {
  const colors = useColors();
  const typeColor: Record<string, string> = {
    api: colors.accent,
    action: colors.success,
    prompt: colors.warning,
  };
  const typeIcon: Record<string, string> = {
    api: "cloud",
    action: "zap",
    prompt: "edit-3",
  };
  const tc = typeColor[skill.type] || colors.primary;
  const ti = typeIcon[skill.type] || "zap";

  return (
    <View style={[styles.skillCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.skillCardHeader}>
        <View style={[styles.skillTypeBadge, { backgroundColor: tc + "22" }]}>
          <Feather name={ti as "cloud" | "zap" | "edit-3"} size={12} color={tc} />
          <Text style={[styles.skillTypeText, { color: tc }]}>{skill.type.toUpperCase()}</Text>
        </View>
        {!isBuiltIn && onDelete && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={14} color={colors.destructive} />
          </Pressable>
        )}
        {isBuiltIn && (
          <View style={[styles.builtInBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.builtInText, { color: colors.mutedForeground }]}>Built-in</Text>
          </View>
        )}
      </View>
      <Text style={[styles.skillName, { color: colors.foreground }]}>{skill.name}</Text>
      <Text style={[styles.skillDesc, { color: colors.mutedForeground }]}>{skill.description}</Text>
      {skill.endpoint ? (
        <Text style={[styles.skillMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {skill.endpoint}
        </Text>
      ) : null}
    </View>
  );
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function SkillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [skills, setSkills] = useState<CustomSkill[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<CustomSkill["type"]>("api");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setSkills(JSON.parse(raw));
    } catch {}
  }

  async function saveSkills(s: CustomSkill[]) {
    setSkills(s);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {}
  }

  const addSkill = useCallback(async () => {
    if (!newName.trim() || !newDesc.trim()) {
      Alert.alert("Error", "Name and description are required.");
      return;
    }
    const skill: CustomSkill = {
      id: makeId(),
      name: newName.trim(),
      description: newDesc.trim(),
      type: newType,
      endpoint: newEndpoint.trim() || undefined,
      promptTemplate: newPrompt.trim() || undefined,
      createdAt: Date.now(),
    };
    await saveSkills([...skills, skill]);
    setNewName("");
    setNewDesc("");
    setNewEndpoint("");
    setNewPrompt("");
    setShowAdd(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newName, newDesc, newType, newEndpoint, newPrompt, skills]);

  const deleteSkill = useCallback(
    async (id: string) => {
      Alert.alert("Delete Skill", "Remove this skill?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await saveSkills(skills.filter((s) => s.id !== id));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    },
    [skills]
  );

  const applyTemplate = (t: (typeof TEMPLATES)[0]) => {
    setNewName(t.name);
    setNewDesc(t.description);
    setNewType(t.type);
    setNewEndpoint(t.endpoint);
    setNewPrompt(t.promptTemplate);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Skill Registry</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {BUILT_IN_SKILLS.length + skills.length} skills available
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setShowAdd(!showAdd);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: showAdd ? colors.secondary : colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather name={showAdd ? "x" : "plus"} size={18} color={showAdd ? colors.foreground : "#fff"} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {showAdd && (
          <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Add Custom Skill</Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
              <View style={styles.templates}>
                {TEMPLATES.map((t) => (
                  <Pressable
                    key={t.name}
                    onPress={() => applyTemplate(t)}
                    style={({ pressed }) => [
                      styles.template,
                      { backgroundColor: colors.secondary, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.templateText, { color: colors.foreground }]}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
            <View style={styles.typeRow}>
              {(["api", "action", "prompt"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setNewType(t)}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: newType === t ? colors.primary : colors.secondary,
                      borderColor: newType === t ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.typeBtnText, { color: newType === t ? "#fff" : colors.mutedForeground }]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Weather Lookup"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="What does this skill do?"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />

            {newType === "api" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>API Endpoint</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  value={newEndpoint}
                  onChangeText={setNewEndpoint}
                  placeholder="https://api.example.com/endpoint"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
              </>
            )}

            {newType === "prompt" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Prompt Template</Text>
                <TextInput
                  style={[styles.formInput, styles.multiline, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                  value={newPrompt}
                  onChangeText={setNewPrompt}
                  placeholder="Use {{input}} as placeholder for user input"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                />
              </>
            )}

            <Pressable
              onPress={addSkill}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Add Skill</Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Built-in Skills</Text>
        {BUILT_IN_SKILLS.map((s) => (
          <SkillCard key={s.id} skill={s} isBuiltIn />
        ))}

        {skills.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Custom Skills</Text>
            {skills.map((s) => (
              <SkillCard key={s.id} skill={s} onDelete={() => deleteSkill(s.id)} />
            ))}
          </>
        )}

        {skills.length === 0 && !showAdd && (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Feather name="zap" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No custom skills yet. Tap + to add one.
            </Text>
          </View>
        )}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 },
  skillCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 6 },
  skillCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skillTypeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  skillTypeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  skillName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  skillDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  skillMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: { padding: 4 },
  builtInBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  builtInText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  addForm: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: -4 },
  formInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  multiline: { height: 80, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  typeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  templatesScroll: { marginBottom: -2 },
  templates: { flexDirection: "row", gap: 8 },
  template: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  templateText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyBox: { alignItems: "center", gap: 12, paddingVertical: 40, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
