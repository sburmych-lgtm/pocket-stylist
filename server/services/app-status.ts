export interface AppStatus {
  version: string;
  geminiConfigured: boolean;
  cloudinaryConfigured: boolean;
  googleAuthConfigured: boolean;
  googleSignInConfigured: boolean;
  googleRedirectConfigured: boolean;
  googleDriveConfigured: boolean;
  googleDrivePickerConfigured: boolean;
  emailAuthEnabled: boolean;
  tryOnConfigured: boolean;
  /** True only when ELEVENLABS_API_KEY is set; client falls back to browser TTS otherwise. */
  ttsConfigured?: boolean;
  googleClientId: string | null;
  googlePickerApiKey: string | null;
}

type EnvMap = Record<string, string | undefined>;

const PLACEHOLDER_VALUES = new Set(["YOUR_KEY_HERE", "MOCK_KEY", ""]);

export function isConfiguredSecret(value: string | null | undefined): value is string {
  return !PLACEHOLDER_VALUES.has(value?.trim() ?? "");
}

export function getAppStatus(env: EnvMap = process.env): AppStatus {
  const googleClientId = env.GOOGLE_CLIENT_ID;
  const googleSignInConfigured = isConfiguredSecret(googleClientId);
  const googleRedirectConfigured =
    googleSignInConfigured && isConfiguredSecret(env.GOOGLE_CLIENT_SECRET);
  const googlePickerApiKey = env.GOOGLE_PICKER_API_KEY;
  const googlePickerConfigured = isConfiguredSecret(googlePickerApiKey);
  const cloudinaryConfigured =
    isConfiguredSecret(env.CLOUDINARY_CLOUD_NAME) &&
    isConfiguredSecret(env.CLOUDINARY_API_KEY) &&
    isConfiguredSecret(env.CLOUDINARY_API_SECRET);

  return {
    version: "0.1.0",
    geminiConfigured: isConfiguredSecret(env.GEMINI_API_KEY),
    cloudinaryConfigured,
    googleAuthConfigured: googleRedirectConfigured,
    googleSignInConfigured,
    googleRedirectConfigured,
    // Drive access works whenever the user has a Google refresh token (i.e. redirect OAuth configured).
    // Picker API key is only needed to render Google's native picker UI; otherwise we use a custom list modal.
    googleDriveConfigured: googleRedirectConfigured,
    googleDrivePickerConfigured: googleRedirectConfigured && googlePickerConfigured,
    emailAuthEnabled: true,
    tryOnConfigured: isConfiguredSecret(env.FAL_KEY),
    googleClientId: googleSignInConfigured ? googleClientId : null,
    googlePickerApiKey: googlePickerConfigured ? googlePickerApiKey : null,
  };
}
