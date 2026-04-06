import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function ThinkingIndicator() {
  const colors = useColors();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const dotStyle = (dot: Animated.Value) => ({
    opacity: dot,
    transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
  });

  return (
    <View style={[styles.wrapper]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Feather name="cpu" size={14} color="#fff" />
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Animated.View style={[styles.dot, { backgroundColor: colors.accent }, dotStyle(dot1)]} />
        <Animated.View style={[styles.dot, { backgroundColor: colors.accent }, dotStyle(dot2)]} />
        <Animated.View style={[styles.dot, { backgroundColor: colors.accent }, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginVertical: 8,
    alignItems: "flex-end",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
