import { expect, test } from '@playwright/test'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../src/runtime/timeWarpFeedbackPolicy'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')
type TimeWarpControlModule =
  typeof import('../../src/ui/touchControls/createTimeWarpControl')
type GameConfigModule = typeof import('../../src/config/gameConfig')

test('routes the retained horizontal Time Warp control to shared state', async ({
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
      getCameraControlsLocked: () => false,
      getCurrentTimeWarp: () => timeWarps[timeWarpIndex],
      getCurrentTrajectoryHorizonHours: () => 1,
      getInteractionsEnabled: () => interactionsEnabled,
      getMobileManeuverStartByDrag: () => true,
      getSpacecraftVisible: () => true,
      getTargetControlRows: () => [],
      getTimeWarpPreview: (action) => getTimeWarpPreviews(action, 1)[0],
      getTimeWarpPreviews,
      getTrajectoryHorizonPreviews: () => [],
      initialTargetControlSide: 'left',
      initialTrajectoryControlSide: 'hidden',
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

    const instantAnimationStyle = document.createElement('style')
    instantAnimationStyle.textContent = `
      .touch-controls {
        display: block !important;
      }
      .mobile-command-dock {
        display: grid !important;
      }
      .touch-step-selector-value {
        transition: none !important;
      }
    `
    document.head.append(instantAnimationStyle)
    const navButton = controls.element.querySelector<HTMLButtonElement>(
      '#mobile-command-dock-nav-button',
    )
    if (!navButton) {
      throw new Error('Expected Nav dock button to render')
    }
    navButton.click()
    const timeWarpControl = controls.element.querySelector<HTMLElement>(
      '[aria-label="Time Warp"]',
    )
    if (!timeWarpControl) {
      throw new Error('Expected Time Warp to render in Nav')
    }
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (getComputedStyle(timeWarpControl).touchAction === 'none') {
        break
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
    }
    if (getComputedStyle(timeWarpControl).touchAction !== 'none') {
      throw new Error('Expected step selector styles to load')
    }

    const dragTimeWarp = async (
      params: { beforeMouseup?: () => void; distanceX?: number } = {},
    ) => {
      const rect = timeWarpControl.getBoundingClientRect()
      const start = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      const end = { x: start.x + (params.distanceX ?? -54), y: start.y }
      timeWarpControl.dispatchEvent(
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
      // Keep this routing fixture outside the fling's recent-motion window.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
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

    const inspectSwipeAnimation = async (distanceX: number) => {
      const rect = timeWarpControl.getBoundingClientRect()
      const start = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      const currentValue = timeWarpControl.querySelector<HTMLElement>(
        '.touch-step-selector-value-current',
      )
      const decreaseValue = timeWarpControl.querySelector<HTMLElement>(
        '.touch-step-selector-value-up-near',
      )
      const increaseValue = timeWarpControl.querySelector<HTMLElement>(
        '.touch-step-selector-value-down-near',
      )
      const stripValues = Array.from(
        timeWarpControl.querySelectorAll<HTMLElement>(
          '.touch-step-selector-value-up-far, .touch-step-selector-value-up-near, .touch-step-selector-value-current, .touch-step-selector-value-down-near, .touch-step-selector-value-down-far',
        ),
      )
      const track = timeWarpControl.querySelector<HTMLElement>(
        '.touch-step-selector-horizontal-track',
      )
      if (!currentValue || !decreaseValue || !increaseValue || !track) {
        throw new Error('Expected horizontal selector values to render')
      }
      const targetValue = distanceX < 0 ? increaseValue : decreaseValue
      const getCenterX = (element: HTMLElement) => {
        const valueRect = element.getBoundingClientRect()
        return valueRect.left + valueRect.width / 2
      }
      const valueCenterYs = stripValues.map((value) => {
        const valueRect = value.getBoundingClientRect()
        return valueRect.top + valueRect.height / 2
      })
      const orderedValueRects = stripValues
        .map((value) => value.getBoundingClientRect())
        .sort((left, right) => left.left - right.left)
      const minimumValueGap = Math.min(
        ...orderedValueRects
          .slice(1)
          .map((rect, index) => rect.left - orderedValueRects[index].right),
      )
      const currentStartX = getCenterX(currentValue)
      const targetStartX = getCenterX(targetValue)
      const valueStartXs = stripValues.map(getCenterX)
      timeWarpControl.dispatchEvent(
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
          clientX: start.x + distanceX,
          clientY: start.y,
        }),
      )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      const className = timeWarpControl.className
      const dragProgress = Number.parseFloat(
        getComputedStyle(timeWarpControl).getPropertyValue(
          '--touch-step-selector-drag-progress',
        ),
      )
      const trackTransform = getComputedStyle(track).transform
      const trackTranslateX =
        trackTransform === 'none'
          ? 0
          : new DOMMatrixReadOnly(trackTransform).m41
      const valueTranslations = stripValues.map(
        (value, index) => getCenterX(value) - valueStartXs[index],
      )
      const targetEndX = getCenterX(targetValue)
      window.dispatchEvent(new Event('blur'))
      return {
        className,
        currentStartX,
        dragProgress,
        minimumValueGap,
        targetEndX,
        targetStartX,
        trackTranslateX,
        valueCenterYs,
        valueTranslations,
      }
    }

    timeWarpIndex = 1
    controls.syncUi()
    const leftDragAnimation = await inspectSwipeAnimation(-22)
    const rightDragAnimation = await inspectSwipeAnimation(22)
    timeWarpIndex = 0
    controls.syncUi()
    await dragTimeWarp()
    const firstCommitTimeWarp = timeWarps[timeWarpIndex]

    await dragTimeWarp({
      beforeMouseup: () => {
        interactionsEnabled = false
        controls.syncUi()
      },
      distanceX: 22,
    })
    const disabledMouseupTimeWarp = timeWarps[timeWarpIndex]
    interactionsEnabled = true

    await dragTimeWarp()
    const postDisabledRecoveryTimeWarp = timeWarps[timeWarpIndex]

    await dragTimeWarp({
      beforeMouseup: () => {
        window.dispatchEvent(new Event('blur'))
      },
      distanceX: 22,
    })
    const blurCancelTimeWarp = timeWarps[timeWarpIndex]

    await dragTimeWarp()
    const beforeUnavailableTimeWarp = timeWarps[timeWarpIndex]
    await dragTimeWarp({
      beforeMouseup: () => {
        controls.setTimeWarpControlVisible(false)
      },
      distanceX: 22,
    })
    const unavailableCancelTimeWarp = timeWarps[timeWarpIndex]
    controls.setTimeWarpControlVisible(true)

    await dragTimeWarp({
      beforeMouseup: () => {
        navButton.click()
      },
      distanceX: 22,
    })
    const collapsedPanelCancelTimeWarp = timeWarps[timeWarpIndex]
    navButton.click()

    await dragTimeWarp()
    controls.syncUi()

    return {
      beforeUnavailableTimeWarp,
      blurCancelTimeWarp,
      collapsedPanelCancelTimeWarp,
      currentTimeWarp: timeWarps[timeWarpIndex],
      disabledMouseupTimeWarp,
      firstCommitTimeWarp,
      leftDragAnimation,
      oldEntryPointCount: controls.element.querySelectorAll(
        '#touch-time-warp-reveal, #touch-time-warp-prototype-reveal, [aria-label="Time warp control"], [aria-label="Time Warp control 1"], [aria-label="Time Warp control 2"]',
      ).length,
      postDisabledRecoveryTimeWarp,
      timeWarpText: timeWarpControl.textContent,
      rightDragAnimation,
      unavailableCancelTimeWarp,
    }
  })

  expect(result.firstCommitTimeWarp).toBe(10)
  expect(result.disabledMouseupTimeWarp).toBe(10)
  expect(result.postDisabledRecoveryTimeWarp).toBe(30)
  expect(result.blurCancelTimeWarp).toBe(30)
  expect(result.beforeUnavailableTimeWarp).toBe(60)
  expect(result.unavailableCancelTimeWarp).toBe(60)
  expect(result.collapsedPanelCancelTimeWarp).toBe(60)
  expect(result.currentTimeWarp).toBe(60)
  expect(
    Math.max(...result.leftDragAnimation.valueCenterYs) -
      Math.min(...result.leftDragAnimation.valueCenterYs),
  ).toBeLessThan(1)
  expect(result.leftDragAnimation.minimumValueGap).toBeGreaterThanOrEqual(0)
  expect(result.leftDragAnimation.className).toContain(
    'touch-step-selector-target-increase',
  )
  expect(result.leftDragAnimation.dragProgress).toBeGreaterThan(0)
  expect(result.leftDragAnimation.trackTranslateX).toBeLessThan(0)
  for (const translation of result.leftDragAnimation.valueTranslations) {
    expect(translation).toBeLessThan(0)
  }
  expect(result.leftDragAnimation.targetStartX).toBeGreaterThan(
    result.leftDragAnimation.currentStartX,
  )
  expect(
    Math.abs(
      result.leftDragAnimation.targetEndX -
        result.leftDragAnimation.currentStartX,
    ),
  ).toBeLessThan(
    Math.abs(
      result.leftDragAnimation.targetStartX -
        result.leftDragAnimation.currentStartX,
    ),
  )
  expect(result.rightDragAnimation.className).toContain(
    'touch-step-selector-target-decrease',
  )
  expect(result.rightDragAnimation.dragProgress).toBeGreaterThan(0)
  expect(result.rightDragAnimation.trackTranslateX).toBeGreaterThan(0)
  for (const translation of result.rightDragAnimation.valueTranslations) {
    expect(translation).toBeGreaterThan(0)
  }
  expect(result.rightDragAnimation.targetStartX).toBeLessThan(
    result.rightDragAnimation.currentStartX,
  )
  expect(
    Math.abs(
      result.rightDragAnimation.targetEndX -
        result.rightDragAnimation.currentStartX,
    ),
  ).toBeLessThan(
    Math.abs(
      result.rightDragAnimation.targetStartX -
        result.rightDragAnimation.currentStartX,
    ),
  )
  expect(result.oldEntryPointCount).toBe(0)
  expect(result.timeWarpText).toContain('x1m')
})

