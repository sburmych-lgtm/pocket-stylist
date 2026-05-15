export interface AppStatus {
  version: string;
  geminiConfigured: boolean;
  cloudinaryConfigured: boolean;
  weatherConfigured: boolean;
  googleAuthConfigured: boolean;
  googleSignInConfigured: boolean;
  googleRedirectConfigured: boolean;
  googleDriveConfigured: boolean;
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
    weatherConfigured: isConfiguredSecret(env.OPENWEATHER_API_KEY),
    googleAuthConfigured: googleRedirectConfigured,
    googleSignInConfigured,
    googleRedirectConfigured,
    googleDriveConfigured: googleRedirectConfigured && googlePickerConfigured,
    googleClientId: googleSignInConfigured ? googleClientId : null,
    googlePickerApiKey: googlePickerConfigured ? googlePickerApiKey : null,
  };
}
