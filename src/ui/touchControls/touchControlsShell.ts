export type TouchControlsShell = {
  element: HTMLElement
}

export const createTouchControlsShell = (): TouchControlsShell => {
  const element = document.createElement('section')
  element.className = 'touch-controls'

  return { element }
}
