import { Feather } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Message } from "@/context/AgentContext";

interface Props {
  message: Message;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const colors = useColors();

  if (message.role === "tool_call") {
    const name = message.toolEvent?.name || "tool";
    return (
      <View style={[styles.toolContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.toolHeader}>
          <Feather name="zap" size={12} color={colors.warning} />
          <Text style={[styles.toolLabel, { color: colors.warning }]}>
            {name.replace(/_/g, " ").toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.toolContent, { color: colors.mutedForeground }]} numberOfLines={3}>
          {message.toolEvent?.args ? JSON.stringify(message.toolEvent.args) : message.content}
        </Text>
      </View>
    );
  }

  if (message.role === "tool_result") {
    const name = message.toolEvent?.name || "result";
    return (
      <View style={[styles.toolContainer, { backgroundColor: colors.success + "0a", borderColor: colors.success + "44" }]}>
        <View style={styles.toolHeader}>
          <Feather name="check" size={12} color={colors.success} />
          <Text style={[styles.toolLabel, { color: colors.success }]}>
            {name.replace(/_/g, " ")} result
          </Text>
        </View>
        <Text style={[styles.toolContent, { color: colors.mutedForeground }]} numberOfLines={4}>
          {message.content}
        </Text>
      </View>
    );
  }

  const isUser = message.role === "user";

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.agentWrapper]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Feather name="cpu" size={14} color="#fff" />
        </View>
      )}
      <View style={styles.bubbleColumn}>
        <View style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.agentBubble, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}>
          <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
            {message.content}
          </Text>
          {message.isStreaming && (
            <View style={[styles.cursor, { backgroundColor: colors.accent }]} />
          )}
        </View>
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          {message.isStreaming ? "typing..." : formatTime(message.timestamp)}
        </Text>
      </View>
      {isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Feather name="user" size={14} color={colors.foreground} />
        </View>
      )}
    </View>
  );
});

export default MessageBubble;

const styles = StyleSheet.create({
  bubbleWrapper: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 16, alignItems: "flex-end", gap: 8 },
  userWrapper: { justifyContent: "flex-end" },
  agentWrapper: { justifyContent: "flex-start" },
  bubbleColumn: { maxWidth: "78%", gap: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { borderBottomRightRadius: 4 },
  agentBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  cursor: { width: 8, height: 14, borderRadius: 1, marginTop: 4 },
  timestamp: { fontSize: 11, paddingHorizontal: 4, alignSelf: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  toolContainer: { marginHorizontal: 16, marginVertical: 4, borderRadius: 10, borderWidth: 1, padding: 10 },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  toolLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  toolContent: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
