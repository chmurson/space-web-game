import { expect, test } from '@playwright/test'

type EdgeRevealControlModule =
  typeof import('../../src/ui/touchControls/edgeRevealControl')

test('preserves the edge reveal shell contract and imperative state API', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const edgeRevealControlModulePath =
      '/src/ui/touchControls/edgeRevealControl.ts'
    const { createEdgeRevealControl } = (await import(
      edgeRevealControlModulePath
    )) as EdgeRevealControlModule
    const hostedControl = document.createElement('div')
    hostedControl.id = 'hosted-control'
    hostedControl.textContent = 'Hosted control'
    const openChanges: boolean[] = []
    const control = createEdgeRevealControl({
      className: 'custom-reveal',
      content: hostedControl,
      icon: 'E',
      id: 'edge-test',
      label: 'Reveal example control',
      onOpenChange: (open: boolean) => openChanges.push(open),
      placement: { edge: 'left', priority: 2 },
    })

    document.body.append(control.element)

    const tab = control.element.querySelector<HTMLButtonElement>(
      '.touch-edge-reveal-tab',
    )
    const content = control.element.querySelector<HTMLElement>(
      '.touch-edge-reveal-content',
    )

    tab?.click()
    const openAfterClick = control.isOpen()
    const ariaAfterClick = tab?.getAttribute('aria-expanded')

    control.setAvailable(false)
    const hiddenWhenUnavailable = control.element.hidden
    const openAfterUnavailable = control.isOpen()

    control.setAvailable(true)
    control.setEdge('right')
    control.syncPlacement(3)
    control.setOpen(true)
    control.close()

    return {
      ariaAfterClick,
      ariaControls: tab?.getAttribute('aria-controls'),
      ariaLabel: tab?.getAttribute('aria-label'),
      availableClass: control.element.classList.contains(
        'touch-edge-reveal-control-available',
      ),
      contentChildId: content?.firstElementChild?.id,
      contentId: content?.id,
      customClass: control.element.classList.contains('custom-reveal'),
      dataId: control.element.dataset.edgeRevealId,
      edgeClassLeft: control.element.classList.contains(
        'touch-edge-reveal-control-left',
      ),
      edgeClassRight: control.element.classList.contains(
        'touch-edge-reveal-control-right',
      ),
      hiddenWhenUnavailable,
      openAfterClick,
      openAfterUnavailable,
      openChanges,
      placementEdge: control.placement.edge,
      rootId: control.element.id,
      tabText: tab?.textContent,
      touchIndex: control.element.style.getPropertyValue(
        '--touch-edge-reveal-index',
      ),
    }
  })

  expect(result).toEqual({
    ariaAfterClick: 'true',
    ariaControls: 'edge-test-content',
    ariaLabel: 'Reveal example control',
    availableClass: true,
    contentChildId: 'hosted-control',
    contentId: 'edge-test-content',
    customClass: true,
    dataId: 'edge-test',
    edgeClassLeft: false,
    edgeClassRight: true,
    hiddenWhenUnavailable: true,
    openAfterClick: true,
    openAfterUnavailable: false,
    openChanges: [true, false, true, false],
    placementEdge: 'right',
    rootId: 'edge-test',
    tabText: 'E',
    touchIndex: '3',
  })
})

test('preserves tab swipe, ignored click after swipe, and content swipe close', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const edgeRevealControlModulePath =
      '/src/ui/touchControls/edgeRevealControl.ts'
    const { createEdgeRevealControl } = (await import(
      edgeRevealControlModulePath
    )) as EdgeRevealControlModule
    const hostedControl = document.createElement('div')
    hostedControl.textContent = 'Hosted control'
    const openChanges: boolean[] = []
    const control = createEdgeRevealControl({
      content: hostedControl,
      id: 'edge-swipe-test',
      label: 'Reveal swipe control',
      onOpenChange: (open: boolean) => openChanges.push(open),
      placement: { edge: 'left', priority: 0 },
    })
    document.body.append(control.element)

    const tab = control.element.querySelector<HTMLButtonElement>(
      '.touch-edge-reveal-tab',
    )
    const content = control.element.querySelector<HTMLElement>(
      '.touch-edge-reveal-content',
    )
    if (!tab || !content) {
      throw new Error('Edge reveal test failed to render required elements')
    }

    const dispatchTouch = (
      target: HTMLElement,
      type: 'touchcancel' | 'touchend' | 'touchmove' | 'touchstart',
      point: { x: number; y: number },
    ) => {
      const touch = new Touch({
        clientX: point.x,
        clientY: point.y,
        identifier: 23,
        target,
      })
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        changedTouches: [touch],
        targetTouches:
          type === 'touchend' || type === 'touchcancel' ? [] : [touch],
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
      })
      target.dispatchEvent(event)
      return event.defaultPrevented
    }

    const tabStartPrevented = dispatchTouch(tab, 'touchstart', { x: 0, y: 10 })
    const tabMovePrevented = dispatchTouch(tab, 'touchmove', { x: 44, y: 10 })
    dispatchTouch(tab, 'touchend', { x: 44, y: 10 })
    const openAfterTabSwipe = control.isOpen()

    tab.click()
    const openAfterIgnoredClick = control.isOpen()

    dispatchTouch(content, 'touchstart', { x: 100, y: 10 })
    const contentMovePrevented = dispatchTouch(content, 'touchmove', {
      x: 56,
      y: 10,
    })
    dispatchTouch(content, 'touchend', { x: 56, y: 10 })
    const closedAfterContentSwipe = !control.isOpen()

    return {
      closedAfterContentSwipe,
      contentMovePrevented,
      openAfterIgnoredClick,
      openAfterTabSwipe,
      openChanges,
      tabMovePrevented,
      tabStartPrevented,
    }
  })

  expect(result).toEqual({
    closedAfterContentSwipe: true,
    contentMovePrevented: true,
    openAfterIgnoredClick: true,
    openAfterTabSwipe: true,
    openChanges: [true, false],
    tabMovePrevented: true,
    tabStartPrevented: true,
  })
})

test('can keep a reveal panel open when its content owns horizontal dragging', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const edgeRevealControlModulePath =
      '/src/ui/touchControls/edgeRevealControl.ts'
    const { createEdgeRevealControl } = (await import(
      edgeRevealControlModulePath
    )) as EdgeRevealControlModule
    const control = createEdgeRevealControl({
      allowContentSwipeClose: false,
      content: document.createElement('div'),
      id: 'edge-no-content-close-test',
      label: 'Reveal drag control',
      placement: { edge: 'left', priority: 0 },
    })
    document.body.append(control.element)
    control.setOpen(true)
    const content = control.element.querySelector<HTMLElement>(
      '.touch-edge-reveal-content',
    )
    if (!content) {
      throw new Error('Expected reveal content')
    }
    const dispatchTouch = (
      type: 'touchend' | 'touchmove' | 'touchstart',
      x: number,
    ) => {
      const touch = new Touch({
        clientX: x,
        clientY: 10,
        identifier: 24,
        target: content,
      })
      content.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          changedTouches: [touch],
          targetTouches: type === 'touchend' ? [] : [touch],
          touches: type === 'touchend' ? [] : [touch],
        }),
      )
    }
    dispatchTouch('touchstart', 100)
    dispatchTouch('touchmove', 56)
    dispatchTouch('touchend', 56)
    return control.isOpen()
  })

  expect(result).toBe(true)
})
