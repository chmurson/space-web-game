import './scenario-prompts.css';
import type { AppRuntimeState } from '../../runtime/appRuntimeState';
import { getRuntimeActivePrompt, getRuntimeScenarioReplayPromptContent } from '../../scenario/scenarioRegistry';
import {
  computePosition,
  flip,
  shift,
  offset,
  arrow,
} from '@floating-ui/dom';

export type ScenarioPromptUiRefs = {
  backdropElement: HTMLElement;
  promptElement: HTMLElement;
  arrowElement: HTMLElement;
  titleElement: HTMLHeadingElement | null;
  descriptionElement: HTMLParagraphElement | null;
  confirmButton: HTMLButtonElement | null;
  secondaryButton: HTMLButtonElement | null;
  replayButton: HTMLButtonElement;
  replayButtonLabel: HTMLSpanElement | null;
};

type AnchorKey = 'speed-pill' | 'time-warp-pill' | 'trajectory';

const getAnchorElement = (anchor: AnchorKey): HTMLElement | null => {
  if (anchor === 'speed-pill') {
    // Find the thrust pill element
    const statThrust = document.querySelector<HTMLElement>('[data-stat="speed"]');
    return statThrust?.closest<HTMLElement>('.telemetry-pill') ?? null;
  }
  if (anchor === 'time-warp-pill') {
    const statTime = document.querySelector<HTMLElement>('[data-stat="time"]');
    return statTime?.closest<HTMLElement>('.telemetry-pill') ?? null;
  }
  return null;
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
      <div class="scenario-prompt-arrow"></div>
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

  const promptElement = backdropElement.querySelector<HTMLElement>('.scenario-prompt')!;
  const arrowElement = promptElement.querySelector<HTMLElement>('.scenario-prompt-arrow')!;

  return {
    backdropElement,
    promptElement,
    arrowElement,
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
 * Uses Floating UI for automatic positioning relative to anchor elements.
 */
export const createScenarioPromptUpdater = (refs: ScenarioPromptUiRefs): ScenarioPromptUpdater => {
  let anchorResizeObserver: ResizeObserver | null = null;
  let windowResizeTimeoutId: number | null = null;
  let anchorMutationObserver: MutationObserver | null = null;

  const updatePromptPosition = async (): Promise<void> => {
    const anchorKey = refs.promptElement.dataset.anchor as AnchorKey | undefined;
    if (!anchorKey) {
      return;
    }

    const anchorElement = getAnchorElement(anchorKey);
    if (!anchorElement || refs.backdropElement.style.display === 'none') {
      debugger;
      return;
    }

    try {
      const { x, y, placement: finalPlacement, middlewareData } = await computePosition(
        anchorElement,
        refs.promptElement,
        {
          placement: 'top-end',
          middleware: [
            offset(12), // 12px gap from anchor
            flip({
              padding: 10,
            }),
            shift({
              padding: 10,
            }),
            arrow({
              element: refs.arrowElement,
              padding: 8,
            }),
          ],
        },
      );

      // Position the prompt
      refs.promptElement.style.position = 'fixed';
      refs.promptElement.style.left = `${x}px`;
      refs.promptElement.style.top = `${y}px`;

      // Position the arrow
      const { x: arrowX, y: arrowY } = middlewareData.arrow || {};
      const staticSide = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      }[finalPlacement.split('-')[0]] as string;

      refs.arrowElement.style.position = 'absolute';
      refs.arrowElement.style.left = arrowX !== undefined ? `${arrowX}px` : '';
      refs.arrowElement.style.top = arrowY !== undefined ? `${arrowY}px` : '';
      refs.arrowElement.style[staticSide as any] = '-6px';
      refs.arrowElement.dataset.side = staticSide;
    } catch (error) {
      console.error('Failed to position prompt:', error);
    }
  };

  const setupAnchorObserver = (anchorElement: HTMLElement): void => {
    if (anchorResizeObserver) {
      anchorResizeObserver.disconnect();
    }

    anchorResizeObserver = new ResizeObserver(() => {
      updatePromptPosition();
    });

    anchorResizeObserver.observe(anchorElement);

    // Also observe for DOM changes that might affect positioning
    if (anchorMutationObserver) {
      anchorMutationObserver.disconnect();
    }

    anchorMutationObserver = new MutationObserver(() => {
      updatePromptPosition();
    });

    anchorMutationObserver.observe(anchorElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: false,
    });
  };

  const handleWindowResize = () => {
    if (windowResizeTimeoutId !== null) {
      window.clearTimeout(windowResizeTimeoutId);
    }
    windowResizeTimeoutId = window.setTimeout(() => {
      updatePromptPosition();
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
      if (activePrompt?.mode === 'coach' && activePrompt?.anchor) {
        const anchorElement = getAnchorElement(activePrompt.anchor as AnchorKey);
        if (anchorElement) {
          setupAnchorObserver(anchorElement);
          updatePromptPosition();
        }
      } else {
        // Clean up observers for non-anchor prompts
        if (anchorResizeObserver) {
          anchorResizeObserver.disconnect();
          anchorResizeObserver = null;
        }
        if (anchorMutationObserver) {
          anchorMutationObserver.disconnect();
          anchorMutationObserver = null;
        }
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
      if (anchorMutationObserver) {
        anchorMutationObserver.disconnect();
      }
      if (windowResizeTimeoutId !== null) {
        window.clearTimeout(windowResizeTimeoutId);
      }
      window.removeEventListener('resize', handleWindowResize);
    },
  };
};
