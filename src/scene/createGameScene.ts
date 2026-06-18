import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

import earthTextureUrl from '../assets/bodies/earth-stylized.webp'
import moonTextureUrl from '../assets/bodies/moon-stylized.webp'
import type { GameConfig } from '../config/types'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body } from '../simulation/types'
import { createStarfield, type Starfield } from './starfield'

const bodyDiffuseTextureUrls: Record<string, string> = {
  earth: earthTextureUrl,
  moon: moonTextureUrl,
}

const EARTH_ATMOSPHERE_RIM_NAME = 'earth-atmosphere-rim'
const BODY_WIDTH_SEGMENTS = 64
const BODY_HEIGHT_SEGMENTS = 32
const EARTH_ATMOSPHERE_RADIUS_MULTIPLIER = 1.045
const EARTH_ATMOSPHERE_WIDTH_SEGMENTS = 96
const EARTH_ATMOSPHERE_HEIGHT_SEGMENTS = 48

const createEarthAtmosphereRimMaterial = () =>
  new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(vViewPosition);
        float limb = 1.0 - abs(dot(normal, viewDirection));
        float edgeGlow = pow(smoothstep(0.42, 1.0, limb), 2.2);
        float alpha = edgeGlow * 0.42;
        vec3 atmosphereColor = mix(
          vec3(0.36, 0.72, 1.0),
          vec3(0.93, 0.98, 1.0),
          edgeGlow
        );

        gl_FragColor = vec4(atmosphereColor * alpha, alpha);
      }
    `,
    side: THREE.BackSide,
    toneMapped: false,
    transparent: true,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -modelViewPosition.xyz;
        gl_Position = projectionMatrix * modelViewPosition;
      }
    `,
  })

const createEarthAtmosphereRim = (radius: number) => {
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius * EARTH_ATMOSPHERE_RADIUS_MULTIPLIER,
      EARTH_ATMOSPHERE_WIDTH_SEGMENTS,
      EARTH_ATMOSPHERE_HEIGHT_SEGMENTS,
    ),
    createEarthAtmosphereRimMaterial(),
  )
  rim.name = EARTH_ATMOSPHERE_RIM_NAME
  return rim
}

export type SpacecraftTrailPoint = {
  elapsed: number
  position: THREE.Vector3
}

export type ScreenSpaceDashPattern = {
  dashPixels: number
  gapPixels: number
  material: LineMaterial | THREE.LineDashedMaterial
}

export type GameSceneRefs = {
  assistedPredictionGeometry: LineGeometry
  assistedPredictionLine: Line2
  assistedPredictionMaterial: LineMaterial
  bodyMeshes: Map<string, THREE.Mesh>
  camera: THREE.OrthographicCamera
  cameraTarget: THREE.Vector3
  circularOrbitGeometry: LineGeometry
  circularOrbitLine: Line2
  circularOrbitMaterial: LineMaterial
  desiredVelocityGeometry: LineGeometry
  desiredVelocityLine: Line2
  desiredVelocityMaterial: LineMaterial
  debugGrid: THREE.GridHelper
  engineGlow: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>
  impactGradientGeometry: LineGeometry
  impactGradientLine: Line2
  impactGradientMaterial: LineMaterial
  inertialPredictionGeometry: LineGeometry
  inertialPredictionLine: Line2
  inertialPredictionMaterial: LineMaterial
  predictionEndMarker: THREE.Group
  predictionEndMarkerFill: THREE.Mesh<
    THREE.CircleGeometry,
    THREE.MeshBasicMaterial
  >
  predictionEndMarkerMinScreenRadius: number
  predictionEndMarkerRadius: number
  predictionGeometry: LineGeometry
  predictionLine: Line2
  predictionMaterial: LineMaterial
  replacePredictionLineGeometryOnUpdate: boolean
  scene: THREE.Scene
  screenSpaceDashPatterns: ScreenSpaceDashPattern[]
  spacecraftMarker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  spacecraftMesh: THREE.Group
  starfield: Starfield
  trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
  trailPoints: SpacecraftTrailPoint[]
}

