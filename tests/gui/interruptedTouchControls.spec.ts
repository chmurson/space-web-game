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
        getCameraCanRecenter: () => true,
        getCameraControlsLocked: () => false,
        getCameraFollow: () => 'spacecraft',
        getCurrentTimeWarp: () => timeWarps[timeWarpIndex],
        getCurrentTrajectoryHorizonHours: () => 1,
        getInteractionsEnabled: () => true,
        getTargetControlRows: () => [],
        getTimeWarpPreview: (action) => getTimeWarpPreviews(action, 1)[0],
        getTimeWarpPreviews,
        getTrajectoryHorizonPreviews: () => [],
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
        onCameraPanGesture: () => false,
        onCameraFollowSelect: () => {},
        onCameraRecenter: () => {},
        onReturnToAutomaticTarget: () => true,
        onSelectTargetIndex: () => true,
        onTargetStateChange: () => {},
        onThrustControlUiStateChange: () => {},
        onZoom: () => {},
      })

      const flightButton = controls.element.querySelector<HTMLButtonElement>(
        '#mobile-command-dock-flight-button',
      )
      const navButton = controls.element.querySelector<HTMLButtonElement>(
        '#mobile-command-dock-nav-button',
      )
      if (!flightButton || !navButton) {
        throw new Error('Expected Flight and Nav dock controls')
      }
      navButton.click()

      const timeWarpControl = controls.element.querySelector<HTMLElement>(
        '[aria-label="Time Warp"]',
      )
      const thrustControl = controls.element.querySelector<HTMLElement>(
        '.touch-thrust-control',
      )
      if (!timeWarpControl || !thrustControl) {
        throw new Error('Expected Nav Time Warp and docked thrust controls')
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
        getThrustStart: () => center(thrustControl),
        getTimeWarpStart: () => center(timeWarpControl),
        openFlightPanel: () => flightButton.click(),
        openNavPanel: () => navButton.click(),
        remove: () => app.remove(),
        setFlightControlsVisible: controls.setFlightControlsVisible,
        thrustControl,
        timeWarpControl,
      }
    }

    const successiveTimeWarp = createHarness()
    const firstWarpTouch = {
      id: 1,
      target: successiveTimeWarp.timeWarpControl,
      ...successiveTimeWarp.getTimeWarpStart(),
    }
    const firstWarpMove = { ...firstWarpTouch, x: firstWarpTouch.x - 10 }
    const secondWarpTouch = {
      id: 2,
      target: successiveTimeWarp.timeWarpControl,
      ...successiveTimeWarp.getTimeWarpStart(),
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
      ...timeWarpToThrust.getTimeWarpStart(),
    }
    const oldWarpMove = { ...oldWarpTouch, x: oldWarpTouch.x - 10 }
    const newThrustTouch = {
      id: 4,
      target: timeWarpToThrust.thrustControl,
      ...timeWarpToThrust.getThrustStart(),
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
    timeWarpToThrust.openFlightPanel()
    timeWarpToThrust.dispatchTouch(
      timeWarpToThrust.thrustControl,
      'touchstart',
      [newThrustTouch],
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
    const timeWarpAfterFlightSwitch = timeWarpToThrust.getTimeWarp()
    const thrustLatchedAfterRelease = timeWarpToThrust.getThrustEngaged()
    timeWarpToThrust.openNavPanel()
    const thrustAfterPanelSwitch = timeWarpToThrust.getThrustEngaged()
    timeWarpToThrust.setFlightControlsVisible(false)
    const thrustAfterUnavailable = timeWarpToThrust.getThrustEngaged()
    timeWarpToThrust.remove()

    const closedThrustGesture = createHarness()
    closedThrustGesture.openFlightPanel()
    const closedThrustTouch = {
      id: 7,
      target: closedThrustGesture.thrustControl,
      ...closedThrustGesture.getThrustStart(),
    }
    const closedThrustMove = {
      ...closedThrustTouch,
      y: closedThrustTouch.y - 80,
    }
    const lateClosedThrustMove = {
      ...closedThrustTouch,
      y: closedThrustTouch.y - 100,
    }
    closedThrustGesture.dispatchTouch(
      closedThrustGesture.thrustControl,
      'touchstart',
      [closedThrustTouch],
      [closedThrustTouch],
    )
    closedThrustGesture.dispatchTouch(
      closedThrustGesture.thrustControl,
      'touchmove',
      [closedThrustMove],
      [closedThrustMove],
    )
    const thrustBeforeActivePanelClose = closedThrustGesture.getThrustEngaged()
    closedThrustGesture.closeFlightPanel()
    const thrustAfterActivePanelClose = closedThrustGesture.getThrustEngaged()
    const thrustEngagementCountAfterActivePanelClose =
      closedThrustGesture.getThrustEngagementCount()
    closedThrustGesture.dispatchTouch(
      closedThrustGesture.thrustControl,
      'touchmove',
      [lateClosedThrustMove],
      [lateClosedThrustMove],
    )
    const thrustAfterLateClosedMove = closedThrustGesture.getThrustEngaged()
    const lateClosedMoveReengagedThrust =
      closedThrustGesture.getThrustEngagementCount() >
      thrustEngagementCountAfterActivePanelClose
    closedThrustGesture.remove()

    const thrustToTimeWarp = createHarness()
    thrustToTimeWarp.openFlightPanel()
    const oldThrustTouch = {
      id: 5,
      target: thrustToTimeWarp.thrustControl,
      ...thrustToTimeWarp.getThrustStart(),
    }
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.thrustControl,
      'touchstart',
      [oldThrustTouch],
      [oldThrustTouch],
    )
    thrustToTimeWarp.openNavPanel()
    const newWarpTouch = {
      id: 6,
      target: thrustToTimeWarp.timeWarpControl,
      ...thrustToTimeWarp.getTimeWarpStart(),
    }
    const newWarpMove = { ...newWarpTouch, x: newWarpTouch.x - 54 }
    thrustToTimeWarp.dispatchTouch(
      thrustToTimeWarp.timeWarpControl,
      'touchstart',
      [newWarpTouch],
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
      lateClosedMoveReengagedThrust,
      thrustAfterActivePanelClose,
      thrustAfterLateClosedMove,
      thrustAfterPanelSwitch,
      thrustAfterUnavailable,
      thrustBeforeActivePanelClose,
      thrustEngaged,
      thrustLatchedAfterRelease,
      timeWarpAfterFlightSwitch,
    }
  })

  expect(result).toEqual({
    postThrustTimeWarpValue: 30,
    successiveTimeWarpValue: 30,
    lateClosedMoveReengagedThrust: false,
    thrustAfterActivePanelClose: true,
    thrustAfterLateClosedMove: true,
    thrustAfterPanelSwitch: true,
    thrustAfterUnavailable: false,
    thrustBeforeActivePanelClose: true,
    thrustEngaged: true,
    thrustLatchedAfterRelease: true,
    timeWarpAfterFlightSwitch: 10,
  })
})

