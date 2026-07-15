import { createEdgeRevealControlView } from './edgeRevealControlView'

export type TouchControlRevealEdge = 'left' | 'right'

export type TouchControlRevealPlacement = {
  edge: TouchControlRevealEdge
  priority: number
}

export type EdgeRevealControlOptions = {
  className?: string
  content: HTMLElement
  icon?: string
  id: string
  label: string
  allowContentSwipeClose?: boolean
  onOpenChange?(open: boolean): void
  placement: TouchControlRevealPlacement
  revealThresholdPx?: number
}

export type EdgeRevealControl = {
  element: HTMLElement
  placement: TouchControlRevealPlacement
  close(): void
  isOpen(): boolean
  setAvailable(available: boolean): void
  setEdge(edge: TouchControlRevealEdge): void
  setOpen(open: boolean): void
  syncPlacement(indexOnEdge: number): void
}

const defaultRevealThresholdPx = 36

type RevealGesture = {
  startX: number
  startY: number
  touchId: number
}

const getTouchById = (touches: TouchList, touchId: number) =>
  Array.from(touches).find((touch) => touch.identifier === touchId) ?? null

export const createEdgeRevealControl = (
  options: EdgeRevealControlOptions,
): EdgeRevealControl => {
  const view = createEdgeRevealControlView({
    className: options.className,
    contentId: `${options.id}-content`,
    edge: options.placement.edge,
    icon: options.icon ?? options.label,
    id: options.id,
    label: options.label,
  })
  const root = view.element
  const tab = view.tab
  const content = view.content
  content.appendChild(options.content)

  const revealThresholdPx =
    options.revealThresholdPx ?? defaultRevealThresholdPx
  let available = true
  let open = false
  let tabGesture: RevealGesture | null = null
  let contentGesture: RevealGesture | null = null
  let ignoreNextClick = false

  const syncState = () => {
    root.classList.toggle('touch-edge-reveal-control-open', open)
    root.classList.toggle('touch-edge-reveal-control-available', available)
    root.hidden = !available
    tab.setAttribute('aria-expanded', String(open))
  }

  const setOpen = (nextOpen: boolean) => {
    const wasOpen = open
    open = available && nextOpen
    syncState()
    if (open !== wasOpen) {
      options.onOpenChange?.(open)
    }
  }

  const stopTabEvent = (event: Event) => {
    event.stopPropagation()
  }

  const getInwardDelta = (deltaX: number) =>
    options.placement.edge === 'left' ? deltaX : -deltaX

  const getOutwardDelta = (deltaX: number) =>
    options.placement.edge === 'left' ? -deltaX : deltaX

  const shouldAcceptHorizontalGesture = (deltaX: number, deltaY: number) =>
    Math.abs(deltaX) >= revealThresholdPx && Math.abs(deltaX) > Math.abs(deltaY)

  const beginRevealGesture = (touch: Touch): RevealGesture => ({
    startX: touch.clientX,
    startY: touch.clientY,
    touchId: touch.identifier,
  })

  const applyRevealGestureMove = (gesture: RevealGesture, touch: Touch) => {
    const deltaX = touch.clientX - gesture.startX
    const deltaY = touch.clientY - gesture.startY
    if (!shouldAcceptHorizontalGesture(deltaX, deltaY)) {
      return false
    }

    if (!open && getInwardDelta(deltaX) >= revealThresholdPx) {
      setOpen(true)
      return true
    }

    if (open && getOutwardDelta(deltaX) >= revealThresholdPx) {
      setOpen(false)
      return true
    }

    return false
  }

  tab.addEventListener('touchstart', (event) => {
    stopTabEvent(event)
    const touch = event.changedTouches[0]
    if (!touch) {
      return
    }
    tabGesture = beginRevealGesture(touch)
    event.preventDefault()
  })

  tab.addEventListener('touchmove', (event) => {
    stopTabEvent(event)
    if (!tabGesture) {
      return
    }

    const touch = getTouchById(event.changedTouches, tabGesture.touchId)
    if (!touch) {
      return
    }

    if (applyRevealGestureMove(tabGesture, touch)) {
      ignoreNextClick = true
    }
    event.preventDefault()
  })

  const finishTabTouch = (event: TouchEvent) => {
    stopTabEvent(event)
    if (!tabGesture) {
      return
    }

    if (getTouchById(event.changedTouches, tabGesture.touchId)) {
      tabGesture = null
    }
    event.preventDefault()
  }

  tab.addEventListener('touchend', finishTabTouch)
  tab.addEventListener('touchcancel', finishTabTouch)
  tab.addEventListener('click', (event) => {
    stopTabEvent(event)
    if (ignoreNextClick) {
      ignoreNextClick = false
      return
    }
    setOpen(!open)
  })

  content.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0]
    if (!touch || !open) {
      return
    }
    contentGesture = beginRevealGesture(touch)
  })

  content.addEventListener('touchmove', (event) => {
    if (!contentGesture) {
      return
    }

    const touch = getTouchById(event.changedTouches, contentGesture.touchId)
    if (!touch) {
      return
    }

    if (
      options.allowContentSwipeClose !== false &&
      applyRevealGestureMove(contentGesture, touch)
    ) {
      event.preventDefault()
    }
  })

  const finishContentTouch = (event: TouchEvent) => {
    if (
      contentGesture &&
      getTouchById(event.changedTouches, contentGesture.touchId)
    ) {
      contentGesture = null
    }
  }

  content.addEventListener('touchend', finishContentTouch)
  content.addEventListener('touchcancel', finishContentTouch)

  syncState()

  return {
    element: root,
    placement: options.placement,
    close() {
      setOpen(false)
    },
    isOpen() {
      return open
    },
    setAvailable(nextAvailable) {
      const wasOpen = open
      available = nextAvailable
      if (!available) {
        open = false
      }
      syncState()
      if (open !== wasOpen) {
        options.onOpenChange?.(open)
      }
    },
    setEdge(edge) {
      if (options.placement.edge === edge) {
        return
      }

      root.classList.remove(
        `touch-edge-reveal-control-${options.placement.edge}`,
      )
      options.placement.edge = edge
      root.classList.add(`touch-edge-reveal-control-${edge}`)
    },
    setOpen,
    syncPlacement(indexOnEdge) {
      root.style.setProperty('--touch-edge-reveal-index', String(indexOnEdge))
    },
  }
}