export const createGameScene = (
  bodies: Body[],
  trajectoryRenderingConfig: GameConfig['trajectory']['rendering'],
): GameSceneRefs => {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5_000)
  const cameraTarget = new THREE.Vector3(0, 0, 0)

  const ambientLight = new THREE.AmbientLight(0x7f8fa6, 1.5)
  scene.add(ambientLight)

  const sunLight = new THREE.DirectionalLight(0xffffff, 3)
  sunLight.position.set(-1, 2, 1)
  scene.add(sunLight)

  const starfield = createStarfield()
  scene.add(starfield.group)

  const debugGrid = new THREE.GridHelper(900, 36, 0x1d4ed8, 0x18253a)
  debugGrid.position.y = -0.05
  debugGrid.visible = false
  scene.add(debugGrid)

  const bodyMeshes = new Map<string, THREE.Mesh>()
  const textureLoader = new THREE.TextureLoader()

  for (const body of bodies) {
    const bodyRadius = Math.max(body.radius * RENDER_SCALE, 1)
    const geometry = new THREE.SphereGeometry(
      bodyRadius,
      BODY_WIDTH_SEGMENTS,
      BODY_HEIGHT_SEGMENTS,
    )
    const material = new THREE.MeshStandardMaterial({
      color: body.color,
      roughness: 0.82,
      metalness: 0.02,
    })
    const diffuseTextureUrl = bodyDiffuseTextureUrls[body.id]
    if (diffuseTextureUrl) {
      textureLoader.load(
        diffuseTextureUrl,
        (diffuseTexture) => {
          diffuseTexture.colorSpace = THREE.SRGBColorSpace
          material.color.set('#ffffff')
          material.map = diffuseTexture
          material.needsUpdate = true
        },
        undefined,
        () => {
          material.color.set(body.color)
          material.map = null
          material.needsUpdate = true
        },
      )
    }
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = body.name
    if (body.id === 'earth') {
      mesh.add(createEarthAtmosphereRim(bodyRadius))
    }
    bodyMeshes.set(body.id, mesh)
    scene.add(mesh)
  }

  const spacecraftMesh = new THREE.Group()
  spacecraftMesh.scale.setScalar(1.5)
  const shipBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.32, 4),
    new THREE.MeshStandardMaterial({ color: '#e8eef8', roughness: 0.5 }),
  )
  shipBody.rotation.x = Math.PI / 2
  spacecraftMesh.add(shipBody)

  const engineGlow = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 12),
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0,
    }),
  )
  engineGlow.position.z = -0.24
  engineGlow.rotation.x = -Math.PI / 2
  spacecraftMesh.add(engineGlow)
  scene.add(spacecraftMesh)

  const spacecraftMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.015, 8, 32),
    new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.9,
    }),
  )
  spacecraftMarker.rotation.x = Math.PI / 2
  scene.add(spacecraftMarker)

  const trailPoints: SpacecraftTrailPoint[] = []
  const trailGeometry = new THREE.BufferGeometry()
  const trailMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
  })
  const trail = new THREE.Line(trailGeometry, trailMaterial)
  scene.add(trail)

  const replacePredictionLineGeometryOnUpdate =
    trajectoryRenderingConfig.replaceLineGeometryOnUpdate
  const screenSpaceDashPatterns: ScreenSpaceDashPattern[] = []

  const predictionLineWidth = 0.8
  const predictionGeometry = new LineGeometry()
  const predictionMaterial = new LineMaterial({
    color: 0x7dd3fc,
    linewidth: predictionLineWidth,
    transparent: true,
    opacity: 1,
    vertexColors: true,
  })
  predictionMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      [
        'float fadeBrightness = clamp( ( vColor.r + vColor.g + vColor.b ) / 3.0, 0.0, 1.0 );',
        'float fadeAlphaMultiplier = mix( 0.55, 1.0, fadeBrightness );',
        'gl_FragColor = vec4( diffuseColor.rgb, alpha * fadeAlphaMultiplier );',
      ].join('\n'),
    )
  }
  predictionMaterial.customProgramCacheKey = () =>
    'prediction-line-alpha-fade-v1'
  const predictionLine = new Line2(predictionGeometry, predictionMaterial)
  scene.add(predictionLine)

  const impactGradientGeometry = new LineGeometry()
  const impactGradientMaterial = new LineMaterial({
    color: 0xffffff,
    linewidth: predictionLineWidth,
    transparent: false,
    vertexColors: true,
  })
  const impactGradientLine = new Line2(
    impactGradientGeometry,
    impactGradientMaterial,
  )
  impactGradientLine.visible = false
  scene.add(impactGradientLine)

  const inertialPredictionGeometry = new LineGeometry()
  const inertialPredictionMaterial = new LineMaterial({
    color: 0xb7c7d6,
    linewidth: 1,
    transparent: false,
  })
  const inertialPredictionLine = new Line2(
    inertialPredictionGeometry,
    inertialPredictionMaterial,
  )
  scene.add(inertialPredictionLine)

  const assistedPredictionGeometry = new LineGeometry()
  const assistedPredictionMaterial = new LineMaterial({
    color: 0xd6bc62,
    linewidth: 1.2,
    transparent: false,
  })
  const assistedPredictionLine = new Line2(
    assistedPredictionGeometry,
    assistedPredictionMaterial,
  )
  assistedPredictionLine.visible = false
  scene.add(assistedPredictionLine)

  const circularOrbitGeometry = new LineGeometry()
  const circularOrbitMaterial = new LineMaterial({
    color: 0x67e8f9,
    linewidth: 1,
    transparent: true,
    opacity: 0.28,
  })
  const circularOrbitLine = new Line2(
    circularOrbitGeometry,
    circularOrbitMaterial,
  )
  circularOrbitLine.visible = false
  scene.add(circularOrbitLine)

  const desiredVelocityGeometry = new LineGeometry()
  const desiredVelocityMaterial = new LineMaterial({
    color: 0xfacc15,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.72,
  })
  const desiredVelocityLine = new Line2(
    desiredVelocityGeometry,
    desiredVelocityMaterial,
  )
  desiredVelocityLine.visible = false
  scene.add(desiredVelocityLine)

  const predictionEndMarkerRadius = trajectoryRenderingConfig.endMarkerRadius
  const predictionEndMarkerMinScreenRadius =
    trajectoryRenderingConfig.endMarkerMinScreenRadius
  const predictionEndMarker = new THREE.Group()
  const predictionEndMarkerBacking = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: '#05070d',
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  )
  const predictionEndMarkerFill = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      opacity: 0.5,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  )
  predictionEndMarkerBacking.renderOrder = 10
  predictionEndMarkerFill.renderOrder = 11
  predictionEndMarkerBacking.scale.setScalar(1.25)
  predictionEndMarker.add(predictionEndMarkerBacking, predictionEndMarkerFill)
  predictionEndMarker.renderOrder = 10
  scene.add(predictionEndMarker)

  return {
    assistedPredictionGeometry,
    assistedPredictionLine,
    assistedPredictionMaterial,
    bodyMeshes,
    camera,
    cameraTarget,
    circularOrbitGeometry,
    circularOrbitLine,
    circularOrbitMaterial,
    desiredVelocityGeometry,
    desiredVelocityLine,
    desiredVelocityMaterial,
    debugGrid,
    engineGlow,
    impactGradientGeometry,
    impactGradientLine,
    impactGradientMaterial,
    inertialPredictionGeometry,
    inertialPredictionLine,
    inertialPredictionMaterial,
    predictionEndMarker,
    predictionEndMarkerFill,
    predictionEndMarkerMinScreenRadius,
    predictionEndMarkerRadius,
    predictionGeometry,
    predictionLine,
    predictionMaterial,
    replacePredictionLineGeometryOnUpdate,
    scene,
    screenSpaceDashPatterns,
    spacecraftMarker,
    spacecraftMesh,
    starfield,
    trail,
    trailPoints,
  }
}
