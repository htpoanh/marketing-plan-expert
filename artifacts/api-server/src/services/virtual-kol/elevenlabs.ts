/**
 * Phase H — ElevenLabs TTS (env-gated stub).
 *
 * Resolves the character's voice id from env (ELEVENLABS_VOICE_<NAME>) and the
 * API key. Returns { active:false } when missing so KOL generation still
 * produces script + caption without audio.
 */
const VOICE_ENV_BY_HANDLE: Record<string, string> = {
  "@thaian.kocht": "ELEVENLABS_VOICE_THAI_AN",
  "@pearl.nailsallgäu": "ELEVENLABS_VOICE_PEARL",
  "@felixamsee": "ELEVENLABS_VOICE_FELIX",
};

export type TtsResult =
  | { active: true; audioUrl: string }
  | { active: false; reason: string };

export async function synthesizeVoice(params: {
  handle: string;
  text: string;
}): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceEnv = VOICE_ENV_BY_HANDLE[params.handle];
  const voiceId = voiceEnv ? process.env[voiceEnv] : undefined;

  if (!apiKey || !voiceId) {
    const missing = [!apiKey && "ELEVENLABS_API_KEY", !voiceId && (voiceEnv ?? "ELEVENLABS_VOICE_*")].filter(Boolean);
    return { active: false, reason: `ElevenLabs inaktiv — fehlt: ${missing.join(", ")}` };
  }

  // TODO(keys): POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
  //   headers: { "xi-api-key": apiKey }
  //   body: { text, model_id: "eleven_multilingual_v2", voice_settings: { stability:0.5, similarity_boost:0.8 } }
  //   → upload the returned MP3 + return its URL.
  throw new Error("elevenlabs: live TTS not yet wired (keys present)");
}
