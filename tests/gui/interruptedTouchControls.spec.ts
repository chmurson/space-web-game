import { expect, test } from '@playwright/test'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../src/runtime/timeWarpFeedbackPolicy'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('hands interrupted control gestures to the newest touch', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsModulePath =
      '/src/ui/touchControls/createTouchControls.ts'
    const { createTouchControls } = (await import(
      touchControlsModulePath
    )) as TouchControlsModule
    const timeWarps = [1, 10, 30, 60, 120]
    const body = {
      color: '#38BDF8',
      id: 'earth',
      mass: 1,
      name: 'Earth',
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    }

    type TouchPoint = {
      id: number
      target: HTMLElement
      x: number
      y: number
    }

    const createHarness = () => {
      const app = document.createElement('div')
      document.body.append(app)
      let timeWarpIndex = 1
      let thrustEngagementCount = 0
      let thrustEngaged = false

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
          return {
            canCommit: nextIndex === clampedIndex,
            reason: nextIndex === clampedIndex ? null : 'global-max',
            value: timeWarps[clampedIndex],
          }
        })

      const controls = createTouchControls({
        app,
        automaticTargetingAvailable: true,
        commitTimeWarp: (action) => {
          const offset = action === 'increaseTimeWarp' ? 1 : -1
          timeWarpIndex = Math.max(
            0,
            Math.min(timeWarps.length - 1, timeWarpIndex + offset),
          )
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
          setVirtualKey: (key, engaged) => {
            if (key === 'main') {
              thrustEngaged = engaged
              if (engaged) {
                thrustEngagementCount += 1
              }
            }
          },
          setVirtualTurn: () => {},
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

      const prototypeReveal = controls.element.querySelector<HTMLElement>(
        '#touch-time-warp-prototype-reveal',
      )
      const flightButton = controls.element.querySelector<HTMLButtonElement>(
        '#mobile-command-dock-flight-button',
      )
      const prototypeRevealButton =
        prototypeReveal?.querySelector<HTMLButtonElement>(
          '.touch-edge-reveal-tab',
        )
      if (!prototypeReveal || !prototypeRevealButton || !flightButton) {
        throw new Error('Expected Time Warp reveal and Flight dock controls')
      }
      prototypeRevealButton.click()
      flightButton.click()

      const timeWarpControl = prototypeReveal.querySelector<HTMLElement>(
        '[aria-label="Time Warp control 2"]',
      )
      const thrustControl = controls.element.querySelector<HTMLElement>(
        '.touch-thrust-control',
      )
      if (!timeWarpControl || !thrustControl) {
        throw new Error(
          'Expected revealed Time Warp and docked thrust controls',
        )
      }

      const createTouch = (point: TouchPoint) =>
        new Touch({
          clientX: point.x,
          clientY: point.y,
          identifier: point.id,
          target: point.target,
        })
      const dispatchTouch = (
        target: HTMLElement,
        type: 'touchend' | 'touchmove' | 'touchstart',
        changedPoints: TouchPoint[],
        activePoints: TouchPoint[],
      ) => {
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: changedPoints.map(createTouch),
            targetTouches: activePoints
              .filter((point) => point.target === target)
              .map(createTouch),
            touches: activePoints.map(createTouch),
          }),
        )
      }
      const center = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect()
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }
      }

      return {
        closeFlightPanel: () => flightButton.click(),
        dispatchTouch,
        getThrustEngagementCount: () => thrustEngagementCount,
        getThrustEngaged: () => thrustEngaged,
        getTimeWarp: () => timeWarps[timeWarpIndex],
        remove: () => app.remove(),
        thrustControl,
        thrustStart: center(thrustControl),
        timeWarpControl,
        timeWarpStart: center(timeWarpControl),
      }
    }

    const successiveTimeWarp = createHarness()
    const firstWarpTouch = {
      id: 1,
      target: successiveTimeWarp.timeWarpControl,
      ...successiveTimeWarp.timeWarpStart,
    }
    const firstWarpMove = { ...firstWarpTouch, x: firstWarpTouch.x - 10 }
    const secondWarpTouch = {
      id: 2,
      target: successiveTimeWarp.timeWarpControl,
      ...successiveTimeWarp.timeWarpStart,
    }
    const secondWarpMove = { ...secondWarpTouch, x: secondWarpTouch.x - 54 }
    successiveTimeWarp.dispatchTouch(
      successiveTimeWarp.timeWarpControl,
      'touchstart',
      [firstWarpTouch],
      [firstWarpTouch],
    )
    successiveTimeWarp.dispatchTouch(
      successiveTimeWarp.timeWarpControl,
      'touchmove',
      [firstWarpMove],
      [firstWarpMove],
    )
    successiveTimeWarp.dispatchTouch(
      successiveTimeWarp.timeWarpControl,
      'touchstart',
      [secondWarpTouch],
      [firstWarpMove, secondWarpTouch],
    )
    successiveTimeWarp.dispatchTouch(
      successiveTimeWarp.timeWarpControl,
      'touchend',
      [firstWarpMove],
      [secondWarpTouch],
    )
    successiveTimeWarp.dispatchTouch(
      successiveTimeWarp.timeWarpControl,
      'touchmove',
      [secondWarpMove],
      [secondWarpMove],
    )
    successiveTimeWarp.dispatchTouch(
      successiveTimeWarp.timeWarpControl,
      'touchend',
      [secondWarpMove],
      [],
    )
    const successiveTimeWarpValue = successiveTimeWarp.getTimeWarp()
    successiveTimeWarp.remove()

    const timeWarpToThrust = createHarness()
    const oldWarpTouch = {
      id: 3,
      target: timeWarpToThrust.timeWarpControl,
      ...timeWarpToThrust.timeWarpStart,
    }
    const oldWarpMove = { ...oldWarpTouch, x: oldWarpTouch.x - 10 }
    const newThrustTouch = {
      id: 4,
      target: timeWarpToThrust.thrustControl,
      ...timeWarpToThrust.thrustStart,
    }
    const newThrustMove = { ...newThrustTouch, y: newThrustTouch.y - 80 }
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.timeWarpControl,
      'touchstart',
      [oldWarpTouch],
      [oldWarpTouch],
    )
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.timeWarpControl,
      'touchmove',
      [oldWarpMove],
      [oldWarpMove],
    )
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.thrustControl,
      'touchstart',
      [newThrustTouch],
      [oldWarpMove, newThrustTouch],
    )
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.timeWarpControl,
      'touchend',
      [oldWarpMove],
      [newThrustTouch],
    )
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.thrustControl,
      'touchmove',
      [newThrustMove],
      [newThrustMove],
    )
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.thrustControl,
      'touchend',
      [newThrustMove],
      [],
    )
    const thrustEngaged = timeWarpToThrust.getThrustEngagementCount() > 0
    const thrustLatchedAfterRelease = timeWarpToThrust.getThrustEngaged()
    timeWarpToThrust.closeFlightPanel()
    const thrustAfterPanelClose = timeWarpToThrust.getThrustEngaged()
    timeWarpToThrust.remove()

    const thrustToTimeWarp = createHarness()
    const oldThrustTouch = {
      id: 5,
      target: thrustToTimeWarp.thrustControl,
      ...thrustToTimeWarp.thrustStart,
    }
    const newWarpTouch = {
      id: 6,
      target: thrustToTimeWarp.timeWarpControl,
      ...thrustToTimeWarp.timeWarpStart,
    }
    const newWarpMove = { ...newWarpTouch, x: newWarpTouch.x - 54 }
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.thrustControl,
      'touchstart',
      [oldThrustTouch],
      [oldThrustTouch],
    )
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.timeWarpControl,
      'touchstart',
      [newWarpTouch],
      [oldThrustTouch, newWarpTouch],
    )
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.thrustControl,
      'touchend',
      [oldThrustTouch],
      [newWarpTouch],
    )
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.timeWarpControl,
      'touchmove',
      [newWarpMove],
      [newWarpMove],
    )
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.timeWarpControl,
      'touchend',
      [newWarpMove],
      [],
    )
    const postThrustTimeWarpValue = thrustToTimeWarp.getTimeWarp()
    thrustToTimeWarp.remove()

    return {
      postThrustTimeWarpValue,
      successiveTimeWarpValue,
      thrustAfterPanelClose,
      thrustEngaged,
      thrustLatchedAfterRelease,
    }
  })

  expect(result).toEqual({
    postThrustTimeWarpValue: 30,
    successiveTimeWarpValue: 30,
    thrustAfterPanelClose: false,
    thrustEngaged: true,
    thrustLatchedAfterRelease: true,
  })
})
