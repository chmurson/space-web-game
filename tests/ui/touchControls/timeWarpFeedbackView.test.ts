import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimeWarpFeedbackView } from '@/ui/touchControls/swipeTimeWarpControl/timeWarpFeedbackView'

vi.mock('preact', () => ({
  render: (vnode: unknown, element: HTMLElement) => {
    const label =
      vnode && typeof vnode === 'object' && 'props' in vnode
        ? (vnode as { props?: { renderState?: { label?: string } } }).props
            ?.renderState?.label
        : ''
    element.textContent = label ?? ''
  },
}))

type FakeClassList = {
  add: (...tokens: string[]) => void
  contains: (token: string) => boolean
  remove: (...tokens: string[]) => void
}

type FakeElement = HTMLElement & {
  classList: FakeClassList
  dataset: Record<string, string>
  style: CSSStyleDeclaration
}

const createFakeElement = (size = { width: 120, height: 40 }): FakeElement => {
  const classes = new Set<string>()
  const styles = new Map<string, string>()

  return {
    classList: {
      add: (...tokens) => {
        for (const token of tokens) {
          classes.add(token)
        }
      },
      contains: (token) => classes.has(token),
      remove: (...tokens) => {
        for (const token of tokens) {
          classes.delete(token)
        }
      },
    },
    dataset: {},
    getBoundingClientRect: () =>
      ({
        height: size.height,
        width: size.width,
      }) as DOMRect,
    style: {
      left: '',
      removeProperty: (property: string) => {
        const existing = styles.get(property) ?? ''
        styles.delete(property)
        return existing
      },
      setProperty: (property: string, value: string) => {
        styles.set(property, value)
      },
      top: '',
      getPropertyValue: (property: string) => styles.get(property) ?? '',
    } as CSSStyleDeclaration,
    textContent: '',
  } as FakeElement
}

describe('timeWarpFeedbackView', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    vi.useRealTimers()
    globalThis.window = originalWindow
  })

  it('renders explicit preview state and clamps the anchor', () => {
    const element = createFakeElement()
    globalThis.window = globalThis as typeof window
    const view = createTimeWarpFeedbackView({
      committedFadeMs: 600,
      element,
      getBounds: () => ({ height: 120, width: 200 }),
    })

    view.render({
      anchor: { x: 4, y: 200 },
      label: '>> x1m max',
      mode: 'preview',
      opacity: 0.6,
      tone: 'blocked',
      value: 60,
      variant: 'increase',
    })

    expect(element.textContent).toBe('>> x1m max')
    expect(element.dataset.timeWarpFeedbackState).toBe('blocked')
    expect(element.dataset.warpFeedbackVariant).toBe('v2')
    expect(element.classList.contains('touch-time-warp-feedback-visible')).toBe(
      true,
    )
    expect(element.style.left).toBe('72px')
    expect(element.style.top).toBe('88px')
    expect(
      element.style.getPropertyValue('--touch-time-warp-feedback-opacity'),
    ).toBe('0.6')
  })

  it('clears confirmation state after the fade timeout', () => {
    vi.useFakeTimers()
    const element = createFakeElement()
    globalThis.window = globalThis as typeof window
    const view = createTimeWarpFeedbackView({
      committedFadeMs: 500,
      element,
      getBounds: () => ({ height: 200, width: 200 }),
    })

    view.render({
      anchor: { x: 80, y: 90 },
      label: '<< x10s',
      mode: 'confirmation',
      opacity: 1,
      tone: 'available',
      value: 10,
      variant: 'decrease',
    })

    expect(element.classList.contains('touch-time-warp-feedback-confirm')).toBe(
      true,
    )
    expect(element.classList.contains('touch-time-warp-feedback-fade')).toBe(
      true,
    )
    expect(element.dataset.warpFeedbackVariant).toBe('v4')

    vi.advanceTimersByTime(500)

    expect(element.textContent).toBe('')
    expect(element.dataset.timeWarpFeedbackState).toBeUndefined()
    expect(element.classList.contains('touch-time-warp-feedback-visible')).toBe(
      false,
    )
  })
})
