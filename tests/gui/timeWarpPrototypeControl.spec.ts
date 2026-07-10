import { expect, test } from '@playwright/test'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../src/runtime/timeWarpFeedbackPolicy'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('routes the horizontal prototype time warp control to shared state', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsModulePath =
      '/src/ui/touchControls/createTouchControls.ts'
    const { createTouchControls } = (await import(
      touchControlsModulePath
    )) as TouchControlsModule
    await import('/src/ui/touchControls/touchControls.css')
    await import(
      '/src/ui/touchControls/stepSelectorControl/stepSelectorControl.css'
    )
    const timeWarps = [1, 10, 30, 60]
    let timeWarpIndex = 0
    let interactionsEnabled = true
    const body = {
      color: '#38BDF8',
      id: 'earth',
      mass: 1,
      name: 'Earth',
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    }
    const getTimeWarpPreviews = (
      action: TimeWarpAction,
      count: number,
    ): {
      canCommit: boolean
      reason: TimeWarpFeedbackReason | null
      value: number
    }[] =>
      Array.from({ length: count }, (_, offset) => {
        const nextIndex =
          timeWarpIndex +
          (action === 'increaseTimeWarp' ? offset + 1 : -offset - 1)
        const clampedIndex = Math.max(
          0,
          Math.min(timeWarps.length - 1, nextIndex),
        )
        let reason: TimeWarpFeedbackReason | null = null
        if (nextIndex !== clampedIndex) {
          if (action === 'increaseTimeWarp') {
            reason = 'global-max'
          } else {
            reason = 'global-min'
          }
        }
        return {
          canCommit: nextIndex === clampedIndex,
          reason,
          value: timeWarps[clampedIndex],
        }
      })
    const controls = createTouchControls({
      app: document.body,
      automaticTargetingAvailable: true,
      commitTimeWarp: (action) => {
        if (action === 'increaseTimeWarp') {
          timeWarpIndex = Math.min(timeWarps.length - 1, timeWarpIndex + 1)
        } else {
          timeWarpIndex = Math.max(0, timeWarpIndex - 1)
        }
      },
      commitTrajectoryHorizon: () => {},
      getAssistTargetUiState: () => ({
        activeTarget: body,
        mode: 'auto',
        recommendedTarget: null,
      }),
      getCameraMode: () => 'unlocked',
      getCameraModeChangesLocked: () => false,
      getCurrentTimeWarp: () => timeWarps[timeWarpIndex],
      getCurrentTrajectoryHorizonHours: () => 1,
      getInteractionsEnabled: () => interactionsEnabled,
      getMobileManeuverStartByDrag: () => true,
      getSpacecraftVisible: () => true,
      getTargetControlRows: () => [],
      getTimeWarpPreview: (action) => getTimeWarpPreviews(action, 1)[0],
      getTimeWarpPreviews,
      getTrajectoryHorizonPreviews: () => [],
      initialBurnControlSide: 'right',
      initialTargetControlSide: 'left',
      initialTrajectoryControlSide: 'hidden',
      initialWarpControlSide: 'right',
      keyboardInput: {
        clear: () => {},
        getManualControls: () => ({
          main: 0,
          reverse: 0,
          strafe: 0,
          turn: 0,
        }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
      },
      onCameraModeSelected: () => true,
      onCameraPanGesture: () => false,
      onReturnToAutomaticTarget: () => true,
      onSelectTargetIndex: () => true,
      onTargetHeadingPlan: () => {},
      onTargetHeadingPlanCanceled: () => {},
      onTargetHeadingPlanCommitted: () => true,
      onTargetStateChange: () => {},
      onThrustControlUiStateChange: () => {},
      onZoom: () => {},
    })
    document.body.append(controls.element)

    const originalReveal = controls.element.querySelector<HTMLElement>(
      '#touch-time-warp-reveal',
    )
    const prototypeReveal = controls.element.querySelector<HTMLElement>(
      '#touch-time-warp-prototype-reveal',
    )
    const revealButton = originalReveal?.querySelector<HTMLButtonElement>(
      '.touch-edge-reveal-tab',
    )
    const prototypeRevealButton =
      prototypeReveal?.querySelector<HTMLButtonElement>(
        '.touch-edge-reveal-tab',
      )
    if (
      !originalReveal ||
      !prototypeReveal ||
      !revealButton ||
      !prototypeRevealButton
    ) {
      throw new Error('Expected separate time warp reveal controls to render')
    }
    const instantAnimationStyle = document.createElement('style')
    instantAnimationStyle.textContent = `
      .touch-step-selector-value {
        transition: none !important;
      }
    `
    document.head.append(instantAnimationStyle)
    revealButton.click()
    prototypeRevealButton.click()
    const originalControl = originalReveal.querySelector<HTMLElement>(
      '[aria-label="Time warp control"]',
    )
    const prototypeControl = prototypeReveal.querySelector<HTMLElement>(
      '[aria-label="Time Warp control 2"]',
    )
    if (!originalControl || !prototypeControl) {
      throw new Error('Expected both time warp controls to render')
    }
    if (originalReveal.contains(prototypeControl)) {
      throw new Error('Expected prototype control to use a separate reveal')
    }
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (getComputedStyle(prototypeControl).touchAction === 'none') {
        break
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
    }
    if (getComputedStyle(prototypeControl).touchAction !== 'none') {
      throw new Error('Expected step selector styles to load')
    }

    const dragPrototype = (
      params: { beforeMouseup?: () => void; distanceX?: number } = {},
    ) => {
      const rect = prototypeControl.getBoundingClientRect()
      const start = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      const end = { x: start.x + (params.distanceX ?? 54), y: start.y }
      prototypeControl.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          cancelable: true,
          clientX: start.x,
          clientY: start.y,
        }),
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          button: 0,
          cancelable: true,
          clientX: end.x,
          clientY: end.y,
        }),
      )
      params.beforeMouseup?.()
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          button: 0,
          cancelable: true,
          clientX: end.x,
          clientY: end.y,
        }),
      )
    }

    const inspectLeftSwipeAnimation = async () => {
      const rect = prototypeControl.getBoundingClientRect()
      const start = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      prototypeControl.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          cancelable: true,
          clientX: start.x,
          clientY: start.y,
        }),
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          button: 0,
          cancelable: true,
          clientX: start.x - 24,
          clientY: start.y,
        }),
      )
      const currentValue = prototypeControl.querySelector(
        '.touch-step-selector-value-current',
      )
      const previousValue = prototypeControl.querySelector(
        '.touch-step-selector-value-up-near',
      )
      if (!currentValue || !previousValue) {
        throw new Error('Expected horizontal selector values to render')
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      const className = prototypeControl.className
      const dragProgress = Number.parseFloat(
        getComputedStyle(prototypeControl).getPropertyValue(
          '--touch-step-selector-drag-progress',
        ),
      )
      const matchingRules = Array.from(document.styleSheets).flatMap(
        (sheet) => {
          try {
            return Array.from(sheet.cssRules).map((rule) => rule.cssText)
          } catch {
            return []
          }
        },
      )
      const currentDragRule = matchingRules.find(
        (cssText) =>
          cssText.includes(
            '.touch-step-selector-horizontal.touch-step-selector-target-decrease',
          ) && cssText.includes('.touch-step-selector-value-current'),
      )
      const previousRule = matchingRules.find(
        (cssText) =>
          cssText.includes(
            '.touch-step-selector-horizontal.touch-step-selector-target-decrease',
          ) && cssText.includes('.touch-step-selector-value-up-near'),
      )
      const currentCommitRule = matchingRules.find(
        (cssText) =>
          cssText.includes(
            '.touch-step-selector-horizontal.touch-step-selector-step-down',
          ) && cssText.includes('.touch-step-selector-value-current'),
      )
      window.dispatchEvent(new Event('blur'))
      return {
        className,
        currentCommitRule,
        currentDragRule,
        dragProgress,
        previousRule,
      }
    }

    timeWarpIndex = 1
    controls.syncUi()
    const leftSwipeAnimation = await inspectLeftSwipeAnimation()
    timeWarpIndex = 0
    controls.syncUi()
    dragPrototype()
    const firstCommitTimeWarp = timeWarps[timeWarpIndex]

    dragPrototype({
      beforeMouseup: () => {
        interactionsEnabled = false
      },
      distanceX: 24,
    })
    const disabledMouseupTimeWarp = timeWarps[timeWarpIndex]
    interactionsEnabled = true

    dragPrototype()
    const postDisabledRecoveryTimeWarp = timeWarps[timeWarpIndex]

    dragPrototype({
      beforeMouseup: () => {
        window.dispatchEvent(new Event('blur'))
      },
      distanceX: 24,
    })
    const blurCancelTimeWarp = timeWarps[timeWarpIndex]

    dragPrototype()
    controls.syncUi()

    return {
      blurCancelTimeWarp,
      currentTimeWarp: timeWarps[timeWarpIndex],
      disabledMouseupTimeWarp,
      firstCommitTimeWarp,
      leftSwipeAnimation,
      originalText: originalControl.textContent,
      postDisabledRecoveryTimeWarp,
      prototypeText: prototypeControl.textContent,
    }
  })

  expect(result.firstCommitTimeWarp).toBe(10)
  expect(result.disabledMouseupTimeWarp).toBe(10)
  expect(result.postDisabledRecoveryTimeWarp).toBe(30)
  expect(result.blurCancelTimeWarp).toBe(30)
  expect(result.currentTimeWarp).toBe(60)
  expect(result.leftSwipeAnimation.className).toContain(
    'touch-step-selector-target-decrease',
  )
  expect(result.leftSwipeAnimation.dragProgress).toBeGreaterThan(0)
  expect(result.leftSwipeAnimation.currentDragRule).toContain(
    'var(--touch-step-selector-drag-progress) * 24px',
  )
  expect(result.leftSwipeAnimation.currentCommitRule).toContain(
    'translateX(2px)',
  )
  expect(result.leftSwipeAnimation.previousRule).toContain(
    'var(--touch-step-selector-drag-progress) * 25px',
  )
  expect(result.originalText).toContain('x1m')
  expect(result.prototypeText).toContain('x1m')
})
