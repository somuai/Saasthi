import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { tapTargetMin } from "../../constants/typography";
import { GovtHeader } from "../../components/GovtHeader";
import { apiUrl } from "../../constants/api";
import { getAccessToken } from "../../services/auth";

export default function AIAssistantScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    {
      id: "0",
      role: "assistant",
      text: "नमस्ते! मैं आपकी स्वास्थ्य सहायिका हूँ। किसी मरीज़ की स्वास्थ्य स्थिति के बारे में पूछें।\n\nHello! I'm your health assistant. Ask about any patient's health status.",
    },
  ]);
  const [input, setInput] = useState("");
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const sendQuery = useCallback(async () => {
    const text = input.trim();
    if (!text || !patientId.trim()) return;
    const userMsg = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(apiUrl("/risk/assessments/gemma_query/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patient_id: Number(patientId), question: text }),
      });
      const data = await res.json();
      if (res.ok && data.recommendation) {
        const rec = data.recommendation;
        const reply = `🤖 ${rec.hindi}\n\n${rec.english}`;
        setMessages((prev) => [...prev, { id: data.id || Date.now().toString(), role: "assistant", text: reply }]);
      } else {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", text: `❌ ${data.detail || "Failed"}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", text: "❌ Network error" }]);
    } finally {
      setLoading(false);
    }
  }, [input, patientId]);

  const renderMessage = ({ item }) => (
    <View style={[styles.msgBubble, item.role === "user" ? styles.userMsg : styles.assistantMsg]}>
      <Text style={item.role === "user" ? styles.userText : styles.assistantText}>{item.text}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <GovtHeader titleHi="AI सहायिका" titleEn="AI Assistant" />
      <View style={styles.patientRow}>
        <TextInput
          style={styles.patientInput}
          placeholder="मरीज़ ID / Patient ID"
          placeholderTextColor={COLORS.textHint}
          value={patientId}
          onChangeText={setPatientId}
          keyboardType="number-pad"
        />
        <Pressable style={styles.pickBtn} onPress={() => router.push("/(tabs)/patients")}>
          <Ionicons name="search" size={18} color="#fff" />
          <Text style={styles.pickBtnText}>चुनें</Text>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: 8 }} />}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="प्रश्न पूछें / Ask a question…"
          placeholderTextColor={COLORS.textHint}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || !patientId.trim()) && styles.sendBtnDisabled]}
          onPress={sendQuery}
          disabled={!input.trim() || !patientId.trim() || loading}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  patientInput: {
    flex: 1,
    minHeight: tapTargetMin,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: tapTargetMin,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  pickBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  msgBubble: { maxWidth: "85%", padding: 12, borderRadius: 12 },
  userMsg: { backgroundColor: COLORS.primary, alignSelf: "flex-end" },
  assistantMsg: { backgroundColor: COLORS.card, alignSelf: "flex-start", borderWidth: 1, borderColor: COLORS.border },
  userText: { color: "#fff", fontSize: 14 },
  assistantText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: tapTargetMin,
    maxHeight: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    minHeight: tapTargetMin,
    minWidth: tapTargetMin,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
});
