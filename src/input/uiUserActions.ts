export const uiUserActions = [
  'cycleAssistMode',
  'cycleAssistTarget',
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
  'zoomIn',
  'zoomOut',
] as const

export type UIUserAction = (typeof uiUserActions)[number]

export const isUIUserAction = (value: unknown): value is UIUserAction =>
  typeof value === 'string' && uiUserActions.includes(value as UIUserAction)
