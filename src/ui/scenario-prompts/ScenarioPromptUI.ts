import './scenario-prompts.css';
import type { AppRuntimeState } from '../../runtime/appRuntimeState';
import { getRuntimeActivePrompt, getRuntimeScenarioReplayPromptContent } from '../../scenario/scenarioRegistry';

export type ScenarioPromptUiRefs = {
  backdropElement: HTMLElement;
  promptElement: HTMLElement;
  titleElement: HTMLHeadingElement | null;
  descriptionElement: HTMLParagraphElement | null;
  confirmButton: HTMLButtonElement | null;
  secondaryButton: HTMLButtonElement | null;
  replayButton: HTMLButtonElement;
  replayButtonLabel: HTMLSpanElement | null;
};

type AnchorKey = 'thrust-pill' | 'time-warp-pill' | 'trajectory';

const getAnchorElement = (anchor: AnchorKey): HTMLElement | null => {
  if (anchor === 'thrust-pill') {
    // Find the thrust pill element
    const statThrust = document.querySelector<HTMLElement>('[data-stat="thrust"]');
    return statThrust?.closest<HTMLElement>('.telemetry-pill') ?? null;
  }
  if (anchor === 'time-warp-pill') {
    const statTime = document.querySelector<HTMLElement>('[data-stat="time"]');
    return statTime?.closest<HTMLElement>('.telemetry-pill') ?? null;
  }
  return null;
};

const positionPromptNearAnchor = (
  promptElement: HTMLElement,
  anchorElement: HTMLElement,
): void => {
  const anchorRect = anchorElement.getBoundingClientRect();
  const promptRect = promptElement.getBoundingClientRect();

  const padding = 12;
  const arrowSize = 8;

  // Preferred position: to the right of anchor
  let top = anchorRect.top + anchorRect.height / 2;
  let left = anchorRect.right + padding + arrowSize;
  let arrowDirection: 'left' | 'right' = 'left';

  // If it goes off-screen to the right, move to the left of anchor
  if (left + promptRect.width > window.innerWidth - padding) {
    left = anchorRect.left - promptRect.width - padding - arrowSize;
    arrowDirection = 'right';
  }

  // Adjust vertical position to keep prompt in bounds
  top = Math.max(padding, Math.min(top - promptRect.height / 2, window.innerHeight - promptRect.height - padding));

  // Clamp horizontal position to viewport bounds
  left = Math.max(padding, Math.min(left, window.innerWidth - promptRect.width - padding));

  // Store the arrow Y position relative to the prompt for CSS to use
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  const arrowY = Math.max(12, Math.min(anchorCenterY - top, promptRect.height - 12));

  promptElement.style.position = 'fixed';
  promptElement.style.left = `${left}px`;
  promptElement.style.top = `${top}px`;
  promptElement.style.setProperty('--arrow-y', `${arrowY}px`);
  promptElement.dataset.arrowDirection = arrowDirection;
};

const resetPromptPosition = (promptElement: HTMLElement): void => {
  promptElement.style.position = '';
  promptElement.style.left = '';
  promptElement.style.top = '';
  promptElement.style.removeProperty('--arrow-y');
  delete promptElement.dataset.arrowDirection;
};

/**
 * Creates the scenario prompt UI elements and returns references to them.
 * This includes the main prompt backdrop/modal and the replay button.
 */
export const createScenarioPromptUI = (app: HTMLElement, topBar: HTMLElement): ScenarioPromptUiRefs => {
  // Create the main prompt backdrop
  const backdropElement = document.createElement('div');
  backdropElement.className = 'scenario-prompt-backdrop';
  backdropElement.style.display = 'none';
  backdropElement.innerHTML = `
    <div class="scenario-prompt">
      <h2></h2>
      <p></p>
      <div class="scenario-prompt-actions">
        <button type="button" data-role="confirm"></button>
        <button type="button" data-role="secondary"></button>
      </div>
    </div>
  `;
  app.appendChild(backdropElement);

  // Create the replay button pill
  const replayButton = document.createElement('button');
  replayButton.type = 'button';
  replayButton.className = 'scenario-prompt-pill';
  replayButton.style.display = 'none';
  replayButton.innerHTML = `
    <svg class="scenario-prompt-pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1.75 16.3 5.4v9.2L10 18.25 3.7 14.6V5.4Z"></path>
      <path d="M10 5.15v5.35"></path>
      <circle cx="10" cy="13.65" r="0.9"></circle>
    </svg>
    <span class="scenario-prompt-pill-label"></span>
  `;
  topBar.appendChild(replayButton);

  return {
    backdropElement,
    promptElement: backdropElement.querySelector<HTMLElement>('.scenario-prompt')!,
    titleElement: backdropElement.querySelector<HTMLHeadingElement>('h2'),
    descriptionElement: backdropElement.querySelector<HTMLParagraphElement>('p'),
    confirmButton: backdropElement.querySelector<HTMLButtonElement>('[data-role="confirm"]'),
    secondaryButton: backdropElement.querySelector<HTMLButtonElement>('[data-role="secondary"]'),
    replayButton,
    replayButtonLabel: replayButton.querySelector<HTMLSpanElement>('.scenario-prompt-pill-label'),
  };
};

