import test from "node:test";
import assert from "node:assert/strict";
import { getAppStatus, isConfiguredSecret } from "../server/services/app-status.js";

test("isConfiguredSecret rejects empty and placeholder values", () => {
  assert.equal(isConfiguredSecret(undefined), false);
  assert.equal(isConfiguredSecret(""), false);
  assert.equal(isConfiguredSecret("YOUR_KEY_HERE"), false);
  assert.equal(isConfiguredSecret("MOCK_KEY"), false);
  assert.equal(isConfiguredSecret("real-secret"), true);
});

test("getAppStatus only reports fully configured services", () => {
  const placeholderStatus = getAppStatus({
    GEMINI_API_KEY: "YOUR_KEY_HERE",
    GOOGLE_CLIENT_ID: "YOUR_KEY_HERE",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "",
  });

  assert.equal(placeholderStatus.geminiConfigured, false);
  assert.equal(placeholderStatus.googleAuthConfigured, false);
  assert.equal(placeholderStatus.googleSignInConfigured, false);
  assert.equal(placeholderStatus.googleRedirectConfigured, false);
  assert.equal(placeholderStatus.googleDriveConfigured, false);
  assert.equal(placeholderStatus.googleClientId, null);
  assert.equal(placeholderStatus.googlePickerApiKey, null);
  assert.equal(placeholderStatus.cloudinaryConfigured, false);

  const signInOnlyStatus = getAppStatus({
    GOOGLE_CLIENT_ID: "google-client",
  });

  assert.equal(signInOnlyStatus.googleSignInConfigured, true);
  assert.equal(signInOnlyStatus.googleRedirectConfigured, false);
  assert.equal(signInOnlyStatus.googleDriveConfigured, false);
  assert.equal(signInOnlyStatus.googleClientId, "google-client");
  assert.equal(signInOnlyStatus.googlePickerApiKey, null);

  const configuredStatus = getAppStatus({
    GEMINI_API_KEY: "gemini",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    GOOGLE_PICKER_API_KEY: "picker-key",
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
  });

  assert.equal(configuredStatus.geminiConfigured, true);
  assert.equal(configuredStatus.googleAuthConfigured, true);
  assert.equal(configuredStatus.googleSignInConfigured, true);
  assert.equal(configuredStatus.googleRedirectConfigured, true);
  assert.equal(configuredStatus.googleDriveConfigured, true);
  assert.equal(configuredStatus.googleDrivePickerConfigured, true);
  assert.equal(configuredStatus.emailAuthEnabled, true);
  assert.equal(configuredStatus.googleClientId, "google-client");
  assert.equal(configuredStatus.googlePickerApiKey, "picker-key");
  assert.equal(configuredStatus.cloudinaryConfigured, true);
});

test("Drive access works with redirect OAuth even without Picker API key", () => {
  const status = getAppStatus({
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
  });

  assert.equal(status.googleRedirectConfigured, true);
  assert.equal(status.googleDriveConfigured, true, "Drive should be available via custom modal");
  assert.equal(status.googleDrivePickerConfigured, false, "Native picker still requires Picker API key");
  assert.equal(status.googlePickerApiKey, null);
});

test("emailAuthEnabled is always true (self-contained password auth)", () => {
  const empty = getAppStatus({});
  assert.equal(empty.emailAuthEnabled, true);

  const placeholders = getAppStatus({
    GEMINI_API_KEY: "YOUR_KEY_HERE",
  });
  assert.equal(placeholders.emailAuthEnabled, true);
});
