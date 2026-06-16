const userSettingsStorageKey = 'space-web-game.userSettings.v1'

export type UserSettings = {
  debugModeEnabled: boolean
  touchBurnControlSide: TouchControlSide
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlSide: TouchControlSide
}

export type TouchControlSide = 'left' | 'right'
export type TouchTrajectoryControlState = TouchControlSide | 'hidden'

const defaultUserSettings: UserSettings = {
  debugModeEnabled: false,
  touchBurnControlSide: 'right',
  touchTargetControlSide: 'left',
  touchTrajectoryControlSide: 'hidden',
  touchWarpControlSide: 'right',
}

const parseTouchControlSide = (value: unknown): TouchControlSide | null =>
  value === 'left' || value === 'right' ? value : null

const parseTouchTrajectoryControlState = (
  value: unknown,
): TouchTrajectoryControlState | null =>
  value === 'hidden' ? value : parseTouchControlSide(value)

const parseUserSettings = (value: unknown): UserSettings => {
  if (!value || typeof value !== 'object') {
    return defaultUserSettings
  }

  const settings = value as Partial<UserSettings>
  const legacyTouchControlSide = parseTouchControlSide(
    (settings as Partial<UserSettings> & { touchControlSide?: unknown })
      .touchControlSide,
  )
  return {
    debugModeEnabled:
      typeof settings.debugModeEnabled === 'boolean'
        ? settings.debugModeEnabled
        : defaultUserSettings.debugModeEnabled,
    touchBurnControlSide:
      parseTouchControlSide(settings.touchBurnControlSide) ??
      legacyTouchControlSide ??
      defaultUserSettings.touchBurnControlSide,
    touchTargetControlSide:
      parseTouchControlSide(settings.touchTargetControlSide) ??
      legacyTouchControlSide ??
      defaultUserSettings.touchTargetControlSide,
    touchTrajectoryControlSide:
      parseTouchTrajectoryControlState(settings.touchTrajectoryControlSide) ??
      legacyTouchControlSide ??
      defaultUserSettings.touchTrajectoryControlSide,
    touchWarpControlSide:
      parseTouchControlSide(settings.touchWarpControlSide) ??
      legacyTouchControlSide ??
      defaultUserSettings.touchWarpControlSide,
  }
}

export const readUserSettings = (): UserSettings => {
  try {
    const rawSettings = window.localStorage.getItem(userSettingsStorageKey)
    return rawSettings
      ? parseUserSettings(JSON.parse(rawSettings))
      : defaultUserSettings
  } catch {
    return defaultUserSettings
  }
}

export const writeUserSettings = (settings: UserSettings) => {
  window.localStorage.setItem(userSettingsStorageKey, JSON.stringify(settings))
}

export const updateUserSettings = (updates: Partial<UserSettings>) => {
  const settings = {
    ...readUserSettings(),
    ...updates,
  }
  writeUserSettings(settings)
  return settings
}
