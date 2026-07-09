const userSettingsStorageKey = 'space-web-game.userSettings.v1'

export type OrbitPointDisplaySettings = {
  altitudeVisible: boolean
  centerDistanceVisible: boolean
  labelsVisible: boolean
  markersVisible: boolean
  pointNameVisible: boolean
}

export type OrbitPointDisplaySettingOverrides =
  Partial<OrbitPointDisplaySettings>

export type UserSettings = {
  desktopEdgePanEnabled: boolean
  desktopEdgePanSpeed: DesktopEdgePanSpeed
  debugModeEnabled: boolean
  mobileManeuverStartByDrag: boolean
  orbitPointDisplay: OrbitPointDisplaySettings
  touchBurnControlSide: TouchControlSide
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlSide: TouchControlSide
}

export type DesktopEdgePanSpeed = 'slow' | 'normal' | 'fast'
export type TouchControlSide = 'left' | 'right'
export type TouchTrajectoryControlState = TouchControlSide | 'hidden'

const createDefaultOrbitPointDisplaySettings =
  (): OrbitPointDisplaySettings => ({
    altitudeVisible: true,
    centerDistanceVisible: false,
    labelsVisible: true,
    markersVisible: true,
    pointNameVisible: true,
  })

const createDefaultUserSettings = (): UserSettings => ({
  desktopEdgePanEnabled: false,
  desktopEdgePanSpeed: 'normal',
  debugModeEnabled: false,
  mobileManeuverStartByDrag: true,
  orbitPointDisplay: createDefaultOrbitPointDisplaySettings(),
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

const parseDesktopEdgePanSpeed = (
  value: unknown,
): DesktopEdgePanSpeed | null =>
  value === 'slow' || value === 'normal' || value === 'fast' ? value : null

const parseBooleanSetting = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback

const parseOrbitPointDisplaySettings = (
  value: unknown,
): OrbitPointDisplaySettings => {
  const defaults = defaultUserSettings.orbitPointDisplay
  if (!value || typeof value !== 'object') {
    return { ...defaults }
  }

  const settings = value as Partial<
    Record<keyof OrbitPointDisplaySettings, unknown>
  >
  return {
    altitudeVisible: parseBooleanSetting(
      settings.altitudeVisible,
      defaults.altitudeVisible,
    ),
    centerDistanceVisible: parseBooleanSetting(
      settings.centerDistanceVisible,
      defaults.centerDistanceVisible,
    ),
    labelsVisible: parseBooleanSetting(
      settings.labelsVisible,
      defaults.labelsVisible,
    ),
    markersVisible: parseBooleanSetting(
      settings.markersVisible,
      defaults.markersVisible,
    ),
    pointNameVisible: parseBooleanSetting(
      settings.pointNameVisible,
      defaults.pointNameVisible,
    ),
  }
}

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
    desktopEdgePanEnabled: parseBooleanSetting(
      settings.desktopEdgePanEnabled,
      defaultUserSettings.desktopEdgePanEnabled,
    ),
    desktopEdgePanSpeed:
      parseDesktopEdgePanSpeed(settings.desktopEdgePanSpeed) ??
      defaultUserSettings.desktopEdgePanSpeed,
    debugModeEnabled:
      typeof settings.debugModeEnabled === 'boolean'
        ? settings.debugModeEnabled
        : defaultUserSettings.debugModeEnabled,
    mobileManeuverStartByDrag: parseBooleanSetting(
      settings.mobileManeuverStartByDrag,
      defaultUserSettings.mobileManeuverStartByDrag,
    ),
    orbitPointDisplay: parseOrbitPointDisplaySettings(
      settings.orbitPointDisplay,
    ),
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

export const resolveOrbitPointDisplaySettings = (
  userSettings: OrbitPointDisplaySettings,
  scenarioOverrides?: OrbitPointDisplaySettingOverrides,
): OrbitPointDisplaySettings => ({
  ...userSettings,
  ...scenarioOverrides,
})
