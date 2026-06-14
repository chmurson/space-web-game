export type SegmentedControlOption<TValue extends string> = {
  label: string
  value: TValue
}

export type SegmentedControl<TValue extends string> = {
  element: HTMLElement
  setDisabled(disabled: boolean): void
  sync(value: TValue): void
}

export const createSegmentedControl = <TValue extends string>(options: {
  ariaLabel: string
  onChange(value: TValue): void
  optionRole?: 'button' | 'menuitemradio'
  options: SegmentedControlOption<TValue>[]
  value: TValue
}): SegmentedControl<TValue> => {
  const root = document.createElement('div')
  root.className = 'segmented-control'
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', options.ariaLabel)

  const buttons = options.options.map((option) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'segmented-control-option'
    button.textContent = option.label
    button.dataset.segmentedControlValue = option.value
    if (options.optionRole && options.optionRole !== 'button') {
      button.setAttribute('role', options.optionRole)
    }
    button.addEventListener('click', () => {
      options.onChange(option.value)
    })
    root.appendChild(button)
    return { button, value: option.value }
  })

  const sync = (value: TValue) => {
    const hasValue = buttons.some((option) => option.value === value)
    if (!hasValue) {
      throw new Error(
        `Invalid segmented control value "${value}". Expected one of: ${buttons
          .map((option) => option.value)
          .join(', ')}`,
      )
    }

    for (const option of buttons) {
      const selected = option.value === value
      option.button.classList.toggle(
        'segmented-control-option-selected',
        selected,
      )
      if (options.optionRole === 'menuitemradio') {
        option.button.setAttribute('aria-checked', String(selected))
      } else {
        option.button.setAttribute('aria-pressed', String(selected))
      }
    }
  }

  sync(options.value)

  return {
    element: root,
    setDisabled: (disabled) => {
      for (const option of buttons) {
        option.button.disabled = disabled
      }
      root.classList.toggle('segmented-control-disabled', disabled)
    },
    sync,
  }
}
