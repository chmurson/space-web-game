import { readDebugScenarioSnapshot } from "../debugScenarioSnapshot";

export type MainMenu = {
  element: HTMLElement;
  setVisible(visible: boolean): void;
  syncState(): void;
};

export const createMainMenu = (options: {
  app: HTMLElement;
  onFreeRoam(): void;
  onLoadGame(): void;
  onTutorial(): void;
}): MainMenu => {
  const root = document.createElement("section");
  root.className = "main-menu";
  root.innerHTML = `
    <div class="main-menu-panel">
      <div class="main-menu-copy">
        <div class="main-menu-kicker">Space Web Game</div>
        <p>Drift above Earth, resume a saved snapshot, or jump straight into the tutorial.</p>
      </div>
      <div class="main-menu-actions">
        <button type="button" data-main-menu-action="load">Load Game</button>
        <button type="button" data-main-menu-action="tutorial">Tutorial</button>
        <button type="button" data-main-menu-action="free-roam">Free Roam</button>
      </div>
    </div>
  `;
  options.app.appendChild(root);

  const loadGameButton = root.querySelector<HTMLButtonElement>('[data-main-menu-action="load"]');
  const tutorialButton = root.querySelector<HTMLButtonElement>('[data-main-menu-action="tutorial"]');
  const freeRoamButton = root.querySelector<HTMLButtonElement>('[data-main-menu-action="free-roam"]');

  loadGameButton?.addEventListener("click", () => {
    if (loadGameButton.disabled) {
      return;
    }

    options.onLoadGame();
  });
  tutorialButton?.addEventListener("click", options.onTutorial);
  freeRoamButton?.addEventListener("click", options.onFreeRoam);

  return {
    element: root,
    setVisible: (visible) => {
      root.style.display = visible ? "flex" : "none";
    },
    syncState: () => {
      if (!loadGameButton) {
        return;
      }

      loadGameButton.disabled = readDebugScenarioSnapshot() === null;
    },
  };
};
