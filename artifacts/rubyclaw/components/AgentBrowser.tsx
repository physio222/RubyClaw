import React from "react";
import { Platform, StyleSheet, View } from "react-native";

/**
 * Hidden WebView browser — kept as a future expansion point.
 * Browser automation is now handled server-side via the backend /api/chat route
 * using the fetch_url tool (Jina AI reader), which works cross-platform.
 */
export default function AgentBrowser() {
  return <View style={styles.hidden} />;
}

const styles = StyleSheet.create({
  hidden: {
    position: Platform.OS !== "web" ? "absolute" : "relative",
    width: 0,
    height: 0,
    overflow: "hidden",
  },
});
