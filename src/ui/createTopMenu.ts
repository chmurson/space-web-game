import { readDebugScenarioSnapshot } from "../debugScenarioSnapshot";
import type { KeyboardShortcutAction } from "../input/keyboardShortcuts";

export type TopMenu = {
  close: () => void;
  element: HTMLElement;
};

export const createTopMenu = (options: {
  app: HTMLElement;
  onAction: (action: KeyboardShortcutAction) => void;
}): TopMenu => {
  const menuId = "top-menu-dropdown";
  const root = document.createElement("div");
  root.className = "top-menu";
  root.innerHTML = `
    <button
      class="top-menu-button"
      type="button"
      aria-label="Open menu"
      aria-expanded="false"
      aria-haspopup="menu"
      aria-controls="${menuId}"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>
    <div class="top-menu-dropdown" id="${menuId}" role="menu" hidden>
      <button type="button" role="menuitem" data-menu-action="saveDebugSnapshot">Save debug snapshot</button>
      <button type="button" role="menuitem" data-menu-action="loadDebugSnapshot">Load debug snapshot</button>
      <button type="button" role="menuitem" data-menu-action="resetScenario">Restart</button>
    </div>
  `;
  options.app.appendChild(root);

  const button = root.querySelector<HTMLButtonElement>(".top-menu-button");
  const dropdown = root.querySelector<HTMLDivElement>(".top-menu-dropdown");
  if (!button || !dropdown) {
    throw new Error("Failed to create top menu");
  }

  const menuItems = Array.from(dropdown.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
  const loadSnapshotButton = dropdown.querySelector<HTMLButtonElement>('[data-menu-action="loadDebugSnapshot"]');
  const focusItem = (index: number) => {
    menuItems.at(index)?.focus();
  };
  const syncSnapshotAvailability = () => {
    if (!loadSnapshotButton) {
      return;
    }

    loadSnapshotButton.disabled = readDebugScenarioSnapshot() === null;
  };

  const setOpen = (open: boolean, focusTarget: "button" | "first-item" | "none" = "none") => {
    if (open) {
      syncSnapshotAvailability();
    }
    button.setAttribute("aria-expanded", String(open));
    dropdown.hidden = !open;
    root.classList.toggle("top-menu-open", open);

    if (open && focusTarget === "first-item") {
      focusItem(0);
    }
    if (!open && focusTarget === "button") {
      button.focus();
    }
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(dropdown.hidden, dropdown.hidden ? "first-item" : "button");
  });

  dropdown.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.dataset.menuAction as KeyboardShortcutAction | undefined;
    if (!action) {
      return;
    }

    options.onAction(action);
    syncSnapshotAvailability();
    setOpen(false, "button");
  });

  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target as Node)) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!root.classList.contains("top-menu-open")) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false, "button");
    }
  });

  dropdown.addEventListener("keydown", (event) => {
    const currentIndex = menuItems.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem((currentIndex + 1 + menuItems.length) % menuItems.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem((currentIndex - 1 + menuItems.length) % menuItems.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusItem(menuItems.length - 1);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
    }
  });

  return {
    close: () => setOpen(false),
    element: root,
  };
};
