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
    const timeWarps = [1, 10, 30, 60]
    let timeWarpIndex = 0
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
      getInteractionsEnabled: () => true,
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

    const revealButton = controls.element.querySelector<HTMLButtonElement>(
      '#touch-time-warp-reveal .touch-edge-reveal-tab',
    )
    revealButton?.click()
    const originalControl = controls.element.querySelector<HTMLElement>(
      '[aria-label="Time warp control"]',
    )
    const prototypeControl = controls.element.querySelector<HTMLElement>(
      '[aria-label="Time Warp control 2"]',
    )
    if (!originalControl || !prototypeControl) {
      throw new Error('Expected both time warp controls to render')
    }

    const rect = prototypeControl.getBoundingClientRect()
    const start = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    const end = { x: start.x + 54, y: start.y }
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
    window.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: end.x,
        clientY: end.y,
      }),
    )
    controls.syncUi()

    return {
      currentTimeWarp: timeWarps[timeWarpIndex],
      originalText: originalControl.textContent,
      prototypeText: prototypeControl.textContent,
    }
  })

  expect(result.currentTimeWarp).toBe(10)
  expect(result.originalText).toContain('x10s')
  expect(result.prototypeText).toContain('x10s')
})
