export type VoiceHandlers = {
  onSOS?: () => void;
  onBedtime?: () => void;
  onSend?: () => void;
  onTranscript?: (text: string) => void;
};

// Native stub. Continuous voice recognition on Android/iOS requires a native
// speech module that only runs in a production build (not Expo Go). The UI
// falls back to the big tap buttons when `supported` is false.
export function useVoiceCommand(_handlers: VoiceHandlers) {
  return {
    supported: false,
    listening: false,
    start: () => {},
    stop: () => {},
  };
}