test('scales a controlled horizontal fling with recent release velocity', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const timeWarpControlModulePath =
      '/src/ui/touchControls/createTimeWarpControl.ts'
    const { createConfiguredTimeWarpControl } = (await import(
      timeWarpControlModulePath
    )) as TimeWarpControlModule
    const timeWarps = [1, 10, 30, 60, 120, 180, 240, 300, 360, 420, 480, 540]
    let timeWarpIndex = 1
    const panel = document.createElement('div')
    document.body.append(panel)
    const createControl = () =>
      createConfiguredTimeWarpControl({
        commitTimeWarp: (action) => {
          timeWarpIndex = Math.max(
            0,
            Math.min(
              timeWarps.length - 1,
              timeWarpIndex + (action === 'increaseTimeWarp' ? 1 : -1),
            ),
          )
        },
        getCurrentTimeWarp: () => timeWarps[timeWarpIndex],
        getTimeWarpPreview: (action) => getPreviews(action, 1)[0],
        getTimeWarpPreviews: getPreviews,
        onSessionChange: () => {},
        panel,
      })
    const getPreviews = (action: TimeWarpAction, count: number) =>
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
          reason: null,
          value: timeWarps[clampedIndex],
        }
      })
    const wait = (delayMs: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, delayMs))
    const fling = async (params: {
      distanceX: number
      holdAfterMoveMs?: number
      releaseVelocityPxPerSecond: number
    }) => {
      const control = createControl()
      const origin = { clientX: 100, clientY: 100, identifier: 1 }
      let session = control.beginGesture(origin)
      session = control.updateGesture(
        {
          clientX: origin.clientX + params.distanceX,
          clientY: origin.clientY,
          identifier: origin.identifier,
        },
        session,
      )
      const latestSampleTime = performance.now()
      session.horizontalMotionSamples = [
        {
          time:
            latestSampleTime -
            (Math.abs(params.distanceX) /
              Math.abs(params.releaseVelocityPxPerSecond)) *
              1_000,
          x: origin.clientX,
        },
        {
          time: latestSampleTime,
          x: origin.clientX + params.distanceX,
        },
      ]
      if (params.holdAfterMoveMs) {
        await wait(params.holdAfterMoveMs)
      }
      control.finishGesture(session, true)
      const getCurrentLabel = () =>
        control.element.querySelector<HTMLElement>(
          '.touch-step-selector-value-current',
        )?.textContent ?? ''
      const getState = () => ({
        currentLabel: getCurrentLabel(),
        isRolling: control.element.classList.contains(
          'touch-step-selector-dragging',
        ),
        timeWarpIndex,
      })
      const immediateState = getState()
      await wait(80)
      const earlyState = getState()
      await wait(160)
      const rollingState = getState()
      await wait(500)
      const settledState = getState()
      control.element.remove()
      return {
        earlyState,
        immediateState,
        rollingState,
        settledState,
        timeWarpIndex,
      }
    }

    const gentleRelease = await fling({
      distanceX: -20,
      releaseVelocityPxPerSecond: 500,
    })
    timeWarpIndex = 1
    const mediumRelease = await fling({
      distanceX: -20,
      releaseVelocityPxPerSecond: 900,
    })
    timeWarpIndex = 1
    const strongRelease = await fling({
      distanceX: -20,
      releaseVelocityPxPerSecond: 1_200,
    })
    timeWarpIndex = 1
    const pausedRelease = await fling({
      distanceX: -46,
      holdAfterMoveMs: 80,
      releaseVelocityPxPerSecond: 1_200,
    })
    timeWarpIndex = 1
    const tinyRelease = await fling({
      distanceX: -9,
      releaseVelocityPxPerSecond: 1_200,
    })
    timeWarpIndex = timeWarps.length - 2
    const cappedRelease = await fling({
      distanceX: -20,
      releaseVelocityPxPerSecond: 1_200,
    })
    return {
      cappedRelease,
      gentleRelease,
      mediumRelease,
      pausedRelease,
      strongRelease,
      tinyRelease,
    }
  })

  expect(result.gentleRelease.timeWarpIndex).toBe(2)
  expect(result.mediumRelease.timeWarpIndex).toBe(5)
  expect(result.strongRelease.timeWarpIndex).toBe(7)
  expect(result.pausedRelease.timeWarpIndex).toBe(2)
  expect(result.tinyRelease.timeWarpIndex).toBe(1)
  expect(result.cappedRelease.timeWarpIndex).toBe(11)
  expect(result.gentleRelease.immediateState.timeWarpIndex).toBe(1)
  expect(result.gentleRelease.earlyState.timeWarpIndex).toBe(2)
  expect(result.mediumRelease.immediateState.timeWarpIndex).toBe(1)
  expect(result.strongRelease.immediateState.timeWarpIndex).toBe(1)
  expect(result.strongRelease.earlyState.timeWarpIndex).toBeGreaterThan(1)
  expect(result.strongRelease.earlyState.timeWarpIndex).toBeLessThan(7)
  expect(result.strongRelease.rollingState.timeWarpIndex).toBeGreaterThan(
    result.strongRelease.earlyState.timeWarpIndex,
  )
  expect(result.strongRelease.rollingState.timeWarpIndex).toBeLessThan(7)
  expect(result.strongRelease.immediateState.currentLabel).toBe('x10s')
  expect(result.strongRelease.earlyState.currentLabel).toBe('x1m')
  expect(result.strongRelease.rollingState.currentLabel).toBe('x4m')
  expect(result.strongRelease.settledState.currentLabel).toBe('x5m')
  expect(result.strongRelease.immediateState.isRolling).toBe(true)
  expect(result.strongRelease.rollingState.isRolling).toBe(true)
  expect(result.strongRelease.settledState.isRolling).toBe(false)
})

