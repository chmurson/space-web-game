import { expect, test } from '@playwright/test'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('wires docked RCS yaw to analog drag, release, and Flight close reset', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsModulePath =
      '/src/ui/touchControls/createTouchControls.ts'
    const { createTouchControls } = (await import(
      touchControlsModulePath
    )) as TouchControlsModule
    const body = {
      color: '#38BDF8',
      id: 'earth',
      mass: 1,
      name: 'Earth',
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    }
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app root')
    }
    app.replaceChildren()
    app.classList.remove('app-main-menu', 'app-crashed')
    const virtualTurns: number[] = []
    const controls = createTouchControls({
      app,
      automaticTargetingAvailable: true,
      commitTimeWarp: () => {},
      commitTrajectoryHorizon: () => {},
      getAssistTargetUiState: () => ({
        activeTarget: body,
        mode: 'auto',
        recommendedTarget: null,
      }),
      getCameraCanRecenter: () => true,
      getCameraControlsLocked: () => false,
      getCameraFollow: () => 'spacecraft',
      getCurrentTimeWarp: () => 1,
      getCurrentTrajectoryHorizonHours: () => 1,
      getInteractionsEnabled: () => true,
      getMobileManeuverStartByDrag: () => true,
      getSpacecraftVisible: () => true,
      getTargetControlRows: () => [],
      getTimeWarpPreview: () => ({
        canCommit: true,
        reason: null,
        value: 1,
      }),
      getTimeWarpPreviews: () => [],
      getTrajectoryHorizonPreviews: () => [],
      keyboardInput: {
        clear: () => {
          virtualTurns.push(0)
        },
        getManualControls: () => ({
          main: 0,
          reverse: 0,
          strafe: 0,
          turn: virtualTurns.at(-1) ?? 0,
        }),
        hasManualTurn: () => (virtualTurns.at(-1) ?? 0) !== 0,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
        setVirtualTurn: (turn: number) => {
          virtualTurns.push(turn)
        },
      },
      onCameraPanGesture: () => false,
      onCameraFollowSelect: () => {},
      onCameraRecenter: () => {},
      onReturnToAutomaticTarget: () => true,
      onSelectTargetIndex: () => true,
      onTargetHeadingPlan: () => {},
      onTargetHeadingPlanCanceled: () => {},
      onTargetHeadingPlanCommitted: () => true,
      onTargetStateChange: () => {},
      onThrustControlUiStateChange: () => {},
      onZoom: () => {},
    })
    controls.element.style.display = 'block'

    const flightButton = controls.element.querySelector<HTMLButtonElement>(
      '#mobile-command-dock-flight-button',
    )
    const flightPanel = controls.element.querySelector<HTMLElement>(
      '#mobile-command-dock-flight-panel',
    )
    const track = flightPanel?.querySelector<HTMLElement>(
      '.touch-rcs-yaw-control-track',
    )
    const rcsControl = flightPanel?.querySelector<HTMLElement>(
      '.touch-rcs-yaw-control',
    )
    if (!flightButton || !flightPanel || !track || !rcsControl) {
      throw new Error('RCS yaw control failed to render')
    }

    flightButton.click()
    if (flightPanel.hidden) {
      throw new Error('Flight panel did not open after dock click')
    }

    const rect = track.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dispatchTouch = (
      type: 'touchcancel' | 'touchend' | 'touchmove' | 'touchstart',
      x: number,
      y: number,
    ) => {
      const touch = new Touch({
        clientX: x,
        clientY: y,
        identifier: 91,
        target: track,
      })
      const activeTouches =
        type === 'touchend' || type === 'touchcancel' ? [] : [touch]
      track.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          changedTouches: [touch],
          targetTouches: activeTouches,
          touches: activeTouches,
        }),
      )
    }

    dispatchTouch('touchstart', centerX, centerY)
    dispatchTouch('touchmove', centerX + 64, centerY)
    const turnAfterRightDrag = virtualTurns.at(-1) ?? 0
    const rightThumbOffset = rcsControl.style.getPropertyValue(
      '--rcs-yaw-thumb-offset',
    )
    dispatchTouch('touchend', centerX + 64, centerY)
    const turnAfterRelease = virtualTurns.at(-1) ?? 0
    const releaseThumbOffset = rcsControl.style.getPropertyValue(
      '--rcs-yaw-thumb-offset',
    )

    track.focus()
    if (document.activeElement !== track) {
      throw new Error('RCS yaw slider did not receive keyboard focus')
    }
    track.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowLeft',
      }),
    )
    const turnAfterKeyboardLeft = virtualTurns.at(-1) ?? 0
    const ariaAfterKeyboardLeft = track.getAttribute('aria-valuetext')
    track.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowLeft',
      }),
    )
    const turnAfterKeyboardRelease = virtualTurns.at(-1) ?? 0

    dispatchTouch('touchstart', centerX, centerY)
    dispatchTouch('touchmove', centerX + 64, centerY)
    dispatchTouch('touchcancel', centerX + 64, centerY)
    const turnAfterTouchCancel = virtualTurns.at(-1) ?? 0

    dispatchTouch('touchstart', centerX, centerY)
    dispatchTouch('touchmove', centerX - 64, centerY)
    const turnAfterLeftDrag = virtualTurns.at(-1) ?? 0
    flightButton.click()
    const turnAfterClose = virtualTurns.at(-1) ?? 0
    const ariaExpandedAfterClose = flightButton.getAttribute('aria-expanded')
    const panelHiddenAfterClose = flightPanel.hidden
    const closeThumbOffset = rcsControl.style.getPropertyValue(
      '--rcs-yaw-thumb-offset',
    )

    flightButton.click()
    dispatchTouch('touchstart', centerX, centerY)
    dispatchTouch('touchmove', centerX + 64, centerY)
    controls.setFlightControlsVisible(false)
    const turnAfterUnavailable = virtualTurns.at(-1) ?? 0
    const flightDisabledWhenUnavailable = flightButton.disabled
    const panelHiddenWhenUnavailable = flightPanel.hidden

    controls.setFlightControlsVisible(true)
    flightButton.click()
    dispatchTouch('touchstart', centerX, centerY)
    dispatchTouch('touchmove', centerX - 64, centerY)
    window.dispatchEvent(new Event('blur'))
    const turnAfterBlur = virtualTurns.at(-1) ?? 0

    controls.element.remove()

    return {
      ariaExpandedAfterClose,
      closeThumbOffset,
      flightDisabledWhenUnavailable,
      internalFrameCount: controls.element.querySelectorAll(
        '.touch-rcs-yaw-control-header, .touch-rcs-yaw-control-close',
      ).length,
      legacyRevealCount: controls.element.querySelectorAll(
        '#touch-rcs-yaw-reveal, #touch-thrust-reveal',
      ).length,
      releaseThumbOffset,
      panelHiddenAfterClose,
      panelHiddenWhenUnavailable,
      ariaAfterKeyboardLeft,
      rightThumbOffset,
      turnAfterClose,
      turnAfterBlur,
      turnAfterKeyboardLeft,
      turnAfterKeyboardRelease,
      turnAfterLeftDrag,
      turnAfterRelease,
      turnAfterRightDrag,
      turnAfterTouchCancel,
      turnAfterUnavailable,
    }
  })

  expect(result.turnAfterRightDrag).toBeGreaterThan(0.6)
  expect(result.rightThumbOffset).not.toBe('0px')
  expect(result.turnAfterRelease).toBe(0)
  expect(result.releaseThumbOffset).toBe('0px')
  expect(result.turnAfterKeyboardLeft).toBe(-1)
  expect(result.ariaAfterKeyboardLeft).toBe('Yaw left 1.00')
  expect(result.turnAfterKeyboardRelease).toBe(0)
  expect(result.turnAfterTouchCancel).toBe(0)
  expect(result.turnAfterLeftDrag).toBeLessThan(-0.6)
  expect(result.turnAfterClose).toBe(0)
  expect(result.closeThumbOffset).toBe('0px')
  expect(result.panelHiddenAfterClose).toBe(true)
  expect(result.ariaExpandedAfterClose).toBe('false')
  expect(result.legacyRevealCount).toBe(0)
  expect(result.turnAfterUnavailable).toBe(0)
  expect(result.flightDisabledWhenUnavailable).toBe(true)
  expect(result.internalFrameCount).toBe(0)
  expect(result.panelHiddenWhenUnavailable).toBe(true)
  expect(result.turnAfterBlur).toBe(0)
})
