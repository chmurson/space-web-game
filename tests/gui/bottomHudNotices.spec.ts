import { expect, test } from '@playwright/test'

test('creates bottom HUD notices with the preserved DOM contract', async ({
  page,
}) => {
  await page.goto('/')

  const contract = await page.evaluate(async () => {
    const overlayUiModulePath = '/src/ui/overlayUI/createOverlayUi.ts'
    const { createOverlayUi } = await import(overlayUiModulePath)
    const app = document.createElement('div')
    document.body.append(app)

    const overlayUi = createOverlayUi({
      app,
      bodies: [],
      showCycleTargetHint: false,
    })

    const fuel = overlayUi.fuelDepletedNotice
    const camera = overlayUi.cameraUnlockNotice
    const target = overlayUi.targetRecommendationNotice
    const targetDismissIcon =
      overlayUi.targetRecommendationNoticeDismissButton?.querySelector(
        '[aria-hidden="true"]',
      )

    const snapshot = {
      bottomPillAreaClass: overlayUi.bottomPillArea.className,
      camera: {
        ariaAtomic: camera.getAttribute('aria-atomic'),
        ariaHidden: camera.getAttribute('aria-hidden'),
        ariaLive: camera.getAttribute('aria-live'),
        bodyText: overlayUi.cameraUnlockNoticeBody?.textContent,
        className: camera.className,
        dataVisible: camera.dataset.visible,
        hidden: camera.hidden,
        parentIsBottomPillArea:
          camera.parentElement === overlayUi.bottomPillArea,
        role: camera.getAttribute('role'),
        titleText: overlayUi.cameraUnlockNoticeTitle?.textContent,
      },
      fuel: {
        ariaAtomic: fuel.getAttribute('aria-atomic'),
        ariaHidden: fuel.getAttribute('aria-hidden'),
        ariaLive: fuel.getAttribute('aria-live'),
        bodyText: fuel.querySelector('.hud-notice-body')?.textContent,
        className: fuel.className,
        dataVisible: fuel.dataset.visible,
        hidden: fuel.hidden,
        parentIsBottomPillArea: fuel.parentElement === overlayUi.bottomPillArea,
        role: fuel.getAttribute('role'),
        titleText: fuel.querySelector('.hud-notice-title')?.textContent,
      },
      hasBurnNotice: Boolean(
        overlayUi.bottomPillArea.querySelector('.burn-active-notice'),
      ),
      target: {
        ariaAtomic: target.getAttribute('aria-atomic'),
        ariaHidden: target.getAttribute('aria-hidden'),
        ariaLive: target.getAttribute('aria-live'),
        className: target.className,
        dataNoticeVariant: target.getAttribute('data-notice-variant'),
        dataVisible: target.dataset.visible,
        dismissAriaLabel:
          overlayUi.targetRecommendationNoticeDismissButton?.getAttribute(
            'aria-label',
          ),
        dismissButtonType:
          overlayUi.targetRecommendationNoticeDismissButton?.type,
        dismissIconCodePoint:
          targetDismissIcon?.textContent?.codePointAt(0) ?? null,
        hidden: target.hidden,
        messageText: overlayUi.targetRecommendationNoticeMessage?.textContent,
        openButtonType: overlayUi.targetRecommendationNoticeOpenButton?.type,
        parentIsBottomPillArea:
          target.parentElement === overlayUi.bottomPillArea,
      },
    }

    app.remove()
    return snapshot
  })

  expect(contract.bottomPillAreaClass).toBe('bottom-pill-area')
  expect(contract.fuel).toEqual({
    ariaAtomic: 'true',
    ariaHidden: 'true',
    ariaLive: 'polite',
    bodyText: 'Thrusters disabled',
    className: 'hud-notice hud-notice-durable fuel-depleted-notice',
    dataVisible: 'false',
    hidden: true,
    parentIsBottomPillArea: true,
    role: 'status',
    titleText: 'Fuel depleted',
  })
  expect(contract.hasBurnNotice).toBe(false)
  expect(contract.camera).toEqual({
    ariaAtomic: 'true',
    ariaHidden: 'true',
    ariaLive: 'polite',
    bodyText: '',
    className: 'hud-notice hud-notice-transient',
    dataVisible: 'false',
    hidden: true,
    parentIsBottomPillArea: true,
    role: 'status',
    titleText: '',
  })
  expect(contract.target).toEqual({
    ariaAtomic: 'true',
    ariaHidden: 'true',
    ariaLive: 'polite',
    className: 'hud-notice target-recommendation-notice',
    dataNoticeVariant: null,
    dataVisible: 'false',
    dismissAriaLabel: 'Dismiss target recommendation',
    dismissButtonType: 'button',
    dismissIconCodePoint: 215,
    hidden: true,
    messageText: '',
    openButtonType: 'button',
    parentIsBottomPillArea: true,
  })
})

