import type { KeyboardInput } from "./keyboardInput";
import { getKeyboardShortcutAction   } from "./keyboardShortcuts";
import { UIUserAction } from "./uiUserActions";

export const bindKeyboardShortcuts = (options: {
  autoDiscoverStrongestInfluence: boolean;
  getDebugModeEnabled(): boolean;
  handleAction(action: UIUserAction): void;
  keyboardInput: KeyboardInput;
  windowTarget: Pick<Window, "addEventListener">;
}) => {
  options.windowTarget.addEventListener("keydown", (event) => {
    options.keyboardInput.press(event.code);

    const shortcutAction = getKeyboardShortcutAction(event, {
      autoDiscoverStrongestInfluence: options.autoDiscoverStrongestInfluence,
      debugModeEnabled: options.getDebugModeEnabled(),
    });
    if (shortcutAction) {
      options.handleAction(shortcutAction);
    }
  });

  options.windowTarget.addEventListener("keyup", (event) => {
    options.keyboardInput.release(event.code);
  });
};
