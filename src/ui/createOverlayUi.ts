import type { Body } from "../simulation/types";
import { createDebugPanel, type DebugPanel } from "./debugPanel";

export type OverlayUiRefs = {
  bodyLabels: Map<string, HTMLElement>;
  debugPanel: DebugPanel;
  fpsIndicator: HTMLElement;
  hud: HTMLElement;
  offscreenIndicators: Map<string, HTMLElement>;
  spacecraftCallout: HTMLElement;
  spacecraftCalloutLabel: HTMLSpanElement | null;
  spacecraftIconThrust: HTMLElement;
  statAssist: HTMLElement | null;
  statEngine: HTMLElement | null;
  statFuel: HTMLElement | null;
  statGuidance: HTMLElement | null;
  statSpeed: HTMLElement | null;
  statTarget: HTMLElement | null;
  statTargetSpeed: HTMLElement | null;
  statWarp: HTMLElement | null;
  statZoom: HTMLElement | null;
};

export type OverlayUiOptions = {
  app: HTMLElement;
  bodies: Body[];
  scenarioDescription: string;
  scenarioName: string;
  showCycleTargetHint: boolean;
};

export const createOverlayUi = (options: OverlayUiOptions): OverlayUiRefs => {
  const hud = document.createElement("section");
  hud.className = "hud";
  hud.innerHTML = `
    <h1>${options.scenarioName}</h1>
    <p>${options.scenarioDescription}</p>
    <div class="stats">
      <div class="stat"><span>Engine</span><strong data-stat="engine"></strong></div>
      <div class="stat"><span>Time warp</span><strong data-stat="warp"></strong></div>
      <div class="stat"><span>Speed</span><strong data-stat="speed"></strong></div>
      <div class="stat"><span>Fuel used</span><strong data-stat="fuel"></strong></div>
      <div class="stat"><span>Zoom</span><strong data-stat="zoom"></strong></div>
      <div class="stat"><span>Target</span><strong data-stat="target"></strong></div>
      <div class="stat"><span>Target speed</span><strong data-stat="target-speed"></strong></div>
      <div class="stat"><span>Assist</span><strong data-stat="assist"></strong></div>
      <div class="stat"><span>Guidance</span><strong data-stat="guidance"></strong></div>
    </div>
    <div class="controls">
      <p><kbd>W</kbd> main engine <kbd>S</kbd> brake <kbd>Q</kbd>/<kbd>E</kbd> side thrusters</p>
      <p><kbd>A</kbd>/<kbd>D</kbd> rotate <kbd>[</kbd>/<kbd>]</kbd> time warp <kbd>-</kbd>/<kbd>=</kbd> zoom <kbd>R</kbd> reset</p>
      <p>${options.showCycleTargetHint ? "<kbd>T</kbd> target body " : ""}<kbd>C</kbd> assist mode</p>
      <p>Double-click the map to point the spacecraft toward that direction.</p>
    </div>
  `;
  options.app.appendChild(hud);

  const debugPanel = createDebugPanel(options.app);

  const fpsIndicator = document.createElement("div");
  fpsIndicator.className = "fps-indicator";
  fpsIndicator.style.display = "none";
  options.app.appendChild(fpsIndicator);

  const spacecraftCallout = document.createElement("div");
  spacecraftCallout.className = "spacecraft-callout";
  spacecraftCallout.innerHTML = "<span>Spacecraft</span>";
  options.app.appendChild(spacecraftCallout);
  const spacecraftCalloutLabel = spacecraftCallout.querySelector<HTMLSpanElement>("span");

  const spacecraftIconThrust = document.createElement("div");
  spacecraftIconThrust.className = "spacecraft-icon-thrust";
  spacecraftIconThrust.style.display = "none";
  options.app.appendChild(spacecraftIconThrust);

  const offscreenIndicators = new Map<string, HTMLElement>();
  const bodyLabels = new Map<string, HTMLElement>();

  for (const body of options.bodies) {
    const indicator = document.createElement("div");
    indicator.className = "offscreen-indicator";
    indicator.innerHTML = `<div class="pointer"></div><div class="label"></div>`;
    indicator.style.display = "none";
    options.app.appendChild(indicator);
    offscreenIndicators.set(body.id, indicator);

    const label = document.createElement("div");
    label.className = "body-label";
    label.textContent = body.name;
    label.style.display = "none";
    options.app.appendChild(label);
    bodyLabels.set(body.id, label);
  }

  return {
    bodyLabels,
    debugPanel,
    fpsIndicator,
    hud,
    offscreenIndicators,
    spacecraftCallout,
    spacecraftCalloutLabel,
    spacecraftIconThrust,
    statAssist: hud.querySelector<HTMLElement>('[data-stat="assist"]'),
    statEngine: hud.querySelector<HTMLElement>('[data-stat="engine"]'),
    statFuel: hud.querySelector<HTMLElement>('[data-stat="fuel"]'),
    statGuidance: hud.querySelector<HTMLElement>('[data-stat="guidance"]'),
    statSpeed: hud.querySelector<HTMLElement>('[data-stat="speed"]'),
    statTarget: hud.querySelector<HTMLElement>('[data-stat="target"]'),
    statTargetSpeed: hud.querySelector<HTMLElement>('[data-stat="target-speed"]'),
    statWarp: hud.querySelector<HTMLElement>('[data-stat="warp"]'),
    statZoom: hud.querySelector<HTMLElement>('[data-stat="zoom"]'),
  };
};
