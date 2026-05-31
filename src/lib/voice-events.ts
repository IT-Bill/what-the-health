export const VOICE_SUBMIT_EVENT = "wth:voice-submit";
export const PENDING_VOICE_TEXT_KEY = "wth:pending-voice-text";
export const CHAT_HAS_ACTIVITY_KEY = "wth:chat-has-activity";
export const CHAT_RESTORE_LATEST_KEY = "wth:chat-restore-latest";
export const CHAT_CACHED_SESSION_KEY = "wth:chat-cached-session";

export interface VoiceSubmitEventDetail {
  text: string;
  startNewSession?: boolean;
}

export interface PendingVoiceText {
  text: string;
  startNewSession?: boolean;
}
