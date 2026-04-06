import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
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
import MessageBubble from "@/components/MessageBubble";
import ThinkingIndicator from "@/components/ThinkingIndicator";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const SUGGESTIONS = [
  "Search for latest AI news",
  "Open Chrome browser",
  "Set an alarm for 8 AM",
  "Navigate to github.com",
  "Create a note about my task",
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { messages, isThinking, webSearchEnabled, setWebSearchEnabled, sendMessage, clearMessages, newConversation } = useAgent();
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isThinking) return;
    setInputText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage(text);
  }, [inputText, isThinking, sendMessage]);

  const handleSuggestion = useCallback(
    async (s: string) => {
      if (isThinking) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendMessage(s);
    },
    [isThinking, sendMessage]
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const showEmpty = messages.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AgentBrowser />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>RubyClaw</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.success + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusText, { color: colors.success }]}>Online</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              newConversation();
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="edit-2" size={18} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              clearMessages();
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {showEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="cpu" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              RubyClaw Agent
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Autonomous AI with web search, browser automation, and device control
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSuggestion(s)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="chevron-right" size={13} color={colors.accent} />
                  <Text style={[styles.suggestionText, { color: colors.secondaryForeground }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            keyExtractor={(item) => item.id}
            inverted
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={isThinking ? <ThinkingIndicator /> : null}
          />
        )}

        {/* Input row */}
        <View
          style={[
            styles.inputArea,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              setWebSearchEnabled(!webSearchEnabled);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.searchToggle,
              {
                backgroundColor: webSearchEnabled ? colors.accent + "22" : colors.secondary,
                borderColor: webSearchEnabled ? colors.accent : colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather
              name="globe"
              size={16}
              color={webSearchEnabled ? colors.accent : colors.mutedForeground}
            />
          </Pressable>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask RubyClaw anything..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />

          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isThinking}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  inputText.trim() && !isThinking ? colors.primary : colors.secondary,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="send" size={18} color={inputText.trim() && !isThinking ? "#fff" : colors.mutedForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerDot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  headerActions: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8 },
  listContent: { paddingVertical: 12 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  suggestions: { width: "100%", gap: 8, marginTop: 8 },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  searchToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
    marginBottom: 2,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
});
