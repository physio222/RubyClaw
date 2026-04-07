import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AgentBrowser from "@/components/AgentBrowser";
import { Attachment, Message, useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string, colors: ReturnType<typeof useColors>) {
  // Simple markdown: **bold**, `code`, code blocks
  const parts: React.ReactElement[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      parts.push(
        <View key={key++} style={[mdStyles.codeBlock, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          {lang ? <Text style={[mdStyles.codeLang, { color: colors.accent }]}>{lang}</Text> : null}
          <Text style={[mdStyles.codeText, { color: colors.terminal }]}>{codeLines.join("\n")}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      parts.push(<Text key={key++} style={[mdStyles.h3, { color: colors.foreground }]}>{line.slice(4)}</Text>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      parts.push(<Text key={key++} style={[mdStyles.h2, { color: colors.foreground }]}>{line.slice(3)}</Text>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      parts.push(<Text key={key++} style={[mdStyles.h1, { color: colors.foreground }]}>{line.slice(2)}</Text>);
      i++;
      continue;
    }

    // Bullet
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const content = line.slice(2);
      parts.push(
        <View key={key++} style={mdStyles.bulletRow}>
          <Text style={[mdStyles.bullet, { color: colors.accent }]}>•</Text>
          <Text style={[mdStyles.bulletText, { color: colors.foreground }]}>{content}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      parts.push(
        <View key={key++} style={mdStyles.bulletRow}>
          <Text style={[mdStyles.bullet, { color: colors.accent }]}>{numMatch[1]}.</Text>
          <Text style={[mdStyles.bulletText, { color: colors.foreground }]}>{numMatch[2]}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      parts.push(<View key={key++} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Normal text with inline code/bold
    const segments = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    const inline = segments.map((seg, si) => {
      if (seg.startsWith("`") && seg.endsWith("`")) {
        return (
          <Text key={si} style={[mdStyles.inlineCode, { backgroundColor: colors.surfaceAlt, color: colors.terminal }]}>
            {seg.slice(1, -1)}
          </Text>
        );
      }
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return <Text key={si} style={[mdStyles.bold, { color: colors.foreground }]}>{seg.slice(2, -2)}</Text>;
      }
      return <Text key={si} style={{ color: colors.foreground }}>{seg}</Text>;
    });

    parts.push(
      <Text key={key++} style={[mdStyles.paragraph, { color: colors.foreground }]}>
        {inline}
      </Text>
    );
    i++;
  }

  return parts;
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageItem({ message }: { message: Message }) {
  const colors = useColors();

  if (message.role === "tool_call") {
    const name = message.toolEvent?.name || "tool";
    const args = message.toolEvent?.args;
    return (
      <View style={[toolStyles.row, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
        <View style={toolStyles.header}>
          <Feather name="zap" size={12} color={colors.warning} />
          <Text style={[toolStyles.name, { color: colors.warning }]}>
            {name.replace(/_/g, " ").toUpperCase()}
          </Text>
        </View>
        {args && (
          <Text style={[toolStyles.args, { color: colors.mutedForeground }]} numberOfLines={2}>
            {JSON.stringify(args)}
          </Text>
        )}
      </View>
    );
  }

  if (message.role === "tool_result") {
    const name = message.toolEvent?.name || "result";
    return (
      <View style={[toolStyles.row, { borderColor: colors.success + "44", backgroundColor: colors.success + "0a" }]}>
        <View style={toolStyles.header}>
          <Feather name="check" size={12} color={colors.success} />
          <Text style={[toolStyles.name, { color: colors.success }]}>
            {name.replace(/_/g, " ")} result
          </Text>
        </View>
        <Text style={[toolStyles.args, { color: colors.mutedForeground }]} numberOfLines={4}>
          {message.content}
        </Text>
      </View>
    );
  }

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={bubbleStyles.userRow}>
        <View style={bubbleStyles.userRight}>
          {message.attachments?.map((att) => (
            <View key={att.uri} style={[bubbleStyles.attTag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name={att.type === "image" ? "image" : "file"} size={12} color={colors.mutedForeground} />
              <Text style={[bubbleStyles.attName, { color: colors.mutedForeground }]} numberOfLines={1}>{att.name}</Text>
            </View>
          ))}
          <View style={[bubbleStyles.userBubble, { backgroundColor: colors.primary }]}>
            <Text style={[bubbleStyles.userText]}>{message.content}</Text>
          </View>
          <Text style={[bubbleStyles.time, { color: colors.mutedForeground, alignSelf: "flex-end" }]}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  }

  // Assistant message
  return (
    <View style={[bubbleStyles.assistRow]}>
      <View style={[bubbleStyles.assistAvatar, { backgroundColor: colors.primary }]}>
        <Feather name="cpu" size={14} color="#fff" />
      </View>
      <View style={bubbleStyles.assistContent}>
        {renderMarkdown(message.content, colors)}
        {message.isStreaming && (
          <View style={[bubbleStyles.cursor, { backgroundColor: colors.accent }]} />
        )}
        <Text style={[bubbleStyles.time, { color: colors.mutedForeground }]}>
          {message.isStreaming ? "typing..." : formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

// ─── Empty / Suggestions ─────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: "globe" as const, text: "Search for latest AI research" },
  { icon: "code" as const, text: "Write a Python web scraper" },
  { icon: "clock" as const, text: "Set an alarm for 7 AM tomorrow" },
  { icon: "file-text" as const, text: "Create a note: grocery list" },
  { icon: "zap" as const, text: "Open Chrome browser" },
];

function EmptyState({ onSuggestion, isLoading }: { onSuggestion: (t: string) => void; isLoading: boolean }) {
  const colors = useColors();
  return (
    <View style={emptyStyles.root}>
      <View style={[emptyStyles.logo, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="cpu" size={32} color={colors.primary} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.foreground }]}>RubyClaw</Text>
      <Text style={[emptyStyles.sub, { color: colors.mutedForeground }]}>
        Autonomous AI agent with web search, browser automation & device control
      </Text>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={emptyStyles.grid}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.text}
              onPress={() => onSuggestion(s.text)}
              style={({ pressed }) => [
                emptyStyles.chip,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name={s.icon} size={14} color={colors.accent} />
              <Text style={[emptyStyles.chipText, { color: colors.secondaryForeground }]}>{s.text}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { messages, isStreaming, webSearchEnabled, setWebSearchEnabled, sendMessage, stopStreaming, newConversation, clearMessages } = useAgent();
  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText("");
    const atts = [...pendingAttachments];
    setPendingAttachments([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage(text, atts.length > 0 ? atts : undefined);
    inputRef.current?.focus();
  }, [inputText, isStreaming, pendingAttachments, sendMessage]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const att: Attachment = {
        name: asset.fileName || "image.jpg",
        type: "image",
        uri: asset.uri,
        base64: asset.base64 || undefined,
      };
      setPendingAttachments((prev) => [...prev, att]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const removeAttachment = (uri: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.uri !== uri));
  };

  const reversed = [...messages].reverse();
  const isEmpty = messages.length === 0;

  return (
    <View style={[chatStyles.root, { backgroundColor: colors.background }]}>
      <AgentBrowser />

      {/* Header */}
      <View style={[chatStyles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View style={chatStyles.headerLeft}>
          <View style={[chatStyles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[chatStyles.title, { color: colors.foreground }]}>RubyClaw</Text>
          <View style={[chatStyles.badge, { backgroundColor: colors.success + "22" }]}>
            <View style={[chatStyles.badgeDot, { backgroundColor: colors.success }]} />
            <Text style={[chatStyles.badgeText, { color: colors.success }]}>Online</Text>
          </View>
        </View>
        <View style={chatStyles.headerRight}>
          <Pressable
            onPress={() => { newConversation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={({ pressed }) => [chatStyles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="edit-2" size={18} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => { clearMessages(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            style={({ pressed }) => [chatStyles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {isEmpty ? (
          <EmptyState
            onSuggestion={(t) => sendMessage(t)}
            isLoading={isStreaming}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={reversed}
            keyExtractor={(m) => m.id}
            inverted
            renderItem={({ item }) => <MessageItem message={item} />}
            contentContainerStyle={chatStyles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Pending attachments */}
        {pendingAttachments.length > 0 && (
          <View style={[chatStyles.attachRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {pendingAttachments.map((att) => (
              <Pressable
                key={att.uri}
                onPress={() => removeAttachment(att.uri)}
                style={[chatStyles.attChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Feather name={att.type === "image" ? "image" : "file"} size={12} color={colors.accent} />
                <Text style={[chatStyles.attChipText, { color: colors.foreground }]} numberOfLines={1}>
                  {att.name}
                </Text>
                <Feather name="x" size={10} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Input area */}
        <View style={[chatStyles.inputArea, { borderTopColor: colors.border, paddingBottom: bottomPad + 8, backgroundColor: colors.background }]}>
          {/* Toolbar */}
          <View style={chatStyles.toolbar}>
            <Pressable
              onPress={() => { setWebSearchEnabled(!webSearchEnabled); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={({ pressed }) => [
                chatStyles.toolBtn,
                {
                  backgroundColor: webSearchEnabled ? colors.accent + "22" : colors.secondary,
                  borderColor: webSearchEnabled ? colors.accent : colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="globe" size={14} color={webSearchEnabled ? colors.accent : colors.mutedForeground} />
              <Text style={[chatStyles.toolBtnText, { color: webSearchEnabled ? colors.accent : colors.mutedForeground }]}>
                Web
              </Text>
            </Pressable>

            <Pressable
              onPress={pickImage}
              style={({ pressed }) => [chatStyles.toolBtn, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <Feather name="image" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Text input row */}
          <View style={chatStyles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[chatStyles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message RubyClaw..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={4000}
              blurOnSubmit={false}
            />
            {isStreaming ? (
              <Pressable
                onPress={stopStreaming}
                style={[chatStyles.sendBtn, { backgroundColor: colors.destructive }]}
              >
                <Feather name="square" size={16} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim()}
                style={[chatStyles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.secondary }]}
              >
                <Feather name="send" size={16} color={inputText.trim() ? "#fff" : colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <Text style={[chatStyles.hint, { color: colors.mutedForeground }]}>
            Powered by Replit AI · Tools: web search, browser, device
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const chatStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  headerRight: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8 },
  listContent: { paddingTop: 12, paddingBottom: 4 },
  attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  attChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, maxWidth: 150 },
  attChipText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  inputArea: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  toolbar: { flexDirection: "row", gap: 8 },
  toolBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  toolBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 130, fontSize: 15, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 1 },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 2 },
});

const bubbleStyles = StyleSheet.create({
  userRow: { paddingHorizontal: 16, marginVertical: 6 },
  userRight: { alignItems: "flex-end", gap: 3 },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 10, maxWidth: "80%" },
  userText: { color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  attTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  attName: { fontSize: 11, fontFamily: "Inter_400Regular", maxWidth: 120 },
  assistRow: { flexDirection: "row", paddingHorizontal: 16, marginVertical: 6, gap: 10, alignItems: "flex-start" },
  assistAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  assistContent: { flex: 1, gap: 3 },
  cursor: { width: 8, height: 16, borderRadius: 1, marginTop: 2 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});

const toolStyles = StyleSheet.create({
  row: { marginHorizontal: 16, marginVertical: 3, borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  args: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});

const mdStyles = StyleSheet.create({
  paragraph: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  h1: { fontSize: 20, fontFamily: "Inter_700Bold", marginVertical: 6 },
  h2: { fontSize: 17, fontFamily: "Inter_700Bold", marginVertical: 4 },
  h3: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginVertical: 3 },
  bold: { fontFamily: "Inter_700Bold" },
  inlineCode: { fontFamily: "Inter_400Regular", fontSize: 13, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  codeBlock: { borderRadius: 10, borderWidth: 1, padding: 12, marginVertical: 6 },
  codeLang: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  codeText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  bulletRow: { flexDirection: "row", gap: 8, marginVertical: 2, paddingLeft: 4 },
  bullet: { fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 24 },
  bulletText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
});

const emptyStyles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  logo: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  grid: { width: "100%", gap: 10, marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
});
