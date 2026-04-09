import type { ControlInput } from "../simulation/types";

export type KeyboardInput = {
  getManualControls(): ControlInput;
  hasManualTurn(): boolean;
  press(code: string): void;
  release(code: string): void;
};

const mainThrustKeys = ["KeyW", "ArrowUp"];
const reverseThrustKeys = ["KeyS", "ArrowDown"];
const turnLeftKeys = ["KeyA", "ArrowLeft"];
const turnRightKeys = ["KeyD", "ArrowRight"];
const turnKeys = [...turnLeftKeys, ...turnRightKeys];

const hasAny = (pressedKeys: Set<string>, codes: string[]) => codes.some((code) => pressedKeys.has(code));

export const createKeyboardInput = (): KeyboardInput => {
  const pressedKeys = new Set<string>();

  return {
    getManualControls: () => ({
      main: hasAny(pressedKeys, mainThrustKeys) ? 1 : 0,
      reverse: hasAny(pressedKeys, reverseThrustKeys) ? 1 : 0,
      strafe: (pressedKeys.has("KeyQ") ? -1 : 0) + (pressedKeys.has("KeyE") ? 1 : 0),
      turn: (hasAny(pressedKeys, turnLeftKeys) ? 1 : 0) + (hasAny(pressedKeys, turnRightKeys) ? -1 : 0),
    }),
    hasManualTurn: () => hasAny(pressedKeys, turnKeys),
    press: (code) => {
      pressedKeys.add(code);
    },
    release: (code) => {
      pressedKeys.delete(code);
    },
  };
};
