export const uiUserActions = [
  'cycleAssistMode',
  'cycleAssistTarget',
  'decreaseCoastHorizon',
  'decreaseTimeWarp',
  'increaseCoastHorizon',
  'increaseTimeWarp',
  'loadDebugSnapshot',
  'promptConfirm',
  'resetScenario',
  'saveDebugSnapshot',
  'setCameraCentered',
  'setCameraUnlocked',
  'toggleDebugMode',
  'toggleFpsIndicator',
  'toggleNoGravityDebug',
  'togglePerformanceDebug',
  'zoomIn',
  'zoomOut',
] as const

export type UIUserAction = (typeof uiUserActions)[number]

export const isUIUserAction = (value: unknown): value is UIUserAction =>
  typeof value === 'string' && uiUserActions.includes(value as UIUserAction)
