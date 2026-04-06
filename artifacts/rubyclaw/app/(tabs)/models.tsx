import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useCallback } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

interface ModelInfo {
  id: string;
  name: string;
  family: string;
  size: string;
  sizeBytes: number;
  description: string;
  quantization: string;
  context: string;
  tags: string[];
  downloadUrl: string;
}

const MODELS: ModelInfo[] = [
  {
    id: "gemma-4-2b",
    name: "Gemma 4 2B",
    family: "Gemma",
    size: "1.4 GB",
    sizeBytes: 1400,
    description: "Google's lightweight Gemma 4 model, optimized for on-device inference. Great for general tasks.",
    quantization: "Q4_K_M",
    context: "8K",
    tags: ["Fast", "Lightweight", "Google"],
    downloadUrl: "https://huggingface.co/google/gemma-4-2b-it-qat-q4_0-gguf",
  },
  {
    id: "gemma-4-4b",
    name: "Gemma 4 4B",
    family: "Gemma",
    size: "2.6 GB",
    sizeBytes: 2600,
    description: "Larger Gemma 4 variant with stronger reasoning. Requires more RAM but produces better outputs.",
    quantization: "Q4_K_M",
    context: "8K",
    tags: ["Balanced", "Reasoning", "Google"],
    downloadUrl: "https://huggingface.co/google/gemma-4-4b-it-qat-q4_0-gguf",
  },
  {
    id: "qwen-1.5b",
    name: "Qwen 3.5 1.5B",
    family: "Qwen",
    size: "1.1 GB",
    sizeBytes: 1100,
    description: "Alibaba's compact Qwen model. Excellent for coding and instruction following on constrained hardware.",
    quantization: "Q4_K_S",
    context: "32K",
    tags: ["Coding", "Fast", "Alibaba"],
    downloadUrl: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF",
  },
  {
    id: "deepseek-r1-1.5b",
    name: "DeepSeek R1 1.5B",
    family: "DeepSeek",
    size: "1.0 GB",
    sizeBytes: 1000,
    description: "DeepSeek's reasoning-first model with chain-of-thought. Outstanding math and logic performance.",
    quantization: "Q4_K_M",
    context: "64K",
    tags: ["Reasoning", "Math", "Chain-of-Thought"],
    downloadUrl: "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
  },
  {
    id: "deepseek-r1-7b",
    name: "DeepSeek R1 7B",
    family: "DeepSeek",
    size: "4.8 GB",
    sizeBytes: 4800,
    description: "Full-sized DeepSeek R1 reasoning model. Best local performance for complex analytical tasks.",
    quantization: "Q4_K_M",
    context: "64K",
    tags: ["Powerful", "Reasoning", "Large"],
    downloadUrl: "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B-GGUF",
  },
  {
    id: "phi-3.5-mini",
    name: "Phi 3.5 Mini",
    family: "Phi",
    size: "2.2 GB",
    sizeBytes: 2200,
    description: "Microsoft's highly capable 3.8B model. Punches far above its weight class for instruction following.",
    quantization: "Q4_K_M",
    context: "128K",
    tags: ["Microsoft", "Long Context", "Efficient"],
    downloadUrl: "https://huggingface.co/microsoft/Phi-3.5-mini-instruct-gguf",
  },
];

type DownloadStatus = "idle" | "downloading" | "installed" | "loading";

interface ModelCardProps {
  model: ModelInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function ModelCard({ model, isSelected, onSelect }: ModelCardProps) {
  const colors = useColors();
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const familyColor: Record<string, string> = {
    Gemma: "#4285F4",
    Qwen: "#FF6B00",
    DeepSeek: "#6C63FF",
    Phi: "#00B4D8",
  };

  const handleAction = useCallback(async () => {
    if (status === "downloading") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (status === "installed") {
      onSelect();
      return;
    }

    setStatus("downloading");
    setProgress(0);

    // Simulate download progress
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setStatus("installed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setProgress(Math.min(p, 100));
      Animated.timing(progressAnim, {
        toValue: Math.min(p, 100) / 100,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, 200);
  }, [status, onSelect]);

  const color = familyColor[model.family] || colors.primary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isSelected ? colors.primary : colors.border,
          borderWidth: isSelected ? 1.5 : 1,
        },
      ]}
    >
      {isSelected && (
        <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.selectedBadgeText}>ACTIVE</Text>
        </View>
      )}

      <View style={styles.cardHeader}>
        <View style={[styles.familyBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.familyText, { color }]}>{model.family}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {model.quantization}
          </Text>
          <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {model.context} ctx
          </Text>
          <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {model.size}
          </Text>
        </View>
      </View>

      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{model.name}</Text>
      <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{model.description}</Text>

      <View style={styles.tagRow}>
        {model.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>{tag}</Text>
          </View>
        ))}
      </View>

      {status === "downloading" && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {Math.round(progress)}%
          </Text>
        </View>
      )}

      <Pressable
        onPress={handleAction}
        style={({ pressed }) => [
          styles.actionBtn,
          {
            backgroundColor:
              status === "installed"
                ? isSelected
                  ? colors.success + "22"
                  : colors.secondary
                : status === "downloading"
                  ? colors.secondary
                  : colors.primary,
            borderColor:
              status === "installed"
                ? isSelected
                  ? colors.success
                  : colors.border
                : "transparent",
            borderWidth: status === "installed" ? 1 : 0,
          },
          pressed && { opacity: 0.75 },
        ]}
      >
        {status === "idle" && (
          <>
            <Feather name="download" size={14} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>Download</Text>
          </>
        )}
        {status === "downloading" && (
          <>
            <Feather name="loader" size={14} color={colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Downloading...</Text>
          </>
        )}
        {status === "installed" && !isSelected && (
          <>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Use Model</Text>
          </>
        )}
        {status === "installed" && isSelected && (
          <>
            <Feather name="cpu" size={14} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Loaded</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function ModelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedModel, setSelectedModel } = useAgent();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Model Manager</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Download & manage local LLMs
        </Text>
      </View>

      <View style={[styles.activeCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}>
        <View style={styles.activeRow}>
          <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.activeLabel, { color: colors.mutedForeground }]}>Cloud API Active</Text>
        </View>
        <Text style={[styles.activeModel, { color: colors.foreground }]}>{selectedModel}</Text>
        <Text style={[styles.activeNote, { color: colors.mutedForeground }]}>
          Download a local model below to run inference on-device
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {MODELS.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            isSelected={selectedModel === m.id}
            onSelect={() => {
              setSelectedModel(m.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        ))}

        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Local model execution requires MLC-LLM or llama.cpp native bindings. Downloads are simulated in this build. Add your OpenAI API key in Settings to use cloud inference.
          </Text>
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
  activeCard: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  activeModel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  activeNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  list: { padding: 16, gap: 14 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  selectedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: -4,
  },
  selectedBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  familyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  familyText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 11 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 12, fontFamily: "Inter_500Medium", width: 36, textAlign: "right" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
