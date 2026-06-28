import { expect, test } from '@playwright/test'

test('preserves touch target selector semantics and activation behavior', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const targetControlModulePath =
      '/src/ui/touchControls/targetControl/createTargetControl.ts'
    const { createTargetControl } = await import(targetControlModulePath)
    const bodies = [
      { color: '#38BDF8', id: 'earth', name: 'Earth' },
      { color: '#F4F7FB', id: 'moon', name: 'Moon' },
      { color: '#FB7185', id: 'mars', name: 'Mars' },
    ]
    const rows = bodies.map((body, index) => ({
      body,
      distanceMeters: (index + 1) * 1_000_000,
      index,
    }))
    let targetState = {
      activeTarget: bodies[0],
      mode: 'auto',
      recommendedTarget: bodies[1],
    }
    const selectedIndexes: number[] = []
    let commitCount = 0
    let returnToAutomaticCount = 0
    let stateChangeCount = 0

    const control = createTargetControl({
      automaticTargetingAvailable: true,
      getRows: () => rows,
      getTargetState: () => targetState,
      onCommit: () => {
        commitCount += 1
      },
      onReturnToAutomaticTarget: () => {
        returnToAutomaticCount += 1
        targetState = {
          activeTarget:
            targetState.recommendedTarget ?? targetState.activeTarget,
          mode: 'auto',
          recommendedTarget: bodies[1],
        }
        return true
      },
      onSelectTargetIndex: (index: number) => {
        selectedIndexes.push(index)
        targetState = {
          activeTarget: bodies[index],
          mode: 'manual',
          recommendedTarget: bodies[1],
        }
        return true
      },
      onStateChange: () => {
        stateChangeCount += 1
      },
    })
    const fixture = document.createElement('section')
    fixture.append(control.element)
    document.body.append(fixture)

    const automaticButton = () =>
      control.element.querySelector(
        '.touch-target-control-automatic-row',
      ) as HTMLButtonElement
    const rowButtons = () =>
      Array.from(
        control.element.querySelectorAll('.touch-target-control-row'),
      ) as HTMLButtonElement[]
    const getStateSummary = () => ({
      automaticAriaChecked: automaticButton().getAttribute('aria-checked'),
      automaticAriaLabel: automaticButton().getAttribute('aria-label'),
      automaticClassName: automaticButton().className,
      automaticDisabled: automaticButton().disabled,
      rootAriaLabel: control.element.getAttribute('aria-label'),
      rowAriaLabels: rowButtons().map((button) =>
        button.getAttribute('aria-label'),
      ),
      rowClassNames: rowButtons().map((button) => button.className),
      rowDisabledStates: rowButtons().map((button) => button.disabled),
      statusMarkClassNames: (
        Array.from(
          control.element.querySelectorAll('.target-status-mark'),
        ) as HTMLElement[]
      ).map((mark) => mark.className),
      switchHiddenFromAria:
        automaticButton()
          .querySelector('.touch-target-control-switch')
          ?.getAttribute('aria-hidden') ?? null,
      targetBodyColor:
        rowButtons()[0]
          ?.querySelector<HTMLElement>('.target-body-sphere')
          ?.style.getPropertyValue('--target-body-color') ?? null,
    })
    const dispatchTouch = (
      element: HTMLElement,
      type: 'touchend' | 'touchstart',
      init: { id: number; x: number; y: number },
    ) => {
      const touch = new Touch({
        clientX: init.x,
        clientY: init.y,
        identifier: init.id,
        target: element,
      })
      return element.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          changedTouches: [touch],
        }),
      )
    }

    const initial = getStateSummary()

    automaticButton().click()
    const afterAutomaticClickFromAuto = getStateSummary()

    automaticButton().click()
    const afterReturnToAutomatic = getStateSummary()

    rowButtons()[2]?.click()
    const afterManualClick = getStateSummary()

    targetState = {
      activeTarget: bodies[2],
      mode: 'forced',
      recommendedTarget: bodies[1],
    }
    control.syncUi()
    const forced = getStateSummary()

    targetState = {
      activeTarget: bodies[0],
      mode: 'auto',
      recommendedTarget: bodies[1],
    }
    control.syncUi()
    let bubbledTouchEndCount = 0
    control.element.addEventListener('touchend', () => {
      bubbledTouchEndCount += 1
    })
    const marsButtonForMovedTouch = rowButtons()[2]
    dispatchTouch(marsButtonForMovedTouch, 'touchstart', {
      id: 8,
      x: 10,
      y: 10,
    })
    const movedTouchEndAllowed = dispatchTouch(
      marsButtonForMovedTouch,
      'touchend',
      {
        id: 8,
        x: 80,
        y: 10,
      },
    )
    const afterMovedTouch = {
      bubbledTouchEndCount,
      commitCount,
      movedTouchEndAllowed,
      selectedIndexes: [...selectedIndexes],
    }

    const marsButtonForTap = rowButtons()[2]
    dispatchTouch(marsButtonForTap, 'touchstart', { id: 9, x: 10, y: 10 })
    const tapTouchEndAllowed = dispatchTouch(marsButtonForTap, 'touchend', {
      id: 9,
      x: 15,
      y: 12,
    })
    const afterTouchTap = {
      bubbledTouchEndCount,
      commitCount,
      selectedIndexes: [...selectedIndexes],
      stateChangeCount,
      tapTouchEndAllowed,
    }

    targetState = {
      activeTarget: bodies[0],
      mode: 'auto',
      recommendedTarget: bodies[1],
    }
    control.syncUi()
    const marsButtonForRerenderTap = rowButtons()[2]
    dispatchTouch(marsButtonForRerenderTap, 'touchstart', {
      id: 10,
      x: 10,
      y: 10,
    })
    targetState = {
      activeTarget: bodies[0],
      mode: 'manual',
      recommendedTarget: bodies[1],
    }
    control.syncUi()
    const rerenderTapTouchEndAllowed = dispatchTouch(
      rowButtons()[2],
      'touchend',
      {
        id: 10,
        x: 13,
        y: 12,
      },
    )
    const afterRerenderTouchTap = {
      bubbledTouchEndCount,
      commitCount,
      rerenderTapTouchEndAllowed,
      selectedIndexes: [...selectedIndexes],
      stateChangeCount,
    }

    fixture.remove()

    return {
      afterAutomaticClickFromAuto,
      afterManualClick,
      afterMovedTouch,
      afterReturnToAutomatic,
      afterRerenderTouchTap,
      afterTouchTap,
      forced,
      initial,
      returnToAutomaticCount,
    }
  })

  expect(result.initial).toMatchObject({
    automaticAriaChecked: 'true',
    automaticAriaLabel: 'Automatic targeting on: Earth',
    automaticClassName:
      'touch-target-control-automatic-row touch-target-control-automatic-row-enabled',
    automaticDisabled: false,
    rootAriaLabel: 'Target body selector',
    rowAriaLabels: [
      'Earth, 1 Mm, tracking target',
      'Moon, 2 Mm, tracking target',
      'Mars, 3 Mm',
    ],
    rowClassNames: [
      'touch-target-control-row touch-target-control-row-active',
      'touch-target-control-row touch-target-control-row-recommended',
      'touch-target-control-row',
    ],
    rowDisabledStates: [false, false, false],
    statusMarkClassNames: [
      'target-status-mark target-status-mark-auto',
      'target-status-mark target-status-mark-auto',
      'target-status-mark target-status-mark-auto',
    ],
    switchHiddenFromAria: 'true',
    targetBodyColor: '#38BDF8',
  })
  expect(result.afterAutomaticClickFromAuto).toMatchObject({
    automaticAriaChecked: 'false',
    automaticAriaLabel: 'Automatic targeting off: Moon',
    rowAriaLabels: [
      'Earth, 1 Mm, pinned target',
      'Moon, 2 Mm, tracking target',
      'Mars, 3 Mm',
    ],
  })
  expect(result.afterReturnToAutomatic).toMatchObject({
    automaticAriaChecked: 'true',
    automaticAriaLabel: 'Automatic targeting on: Moon',
  })
  expect(result.afterManualClick).toMatchObject({
    automaticAriaChecked: 'false',
    automaticAriaLabel: 'Automatic targeting off: Moon',
    rowAriaLabels: [
      'Earth, 1 Mm',
      'Moon, 2 Mm, tracking target',
      'Mars, 3 Mm, pinned target',
    ],
  })
  expect(result.forced).toMatchObject({
    automaticAriaChecked: 'false',
    automaticDisabled: true,
    rowAriaLabels: [
      'Earth, 1 Mm',
      'Moon, 2 Mm, tracking target',
      'Mars, 3 Mm, locked target',
    ],
    rowDisabledStates: [true, true, true],
  })
  expect(result.afterMovedTouch).toEqual({
    bubbledTouchEndCount: 1,
    commitCount: 1,
    movedTouchEndAllowed: true,
    selectedIndexes: [0, 2],
  })
  expect(result.afterTouchTap).toEqual({
    bubbledTouchEndCount: 1,
    commitCount: 2,
    selectedIndexes: [0, 2, 2],
    stateChangeCount: 4,
    tapTouchEndAllowed: false,
  })
  expect(result.afterRerenderTouchTap).toEqual({
    bubbledTouchEndCount: 1,
    commitCount: 3,
    rerenderTapTouchEndAllowed: false,
    selectedIndexes: [0, 2, 2, 2],
    stateChangeCount: 5,
  })
  expect(result.returnToAutomaticCount).toBe(1)
})
