import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  displaySize: string;
  bytesApprox: number;
  description: string;
  quantization: string;
  context: string;
  tags: string[];
  downloadUrl: string;
  filename: string;
}

const MODELS: ModelInfo[] = [
  {
    id: "gemma-4-2b",
    name: "Gemma 4 2B",
    family: "Gemma",
    displaySize: "1.4 GB",
    bytesApprox: 1_400_000_000,
    description: "Google's lightweight Gemma 4 model, optimized for on-device inference.",
    quantization: "Q4_K_M",
    context: "8K",
    tags: ["Fast", "Lightweight", "Google"],
    filename: "gemma-4-2b-q4_k_m.gguf",
    downloadUrl: "https://huggingface.co/google/gemma-4-2b-it-qat-q4_0-gguf/resolve/main/gemma-4-2b-it-qat-q4_0.gguf",
  },
  {
    id: "qwen-1.5b",
    name: "Qwen 3.5 1.5B",
    family: "Qwen",
    displaySize: "1.1 GB",
    bytesApprox: 1_100_000_000,
    description: "Alibaba's compact Qwen model. Excellent 32K context window.",
    quantization: "Q4_K_S",
    context: "32K",
    tags: ["Coding", "Fast", "Alibaba"],
    filename: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    downloadUrl: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
  },
  {
    id: "deepseek-r1-1.5b",
    name: "DeepSeek R1 1.5B",
    family: "DeepSeek",
    displaySize: "1.0 GB",
    bytesApprox: 1_000_000_000,
    description: "DeepSeek's reasoning model. Outstanding math & chain-of-thought.",
    quantization: "Q4_K_M",
    context: "64K",
    tags: ["Reasoning", "Math", "Chain-of-Thought"],
    filename: "deepseek-r1-distill-qwen-1.5b-q4_k_m.gguf",
    downloadUrl: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
  },
  {
    id: "deepseek-r1-7b",
    name: "DeepSeek R1 7B",
    family: "DeepSeek",
    displaySize: "4.8 GB",
    bytesApprox: 4_800_000_000,
    description: "Full DeepSeek R1 reasoning model. Best for complex analysis.",
    quantization: "Q4_K_M",
    context: "64K",
    tags: ["Powerful", "Reasoning", "Large"],
    filename: "deepseek-r1-distill-qwen-7b-q4_k_m.gguf",
    downloadUrl: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
  },
  {
    id: "phi-3.5-mini",
    name: "Phi 3.5 Mini",
    family: "Phi",
    displaySize: "2.2 GB",
    bytesApprox: 2_200_000_000,
    description: "Microsoft's 3.8B model with 128K context. Punches above its weight.",
    quantization: "Q4_K_M",
    context: "128K",
    tags: ["Microsoft", "Long Context", "Efficient"],
    filename: "phi-3.5-mini-instruct-q4_k_m.gguf",
    downloadUrl: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
  },
];

const FAMILY_COLORS: Record<string, string> = {
  Gemma: "#4285F4",
  Qwen: "#FF6B00",
  DeepSeek: "#6C63FF",
  Phi: "#00B4D8",
};

const MODELS_DIR = FileSystem.documentDirectory + "rubyclaw_models/";
const MODEL_STATUS_KEY = "rubyclaw_model_status";

