export type TouchControlsTutorialHint = {
  element: HTMLDivElement
  setVisible(visible: boolean): void
}

export const createTouchControlsTutorialHint =
  (): TouchControlsTutorialHint => {
    const element = document.createElement('div')
    element.className = 'touch-controls-tutorial-hint'
    element.style.display = 'none'

    const frame = document.createElement('div')
    frame.className = 'touch-controls-tutorial-hint-frame'
    element.appendChild(frame)

    const label = document.createElement('div')
    label.className = 'touch-controls-tutorial-hint-label'
    label.textContent = 'Press and hold here'
    element.appendChild(label)

    return {
      element,
      setVisible: (visible) => {
        element.style.display = visible ? 'block' : 'none'
      },
    }
  }