test('keeps target recommendation presenter wired to Preact notice controls', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const overlayUiModulePath = '/src/ui/overlayUI/createOverlayUi.ts'
    const targetRecommendationModulePath =
      '/src/ui/createTargetRecommendationNotice.ts'
    const { createOverlayUi } = await import(overlayUiModulePath)
    const { createTargetRecommendationNoticePresenter } = await import(
      targetRecommendationModulePath
    )
    const app = document.createElement('div')
    document.body.append(app)
    const events: string[] = []

    const createBody = (id: string, name: string) => ({
      color: '#ffffff',
      id,
      mass: 1,
      name,
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    })
    const earth = createBody('earth', 'Earth')
    const moon = createBody('moon', 'Moon')
    const mars = createBody('mars', 'Mars')
    const overlayUi = createOverlayUi({
      app,
      bodies: [],
      showCycleTargetHint: false,
    })
    const presenter = createTargetRecommendationNoticePresenter({
      onOpenTargetControl: () => events.push('open-target-control'),
      refs: {
        dismissButton: overlayUi.targetRecommendationNoticeDismissButton,
        element: overlayUi.targetRecommendationNotice,
        message: overlayUi.targetRecommendationNoticeMessage,
        openButton: overlayUi.targetRecommendationNoticeOpenButton,
      },
    })

    presenter.sync({
      activeTarget: earth,
      mode: 'manual',
      recommendedTarget: moon,
    })
    presenter.sync({
      activeTarget: earth,
      mode: 'manual',
      recommendedTarget: mars,
    })

    const notice = overlayUi.targetRecommendationNotice
    const visible = {
      ariaHidden: notice.getAttribute('aria-hidden'),
      dataNoticeVariant: notice.dataset.noticeVariant,
      dataVisible: notice.dataset.visible,
      dismissDisabled:
        overlayUi.targetRecommendationNoticeDismissButton?.disabled,
      dismissHidden: overlayUi.targetRecommendationNoticeDismissButton?.hidden,
      hidden: notice.hidden,
      message: overlayUi.targetRecommendationNoticeMessage?.textContent,
      openAriaLabel:
        overlayUi.targetRecommendationNoticeOpenButton?.getAttribute(
          'aria-label',
        ),
      openDisabled: overlayUi.targetRecommendationNoticeOpenButton?.disabled,
      openTitle:
        overlayUi.targetRecommendationNoticeOpenButton?.getAttribute('title'),
    }

    overlayUi.targetRecommendationNoticeOpenButton?.click()
    overlayUi.targetRecommendationNoticeDismissButton?.click()

    const hidden = {
      ariaHidden: notice.getAttribute('aria-hidden'),
      dataNoticeVariant: notice.dataset.noticeVariant,
      dataVisible: notice.dataset.visible,
      hidden: notice.hidden,
    }

    app.remove()
    return { events, hidden, visible }
  })

  expect(result.visible).toEqual({
    ariaHidden: 'false',
    dataNoticeVariant: 'durable',
    dataVisible: 'true',
    dismissDisabled: false,
    dismissHidden: false,
    hidden: false,
    message: 'Mars is now recommended for trajectory targeting',
    openAriaLabel:
      'Mars is now recommended for trajectory targeting; open target selector',
    openDisabled: false,
    openTitle: 'Mars is now recommended for trajectory targeting',
  })
  expect(result.events).toEqual(['open-target-control'])
  expect(result.hidden).toEqual({
    ariaHidden: 'true',
    dataNoticeVariant: '',
    dataVisible: 'false',
    hidden: true,
  })
})
