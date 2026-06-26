import type { ComponentChildren } from 'preact'

type MenuActionTone = 'danger' | 'neutral'
type MenuActionVariant = 'default' | 'primary' | 'secondary'

const joinClassNames = (...classNames: Array<string | undefined | false>) => {
  const joined = classNames.filter(Boolean).join(' ')
  return joined || undefined
}

export const MenuPanel = ({
  children,
  className,
  hidden,
  view,
  viewAttribute = 'data-menu-view',
}: {
  children: ComponentChildren
  className?: string
  hidden?: boolean
  view?: string
  viewAttribute?: string
}) => (
  <div
    class={joinClassNames('menu-panel', className)}
    hidden={hidden}
    {...(view ? { [viewAttribute]: view } : {})}
  >
    {children}
  </div>
)

export const MenuCopy = ({
  children,
  className,
}: {
  children: ComponentChildren
  className?: string
}) => <div class={joinClassNames('menu-copy', className)}>{children}</div>

export const MenuKicker = ({
  children,
  className,
}: {
  children: ComponentChildren
  className?: string
}) => <div class={joinClassNames('menu-kicker', className)}>{children}</div>

export const MenuTitle = ({
  children,
  className,
  id,
}: {
  children: ComponentChildren
  className?: string
  id?: string
}) => (
  <h2 class={joinClassNames('menu-title', className)} id={id}>
    {children}
  </h2>
)

export const MenuDescription = ({
  children,
  className,
  id,
}: {
  children: ComponentChildren
  className?: string
  id?: string
}) => (
  <p class={joinClassNames('menu-description', className)} id={id}>
    {children}
  </p>
)

export const MenuActions = ({
  children,
  className,
}: {
  children: ComponentChildren
  className?: string
}) => <div class={joinClassNames('menu-actions', className)}>{children}</div>

export const MenuActionButton = ({
  action,
  actionAttribute,
  children,
  className,
  disabled,
  hidden,
  onClick,
  tone = 'neutral',
  variant = 'default',
}: {
  action: string
  actionAttribute: string
  children: ComponentChildren
  className?: string
  disabled?: boolean
  hidden?: boolean
  onClick(): void
  tone?: MenuActionTone
  variant?: MenuActionVariant
}) => {
  const actionClasses = joinClassNames(
    'menu-action',
    variant === 'primary' && 'menu-action-primary',
    variant === 'secondary' && 'menu-action-secondary',
    variant === 'primary' && tone === 'danger' && 'menu-action-danger-primary',
    className,
  )
  const dataActionAttribute = {
    [actionAttribute]: action,
  }

  return (
    <button
      class={actionClasses}
      type="button"
      disabled={disabled}
      hidden={hidden}
      onClick={onClick}
      {...dataActionAttribute}
    >
      {children}
    </button>
  )
}
