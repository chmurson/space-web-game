import { describe, expect, it } from 'vitest'
import type { AssistTargetUiState } from '@/runtime/gameQueries'
import type { Body } from '@/simulation/types'
import {
  acknowledgeTargetRecommendationNoticeModel,
  createTargetRecommendationNoticeModel,
  dismissTargetRecommendationNoticeModel,
  syncTargetRecommendationNoticeModel,
} from '@/ui/createTargetRecommendationNotice'

const createBody = (id: string, name: string): Body => ({
  id,
  name,
  color: '#ffffff',
  mass: 1,
  position: { x: 0, y: 0 },
  radius: 1,
  velocity: { x: 0, y: 0 },
})

const earth = createBody('earth', 'Earth')
const moon = createBody('moon', 'Moon')
const mars = createBody('mars', 'Mars')

const createTargetState = (
  mode: AssistTargetUiState['mode'],
  activeTarget: Body,
  recommendedTarget: Body | null,
): AssistTargetUiState => ({
  activeTarget,
  mode,
  recommendedTarget,
})

describe('targetRecommendationNotice', () => {
  it('waits for a recommendation change after manual targeting starts', () => {
    const model = createTargetRecommendationNoticeModel()

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, moon),
      ),
    ).toBeNull()
    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, moon),
      ),
    ).toBeNull()

    const notice = syncTargetRecommendationNoticeModel(
      model,
      createTargetState('manual', earth, mars),
    )
    expect(notice?.target.id).toBe('mars')
    expect(notice?.variant).toBe('durable')
  })

  it('keeps a dismissed recommendation hidden until the recommendation changes', () => {
    const model = createTargetRecommendationNoticeModel()

    syncTargetRecommendationNoticeModel(
      model,
      createTargetState('manual', earth, moon),
    )
    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, mars),
      )?.target.id,
    ).toBe('mars')

    dismissTargetRecommendationNoticeModel(model)

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, mars),
      ),
    ).toBeNull()
    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, moon),
      )?.target.id,
    ).toBe('moon')
  })

  it('clears the current notice when the user commits target state', () => {
    const model = createTargetRecommendationNoticeModel()

    syncTargetRecommendationNoticeModel(
      model,
      createTargetState('manual', earth, moon),
    )
    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, mars),
      )?.target.id,
    ).toBe('mars')

    acknowledgeTargetRecommendationNoticeModel(
      model,
      createTargetState('manual', earth, mars),
    )

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, mars),
      ),
    ).toBeNull()
  })

  it('hides outside manual targeting', () => {
    const model = createTargetRecommendationNoticeModel()

    syncTargetRecommendationNoticeModel(
      model,
      createTargetState('manual', earth, moon),
    )
    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('manual', earth, mars),
      )?.target.id,
    ).toBe('mars')

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('auto', mars, null),
      ),
    ).toBeNull()
  })

  it('waits for an automatic target change before showing in auto mode', () => {
    const model = createTargetRecommendationNoticeModel()

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('auto', earth, null),
      ),
    ).toBeNull()
    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('auto', earth, null),
      ),
    ).toBeNull()

    const notice = syncTargetRecommendationNoticeModel(
      model,
      createTargetState('auto', moon, null),
    )
    expect(notice?.target.id).toBe('moon')
    expect(notice?.message).toBe('Moon is now the trajectory target')
    expect(notice?.variant).toBe('transient')
  })

  it('emits automatic target changes as one-shot transient notices', () => {
    const model = createTargetRecommendationNoticeModel()

    syncTargetRecommendationNoticeModel(
      model,
      createTargetState('auto', earth, null),
    )
    const moonNotice = syncTargetRecommendationNoticeModel(
      model,
      createTargetState('auto', moon, null),
    )
    expect(moonNotice?.target.id).toBe('moon')
    expect(moonNotice?.variant).toBe('transient')

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('auto', moon, null),
      ),
    ).toBeNull()

    const marsNotice = syncTargetRecommendationNoticeModel(
      model,
      createTargetState('auto', mars, null),
    )
    expect(marsNotice?.target.id).toBe('mars')
    expect(marsNotice?.variant).toBe('transient')
  })

  it('does not show an automatic notice immediately after returning from manual mode', () => {
    const model = createTargetRecommendationNoticeModel()

    syncTargetRecommendationNoticeModel(
      model,
      createTargetState('auto', earth, null),
    )
    syncTargetRecommendationNoticeModel(
      model,
      createTargetState('manual', earth, moon),
    )

    expect(
      syncTargetRecommendationNoticeModel(
        model,
        createTargetState('auto', moon, null),
      ),
    ).toBeNull()
  })
})
