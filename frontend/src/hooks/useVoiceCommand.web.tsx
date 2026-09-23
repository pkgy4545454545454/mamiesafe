import { useCallback, useRef, useState } from "react";

export type VoiceHandlers = {
  onSOS?: () => void;
  onBedtime?: () => void;
  onSend?: () => void;
  onTranscript?: (text: string) => void;
};

// Web implementation using the browser Web Speech API. Lets Mamie say
// "à l'aide" / "appelle" (SOS), "coucher" (bedtime) or "envoyer" (send).
export function useVoiceCommand(handlers: VoiceHandlers) {
  const [supported] = useState(
    typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
  );
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handle = useCallback((text: string) => {
    const t = text.toLowerCase();
    handlersRef.current.onTranscript?.(t);
    if (/(aide|secours|appelle|appeler|urgence)/.test(t)) {
      handlersRef.current.onSOS?.();
    } else if (/(couch|dodo|dormir|lit)/.test(t)) {
      handlersRef.current.onBedtime?.();
    } else if (/(envoi|envoyer|envoie)/.test(t)) {
      handlersRef.current.onSend?.();
    }
  }, []);

  const start = useCallback(() => {
    if (!supported || listening) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      if (last && last[0]) handle(last[0].transcript);
    };
    rec.onend = () => {
      // auto-restart to keep listening
      if (recRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      }
    };
    rec.onerror = () => {};
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [supported, listening, handle]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  return { supported: !!supported, listening, start, stop };
}
