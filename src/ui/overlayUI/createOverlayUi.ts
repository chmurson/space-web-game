import type { Body } from "../../simulation/types";
import { createDebugPanel, type DebugPanel } from "../debugPanel";
import './overlayUIStyles.css'

type ReplayPromptIconVariant = "v1" | "v2" | "v3" | "v4";

const getReplayPromptIconMarkup = (variant: ReplayPromptIconVariant) => {
  if (variant === "v2") {
    return `
      <svg class="scenario-prompt-pill-icon scenario-prompt-pill-icon-v2" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 1.75 16.3 5.4v9.2L10 18.25 3.7 14.6V5.4Z"></path>
        <path d="M10 5.15v5.35"></path>
        <circle cx="10" cy="13.65" r="0.9"></circle>
      </svg>
    `;
  }

  if (variant === "v3") {
    return `
      <svg class="scenario-prompt-pill-icon scenario-prompt-pill-icon-v3" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2.4c3.55 0 6.45 2.9 6.45 6.45 0 4.65-4.1 7.36-6.45 8.75-2.35-1.39-6.45-4.1-6.45-8.75C3.55 5.3 6.45 2.4 10 2.4Z"></path>
        <path d="M10 5.3v4.75"></path>
        <circle cx="10" cy="12.95" r="0.88"></circle>
      </svg>
    `;
  }

  if (variant === "v4") {
    return `
      <svg class="scenario-prompt-pill-icon scenario-prompt-pill-icon-v4" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 1.95 16 5.9v5.95c0 2.7-2.2 4.65-6 6.2-3.8-1.55-6-3.5-6-6.2V5.9Z"></path>
        <path d="M10 4.95v5.15"></path>
        <circle cx="10" cy="12.95" r="0.88"></circle>
      </svg>
    `;
  }

  return `
    <svg class="scenario-prompt-pill-icon scenario-prompt-pill-icon-v1" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1.8c2.85 0 5.15 2.3 5.15 5.15 0 3.55-2.7 6.25-5.15 9.3-2.45-3.05-5.15-5.75-5.15-9.3C4.85 4.1 7.15 1.8 10 1.8Z"></path>
      <path d="M10 5.15v4.5"></path>
      <circle cx="10" cy="12.3" r="0.88"></circle>
    </svg>
  `;
};

export type OverlayUiRefs = {
  bodyLabels: Map<string, HTMLElement>;
  debugPanel: DebugPanel;
  fpsIndicator: HTMLElement;
  hud: HTMLElement;
  hudDescription: HTMLParagraphElement | null;
  hudTitle: HTMLHeadingElement | null;
  offscreenIndicators: Map<string, HTMLElement>;
  scenarioPrompt: HTMLElement;
  scenarioPromptConfirmButton: HTMLButtonElement | null;
  scenarioPromptDescription: HTMLParagraphElement | null;
  scenarioPromptReplayButton: HTMLButtonElement;
  scenarioPromptReplayButtonLabel: HTMLSpanElement | null;
  scenarioPromptSecondaryButton: HTMLButtonElement | null;
  scenarioPromptTitle: HTMLHeadingElement | null;
  spacecraftCallout: HTMLElement;
  spacecraftCalloutLabel: HTMLSpanElement | null;
  spacecraftIconThrust: HTMLElement;
  statAssist: HTMLElement | null;
  statEngine: HTMLElement | null;
  statFuel: HTMLElement | null;
  statGuidance: HTMLElement | null;
  statSpeed: HTMLElement | null;
  speedIcon: SVGSVGElement | null;
  statTarget: HTMLElement | null;
  statTargetSpeed: HTMLElement | null;
  statTime: HTMLElement | null;
  timeIcon: SVGSVGElement | null;
  timeIconHand: SVGLineElement | null;
  statWarp: HTMLElement | null;
  statZoom: HTMLElement | null;
};

export type OverlayUiOptions = {
  app: HTMLElement;
  bodies: Body[];
  replayPromptIconVariant: ReplayPromptIconVariant;
  scenarioDescription: string;
  scenarioName: string;
  showCycleTargetHint: boolean;
};

