import {
  clearStoredConnectionSettings,
  CONNECTION_SETTINGS_STORAGE_KEY,
  DEFAULT_OPENAI_BASE_URL,
  normalizeConnectionSettings,
  readStoredConnectionSettings,
  resolveBaseUrl,
  validateBaseUrl,
  writeStoredConnectionSettings,
} from "@/lib/connection";

describe("connection helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes settings before persisting", () => {
    const stored = writeStoredConnectionSettings({
      apiKey: "  sk-test  ",
      baseUrl: " https://example.com/v1/ ",
    });

    expect(stored).toEqual({
      apiKey: "sk-test",
      baseUrl: "https://example.com/v1",
    });
    expect(readStoredConnectionSettings()).toEqual(stored);
  });

  it("falls back to default base URL when blank", () => {
    expect(resolveBaseUrl("")).toBe(DEFAULT_OPENAI_BASE_URL);
  });

  it("rejects invalid base URLs", () => {
    expect(validateBaseUrl("not-a-url")).toBe(
      "Base URL must be a valid absolute URL.",
    );
  });

  it("clears persisted settings", () => {
    writeStoredConnectionSettings({
      apiKey: "sk-test",
      baseUrl: "",
    });

    clearStoredConnectionSettings();

    expect(window.localStorage.getItem(CONNECTION_SETTINGS_STORAGE_KEY)).toBe(
      null,
    );
    expect(readStoredConnectionSettings()).toEqual(
      normalizeConnectionSettings({ apiKey: "", baseUrl: "" }),
    );
  });
});
