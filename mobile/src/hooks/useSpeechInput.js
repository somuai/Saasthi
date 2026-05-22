import { useCallback, useEffect, useRef, useState } from "react";
import Voice from "@react-native-voice/voice";

export function useSpeechInput(onResult) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    Voice.isAvailable().then((available) => setIsSupported(available)).catch(() => setIsSupported(false));
  }, []);

  useEffect(() => {
    const onSpeechResults = (e) => {
      const text = (e.value || [""])[0];
      setTranscript(text);
      onResultRef.current?.(text);
    };
    const onSpeechError = (e) => {
      setError(e.error?.message || "Voice input failed");
      setIsListening(false);
    };
    const onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechEnd = onSpeechEnd;
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    Voice.start("hi-IN")
      .then(() => setIsListening(true))
      .catch(() => {
        Voice.start("en-IN")
          .then(() => setIsListening(true))
          .catch((e) => setError(e.message));
      });
  }, []);

  const stopListening = useCallback(() => {
    Voice.stop().then(() => setIsListening(false)).catch(() => {});
  }, []);

  return { isListening, isSupported, transcript, error, startListening, stopListening };
}