export const createOverlayUi = (options: OverlayUiOptions): OverlayUiRefs => {
  const topBar = document.createElement("div");
  topBar.className = "top-bar";
  options.app.appendChild(topBar);

  const hud = document.createElement("section");
  hud.className = "hud hud-hidden";
  options.app.appendChild(hud);

  const telemetryStrip = document.createElement("div");
  telemetryStrip.className = "telemetry-strip";

  telemetryStrip.innerHTML = `
    <div class="telemetry-pill telemetry-pill-time">
      <span class="telemetry-time-display">
        <svg class="telemetry-time-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle class="telemetry-time-icon-face" cx="8" cy="8" r="6.25"></circle>
          <line class="telemetry-time-icon-hand telemetry-time-icon-hand-minute" x1="8" y1="8" x2="8" y2="3.5"></line>
          <circle class="telemetry-time-icon-center" cx="8" cy="8" r="0.9"></circle>
        </svg>
        <strong data-stat="time"></strong>
      </span>
    </div>
    <div class="telemetry-pill telemetry-pill-velocity">
      <span class="telemetry-speed-display">
        <svg class="telemetry-speed-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path class="telemetry-speed-icon-body" d="M8 1.5 L10.5 6.2 L10.2 10.1 L9 12.8 L7 12.8 L5.8 10.1 L5.5 6.2 Z"></path>
          <path class="telemetry-speed-icon-wing telemetry-speed-icon-wing-left" d="M5.7 8.8 L3.9 10.8 L5.8 11.1 Z"></path>
          <path class="telemetry-speed-icon-wing telemetry-speed-icon-wing-right" d="M10.3 8.8 L12.1 10.8 L10.2 11.1 Z"></path>
          <circle class="telemetry-speed-icon-window" cx="8" cy="6.1" r="0.95"></circle>
          <path class="telemetry-speed-icon-flame" d="M8 14.6 C8.9 13.6, 9.3 12.4, 8 11.1 C6.7 12.4, 7.1 13.6, 8 14.6 Z"></path>
        </svg>
        <strong data-stat="speed"></strong>
      </span>
    </div>
  `;
  topBar.appendChild(telemetryStrip);

  const debugPanel = createDebugPanel(options.app);

  const fpsIndicator = document.createElement("div");
  fpsIndicator.className = "fps-indicator";
  fpsIndicator.style.display = "none";
  options.app.appendChild(fpsIndicator);

  const scenarioPrompt = document.createElement("div");
  scenarioPrompt.className = "scenario-prompt-backdrop";
  scenarioPrompt.style.display = "none";
  scenarioPrompt.innerHTML = `
    <div class="scenario-prompt">
      <h2></h2>
      <p></p>
      <div class="scenario-prompt-actions">
        <button type="button" data-role="confirm"></button>
        <button type="button" data-role="secondary"></button>
      </div>
    </div>
  `;
  options.app.appendChild(scenarioPrompt);

  const scenarioPromptReplayButton = document.createElement("button");
  scenarioPromptReplayButton.type = "button";
  scenarioPromptReplayButton.className = "scenario-prompt-pill";
  scenarioPromptReplayButton.style.display = "none";
  scenarioPromptReplayButton.innerHTML = `
    ${getReplayPromptIconMarkup(options.replayPromptIconVariant)}
    <span class="scenario-prompt-pill-label"></span>
  `;
  topBar.appendChild(scenarioPromptReplayButton);

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
    hudDescription: hud.querySelector<HTMLParagraphElement>("p"),
    hudTitle: hud.querySelector<HTMLHeadingElement>("h1"),
    offscreenIndicators,
    scenarioPrompt,
    scenarioPromptConfirmButton: scenarioPrompt.querySelector<HTMLButtonElement>('[data-role="confirm"]'),
    scenarioPromptDescription: scenarioPrompt.querySelector<HTMLParagraphElement>("p"),
    scenarioPromptReplayButton,
    scenarioPromptReplayButtonLabel: scenarioPromptReplayButton.querySelector<HTMLSpanElement>(".scenario-prompt-pill-label"),
    scenarioPromptSecondaryButton: scenarioPrompt.querySelector<HTMLButtonElement>('[data-role="secondary"]'),
    scenarioPromptTitle: scenarioPrompt.querySelector<HTMLHeadingElement>("h2"),
    spacecraftCallout,
    spacecraftCalloutLabel,
    spacecraftIconThrust,
    statAssist: null,
    statEngine: null,
    statFuel: null,
    statGuidance: null,
    statSpeed: topBar.querySelector<HTMLElement>('[data-stat="speed"]'),
    speedIcon: topBar.querySelector<SVGSVGElement>(".telemetry-speed-icon"),
    statTarget: null,
    statTargetSpeed: null,
    statTime: topBar.querySelector<HTMLElement>('[data-stat="time"]'),
    timeIcon: topBar.querySelector<SVGSVGElement>(".telemetry-time-icon"),
    timeIconHand: topBar.querySelector<SVGLineElement>(".telemetry-time-icon-hand-minute"),
    statWarp: null,
    statZoom: null,
  };
};
