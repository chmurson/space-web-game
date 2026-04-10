import { shouldCircularizeBurn, type AssistMode } from "../assist/orbitalAssist";
import type { KeyboardInput } from "../input/keyboardInput";
import { idleControls } from "../simulation/state";
import type { Body, PhysicsEngine, SimulationState } from "../simulation/types";
import { add, fromAngle, length, normalize, scale, sub } from "../simulation/vector";
import type { GameQueries } from "./gameQueries";

type SimulationStepQueries = Pick<
  GameQueries,
  "getAssistTarget" | "getAutopilotTurn" | "getCaptureMetrics" | "getCircularizePlan" | "shouldCaptureBurn"
>;

type ResolveSimulationControlsOptions = SimulationStepQueries & {
  assistMode: AssistMode;
  crashedBodyName: string | null;
  keyboardInput: KeyboardInput;
  state: SimulationState;
  targetHeading: number | null;
};

type ResolvedSimulationControls = {
  assistMode: AssistMode;
  controls: SimulationState["controls"];
  targetHeading: number | null;
};

export type StepSimulationFrameOptions = SimulationStepQueries & {
  assistMode: AssistMode;
  crashedBodyName: string | null;
  keyboardInput: KeyboardInput;
  maxControlWarp: number;
  physicsEngine: PhysicsEngine;
  realDt: number;
  state: SimulationState;
  targetHeading: number | null;
  timeWarpIndex: number;
  timeWarps: number[];
};

export type StepSimulationFrameResult = {
  assistMode: AssistMode;
  crashedBodyName: string | null;
  state: SimulationState;
  targetHeading: number | null;
  timeWarpIndex: number;
};

const resolveSimulationControls = (options: ResolveSimulationControlsOptions): ResolvedSimulationControls => {
  if (options.crashedBodyName) {
    return {
      assistMode: options.assistMode,
      controls: idleControls(),
      targetHeading: options.targetHeading,
    };
  }

  const manualControls = options.keyboardInput.getManualControls();
  let main = manualControls.main;
  const manualTurn = manualControls.turn;
  let turn = manualTurn;
  let assistMode = options.assistMode;
  let targetHeading = options.targetHeading;

  if (manualTurn !== 0) {
    assistMode = "off";
    targetHeading = null;
  } else if (assistMode === "capture") {
    const target = options.getAssistTarget();
    const relativeVelocity = sub(options.state.spacecraft.velocity, target.velocity);
    const desiredHeading = Math.atan2(-relativeVelocity.y, -relativeVelocity.x);
    turn = options.getAutopilotTurn(desiredHeading);

    if (options.shouldCaptureBurn(target)) {
      main = 1;
    }
  } else if (assistMode === "circularize") {
    const target = options.getAssistTarget();
    const plan = options.getCircularizePlan(target);
    const metrics = options.getCaptureMetrics(target);
    turn = options.getAutopilotTurn(plan.burnHeading);

    if (shouldCircularizeBurn(metrics, plan)) {
      main = 1;
    }
  } else if (targetHeading !== null) {
    turn = options.getAutopilotTurn(targetHeading);

    if (turn === 0) {
      targetHeading = null;
    }
  }

  return {
    assistMode,
    controls: {
      main,
      reverse: manualControls.reverse,
      strafe: manualControls.strafe,
      turn,
    },
    targetHeading,
  };
};

const capTimeWarpForActiveControls = (
  controls: SimulationState["controls"],
  keyboardInput: KeyboardInput,
  timeWarpIndex: number,
  timeWarps: number[],
  maxControlWarp: number,
) => {
  const usingManualTurn = keyboardInput.hasManualTurn();
  const usingControls = controls.main !== 0 || controls.reverse !== 0 || controls.strafe !== 0 || usingManualTurn;
  const maxControlWarpIndex = timeWarps.indexOf(maxControlWarp);

  if (usingControls && maxControlWarpIndex >= 0 && timeWarps[timeWarpIndex] > maxControlWarp) {
    return maxControlWarpIndex;
  }

  return timeWarpIndex;
};

