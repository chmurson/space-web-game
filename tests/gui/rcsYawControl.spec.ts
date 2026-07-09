import { expect, test } from '@playwright/test'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('wires the RCS yaw reveal to analog turn drag, release, and close reset', async ({
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
    const virtualTurns: number[] = []
    const controls = createTouchControls({
      app: document.body,
      automaticTargetingAvailable: true,
      commitTimeWarp: () => {},
      commitTrajectoryHorizon: () => {},
      getAssistTargetUiState: () => ({
        activeTarget: body,
        mode: 'auto',
        recommendedTarget: null,
      }),
      getCameraMode: () => 'unlocked',
      getCameraModeChangesLocked: () => false,
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
      initialBurnControlSide: 'right',
      initialTargetControlSide: 'left',
      initialTrajectoryControlSide: 'hidden',
      initialWarpControlSide: 'right',
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
    controls.element.style.display = 'block'

    const reveal = controls.element.querySelector<HTMLElement>(
      '#touch-rcs-yaw-reveal',
    )
    const tab = reveal?.querySelector<HTMLButtonElement>(
      '.touch-edge-reveal-tab',
    )
    const track = reveal?.querySelector<HTMLElement>(
      '.touch-rcs-yaw-control-track',
    )
    const closeButton = reveal?.querySelector<HTMLButtonElement>(
      '.touch-rcs-yaw-control-close',
    )
    const rcsControl = reveal?.querySelector<HTMLElement>(
      '.touch-rcs-yaw-control',
    )
    if (!reveal || !tab || !track || !closeButton || !rcsControl) {
      throw new Error('RCS yaw control failed to render')
    }

    tab.click()
    const rect = track.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dispatchTouch = (
      type: 'touchend' | 'touchmove' | 'touchstart',
      x: number,
      y: number,
    ) => {
      const touch = new Touch({
        clientX: x,
        clientY: y,
        identifier: 91,
        target: track,
      })
      const activeTouches = type === 'touchend' ? [] : [touch]
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
    dispatchTouch('touchmove', centerX + 48, centerY)
    const turnAfterRightDrag = virtualTurns.at(-1) ?? 0
    const rightThumbOffset = rcsControl.style.getPropertyValue(
      '--rcs-yaw-thumb-offset',
    )
    dispatchTouch('touchend', centerX + 48, centerY)
    const turnAfterRelease = virtualTurns.at(-1) ?? 0
    const releaseThumbOffset = rcsControl.style.getPropertyValue(
      '--rcs-yaw-thumb-offset',
    )

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
    dispatchTouch('touchmove', centerX - 48, centerY)
    const turnAfterLeftDrag = virtualTurns.at(-1) ?? 0
    closeButton.click()
    const turnAfterClose = virtualTurns.at(-1) ?? 0
    const closeThumbOffset = rcsControl.style.getPropertyValue(
      '--rcs-yaw-thumb-offset',
    )

    controls.element.remove()

    return {
      ariaExpandedAfterClose: tab.getAttribute('aria-expanded'),
      closeThumbOffset,
      releaseThumbOffset,
      revealOpenAfterClose: reveal.classList.contains(
        'touch-edge-reveal-control-open',
      ),
      ariaAfterKeyboardLeft,
      rightThumbOffset,
      turnAfterClose,
      turnAfterKeyboardLeft,
      turnAfterKeyboardRelease,
      turnAfterLeftDrag,
      turnAfterRelease,
      turnAfterRightDrag,
    }
  })

  expect(result.turnAfterRightDrag).toBeLessThan(-0.6)
  expect(result.rightThumbOffset).not.toBe('0px')
  expect(result.turnAfterRelease).toBe(0)
  expect(result.releaseThumbOffset).toBe('0px')
  expect(result.turnAfterKeyboardLeft).toBe(1)
  expect(result.ariaAfterKeyboardLeft).toBe('Yaw left 1.00')
  expect(result.turnAfterKeyboardRelease).toBe(0)
  expect(result.turnAfterLeftDrag).toBeGreaterThan(0.6)
  expect(result.turnAfterClose).toBe(0)
  expect(result.closeThumbOffset).toBe('0px')
  expect(result.revealOpenAfterClose).toBe(false)
  expect(result.ariaExpandedAfterClose).toBe('false')
})