export type ScenarioPromptUpdater = {
  update: (runtime: AppRuntimeState, inputMode: 'desktop' | 'mobile', showScenarioInfoButton: boolean) => void;
  cleanup: () => void;
};

/**
 * Creates an updater that handles all scenario prompt state updates and positioning logic.
 * Encapsulates anchor positioning, resize observers, and window resize handling.
 */
export const createScenarioPromptUpdater = (refs: ScenarioPromptUiRefs): ScenarioPromptUpdater => {
  let anchorResizeObserver: ResizeObserver | null = null;
  let windowResizeTimeoutId: number | null = null;

  const setupAnchorObserver = (anchorElement: HTMLElement): void => {
    if (anchorResizeObserver) {
      anchorResizeObserver.disconnect();
    }

    anchorResizeObserver = new ResizeObserver(() => {
      const anchorKey = refs.promptElement.dataset.anchor as AnchorKey | undefined;
      if (anchorKey) {
        const anchor = getAnchorElement(anchorKey);
        if (anchor) {
          positionPromptNearAnchor(refs.promptElement, anchor);
        }
      }
    });

    anchorResizeObserver.observe(anchorElement);
  };

  const updateAnchorPosition = (): void => {
    const anchorKey = refs.promptElement.dataset.anchor as AnchorKey | undefined;
    if (!anchorKey) {
      resetPromptPosition(refs.promptElement);
      if (anchorResizeObserver) {
        anchorResizeObserver.disconnect();
        anchorResizeObserver = null;
      }
      return;
    }

    const anchorElement = getAnchorElement(anchorKey);
    if (anchorElement) {
      positionPromptNearAnchor(refs.promptElement, anchorElement);
      setupAnchorObserver(anchorElement);
    }
  };

  const handleWindowResize = () => {
    if (windowResizeTimeoutId !== null) {
      window.clearTimeout(windowResizeTimeoutId);
    }
    windowResizeTimeoutId = window.setTimeout(() => {
      updateAnchorPosition();
      windowResizeTimeoutId = null;
    }, 100);
  };

  window.addEventListener('resize', handleWindowResize);

  return {
    update: (runtime: AppRuntimeState, inputMode: 'desktop' | 'mobile', showScenarioInfoButton: boolean) => {
      const activePrompt = getRuntimeActivePrompt(runtime, inputMode);
      const replayPromptContent = getRuntimeScenarioReplayPromptContent(runtime);

      // Show/hide backdrop
      refs.backdropElement.style.display = activePrompt ? 'grid' : 'none';

      // Set prompt mode
      refs.backdropElement.dataset.promptMode = activePrompt?.mode === 'coach' ? 'coach' : 'modal';

      // Set anchor if present
      if (activePrompt?.anchor) {
        refs.promptElement.dataset.anchor = activePrompt.anchor;
      } else {
        delete refs.promptElement.dataset.anchor;
      }

      // Update anchor positioning for coach prompts
      if (activePrompt?.mode === 'coach') {
        updateAnchorPosition();
      }

      // Update content
      if (refs.titleElement) {
        refs.titleElement.textContent = activePrompt?.title ?? '';
      }
      if (refs.descriptionElement) {
        refs.descriptionElement.textContent = activePrompt?.description ?? '';
      }

      // Update buttons
      if (refs.confirmButton) {
        refs.confirmButton.style.display = activePrompt?.confirmButton ? 'inline-flex' : 'none';
        refs.confirmButton.textContent = activePrompt?.confirmButton?.label ?? '';
        refs.confirmButton.dataset.promptAction = activePrompt?.confirmButton?.action ?? '';
      }
      if (refs.secondaryButton) {
        refs.secondaryButton.style.display = activePrompt?.secondaryButton ? 'inline-flex' : 'none';
        refs.secondaryButton.textContent = activePrompt?.secondaryButton?.label ?? '';
        refs.secondaryButton.dataset.promptAction = activePrompt?.secondaryButton?.action ?? '';
      }

      // Update replay button
      refs.replayButton.style.display =
        showScenarioInfoButton && !activePrompt && replayPromptContent ? 'inline-flex' : 'none';
      if (refs.replayButtonLabel) {
        refs.replayButtonLabel.textContent = replayPromptContent?.title ?? '';
      }
    },

    cleanup: () => {
      if (anchorResizeObserver) {
        anchorResizeObserver.disconnect();
      }
      if (windowResizeTimeoutId !== null) {
        window.clearTimeout(windowResizeTimeoutId);
      }
      window.removeEventListener('resize', handleWindowResize);
    },
  };
};