test('cancels Nav trajectory gestures across every ownership boundary', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app root')
    }

    const touchControlsModulePath =
      '/src/ui/touchControls/createTouchControls.ts'
    const trajectoryPolicyModulePath =
      '/src/runtime/trajectoryHorizonControlPolicy.ts'
    const [{ createTouchControls }, trajectoryPolicy] = await Promise.all([
      import(touchControlsModulePath) as Promise<TouchControlsModule>,
      import(trajectoryPolicyModulePath),
    ])
    const body = {
      color: '#38BDF8',
      id: 'earth',
      mass: 1,
      name: 'Earth',
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    }
    let interactionsEnabled = true
    let trajectoryHorizonHours = 1
    let trajectoryCommitCount = 0

    app.replaceChildren()
    app.classList.remove('app-main-menu', 'app-crashed')
    const controls = createTouchControls({
      app,
      automaticTargetingAvailable: true,
      commitTimeWarp: () => {},
      commitTrajectoryHorizon: (action) => {
        trajectoryCommitCount += 1
        trajectoryHorizonHours = trajectoryPolicy.getNextTrajectoryHorizonHours(
          {
            action,
            currentHours: trajectoryHorizonHours,
            maxHours: 4,
            minHours: 0.5,
          },
        )
      },
      getAssistTargetUiState: () => ({
        activeTarget: body,
        mode: 'auto',
        recommendedTarget: null,
      }),
      getCameraCanRecenter: () => false,
      getCameraControlsLocked: () => false,
      getCameraFollow: () => 'spacecraft',
      getCurrentTimeWarp: () => 1,
      getCurrentTrajectoryHorizonHours: () => trajectoryHorizonHours,
      getInteractionsEnabled: () => interactionsEnabled,
      getTargetControlRows: () => [],
      getTimeWarpPreview: () => ({
        canCommit: true,
        reason: null,
        value: 1,
      }),
      getTimeWarpPreviews: () => [],
      getTrajectoryHorizonPreviews: (action, count) =>
        trajectoryPolicy.getTrajectoryHorizonPreviews({
          action,
          count,
          currentHours: trajectoryHorizonHours,
          maxHours: 4,
          minHours: 0.5,
        }),
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
        setVirtualTurn: () => {},
      },
      onCameraFollowSelect: () => {},
      onCameraPanGesture: () => false,
      onCameraRecenter: () => {},
      onReturnToAutomaticTarget: () => true,
      onSelectTargetIndex: () => true,
      onThrustControlUiStateChange: () => {},
      onZoom: () => {},
    })
    const navButton = controls.element.querySelector<HTMLButtonElement>(
      '#mobile-command-dock-nav-button',
    )
    const flightButton = controls.element.querySelector<HTMLButtonElement>(
      '#mobile-command-dock-flight-button',
    )
    const trajectoryControl = controls.element.querySelector<HTMLElement>(
      '[aria-label="Trajectory prediction horizon control"]',
    )
    if (!navButton || !flightButton || !trajectoryControl) {
      throw new Error('Missing trajectory cancellation controls')
    }

    const beginTrajectoryGesture = () => {
      if (navButton.getAttribute('aria-expanded') !== 'true') {
        navButton.click()
      }
      const rect = trajectoryControl.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      trajectoryControl.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: x,
          clientY: y - 12,
        }),
      )
      return trajectoryControl.classList.contains(
        'touch-step-selector-dragging',
      )
    }
    const captureCanceled = () => ({
      commitCount: trajectoryCommitCount,
      dragging: trajectoryControl.classList.contains(
        'touch-step-selector-dragging',
      ),
    })
    const states: Record<
      string,
      { beganDragging: boolean; commitCount: number; dragging: boolean }
    > = {}

    let beganDragging = beginTrajectoryGesture()
    navButton.click()
    states.close = { beganDragging, ...captureCanceled() }

    beganDragging = beginTrajectoryGesture()
    flightButton.click()
    states.switch = { beganDragging, ...captureCanceled() }

    beganDragging = beginTrajectoryGesture()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
    )
    states.escape = { beganDragging, ...captureCanceled() }

    beganDragging = beginTrajectoryGesture()
    interactionsEnabled = false
    controls.syncUi()
    states.interactionDisable = { beganDragging, ...captureCanceled() }
    interactionsEnabled = true

    beganDragging = beginTrajectoryGesture()
    window.dispatchEvent(new Event('blur'))
    states.blur = { beganDragging, ...captureCanceled() }

    beganDragging = beginTrajectoryGesture()
    controls.setTrajectoryControlVisible(false)
    states.unavailable = { beganDragging, ...captureCanceled() }

    return states
  })

  expect(result).toEqual({
    blur: { beganDragging: true, commitCount: 0, dragging: false },
    close: { beganDragging: true, commitCount: 0, dragging: false },
    escape: { beganDragging: true, commitCount: 0, dragging: false },
    interactionDisable: {
      beganDragging: true,
      commitCount: 0,
      dragging: false,
    },
    switch: { beganDragging: true, commitCount: 0, dragging: false },
    unavailable: { beganDragging: true, commitCount: 0, dragging: false },
  })
})
