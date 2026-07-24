import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import {
  bindCanvasInfoPinLabels,
  createCanvasInfoPinPicker,
} from '@/input/canvasInfoPinInput'

class FakeCanvas {
  getBoundingClientRect() {
    return {
      bottom: 200,
      height: 200,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
}

const createCamera = () => {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 10, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return camera
}

describe('createCanvasInfoPinPicker', () => {
  it('raycasts visible bodies', () => {
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25))
    bodyMesh.visible = true
    bodyMesh.updateMatrixWorld()
    const picker = createCanvasInfoPinPicker({
      gameScene: {
        bodyMeshes: new Map([['earth', bodyMesh]]),
        camera: createCamera(),
      },
      rendererElement: new FakeCanvas() as unknown as HTMLCanvasElement,
    })

    expect(picker(100, 100)).toEqual({ bodyId: 'earth', kind: 'body' })
    expect(picker(10, 10)).toBeNull()
  })

  it('ignores hidden body meshes', () => {
    const hiddenBody = new THREE.Mesh(new THREE.SphereGeometry(0.5))
    hiddenBody.visible = false
    const picker = createCanvasInfoPinPicker({
      gameScene: {
        bodyMeshes: new Map([['earth', hiddenBody]]),
        camera: createCamera(),
      },
      rendererElement: new FakeCanvas() as unknown as HTMLCanvasElement,
    })

    expect(picker(100, 100)).toBeNull()
  })
})

describe('bindCanvasInfoPinLabels', () => {
  it('routes body and apsis label clicks through the shared pin action', () => {
    const bodyLabel = new EventTarget()
    const periapsisLabel = new EventTarget()
    const apoapsisLabel = new EventTarget()
    const onTogglePin = vi.fn(() => true)

    bindCanvasInfoPinLabels({
      onTogglePin,
      overlayUi: {
        bodyLabels: new Map([['earth', bodyLabel as unknown as HTMLElement]]),
        trajectoryEventMarkerLabels: {
          apoapsis: apoapsisLabel as unknown as HTMLElement,
          periapsis: periapsisLabel as unknown as HTMLElement,
        },
      },
    })

    bodyLabel.dispatchEvent(new Event('click', { cancelable: true }))
    periapsisLabel.dispatchEvent(new Event('click', { cancelable: true }))

    expect(onTogglePin).toHaveBeenNthCalledWith(1, {
      bodyId: 'earth',
      kind: 'body',
    })
    expect(onTogglePin).toHaveBeenNthCalledWith(2, {
      apsis: 'periapsis',
      kind: 'apsis',
    })
  })
})
