type PickerRegistration = (
  ready: () => void,
  failed: () => void,
) => void;

export function waitForGooglePicker(
  register: PickerRegistration,
  timeoutMs = 8_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: "ready" | "failed" | "timeout") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result === "ready") resolve();
      else {
        reject(
          new Error(
            result === "timeout"
              ? "Google Picker loading timed out"
              : "Google Picker failed to load",
          ),
        );
      }
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);

    try {
      register(
        () => finish("ready"),
        () => finish("failed"),
      );
    } catch {
      finish("failed");
    }
  });
}
