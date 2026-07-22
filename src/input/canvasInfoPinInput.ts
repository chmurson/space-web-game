import * as THREE from 'three'

import type { TrajectoryPredictionEventMarkerKind } from '../prediction/trajectoryPrediction'
import {
  apoapsisInfoPin,
  createBodyInfoPin,
  type InfoPin,
  periapsisInfoPin,
} from '../runtime/infoPins'
import type { GameSceneRefs } from '../scene/createGameScene'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'

type CanvasInfoPinScene = Pick<
  GameSceneRefs,
  'bodyMeshes' | 'camera' | 'trajectoryEventMarkers'
>

const apsisPinByKind = {
  apoapsis: apoapsisInfoPin,
  periapsis: periapsisInfoPin,
} satisfies Record<TrajectoryPredictionEventMarkerKind, InfoPin>

const isProjectedIntoViewport = (position: THREE.Vector3) =>
  position.x >= -1 &&
  position.x <= 1 &&
  position.y >= -1 &&
  position.y <= 1 &&
  position.z > -1 &&
  position.z < 1

export const createCanvasInfoPinPicker = (options: {
  gameScene: CanvasInfoPinScene
  markerHitRadiusPixels?: number
  rendererElement: HTMLCanvasElement
}) => {
  const markerHitRadiusPixels = options.markerHitRadiusPixels ?? 18
  const pointerNdc = new THREE.Vector2()
  const markerWorldPosition = new THREE.Vector3()
  const raycaster = new THREE.Raycaster()

  return (clientX: number, clientY: number): InfoPin | null => {
    const bounds = options.rendererElement.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null
    }

    let closestMarker:
      | {
          distancePixels: number
          pin: InfoPin
        }
      | undefined
    for (const [kind, marker] of Object.entries(
      options.gameScene.trajectoryEventMarkers,
    )) {
      if (!marker.group.visible) {
        continue
      }

      marker.group.getWorldPosition(markerWorldPosition)
      markerWorldPosition.project(options.gameScene.camera)
      if (!isProjectedIntoViewport(markerWorldPosition)) {
        continue
      }

      const markerX =
        bounds.left + (markerWorldPosition.x * 0.5 + 0.5) * bounds.width
      const markerY =
        bounds.top + (-markerWorldPosition.y * 0.5 + 0.5) * bounds.height
      const distancePixels = Math.hypot(clientX - markerX, clientY - markerY)
      if (
        distancePixels <= markerHitRadiusPixels &&
        (!closestMarker || distancePixels < closestMarker.distancePixels)
      ) {
        closestMarker = {
          distancePixels,
          pin: apsisPinByKind[kind as TrajectoryPredictionEventMarkerKind],
        }
      }
    }
    if (closestMarker) {
      return closestMarker.pin
    }

    pointerNdc.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((clientY - bounds.top) / bounds.height) * 2 - 1),
    )
    raycaster.setFromCamera(pointerNdc, options.gameScene.camera)
    const visibleBodyMeshes = Array.from(
      options.gameScene.bodyMeshes.entries(),
    ).filter(([, mesh]) => mesh.visible)
    const bodyIdByMesh = new Map(
      visibleBodyMeshes.map(([bodyId, mesh]) => [mesh, bodyId]),
    )
    const intersection = raycaster.intersectObjects(
      visibleBodyMeshes.map(([, mesh]) => mesh),
      false,
    )[0]
    const bodyId = intersection
      ? bodyIdByMesh.get(intersection.object as THREE.Mesh)
      : undefined

    return bodyId ? createBodyInfoPin(bodyId) : null
  }
}

export const bindCanvasInfoPinLabels = (options: {
  onTogglePin(pin: InfoPin): boolean
  overlayUi: Pick<OverlayUiRefs, 'bodyLabels' | 'trajectoryEventMarkerLabels'>
}) => {
  for (const [bodyId, label] of options.overlayUi.bodyLabels) {
    label.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      options.onTogglePin(createBodyInfoPin(bodyId))
    })
  }

  for (const [kind, label] of Object.entries(
    options.overlayUi.trajectoryEventMarkerLabels,
  )) {
    label.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      options.onTogglePin(
        apsisPinByKind[kind as TrajectoryPredictionEventMarkerKind],
      )
    })
  }
}
