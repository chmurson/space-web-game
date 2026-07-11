import { expect, test } from '@playwright/test'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../src/runtime/timeWarpFeedbackPolicy'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')
type TimeWarpControlModule =
  typeof import('../../src/ui/touchControls/createTimeWarpControl')

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
      .touch-controls {
        display: block !important;
      }
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

    const inspectSwipeAnimation = async (distanceX: number) => {
      const rect = prototypeControl.getBoundingClientRect()
      const start = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      const currentValue = prototypeControl.querySelector<HTMLElement>(
        '.touch-step-selector-value-current',
      )
      const decreaseValue = prototypeControl.querySelector<HTMLElement>(
        '.touch-step-selector-value-up-near',
      )
      const increaseValue = prototypeControl.querySelector<HTMLElement>(
        '.touch-step-selector-value-down-near',
      )
      const stripValues = Array.from(
        prototypeControl.querySelectorAll<HTMLElement>(
          '.touch-step-selector-value-up-far, .touch-step-selector-value-up-near, .touch-step-selector-value-current, .touch-step-selector-value-down-near, .touch-step-selector-value-down-far',
        ),
      )
      const track = prototypeControl.querySelector<HTMLElement>(
        '.touch-step-selector-horizontal-track',
      )
      if (!currentValue || !decreaseValue || !increaseValue || !track) {
        throw new Error('Expected horizontal selector values to render')
      }
      const targetValue = distanceX > 0 ? increaseValue : decreaseValue
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
          clientX: start.x + distanceX,
          clientY: start.y,
        }),
      )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      const className = prototypeControl.className
      const dragProgress = Number.parseFloat(
        getComputedStyle(prototypeControl).getPropertyValue(
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
    dragPrototype()
    const firstCommitTimeWarp = timeWarps[timeWarpIndex]

    dragPrototype({
      beforeMouseup: () => {
        interactionsEnabled = false
      },
      distanceX: 22,
    })
    const disabledMouseupTimeWarp = timeWarps[timeWarpIndex]
    interactionsEnabled = true

    dragPrototype()
    const postDisabledRecoveryTimeWarp = timeWarps[timeWarpIndex]

    dragPrototype({
      beforeMouseup: () => {
        window.dispatchEvent(new Event('blur'))
      },
      distanceX: 22,
    })
    const blurCancelTimeWarp = timeWarps[timeWarpIndex]

    dragPrototype()
    controls.syncUi()

    return {
      blurCancelTimeWarp,
      currentTimeWarp: timeWarps[timeWarpIndex],
      disabledMouseupTimeWarp,
      firstCommitTimeWarp,
      leftDragAnimation,
      originalText: originalControl.textContent,
      postDisabledRecoveryTimeWarp,
      prototypeText: prototypeControl.textContent,
      rightDragAnimation,
    }
  })

  expect(result.firstCommitTimeWarp).toBe(10)
  expect(result.disabledMouseupTimeWarp).toBe(10)
  expect(result.postDisabledRecoveryTimeWarp).toBe(30)
  expect(result.blurCancelTimeWarp).toBe(30)
  expect(result.currentTimeWarp).toBe(60)
  expect(
    Math.max(...result.leftDragAnimation.valueCenterYs) -
      Math.min(...result.leftDragAnimation.valueCenterYs),
  ).toBeLessThan(1)
  expect(result.leftDragAnimation.minimumValueGap).toBeGreaterThanOrEqual(0)
  expect(result.leftDragAnimation.className).toContain(
    'touch-step-selector-target-decrease',
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
    'touch-step-selector-target-increase',
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
  expect(result.originalText).toContain('x1m')
  expect(result.prototypeText).toContain('x1m')
})

