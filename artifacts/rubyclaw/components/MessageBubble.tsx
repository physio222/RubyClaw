import { Feather } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Message } from "@/context/AgentContext";

interface Props {
  message: Message;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ToolBubble({ message }: { message: Message }) {
  const colors = useColors();
  return (
    <View style={[styles.toolContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.toolHeader}>
        <Feather name="terminal" size={12} color={colors.terminal} />
        <Text style={[styles.toolLabel, { color: colors.terminal }]}>
          {message.toolName || "tool"}
        </Text>
      </View>
      <Text style={[styles.toolContent, { color: colors.mutedForeground }]}>
        {message.content}
      </Text>
    </View>
  );
}

function AgentThinkBubble({ message }: { message: Message }) {
  const colors = useColors();
  const isToolCall = message.content.includes("TOOL_CALL:");
  if (!isToolCall) return null;
  const toolMatch = message.content.match(/TOOL_CALL:\s*(\w+)/);
  const paramsMatch = message.content.match(/PARAMS:\s*(\{[\s\S]*?\})/);
  const toolName = toolMatch?.[1] || "tool";
  return (
    <View style={[styles.thinkContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <View style={styles.toolHeader}>
        <Feather name="cpu" size={12} color={colors.warning} />
        <Text style={[styles.toolLabel, { color: colors.warning }]}>
          Calling: {toolName}
        </Text>
      </View>
      {paramsMatch && (
        <Text style={[styles.toolContent, { color: colors.mutedForeground }]} numberOfLines={3}>
          {paramsMatch[1]}
        </Text>
      )}
    </View>
  );
}

const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const colors = useColors();

  if (message.role === "tool") {
    return <ToolBubble message={message} />;
  }

  if (message.role === "agent" && message.content.includes("TOOL_CALL:")) {
    return <AgentThinkBubble message={message} />;
  }

  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.agentWrapper]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Feather name="cpu" size={14} color="#fff" />
        </View>
      )}
      <View style={styles.bubbleColumn}>
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.agentBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? "#fff" : colors.foreground },
            ]}
          >
            {message.content}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          {formatTime(message.timestamp)}
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
  bubbleWrapper: {
    flexDirection: "row",
    marginVertical: 4,
    paddingHorizontal: 16,
    alignItems: "flex-end",
    gap: 8,
  },
  userWrapper: {
    justifyContent: "flex-end",
  },
  agentWrapper: {
    justifyContent: "flex-start",
  },
  bubbleColumn: {
    maxWidth: "78%",
    gap: 2,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  timestamp: {
    fontSize: 11,
    paddingHorizontal: 4,
    alignSelf: "flex-end",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toolContainer: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  toolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  toolLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  toolContent: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  thinkContainer: {
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  systemContainer: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 32,
  },
  systemText: {
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
});
