import * as THREE from 'three'

import type { SphereOfInfluenceVariant } from '../config/featureFlags'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body } from '../simulation/types'

const CIRCLE_SEGMENTS = 192
const FIELD_OPACITY = 0.045
const SOI_RENDER_ORDER = -8
const WHITE = new THREE.Color('#ffffff')

export const SPHERE_OF_INFLUENCE_RENDER_LIFT = -0.08

export type SphereOfInfluenceDashPattern = {
  dashPixels: number
  gapPixels: number
  material: THREE.LineDashedMaterial
}

export type SphereOfInfluenceVisual = {
  dashPatterns: SphereOfInfluenceDashPattern[]
  group: THREE.Group
}

const getDisplayColor = (bodyColor: string) =>
  new THREE.Color(bodyColor).lerp(WHITE, 0.28)

const configureVisualObject = (object: THREE.Object3D, name: string) => {
  object.name = name
  object.renderOrder = SOI_RENDER_ORDER
}

const createRing = (options: {
  color: THREE.Color
  innerRadius: number
  name: string
  opacity: number
  outerRadius: number
}) => {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(
      options.innerRadius,
      options.outerRadius,
      CIRCLE_SEGMENTS,
    ),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: options.color,
      depthWrite: false,
      opacity: options.opacity,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  configureVisualObject(ring, options.name)
  return ring
}

const createField = (radius: number, color: THREE.Color) => {
  const material = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: `
      varying vec2 vSoiUv;
      uniform vec3 uSoiColor;

      void main() {
        float radiusFromCenter = length(vSoiUv * 2.0 - 1.0);
        float interior = 1.0 - smoothstep(0.0, 0.98, radiusFromCenter);
        float outerField = smoothstep(0.38, 0.98, radiusFromCenter);
        float alpha = ${FIELD_OPACITY.toFixed(3)} * (0.32 * interior + outerField);
        gl_FragColor = vec4(uSoiColor, alpha);
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uSoiColor: { value: color },
    },
    vertexShader: `
      varying vec2 vSoiUv;

      void main() {
        vSoiUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  })
  const field = new THREE.Mesh(
    new THREE.CircleGeometry(radius, CIRCLE_SEGMENTS),
    material,
  )
  field.rotation.x = -Math.PI / 2
  configureVisualObject(field, 'soi-field-fill')
  return field
}

const createCirclePoints = (radius: number) =>
  Array.from({ length: CIRCLE_SEGMENTS + 1 }, (_, index) => {
    const angle = (index / CIRCLE_SEGMENTS) * Math.PI * 2
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius,
    )
  })

const createDashedBoundary = (
  radius: number,
  color: THREE.Color,
): {
  dashPattern: SphereOfInfluenceDashPattern
  line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>
} => {
  const material = new THREE.LineDashedMaterial({
    blending: THREE.AdditiveBlending,
    color,
    depthWrite: false,
    opacity: 0.78,
    toneMapped: false,
    transparent: true,
  })
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(createCirclePoints(radius)),
    material,
  )
  line.computeLineDistances()
  configureVisualObject(line, 'soi-dashed-boundary')
  return {
    dashPattern: {
      dashPixels: 10,
      gapPixels: 7,
      material,
    },
    line,
  }
}

const createContourSpokes = (radius: number, color: THREE.Color) => {
  const positions: number[] = []
  const spokeCount = 12

  for (let index = 0; index < spokeCount; index += 1) {
    const angle = (index / spokeCount) * Math.PI * 2
    positions.push(
      Math.cos(angle) * radius * 0.12,
      0,
      Math.sin(angle) * radius * 0.12,
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  const spokes = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.12,
      toneMapped: false,
      transparent: true,
    }),
  )
  configureVisualObject(spokes, 'soi-contour-spokes')
  return spokes
}

const addFieldVariant = (
  group: THREE.Group,
  radius: number,
  color: THREE.Color,
) => {
  group.add(
    createField(radius, color),
    createRing({
      color,
      innerRadius: radius * 0.982,
      name: 'soi-field-edge',
      opacity: 0.2,
      outerRadius: radius,
    }),
  )
}

const addBoundaryVariant = (
  group: THREE.Group,
  radius: number,
  color: THREE.Color,
) => {
  group.add(
    createRing({
      color,
      innerRadius: radius * 0.965,
      name: 'soi-boundary-glow',
      opacity: 0.06,
      outerRadius: radius,
    }),
    createRing({
      color,
      innerRadius: radius * 0.992,
      name: 'soi-boundary-band',
      opacity: 0.52,
      outerRadius: radius,
    }),
  )
}

const addContourVariant = (
  group: THREE.Group,
  radius: number,
  color: THREE.Color,
) => {
  const contourFractions = [0.25, 0.5, 0.75, 1]

  for (const [index, fraction] of contourFractions.entries()) {
    const contourRadius = radius * fraction
    const halfWidth = Math.max(radius * 0.0016, contourRadius * 0.003)
    group.add(
      createRing({
        color,
        innerRadius: contourRadius - halfWidth,
        name: `soi-contour-${index + 1}`,
        opacity: fraction === 1 ? 0.48 : 0.16 + index * 0.035,
        outerRadius: contourRadius + halfWidth,
      }),
    )
  }

  group.add(createContourSpokes(radius, color))
}

export const createSphereOfInfluenceVisual = (
  body: Body,
  variant: SphereOfInfluenceVariant,
): SphereOfInfluenceVisual => {
  if (
    body.sphereOfInfluenceRadius === undefined ||
    body.sphereOfInfluenceRadius <= 0
  ) {
    throw new Error(`Missing sphere of influence radius for ${body.id}`)
  }

  const radius = body.sphereOfInfluenceRadius * RENDER_SCALE
  const color = getDisplayColor(body.color)
  const group = new THREE.Group()
  const dashPatterns: SphereOfInfluenceDashPattern[] = []
  group.name = `${body.name} sphere of influence`
  group.userData.sphereOfInfluence = {
    bodyId: body.id,
    radiusMeters: body.sphereOfInfluenceRadius,
    variant,
  }

  if (variant === 'field') {
    addFieldVariant(group, radius, color)
  } else if (variant === 'boundary') {
    addBoundaryVariant(group, radius, color)
  } else if (variant === 'dashed') {
    const dashedBoundary = createDashedBoundary(radius, color)
    group.add(dashedBoundary.line)
    dashPatterns.push(dashedBoundary.dashPattern)
  } else {
    addContourVariant(group, radius, color)
  }

  return { dashPatterns, group }
}
