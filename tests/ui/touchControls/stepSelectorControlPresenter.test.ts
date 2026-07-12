import { describe, expect, it } from 'vitest'
import { presentStepSelectorControl } from '@/ui/touchControls/stepSelectorControl/stepSelectorControlPresenter'

describe('stepSelectorControlPresenter', () => {
  it('renders lower values above current and higher values below current', () => {
    expect(
      presentStepSelectorControl(
        {
          animationDirection: null,
          deferredRuntimeSnapshot: null,
          gesture: null,
          runtimeSnapshot: {
            currentValue: 10,
            decreaseSteps: [
              { canCommit: true, value: 5 },
              { canCommit: true, value: 1 },
            ],
            increaseSteps: [
              { canCommit: true, value: 20 },
              { canCommit: false, value: 40 },
            ],
          },
        },
        { formatValue: (value) => String(value) },
      ),
    ).toMatchObject({
      currentLabel: '10',
      downFarStep: {
        hidden: false,
        label: '40',
        tone: 'blocked',
      },
      downNearStep: {
        hidden: false,
        label: '20',
        tone: 'available',
      },
      upFarStep: {
        hidden: false,
        label: '1',
        tone: 'available',
      },
      upNearStep: {
        hidden: false,
        label: '5',
        tone: 'available',
      },
    })
  })

  it('renders horizontal values from lowest on the left to highest on the right', () => {
    const renderState = presentStepSelectorControl(
      {
        animationDirection: null,
        deferredRuntimeSnapshot: null,
        gesture: null,
        runtimeSnapshot: {
          currentValue: 10,
          decreaseSteps: [
            { canCommit: true, value: 5 },
            { canCommit: true, value: 1 },
          ],
          increaseSteps: [
            { canCommit: true, value: 20 },
            { canCommit: false, value: 40 },
          ],
        },
      },
      { axis: 'horizontal', formatValue: (value) => String(value) },
    )

    expect(
      renderState.horizontalSteps.map(({ label, offset }) => ({
        label,
        offset,
      })),
    ).toEqual([
      { label: '1', offset: -2 },
      { label: '5', offset: -1 },
      { label: '10', offset: 0 },
      { label: '20', offset: 1 },
      { label: '40', offset: 2 },
    ])
  })
})