test('keeps the horizontal track anchored while midpoint commits settle smoothly', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const timeWarpControlModulePath =
      '/src/ui/touchControls/createTimeWarpControl.ts'
    const gameConfigModulePath = '/src/config/gameConfig.ts'
    const { createConfiguredTimeWarpControl } = (await import(
      timeWarpControlModulePath
    )) as TimeWarpControlModule
    const { gameConfig } = (await import(
      gameConfigModulePath
    )) as GameConfigModule
    await import(
      '/src/ui/touchControls/stepSelectorControl/stepSelectorControl.css'
    )

    const timeWarps = [...gameConfig.controls.timeWarps]
    const initialTimeWarpIndex = timeWarps.indexOf(60)
    if (initialTimeWarpIndex < 0) {
      throw new Error('Expected the configured Time Warp ladder to contain 60')
    }
    let timeWarpIndex = 0
    const getTimeWarpPreviews = (action: TimeWarpAction, count: number) => {
      const previews: Array<{
        canCommit: boolean
        reason: TimeWarpFeedbackReason | null
        value: number
      }> = []
      let previewIndex = timeWarpIndex

      for (let step = 0; step < count; step += 1) {
        const nextIndex =
          previewIndex + (action === 'increaseTimeWarp' ? 1 : -1)
        const clampedIndex = Math.max(
          0,
          Math.min(timeWarps.length - 1, nextIndex),
        )
        if (step > 0 && clampedIndex === previewIndex) {
          break
        }
        let reason: TimeWarpFeedbackReason | null = null
        if (nextIndex !== clampedIndex) {
          reason = action === 'increaseTimeWarp' ? 'global-max' : 'global-min'
        }
        const preview = {
          canCommit: nextIndex === clampedIndex,
          reason,
          value: timeWarps[clampedIndex],
        }
        previews.push(preview)
        if (!preview.canCommit) {
          break
        }
        previewIndex = clampedIndex
      }

      return previews
    }
    const panel = document.createElement('div')
    document.body.append(panel)
    const control = createConfiguredTimeWarpControl({
      commitTimeWarp: (action) => {
        if (action === 'increaseTimeWarp') {
          timeWarpIndex = Math.min(timeWarps.length - 1, timeWarpIndex + 1)
        } else {
          timeWarpIndex = Math.max(0, timeWarpIndex - 1)
        }
      },
      getCurrentTimeWarp: () => timeWarps[timeWarpIndex],
      getTimeWarpPreview: (action) => getTimeWarpPreviews(action, 1)[0],
      getTimeWarpPreviews,
      onSessionChange: () => {},
      panel,
    })
    control.element.classList.add('time-warp-track-regression')

    const nextFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const wait = (delayMs: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, delayMs))
    const getCenterX = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      return rect.left + rect.width / 2
    }
    const getTrack = () => {
      const track = control.element.querySelector<HTMLElement>(
        '.touch-step-selector-horizontal-track',
      )
      if (!track) {
        throw new Error('Expected horizontal selector track to render')
      }
      return track
    }
    const getTrackTranslateX = () => {
      const transform = getComputedStyle(getTrack()).transform
      return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41
    }
    const getSteps = () =>
      Array.from(
        control.element.querySelectorAll<HTMLElement>(
          '.touch-step-selector-horizontal-step',
        ),
      )
    const getLabel = (label: string) => {
      const value = Array.from(
        control.element.querySelectorAll<HTMLElement>(
          '.touch-step-selector-value',
        ),
      ).find((element) => element.textContent === label)
      if (!value) {
        throw new Error(`Expected ${label} to render`)
      }
      return value
    }
    const getAppearance = (label: string) => {
      const style = getComputedStyle(getLabel(label))
      return {
        color: style.color,
        fontSize: Number.parseFloat(style.fontSize),
        opacity: Number.parseFloat(style.opacity),
        textShadow: style.textShadow,
      }
    }
    const getTickAppearance = (label: string) => {
      const labelElement = getLabel(label)
      const step = labelElement.closest<HTMLElement>(
        '.touch-step-selector-horizontal-step',
      )
      if (!step) {
        throw new Error(`Expected ${label} to belong to a horizontal step`)
      }
      const windowElement = control.element.querySelector<HTMLElement>(
        '.touch-step-selector-horizontal-window',
      )
      if (!windowElement) {
        throw new Error('Expected horizontal selector window to render')
      }
      const style = getComputedStyle(step, '::after')
      const height = Number.parseFloat(style.height)
      const tickTop =
        step.getBoundingClientRect().top + Number.parseFloat(style.top)
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        gapBelowLabel: tickTop - labelElement.getBoundingClientRect().bottom,
        height,
        opacity: Number.parseFloat(style.opacity),
        transitionDuration: style.transitionDuration,
        windowBottomClearance:
          windowElement.getBoundingClientRect().bottom - tickTop - height,
      }
    }
    const getTrackedAppearances = () => ({
      x1m: getAppearance('x1m'),
      x2m: getAppearance('x2m'),
      x4m: getAppearance('x4m'),
    })
    const getTrackedTickAppearances = () => ({
      x1m: getTickAppearance('x1m'),
      x2m: getTickAppearance('x2m'),
      x4m: getTickAppearance('x4m'),
    })
    const getTrackedCenters = () => ({
      x1m: getCenterX(getLabel('x1m')),
      x2m: getCenterX(getLabel('x2m')),
      x4m: getCenterX(getLabel('x4m')),
    })
    const getMinimumTrackedGap = () => {
      const rects = ['x1m', 'x2m', 'x4m']
        .map((label) => getLabel(label).getBoundingClientRect())
        .sort((left, right) => left.left - right.left)
      return Math.min(
        ...rects.slice(1).map((rect, index) => rect.left - rects[index].right),
      )
    }
    const getTrackWindowCenterX = () => {
      const windowElement = control.element.querySelector<HTMLElement>(
        '.touch-step-selector-horizontal-window',
      )
      if (!windowElement) {
        throw new Error('Expected horizontal selector window to render')
      }
      const rect = windowElement.getBoundingClientRect()
      return rect.left + rect.width / 2
    }
    await nextFrame()
    const minimumValueLabels = getSteps().map((node) => node.textContent ?? '')
    const minimumHighestValueCount = minimumValueLabels.filter(
      (label) => label === 'x15h',
    ).length
    const minimumBlockedStep = getSteps().find((node) =>
      node.querySelector('.touch-step-selector-value-disabled'),
    )
    if (!minimumBlockedStep) {
      throw new Error('Expected a blocked endpoint step at the minimum')
    }
    const minimumBlockedTickStyle = getComputedStyle(
      minimumBlockedStep,
      '::after',
    )
    const minimumBlockedTick = {
      boxShadow: minimumBlockedTickStyle.boxShadow,
      opacity: Number.parseFloat(minimumBlockedTickStyle.opacity),
    }
    timeWarpIndex = initialTimeWarpIndex
    control.syncUi()
    await nextFrame()

    const origin = { clientX: 100, clientY: 100, identifier: 17 }
    let session = control.beginGesture(origin)
    const initialNodes = getSteps()
    const initialLabels = initialNodes.map((node) => node.textContent ?? '')

    const moveTo = async (distanceX: number) => {
      session = control.updateGesture(
        {
          clientX: origin.clientX + distanceX,
          clientY: origin.clientY,
          identifier: origin.identifier,
        },
        session,
      )
      await nextFrame()
      const nodes = getSteps()
      const centerYs = nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        return rect.top + rect.height / 2
      })
      return {
        anchorStable:
          session.stepAnchorX === origin.clientX &&
          session.stepAnchorY === origin.clientY &&
          session.startX === origin.clientX &&
          session.startY === origin.clientY,
        committedStepCount: session.committedStepCount,
        currentLabel:
          control.element.querySelector<HTMLElement>(
            '.touch-step-selector-value-current',
          )?.textContent ?? '',
        currentValue: timeWarps[timeWarpIndex],
        domStable:
          nodes.length === initialNodes.length &&
          nodes.every((node, index) => node === initialNodes[index]),
        labelsStable: nodes.every(
          (node, index) => node.textContent === initialLabels[index],
        ),
        appearances: getTrackedAppearances(),
        minimumTrackedGap: getMinimumTrackedGap(),
        trackedCenters: getTrackedCenters(),
        ticks: getTrackedTickAppearances(),
        trackTranslateX: getTrackTranslateX(),
        ySpread: Math.max(...centerYs) - Math.min(...centerYs),
      }
    }

    const rest = await moveTo(0)
    const outward22 = await moveTo(-22)
    const outward23 = await moveTo(-23)
    const outward46 = await moveTo(-46)
    const outward68 = await moveTo(-68)
    const outward69 = await moveTo(-69)
    const outward92 = await moveTo(-92)
    const outward114 = await moveTo(-114)
    const outward115 = await moveTo(-115)
    const reverse114 = await moveTo(-114)
    const reverse68 = await moveTo(-68)
    const reverse46 = await moveTo(-46)
    const reverse22 = await moveTo(-22)
    const reverse23 = await moveTo(23)
    const cappedOverdrag = await moveTo(-506)
    control.finishGesture(session, false)
    await nextFrame()

    const settleGesture = async (distanceX: number, selectedLabel: string) => {
      timeWarpIndex = initialTimeWarpIndex
      control.syncUi()
      await nextFrame()
      const settleOrigin = {
        clientX: 100,
        clientY: 100,
        identifier: 23,
      }
      let settleSession = control.beginGesture(settleOrigin)
      settleSession = control.updateGesture(
        {
          clientX: settleOrigin.clientX + distanceX,
          clientY: settleOrigin.clientY,
          identifier: settleOrigin.identifier,
        },
        settleSession,
      )
      await wait(80)
      const selectedBeforeRelease = getLabel(selectedLabel)
      const beforeReleaseCenterX = getCenterX(selectedBeforeRelease)
      const beforeReleaseAppearance = getAppearance(selectedLabel)
      const beforeReleaseTickAppearance = getTickAppearance(selectedLabel)
      const committedValue = timeWarps[timeWarpIndex]
      const track = getTrack()

      control.finishGesture(settleSession, true)
      const selectedImmediatelyAfterRelease = getLabel(selectedLabel)
      const immediateCenterX = getCenterX(selectedImmediatelyAfterRelease)
      const immediateAppearance = getAppearance(selectedLabel)
      const immediateTickAppearance = getTickAppearance(selectedLabel)
      const runningTrackAnimations = track
        .getAnimations()
        .filter(
          (animation) => animation.playState === 'running' || animation.pending,
        ).length
      await wait(70)
      const inFlightCenterX = getCenterX(getLabel(selectedLabel))
      const inFlightAppearance = getAppearance(selectedLabel)
      const inFlightTickAppearance = getTickAppearance(selectedLabel)
      await wait(150)
      const finalCurrent = control.element.querySelector<HTMLElement>(
        '.touch-step-selector-value-current',
      )
      if (!finalCurrent) {
        throw new Error('Expected settled current value to render')
      }

      return {
        beforeReleaseCenterX,
        beforeReleaseAppearance,
        beforeReleaseTickAppearance,
        committedValue,
        finalAppearance: getAppearance(finalCurrent.textContent ?? ''),
        finalCenterX: getCenterX(finalCurrent),
        finalLabel: finalCurrent.textContent ?? '',
        finalTickAppearance: getTickAppearance(finalCurrent.textContent ?? ''),
        immediateAppearance,
        immediateCenterX,
        immediateTickAppearance,
        inFlightAppearance,
        inFlightCenterX,
        inFlightTickAppearance,
        runningTrackAnimations,
        sameNodeImmediately:
          selectedImmediatelyAfterRelease === selectedBeforeRelease,
        targetCenterX: getTrackWindowCenterX(),
      }
    }

    const committedSettle = await settleGesture(-69, 'x4m')
    const subThresholdSettle = await settleGesture(-22, 'x1m')

    return {
      cappedOverdrag,
      committedSettle,
      minimumBlockedTick,
      minimumHighestValueCount,
      dragSnapshots: [
        outward22,
        outward23,
        outward68,
        outward69,
        outward114,
        outward115,
        reverse114,
        reverse68,
        reverse22,
        reverse23,
      ],
      outward22,
      outward23,
      outward46,
      outward68,
      outward69,
      outward92,
      outward114,
      outward115,
      rest,
      reverse46,
      reverse114,
      reverse68,
      subThresholdSettle,
    }
  })

  expect(result.dragSnapshots.map((snapshot) => snapshot.currentValue)).toEqual(
    [60, 120, 120, 240, 240, 480, 240, 120, 60, 30],
  )
  expect(
    result.dragSnapshots.map((snapshot) => snapshot.committedStepCount),
  ).toEqual([0, 1, 1, 2, 2, 3, 2, 1, 0, -1])
  for (const snapshot of [...result.dragSnapshots, result.cappedOverdrag]) {
    expect(snapshot.anchorStable).toBe(true)
    expect(snapshot.domStable).toBe(true)
    expect(snapshot.labelsStable).toBe(true)
    expect(snapshot.currentLabel).toBe('x1m')
    expect(snapshot.ySpread).toBeLessThan(1)
  }
  expect(result.minimumHighestValueCount).toBe(1)
  expect(result.rest.trackedCenters.x1m).toBeLessThan(
    result.rest.trackedCenters.x2m,
  )
  expect(result.rest.trackedCenters.x2m).toBeLessThan(
    result.rest.trackedCenters.x4m,
  )
  expect(result.minimumBlockedTick.boxShadow).toBe('none')
  expect(result.minimumBlockedTick.opacity).toBeCloseTo(0.22, 2)
  expect(result.cappedOverdrag.committedStepCount).toBe(10)
  expect(result.cappedOverdrag.currentValue).toBe(54_000)

  const forwardThresholdDeltas = [
    result.outward23.trackTranslateX - result.outward22.trackTranslateX,
    result.outward69.trackTranslateX - result.outward68.trackTranslateX,
    result.outward115.trackTranslateX - result.outward114.trackTranslateX,
  ]
  for (const delta of forwardThresholdDeltas) {
    expect(delta).toBeLessThan(0)
    expect(delta).toBeGreaterThan(-2)
  }
  expect(
    Math.max(...forwardThresholdDeltas) - Math.min(...forwardThresholdDeltas),
  ).toBeLessThan(0.1)
  expect(
    result.reverse114.trackTranslateX - result.outward115.trackTranslateX,
  ).toBeGreaterThan(0)
  expect(result.reverse114.trackTranslateX).toBeCloseTo(
    result.outward114.trackTranslateX,
    3,
  )
  expect(result.reverse68.trackTranslateX).toBeCloseTo(
    result.outward68.trackTranslateX,
    3,
  )

  const expectSameAppearance = (
    actual: typeof result.rest.appearances.x1m,
    expected: typeof result.rest.appearances.x1m,
  ) => {
    expect(actual.color).toBe(expected.color)
    expect(actual.fontSize).toBeCloseTo(expected.fontSize, 2)
    expect(actual.opacity).toBeCloseTo(expected.opacity, 2)
    expect(actual.textShadow).toBe(expected.textShadow)
  }
  const expectSameTickAppearance = (
    actual: typeof result.rest.ticks.x1m,
    expected: typeof result.rest.ticks.x1m,
  ) => {
    expect(actual.backgroundColor).toBe(expected.backgroundColor)
    expect(actual.height).toBeCloseTo(expected.height, 2)
    expect(actual.opacity).toBeCloseTo(expected.opacity, 2)
  }

  expect(result.rest.appearances.x1m.fontSize).toBeGreaterThan(
    result.rest.appearances.x2m.fontSize,
  )
  expect(result.rest.appearances.x2m.fontSize).toBeGreaterThan(
    result.rest.appearances.x4m.fontSize,
  )
  expect(result.rest.appearances.x4m.opacity).toBeLessThan(
    result.rest.appearances.x2m.opacity,
  )
  expect(result.rest.appearances.x1m.color).not.toBe(
    result.rest.appearances.x2m.color,
  )
  expect(result.rest.ticks.x1m.height).toBeGreaterThan(
    result.rest.ticks.x2m.height,
  )
  expect(result.rest.ticks.x2m.height).toBeGreaterThan(
    result.rest.ticks.x4m.height,
  )
  expect(result.rest.ticks.x2m.opacity).toBeGreaterThan(
    result.rest.ticks.x4m.opacity,
  )
  expect(result.rest.ticks.x1m.backgroundColor).not.toBe(
    result.rest.ticks.x2m.backgroundColor,
  )
  expect(result.rest.ticks.x1m.boxShadow).not.toBe('none')
  expect(result.outward22.ticks.x1m.transitionDuration).toBe('0s')
  for (const tick of Object.values(result.rest.ticks)) {
    expect(tick.gapBelowLabel).toBeGreaterThan(1)
    expect(tick.windowBottomClearance).toBeGreaterThanOrEqual(2.5)
  }
  for (const snapshot of [
    result.rest,
    result.outward46,
    result.outward69,
    result.outward92,
    result.reverse46,
  ]) {
    expect(snapshot.minimumTrackedGap).toBeGreaterThanOrEqual(0)
  }

  const getCenterDistance = (left: number, right: number) =>
    Math.abs(left - right)
  const nonElevatedStepDistance = getCenterDistance(
    result.rest.trackedCenters.x2m,
    result.rest.trackedCenters.x4m,
  )
  expect(
    getCenterDistance(
      result.outward46.trackedCenters.x2m,
      result.outward46.trackedCenters.x4m,
    ) - nonElevatedStepDistance,
  ).toBeGreaterThan(5)
  expect(
    getCenterDistance(
      result.outward69.trackedCenters.x2m,
      result.outward69.trackedCenters.x4m,
    ) - nonElevatedStepDistance,
  ).toBeGreaterThan(5)
  expect(result.reverse46.trackedCenters).toEqual(
    result.outward46.trackedCenters,
  )

  expectSameAppearance(
    result.outward46.appearances.x2m,
    result.rest.appearances.x1m,
  )
  expectSameAppearance(
    result.outward46.appearances.x1m,
    result.rest.appearances.x2m,
  )
  expectSameAppearance(
    result.outward46.appearances.x4m,
    result.rest.appearances.x2m,
  )
  expectSameAppearance(
    result.outward69.appearances.x2m,
    result.outward69.appearances.x4m,
  )
  expectSameAppearance(
    result.outward92.appearances.x4m,
    result.rest.appearances.x1m,
  )
  expectSameAppearance(
    result.outward92.appearances.x2m,
    result.rest.appearances.x2m,
  )
  expectSameAppearance(
    result.outward92.appearances.x1m,
    result.rest.appearances.x4m,
  )
  expectSameAppearance(
    result.reverse46.appearances.x1m,
    result.outward46.appearances.x1m,
  )
  expectSameAppearance(
    result.reverse46.appearances.x2m,
    result.outward46.appearances.x2m,
  )
  expectSameAppearance(
    result.reverse46.appearances.x4m,
    result.outward46.appearances.x4m,
  )
  expectSameTickAppearance(result.outward46.ticks.x2m, result.rest.ticks.x1m)
  expectSameTickAppearance(
    result.outward69.ticks.x2m,
    result.outward69.ticks.x4m,
  )

  const expectSmoothSettle = (
    settle: typeof result.committedSettle,
    expectedValue: number,
    expectedLabel: string,
  ) => {
    expect(settle.committedValue).toBe(expectedValue)
    expect(settle.sameNodeImmediately).toBe(true)
    expect(settle.immediateAppearance.fontSize).toBeCloseTo(
      settle.beforeReleaseAppearance.fontSize,
      2,
    )
    expect(settle.immediateAppearance.opacity).toBeCloseTo(
      settle.beforeReleaseAppearance.opacity,
      2,
    )
    expect(
      Math.abs(settle.immediateCenterX - settle.beforeReleaseCenterX),
    ).toBeLessThan(1)
    expect(settle.runningTrackAnimations).toBeGreaterThan(0)
    const settleDistance = settle.finalCenterX - settle.beforeReleaseCenterX
    const inFlightDistance =
      settle.inFlightCenterX - settle.beforeReleaseCenterX
    expect(Math.sign(inFlightDistance)).toBe(Math.sign(settleDistance))
    expect(Math.abs(inFlightDistance)).toBeGreaterThan(0)
    expect(Math.abs(inFlightDistance)).toBeLessThan(Math.abs(settleDistance))
    expect(settle.inFlightAppearance.fontSize).toBeGreaterThan(
      settle.beforeReleaseAppearance.fontSize,
    )
    expect(settle.inFlightAppearance.fontSize).toBeLessThan(
      settle.finalAppearance.fontSize,
    )
    expect(settle.immediateTickAppearance.height).toBeCloseTo(
      settle.beforeReleaseTickAppearance.height,
      2,
    )
    expect(settle.immediateTickAppearance.opacity).toBeCloseTo(
      settle.beforeReleaseTickAppearance.opacity,
      2,
    )
    expect(settle.inFlightTickAppearance.height).toBeGreaterThan(
      settle.beforeReleaseTickAppearance.height,
    )
    expect(settle.inFlightTickAppearance.height).toBeLessThan(
      settle.finalTickAppearance.height,
    )
    expectSameTickAppearance(settle.finalTickAppearance, result.rest.ticks.x1m)
    expectSameAppearance(settle.finalAppearance, result.rest.appearances.x1m)
    expect(settle.finalLabel).toBe(expectedLabel)
    expect(settle.finalCenterX).toBeCloseTo(settle.targetCenterX, 0)
  }

  expectSmoothSettle(result.committedSettle, 240, 'x4m')
  expectSmoothSettle(result.subThresholdSettle, 60, 'x1m')
})
