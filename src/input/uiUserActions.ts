export const uiUserActions = [
  'cycleAssistMode',
  'cycleAssistTarget',
  'clearInfoPins',
  'decreaseCoastHorizon',
  'decreaseTimeWarp',
  'increaseCoastHorizon',
  'increaseTimeWarp',
  'loadDebugSnapshot',
  'promptConfirm',
  'recenterCamera',
  'resetScenario',
  'saveDebugSnapshot',
  'setCameraFollowSpacecraft',
  'setCameraFollowTarget',
  'toggleCameraFollow',
  'toggleDebugMode',
  'toggleFpsIndicator',
  'toggleNoGravityDebug',
  'toggleInfo',
  'zoomIn',
  'zoomOut',
] as const

export type UIUserAction = (typeof uiUserActions)[number]

export const isUIUserAction = (value: unknown): value is UIUserAction =>
  typeof value === 'string' && uiUserActions.includes(value as UIUserAction)