interface ModelStatus {
  path?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  status: "idle" | "downloading" | "paused" | "complete" | "error";
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface ModelCardProps {
  model: ModelInfo;
  status: ModelStatus;
  isActive: boolean;
  onActivate: () => void;
  onDownload: () => void;
  onPause: () => void;
  onDelete: () => void;
}

function ModelCard({ model, status, isActive, onActivate, onDownload, onPause, onDelete }: ModelCardProps) {
  const colors = useColors();
  const color = FAMILY_COLORS[model.family] || colors.primary;
  const progress = status.totalBytes && status.downloadedBytes
    ? Math.min(status.downloadedBytes / status.totalBytes, 1)
    : 0;

  return (
    <View style={[cardStyles.root, {
      backgroundColor: colors.card,
      borderColor: isActive ? colors.primary : colors.border,
      borderWidth: isActive ? 1.5 : 1,
    }]}>
      {isActive && (
        <View style={[cardStyles.activeBadge, { backgroundColor: colors.primary }]}>
          <Text style={cardStyles.activeBadgeText}>ACTIVE</Text>
        </View>
      )}

      <View style={cardStyles.topRow}>
        <View style={[cardStyles.familyChip, { backgroundColor: color + "22" }]}>
          <Text style={[cardStyles.familyText, { color }]}>{model.family}</Text>
        </View>
        <Text style={[cardStyles.meta, { color: colors.mutedForeground }]}>
          {model.quantization} · {model.context} · {model.displaySize}
        </Text>
      </View>

      <Text style={[cardStyles.name, { color: colors.foreground }]}>{model.name}</Text>
      <Text style={[cardStyles.desc, { color: colors.mutedForeground }]}>{model.description}</Text>

      <View style={cardStyles.tags}>
        {model.tags.map((t) => (
          <View key={t} style={[cardStyles.tag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[cardStyles.tagText, { color: colors.secondaryForeground }]}>{t}</Text>
          </View>
        ))}
      </View>

      {/* Progress bar */}
      {(status.status === "downloading" || status.status === "paused") && (
        <View style={cardStyles.progressRow}>
          <View style={[cardStyles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[cardStyles.progressFill, { backgroundColor: colors.primary, width: `${(progress * 100).toFixed(0)}%` as `${number}%` }]} />
          </View>
          <Text style={[cardStyles.progressText, { color: colors.mutedForeground }]}>
            {formatBytes(status.downloadedBytes || 0)} / {formatBytes(model.bytesApprox)}
          </Text>
        </View>
      )}

      {status.status === "error" && (
        <Text style={[cardStyles.errorText, { color: colors.destructive }]}>
          Error: {status.error}
        </Text>
      )}

      {/* Action buttons */}
      <View style={cardStyles.actions}>
        {status.status === "idle" || status.status === "error" ? (
          <Pressable onPress={onDownload} style={({ pressed }) => [cardStyles.btn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}>
            <Feather name="download" size={14} color="#fff" />
            <Text style={cardStyles.btnText}>Download</Text>
          </Pressable>
        ) : status.status === "downloading" ? (
          <Pressable onPress={onPause} style={({ pressed }) => [cardStyles.btn, { backgroundColor: colors.warning + "22", borderColor: colors.warning, borderWidth: 1 }, pressed && { opacity: 0.8 }]}>
            <Feather name="pause" size={14} color={colors.warning} />
            <Text style={[cardStyles.btnText, { color: colors.warning }]}>Pause</Text>
          </Pressable>
        ) : status.status === "paused" ? (
          <Pressable onPress={onDownload} style={({ pressed }) => [cardStyles.btn, { backgroundColor: colors.accent + "22", borderColor: colors.accent, borderWidth: 1 }, pressed && { opacity: 0.8 }]}>
            <Feather name="play" size={14} color={colors.accent} />
            <Text style={[cardStyles.btnText, { color: colors.accent }]}>Resume</Text>
          </Pressable>
        ) : status.status === "complete" ? (
          <>
            {!isActive && (
              <Pressable onPress={onActivate} style={({ pressed }) => [cardStyles.btn, { backgroundColor: colors.success + "22", borderColor: colors.success, borderWidth: 1 }, pressed && { opacity: 0.8 }]}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <Text style={[cardStyles.btnText, { color: colors.success }]}>Use Model</Text>
              </Pressable>
            )}
            {isActive && (
              <View style={[cardStyles.btn, { backgroundColor: colors.success + "22", borderColor: colors.success, borderWidth: 1 }]}>
                <Feather name="cpu" size={14} color={colors.success} />
                <Text style={[cardStyles.btnText, { color: colors.success }]}>Loaded</Text>
              </View>
            )}
            <Pressable onPress={onDelete} style={({ pressed }) => [cardStyles.iconBtn, pressed && { opacity: 0.6 }]}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function ModelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { localServerUrl, setLocalServerUrl } = useAgent();
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const downloadRefs = useRef<Record<string, FileSystem.DownloadResumable | null>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 84;

  useEffect(() => {
    loadPersistedStatuses();
  }, []);

  async function loadPersistedStatuses() {
    try {
      // Ensure model directory exists
      await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true }).catch(() => {});
      const raw = await AsyncStorage.getItem(MODEL_STATUS_KEY);
      if (raw) {
        const statuses: Record<string, ModelStatus> = JSON.parse(raw);
        // Verify downloaded files still exist
        for (const [id, s] of Object.entries(statuses)) {
          if (s.status === "complete" && s.path) {
            const info = await FileSystem.getInfoAsync(s.path).catch(() => ({ exists: false }));
            if (!info.exists) {
              statuses[id] = { status: "idle" };
            }
          }
        }
        setModelStatuses(statuses);
      }
      const activeId = await AsyncStorage.getItem("rubyclaw_active_model");
      if (activeId) setActiveModelId(activeId);
    } catch {}
  }

  async function persistStatuses(updated: Record<string, ModelStatus>) {
    try {
      await AsyncStorage.setItem(MODEL_STATUS_KEY, JSON.stringify(updated));
    } catch {}
  }

  function updateStatus(id: string, patch: Partial<ModelStatus>) {
    setModelStatuses((prev) => {
      const updated = { ...prev, [id]: { ...(prev[id] || { status: "idle" }), ...patch } };
      persistStatuses(updated);
      return updated;
    });
  }

  const handleDownload = useCallback(async (model: ModelInfo) => {
    if (Platform.OS === "web") {
      Alert.alert("Web Not Supported", "Model downloads require the native app (Expo Go or custom build). Please test on your Android device.");
      return;
    }

    const destPath = MODELS_DIR + model.filename;
    updateStatus(model.id, { status: "downloading", downloadedBytes: 0, totalBytes: model.bytesApprox, path: destPath });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true }).catch(() => {});

      const dl = FileSystem.createDownloadResumable(
        model.downloadUrl,
        destPath,
        {},
        (progress) => {
          updateStatus(model.id, {
            status: "downloading",
            downloadedBytes: progress.totalBytesWritten,
            totalBytes: progress.totalBytesExpectedToWrite || model.bytesApprox,
          });
        }
      );
      downloadRefs.current[model.id] = dl;

      const result = await dl.downloadAsync();
      downloadRefs.current[model.id] = null;

      if (result?.uri) {
        updateStatus(model.id, { status: "complete", path: result.uri, downloadedBytes: model.bytesApprox, totalBytes: model.bytesApprox });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Download Complete",
          `${model.name} downloaded to device storage.\n\nTo run it locally, start a llama.cpp server pointing to:\n${result.uri}\n\nThen set the server URL in Settings.`,
          [{ text: "OK" }]
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("cancel") && !msg.includes("abort")) {
        updateStatus(model.id, { status: "error", error: msg });
        Alert.alert("Download Failed", msg);
      } else {
        updateStatus(model.id, { status: "paused" });
      }
    }
  }, []);

  const handlePause = useCallback(async (model: ModelInfo) => {
    const dl = downloadRefs.current[model.id];
    if (dl) {
      try {
        await dl.pauseAsync();
        downloadRefs.current[model.id] = null;
        updateStatus(model.id, { status: "paused" });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  const handleDelete = useCallback((model: ModelInfo) => {
    Alert.alert("Delete Model", `Remove "${model.name}" from device?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const status = modelStatuses[model.id];
          if (status?.path) {
            await FileSystem.deleteAsync(status.path, { idempotent: true }).catch(() => {});
          }
          updateStatus(model.id, { status: "idle", path: undefined, downloadedBytes: 0 });
          if (activeModelId === model.id) {
            setActiveModelId(null);
            await AsyncStorage.removeItem("rubyclaw_active_model");
            setLocalServerUrl("");
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [modelStatuses, activeModelId]);

  const handleActivate = useCallback(async (model: ModelInfo) => {
    setActiveModelId(model.id);
    await AsyncStorage.setItem("rubyclaw_active_model", model.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Model Ready",
      `${model.name} is ready. Set your llama.cpp server URL in Settings > Local Server to run inference on this model.`,
      [{ text: "OK" }]
    );
  }, []);

  const downloadedCount = Object.values(modelStatuses).filter((s) => s.status === "complete").length;

  return (
    <View style={[rootStyles.root, { backgroundColor: colors.background }]}>
      <View style={[rootStyles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[rootStyles.title, { color: colors.foreground }]}>Model Manager</Text>
        <Text style={[rootStyles.sub, { color: colors.mutedForeground }]}>
          Download real GGUF models to your device
        </Text>
      </View>

      <ScrollView contentContainerStyle={[rootStyles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        {/* Status summary */}
        <View style={[rootStyles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={rootStyles.summaryRow}>
            <View style={[rootStyles.summaryDot, { backgroundColor: downloadedCount > 0 ? colors.success : colors.warning }]} />
            <Text style={[rootStyles.summaryText, { color: colors.foreground }]}>
              {downloadedCount > 0
                ? `${downloadedCount} model${downloadedCount > 1 ? "s" : ""} on device`
                : "No local models downloaded"}
            </Text>
          </View>
          <Text style={[rootStyles.summaryNote, { color: colors.mutedForeground }]}>
            {localServerUrl
              ? `Local server: ${localServerUrl}`
              : "Using Replit AI (cloud) — set local server URL in Settings for on-device inference"}
          </Text>
        </View>

        {/* Model cards */}
        {MODELS.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            status={modelStatuses[m.id] || { status: "idle" }}
            isActive={activeModelId === m.id}
            onActivate={() => handleActivate(m)}
            onDownload={() => handleDownload(m)}
            onPause={() => handlePause(m)}
            onDelete={() => handleDelete(m)}
          />
        ))}

        {/* Info box */}
        <View style={[rootStyles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[rootStyles.infoTitle, { color: colors.foreground }]}>
              How local inference works
            </Text>
            <Text style={[rootStyles.infoText, { color: colors.mutedForeground }]}>
              1. Download a GGUF model above (saved to your device){"\n"}
              2. Run llama.cpp server on your PC: {"\n"}
              {"   "}./llama-server -m model.gguf --port 8080{"\n"}
              3. Set the server URL in Settings → Local Server{"\n"}
              4. All chat requests will use your local model
            </Text>
            <Text style={[rootStyles.infoNote, { color: colors.accent }]}>
              Direct on-device inference requires a custom native build (EAS Build). Expo Go supports downloads only.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  content: { padding: 16, gap: 14 },
  summary: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 6 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  summaryNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  infoBox: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 4 },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 20 },
  infoNote: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
});

const cardStyles = StyleSheet.create({
  root: { borderRadius: 16, padding: 16, gap: 10 },
  activeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: -4 },
  activeBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  familyChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  familyText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  name: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  progressRow: { gap: 4 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, flex: 1 },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  iconBtn: { padding: 8 },
});

const { useRef } = React;
