import React, { useRef, useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useAgent } from "@/context/AgentContext";

let WebView: React.ComponentType<{
  ref?: React.Ref<{ injectJavaScript: (js: string) => void }>;
  source: { uri: string };
  style: object;
  onMessage: (e: { nativeEvent: { data: string } }) => void;
  injectedJavaScript?: string;
}> | null = null;

if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch {}
}

export default function AgentBrowser() {
  const { pendingBrowserJS, setPendingBrowserJS, setBrowserOutput } = useAgent();
  const webViewRef = useRef<{ injectJavaScript: (js: string) => void } | null>(null);

  const handleMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      setBrowserOutput(e.nativeEvent.data);
      setPendingBrowserJS(null);
    },
    [setBrowserOutput, setPendingBrowserJS]
  );

  const INJECT_JS = `
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage('PAGE_LOADED:' + document.title);
    true;
  `;

  React.useEffect(() => {
    if (pendingBrowserJS && webViewRef.current) {
      const safeJs = `
        (function() {
          try {
            var result = ${pendingBrowserJS};
            window.ReactNativeWebView.postMessage(String(result).slice(0, 2000));
          } catch(e) {
            window.ReactNativeWebView.postMessage('Error: ' + e.message);
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(safeJs);
    }
  }, [pendingBrowserJS]);

  if (Platform.OS === "web" || !WebView) {
    return <View style={styles.hidden} />;
  }

  return (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        source={{ uri: "https://www.google.com" }}
        style={styles.webView}
        onMessage={handleMessage}
        injectedJavaScript={INJECT_JS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
    left: -9999,
    top: -9999,
  },
  webView: {
    flex: 1,
  },
});