test('keeps the horizontal track anchored while midpoint commits settle smoothly', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const timeWarpControlModulePath =
      '/src/ui/touchControls/createTimeWarpControl.ts'
    const { createPrototypeTimeWarpControl2 } = (await import(
      timeWarpControlModulePath
    )) as TimeWarpControlModule
    await import(
      '/src/ui/touchControls/stepSelectorControl/stepSelectorControl.css'
    )

    const timeWarps = [1, 10, 30, 60, 300, 1_800, 3_600, 7_200]
    let timeWarpIndex = 3
    const getTimeWarpPreviews = (action: TimeWarpAction, count: number) =>
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
          reason = action === 'increaseTimeWarp' ? 'global-max' : 'global-min'
        }
        return {
          canCommit: nextIndex === clampedIndex,
          reason,
          value: timeWarps[clampedIndex],
        }
      })
    const panel = document.createElement('div')
    document.body.append(panel)
    const control = createPrototypeTimeWarpControl2({
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
    const getTrackedAppearances = () => ({
      x1m: getAppearance('x1m'),
      x5m: getAppearance('x5m'),
      x30m: getAppearance('x30m'),
    })
    const getTrackedCenters = () => ({
      x1m: getCenterX(getLabel('x1m')),
      x5m: getCenterX(getLabel('x5m')),
      x30m: getCenterX(getLabel('x30m')),
    })
    const getMinimumTrackedGap = () => {
      const rects = ['x1m', 'x5m', 'x30m']
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
    const getCenteredBlockedStep = () => {
      const windowCenterX = getTrackWindowCenterX()
      const blockedValues = Array.from(
        control.element.querySelectorAll<HTMLElement>(
          '.touch-step-selector-value-disabled',
        ),
      )
      const centeredValue = blockedValues.sort(
        (left, right) =>
          Math.abs(getCenterX(left) - windowCenterX) -
          Math.abs(getCenterX(right) - windowCenterX),
      )[0]
      if (!centeredValue) {
        throw new Error('Expected a blocked cap value to render')
      }
      return {
        centerDistance: Math.abs(getCenterX(centeredValue) - windowCenterX),
        label: centeredValue.textContent ?? '',
        opacity: Number.parseFloat(getComputedStyle(centeredValue).opacity),
      }
    }

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
        trackTranslateX: getTrackTranslateX(),
        ySpread: Math.max(...centerYs) - Math.min(...centerYs),
      }
    }

    const rest = await moveTo(0)
    const outward22 = await moveTo(22)
    const outward23 = await moveTo(23)
    const outward46 = await moveTo(46)
    const outward68 = await moveTo(68)
    const outward69 = await moveTo(69)
    const outward92 = await moveTo(92)
    const outward114 = await moveTo(114)
    const outward115 = await moveTo(115)
    const reverse114 = await moveTo(114)
    const reverse68 = await moveTo(68)
    const reverse46 = await moveTo(46)
    const reverse22 = await moveTo(22)
    const reverse23 = await moveTo(-23)
    const cappedOverdrag = await moveTo(230)
    const centeredBlockedStep = getCenteredBlockedStep()
    control.finishGesture(session, false)
    await nextFrame()

    const settleGesture = async (distanceX: number, selectedLabel: string) => {
      timeWarpIndex = 3
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
      await wait(70)
      const selectedBeforeRelease = getLabel(selectedLabel)
      const beforeReleaseCenterX = getCenterX(selectedBeforeRelease)
      const beforeReleaseAppearance = getAppearance(selectedLabel)
      const committedValue = timeWarps[timeWarpIndex]
      const track = getTrack()

      control.finishGesture(settleSession, true)
      const selectedImmediatelyAfterRelease = getLabel(selectedLabel)
      const immediateCenterX = getCenterX(selectedImmediatelyAfterRelease)
      const immediateAppearance = getAppearance(selectedLabel)
      const runningTrackAnimations = track
        .getAnimations()
        .filter(
          (animation) => animation.playState === 'running' || animation.pending,
        ).length
      await wait(70)
      const inFlightCenterX = getCenterX(getLabel(selectedLabel))
      const inFlightAppearance = getAppearance(selectedLabel)
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
        committedValue,
        finalAppearance: getAppearance(finalCurrent.textContent ?? ''),
        finalCenterX: getCenterX(finalCurrent),
        finalLabel: finalCurrent.textContent ?? '',
        immediateAppearance,
        immediateCenterX,
        inFlightAppearance,
        inFlightCenterX,
        runningTrackAnimations,
        sameNodeImmediately:
          selectedImmediatelyAfterRelease === selectedBeforeRelease,
        targetCenterX: getTrackWindowCenterX(),
      }
    }

    const committedSettle = await settleGesture(69, 'x30m')
    const subThresholdSettle = await settleGesture(22, 'x1m')

    return {
      cappedOverdrag,
      centeredBlockedStep,
      committedSettle,
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
    [60, 300, 300, 1_800, 1_800, 3_600, 1_800, 300, 60, 30],
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
  expect(result.cappedOverdrag.committedStepCount).toBe(4)
  expect(result.cappedOverdrag.currentValue).toBe(7_200)
  expect(result.centeredBlockedStep.label).toBe('x2h')
  expect(result.centeredBlockedStep.centerDistance).toBeLessThan(1)
  expect(result.centeredBlockedStep.opacity).toBeCloseTo(0.22, 2)

  const forwardThresholdDeltas = [
    result.outward23.trackTranslateX - result.outward22.trackTranslateX,
    result.outward69.trackTranslateX - result.outward68.trackTranslateX,
    result.outward115.trackTranslateX - result.outward114.trackTranslateX,
  ]
  for (const delta of forwardThresholdDeltas) {
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeLessThan(2)
  }
  expect(
    Math.max(...forwardThresholdDeltas) - Math.min(...forwardThresholdDeltas),
  ).toBeLessThan(0.1)
  expect(
    result.reverse114.trackTranslateX - result.outward115.trackTranslateX,
  ).toBeLessThan(0)
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

  expect(result.rest.appearances.x1m.fontSize).toBeGreaterThan(
    result.rest.appearances.x5m.fontSize,
  )
  expect(result.rest.appearances.x5m.fontSize).toBeGreaterThan(
    result.rest.appearances.x30m.fontSize,
  )
  expect(result.rest.appearances.x30m.opacity).toBeLessThan(
    result.rest.appearances.x5m.opacity,
  )
  expect(result.rest.appearances.x1m.color).not.toBe(
    result.rest.appearances.x5m.color,
  )
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
    result.rest.trackedCenters.x5m,
    result.rest.trackedCenters.x30m,
  )
  expect(
    getCenterDistance(
      result.rest.trackedCenters.x1m,
      result.rest.trackedCenters.x5m,
    ) - nonElevatedStepDistance,
  ).toBeGreaterThan(5)
  expect(
    getCenterDistance(
      result.outward46.trackedCenters.x5m,
      result.outward46.trackedCenters.x30m,
    ) - nonElevatedStepDistance,
  ).toBeGreaterThan(5)
  expect(
    getCenterDistance(
      result.outward46.trackedCenters.x1m,
      result.outward46.trackedCenters.x5m,
    ) - nonElevatedStepDistance,
  ).toBeGreaterThan(5)
  expect(
    getCenterDistance(
      result.outward69.trackedCenters.x5m,
      result.outward69.trackedCenters.x30m,
    ) - nonElevatedStepDistance,
  ).toBeGreaterThan(5)
  expect(result.reverse46.trackedCenters).toEqual(
    result.outward46.trackedCenters,
  )

  expectSameAppearance(
    result.outward46.appearances.x5m,
    result.rest.appearances.x1m,
  )
  expectSameAppearance(
    result.outward46.appearances.x1m,
    result.rest.appearances.x5m,
  )
  expectSameAppearance(
    result.outward46.appearances.x30m,
    result.rest.appearances.x5m,
  )
  expectSameAppearance(
    result.outward69.appearances.x5m,
    result.outward69.appearances.x30m,
  )
  expectSameAppearance(
    result.outward92.appearances.x30m,
    result.rest.appearances.x1m,
  )
  expectSameAppearance(
    result.outward92.appearances.x5m,
    result.rest.appearances.x5m,
  )
  expectSameAppearance(
    result.outward92.appearances.x1m,
    result.rest.appearances.x30m,
  )
  expectSameAppearance(
    result.reverse46.appearances.x1m,
    result.outward46.appearances.x1m,
  )
  expectSameAppearance(
    result.reverse46.appearances.x5m,
    result.outward46.appearances.x5m,
  )
  expectSameAppearance(
    result.reverse46.appearances.x30m,
    result.outward46.appearances.x30m,
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
    expectSameAppearance(settle.finalAppearance, result.rest.appearances.x1m)
    expect(settle.finalLabel).toBe(expectedLabel)
    expect(settle.finalCenterX).toBeCloseTo(settle.targetCenterX, 0)
  }

  expectSmoothSettle(result.committedSettle, 1_800, 'x30m')
  expectSmoothSettle(result.subThresholdSettle, 60, 'x1m')
})
