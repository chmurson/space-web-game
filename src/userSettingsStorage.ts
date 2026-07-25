const userSettingsStorageKey = 'space-web-game.userSettings.v1'

export type UserSettings = {
  desktopCameraPanMode: DesktopCameraPanMode
  desktopEdgePanSpeed: DesktopEdgePanSpeed
  desktopWheelPanSpeed: DesktopWheelPanSpeed
  debugModeEnabled: boolean
  touchBurnControlSide: TouchControlSide
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlSide: TouchControlSide
}

export type DesktopCameraPanMode = 'wheel' | 'drag' | 'edge'
export type DesktopEdgePanSpeed = 'slow' | 'normal' | 'fast'
export type DesktopWheelPanSpeed = DesktopEdgePanSpeed
export type TouchControlSide = 'left' | 'right'
export type TouchTrajectoryControlState = TouchControlSide | 'hidden'

const createDefaultUserSettings = (): UserSettings => ({
  desktopCameraPanMode: 'wheel',
  desktopEdgePanSpeed: 'normal',
  desktopWheelPanSpeed: 'normal',
  debugModeEnabled: false,
  touchBurnControlSide: 'right',
  touchTargetControlSide: 'left',
  touchTrajectoryControlSide: 'hidden',
  touchWarpControlSide: 'right',
})

const defaultUserSettings: UserSettings = createDefaultUserSettings()

const parseTouchControlSide = (value: unknown): TouchControlSide | null =>
  value === 'left' || value === 'right' ? value : null

const parseTouchTrajectoryControlState = (
  value: unknown,
): TouchTrajectoryControlState | null =>
  value === 'hidden' ? value : parseTouchControlSide(value)

const parseDesktopCameraPanMode = (
  value: unknown,
): DesktopCameraPanMode | null =>
  value === 'wheel' || value === 'drag' || value === 'edge' ? value : null

const parseDesktopPanSpeed = (value: unknown): DesktopEdgePanSpeed | null =>
  value === 'slow' || value === 'normal' || value === 'fast' ? value : null

const parseUserSettings = (value: unknown): UserSettings => {
  if (!value || typeof value !== 'object') {
    return createDefaultUserSettings()
  }

  const settings = value as Partial<UserSettings>
  const legacyTouchControlSide = parseTouchControlSide(
    (settings as Partial<UserSettings> & { touchControlSide?: unknown })
      .touchControlSide,
  )
  return {
    desktopCameraPanMode:
      parseDesktopCameraPanMode(settings.desktopCameraPanMode) ??
      defaultUserSettings.desktopCameraPanMode,
    desktopEdgePanSpeed:
      parseDesktopPanSpeed(settings.desktopEdgePanSpeed) ??
      defaultUserSettings.desktopEdgePanSpeed,
    desktopWheelPanSpeed:
      parseDesktopPanSpeed(settings.desktopWheelPanSpeed) ??
      defaultUserSettings.desktopWheelPanSpeed,
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
      : createDefaultUserSettings()
  } catch {
    return createDefaultUserSettings()
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
