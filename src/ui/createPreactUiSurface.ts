import { type ComponentType, h, render } from 'preact'

export type SurfaceRootRefProps = {
  rootRef(element: HTMLElement | null): void
}

export const createPreactUiSurface = <Props extends object>(options: {
  app: HTMLElement
  component: ComponentType<Props & SurfaceRootRefProps>
  missingRootError: string
}) => {
  const host = document.createElement('div')
  options.app.appendChild(host)

  let root: HTMLElement | null = null
  const rootRef = (element: HTMLElement | null) => {
    root = element
  }

  return {
    get element() {
      if (!root) {
        throw new Error(options.missingRootError)
      }
      return root
    },
    render: (props: Props) => {
      render(
        h(options.component, {
          ...props,
          rootRef,
        } as Props & SurfaceRootRefProps),
        host,
      )
    },
  }
}
