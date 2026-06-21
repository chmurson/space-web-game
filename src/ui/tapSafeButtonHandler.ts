export const addTapSafeButtonHandler = (
  button: HTMLButtonElement,
  handler: (event: Event) => void | Promise<void>,
) => {
  let ignoreNextClick = false
  let ignoreNextClickTimeout: ReturnType<typeof setTimeout> | null = null

  const clearIgnoreNextClick = () => {
    if (ignoreNextClickTimeout !== null) {
      clearTimeout(ignoreNextClickTimeout)
      ignoreNextClickTimeout = null
    }
    ignoreNextClick = false
  }

  const ignoreSyntheticClick = () => {
    if (ignoreNextClickTimeout !== null) {
      clearTimeout(ignoreNextClickTimeout)
    }
    ignoreNextClick = true
    ignoreNextClickTimeout = setTimeout(clearIgnoreNextClick, 700)
  }

  button.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse' || button.disabled) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    ignoreSyntheticClick()
    void handler(event)
  })

  button.addEventListener('click', (event) => {
    event.stopPropagation()

    if (ignoreNextClick) {
      clearIgnoreNextClick()
      return
    }

    if (button.disabled) {
      return
    }

    void handler(event)
  })
}