const detectCollision = (state: SimulationState) =>
  state.bodies.find((body) => length(sub(state.spacecraft.position, body.position)) <= body.radius);

const createStoppedCollisionState = (state: SimulationState, body: Body): SimulationState => {
  const outward = normalize(sub(state.spacecraft.position, body.position));
  const fallback = fromAngle(state.spacecraft.heading);
  const normal = length(outward) > 0 ? outward : fallback;

  return {
    ...state,
    controls: idleControls(),
    spacecraft: {
      ...state.spacecraft,
      position: add(body.position, scale(normal, body.radius)),
      velocity: { ...body.velocity },
    },
  };
};

export const stepSimulationFrame = (options: StepSimulationFrameOptions): StepSimulationFrameResult => {
  if (options.crashedBodyName) {
    return {
      assistMode: options.assistMode,
      crashedBodyName: options.crashedBodyName,
      state: {
        ...options.state,
        controls: idleControls(),
      },
      targetHeading: options.targetHeading,
      timeWarpIndex: options.timeWarpIndex,
    };
  }

  let assistMode = options.assistMode;
  let targetHeading = options.targetHeading;
  let state = options.state;
  let crashedBodyName = options.crashedBodyName;

  const initialControls = resolveSimulationControls({
    assistMode,
    crashedBodyName,
    getAssistTarget: options.getAssistTarget,
    getAutopilotTurn: options.getAutopilotTurn,
    getCaptureMetrics: options.getCaptureMetrics,
    getCircularizePlan: options.getCircularizePlan,
    keyboardInput: options.keyboardInput,
    shouldCaptureBurn: options.shouldCaptureBurn,
    state,
    targetHeading,
  });

  assistMode = initialControls.assistMode;
  targetHeading = initialControls.targetHeading;
  const timeWarpIndex = capTimeWarpForActiveControls(
    initialControls.controls,
    options.keyboardInput,
    options.timeWarpIndex,
    options.timeWarps,
    options.maxControlWarp,
  );
  const timeWarp = options.timeWarps[timeWarpIndex] ?? 1;
  const physicsStep = 1;
  let remaining = Math.min(options.realDt * timeWarp, 3600);

  while (remaining > 0) {
    const dt = Math.min(physicsStep, remaining);
    const controls = resolveSimulationControls({
      assistMode,
      crashedBodyName,
      getAssistTarget: options.getAssistTarget,
      getAutopilotTurn: options.getAutopilotTurn,
      getCaptureMetrics: options.getCaptureMetrics,
      getCircularizePlan: options.getCircularizePlan,
      keyboardInput: options.keyboardInput,
      shouldCaptureBurn: options.shouldCaptureBurn,
      state,
      targetHeading,
    });

    assistMode = controls.assistMode;
    targetHeading = controls.targetHeading;
    state = {
      ...state,
      controls: controls.controls,
    };
    state = options.physicsEngine.step(state, dt);
    const collision = detectCollision(state);

    if (collision) {
      crashedBodyName = collision.name;
      assistMode = "off";
      targetHeading = null;
      state = createStoppedCollisionState(state, collision);
      break;
    }

    remaining -= dt;
  }

  if (!crashedBodyName) {
    const finalControls = resolveSimulationControls({
      assistMode,
      crashedBodyName,
      getAssistTarget: options.getAssistTarget,
      getAutopilotTurn: options.getAutopilotTurn,
      getCaptureMetrics: options.getCaptureMetrics,
      getCircularizePlan: options.getCircularizePlan,
      keyboardInput: options.keyboardInput,
      shouldCaptureBurn: options.shouldCaptureBurn,
      state,
      targetHeading,
    });

    assistMode = finalControls.assistMode;
    targetHeading = finalControls.targetHeading;
    state = {
      ...state,
      controls: finalControls.controls,
    };
  }

  return {
    assistMode,
    crashedBodyName,
    state,
    targetHeading,
    timeWarpIndex,
  };
};
