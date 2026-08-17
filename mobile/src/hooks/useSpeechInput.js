import { useCallback, useEffect, useRef, useState } from "react";

const getVoice = () => {
  try {
    return require("@react-native-voice/voice").default;
  } catch (e) {
    return null;
  }
};

export function useSpeechInput(onResult) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const voiceLib = getVoice();
    if (!voiceLib || !voiceLib.isAvailable) {
      setIsSupported(false);
      return;
    }
    voiceLib
      .isAvailable()
      .then((available) => setIsSupported(available))
      .catch(() => setIsSupported(false));
  }, []);

  useEffect(() => {
    const voiceLib = getVoice();
    if (!voiceLib) return;

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
    voiceLib.onSpeechResults = onSpeechResults;
    voiceLib.onSpeechError = onSpeechError;
    voiceLib.onSpeechEnd = onSpeechEnd;
    return () => {
      voiceLib
        .destroy()
        .then(() => voiceLib.removeAllListeners())
        .catch(() => {});
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    const voiceLib = getVoice();
    if (!voiceLib) {
      setError("Voice input not supported on this device");
      return;
    }
    voiceLib
      .start("hi-IN")
      .then(() => setIsListening(true))
      .catch(() => {
        voiceLib
          .start("en-IN")
          .then(() => setIsListening(true))
          .catch((e) => setError(e.message));
      });
  }, []);

  const stopListening = useCallback(() => {
    const voiceLib = getVoice();
    if (!voiceLib) return;
    voiceLib
      .stop()
      .then(() => setIsListening(false))
      .catch(() => {});
  }, []);

  return { isListening, isSupported, transcript, error, startListening, stopListening };
}
