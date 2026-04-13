import { readDebugScenarioSnapshot } from "../debugScenarioSnapshot";

export type CrashMenu = {
  element: HTMLElement;
  setVisible(visible: boolean): void;
  syncState(input: { hasCheckpoint: boolean }): void;
};

export const createCrashMenu = (options: {
  app: HTMLElement;
  onExit(): void;
  onLoadGame(): void;
  onRestart(): void;
  onRestartFromCheckpoint(): void;
}): CrashMenu => {
  const root = document.createElement("section");
  root.className = "crash-menu";
  root.innerHTML = `
    <div class="main-menu-actions crash-menu-actions">
      <button type="button" data-crash-menu-action="load">Load Game</button>
      <button type="button" data-crash-menu-action="restart">Restart</button>
      <button type="button" data-crash-menu-action="checkpoint">Restart from checkpoint</button>
      <button type="button" data-crash-menu-action="exit">Exit</button>
    </div>
  `;
  options.app.appendChild(root);

  const loadButton = root.querySelector<HTMLButtonElement>('[data-crash-menu-action="load"]');
  const restartButton = root.querySelector<HTMLButtonElement>('[data-crash-menu-action="restart"]');
  const restartFromCheckpointButton = root.querySelector<HTMLButtonElement>('[data-crash-menu-action="checkpoint"]');
  const exitButton = root.querySelector<HTMLButtonElement>('[data-crash-menu-action="exit"]');

  loadButton?.addEventListener("click", () => {
    if (!loadButton.disabled) {
      options.onLoadGame();
    }
  });
  restartButton?.addEventListener("click", options.onRestart);
  restartFromCheckpointButton?.addEventListener("click", options.onRestartFromCheckpoint);
  exitButton?.addEventListener("click", options.onExit);

  return {
    element: root,
    setVisible: (visible) => {
      root.style.display = visible ? "flex" : "none";
    },
    syncState: ({ hasCheckpoint }) => {
      if (loadButton) {
        loadButton.disabled = readDebugScenarioSnapshot() === null;
      }
      if (restartFromCheckpointButton) {
        restartFromCheckpointButton.style.display = hasCheckpoint ? "block" : "none";
      }
    },
  };
};
