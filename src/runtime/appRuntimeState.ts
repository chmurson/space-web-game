import type { AssistMode } from "../assist/orbitalAssist";
import type { SimulationState } from "../simulation/types";

export type AppRuntimeState = {
  assistMode: AssistMode;
  assistTargetIndex: number;
  coastPredictionHorizonHours: number;
  crashedBodyName: string | null;
  debugModeEnabled: boolean;
  debugNoGravityEnabled: boolean;
  debugSnapshotStatus: string;
  fpsIndicatorEnabled: boolean;
  performanceDebugEnabled: boolean;
  spacecraftLabelIntroUntil: number;
  state: SimulationState;
  targetHeading: number | null;
  timeWarpIndex: number;
  viewportSize: number;
};
