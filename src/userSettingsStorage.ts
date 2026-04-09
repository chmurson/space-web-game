const userSettingsStorageKey = "space-web-game.userSettings.v1";

export type UserSettings = {
  debugModeEnabled: boolean;
};

const defaultUserSettings: UserSettings = {
  debugModeEnabled: false,
};

const parseUserSettings = (value: unknown): UserSettings => {
  if (!value || typeof value !== "object") {
    return defaultUserSettings;
  }

  const settings = value as Partial<UserSettings>;
  return {
    debugModeEnabled: typeof settings.debugModeEnabled === "boolean" ? settings.debugModeEnabled : defaultUserSettings.debugModeEnabled,
  };
};

export const readUserSettings = (): UserSettings => {
  try {
    const rawSettings = window.localStorage.getItem(userSettingsStorageKey);
    return rawSettings ? parseUserSettings(JSON.parse(rawSettings)) : defaultUserSettings;
  } catch {
    return defaultUserSettings;
  }
};

export const writeUserSettings = (settings: UserSettings) => {
  window.localStorage.setItem(userSettingsStorageKey, JSON.stringify(settings));
};

export const updateUserSettings = (updates: Partial<UserSettings>) => {
  const settings = {
    ...readUserSettings(),
    ...updates,
  };
  writeUserSettings(settings);
  return settings;
};
