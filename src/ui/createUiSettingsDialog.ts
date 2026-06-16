import type { TouchControlSide } from '../userSettingsStorage'
import { createDialog, createDialogSettingRow } from './createDialog'
import { createSegmentedControl } from './segmentedControl'

export type UiSettingsDialog = {
  close: (restoreFocus?: boolean) => void
  element: HTMLElement
  open: () => void
  syncState: () => void
}

export const createUiSettingsDialog = (options: {
  app: HTMLElement
  getTouchBurnControlSide: () => TouchControlSide
  getTouchTrajectoryControlSide: () => TouchControlSide
  getTouchWarpControlSide: () => TouchControlSide
  onOpenChange?: (open: boolean) => void
  onTouchBurnControlSideChange(side: TouchControlSide): void
  onTouchTrajectoryControlSideChange(side: TouchControlSide): void
  onTouchWarpControlSideChange(side: TouchControlSide): void
}): UiSettingsDialog => {
  const dialog = createDialog({
    app: options.app,
    className: 'ui-settings-dialog',
    closeAriaLabel: 'Close UI settings',
    kicker: 'Controls',
    onOpenChange: options.onOpenChange,
    title: 'UI settings',
  })
  const sideOptions = [
    { label: 'Left', value: 'left' },
    { label: 'Right', value: 'right' },
  ] satisfies { label: string; value: TouchControlSide }[]
  const burnSideControl = createSegmentedControl<TouchControlSide>({
    ariaLabel: 'Burn control side',
    onChange: (side) => {
      options.onTouchBurnControlSideChange(side)
      syncState()
    },
    options: sideOptions,
    value: options.getTouchBurnControlSide(),
  })
  const warpSideControl = createSegmentedControl<TouchControlSide>({
    ariaLabel: 'Warp control side',
    onChange: (side) => {
      options.onTouchWarpControlSideChange(side)
      syncState()
    },
    options: sideOptions,
    value: options.getTouchWarpControlSide(),
  })
  const trajectorySideControl = createSegmentedControl<TouchControlSide>({
    ariaLabel: 'Trajectory control side',
    onChange: (side) => {
      options.onTouchTrajectoryControlSideChange(side)
      syncState()
    },
    options: sideOptions,
    value: options.getTouchTrajectoryControlSide(),
  })

  const settingList = document.createElement('div')
  settingList.className = 'app-dialog-setting-list'
  settingList.append(
    createDialogSettingRow({
      control: burnSideControl.element,
      label: 'Burn side',
    }),
    createDialogSettingRow({
      control: warpSideControl.element,
      label: 'Warp side',
    }),
    createDialogSettingRow({
      control: trajectorySideControl.element,
      label: 'Trajectory side',
    }),
  )
  dialog.body.append(settingList)

  function syncState() {
    burnSideControl.sync(options.getTouchBurnControlSide())
    warpSideControl.sync(options.getTouchWarpControlSide())
    trajectorySideControl.sync(options.getTouchTrajectoryControlSide())
  }

  const open = () => {
    syncState()
    dialog.open()
  }

  syncState()

  return {
    close: dialog.close,
    element: dialog.element,
    open,
    syncState,
  }
}
