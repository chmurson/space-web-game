import * as THREE from 'three'

import type { SphereOfInfluenceVariant } from '../config/featureFlags'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body } from '../simulation/types'

const CIRCLE_SEGMENTS = 192
const BORDER_WIDTH_PIXELS = 1
const FIELD_OPACITY = 0.045
const SOI_RENDER_ORDER = -8
const WHITE = new THREE.Color('#ffffff')
const edgeGradientStrengthByVariant: Record<SphereOfInfluenceVariant, number> =
  {
    'field-gradient-1x': 1,
    'field-gradient-1.5x': 1.5,
    'field-gradient-2x': 2,
    'field-gradient-2.5x': 2.5,
    'field-gradient-3x': 3,
  }

export const SPHERE_OF_INFLUENCE_RENDER_LIFT = -0.08

export type SphereOfInfluenceVisual = {
  group: THREE.Group
}

const getDisplayColor = (bodyColor: string) =>
  new THREE.Color(bodyColor).lerp(WHITE, 0.28)

const configureVisualObject = (object: THREE.Object3D, name: string) => {
  object.name = name
  object.renderOrder = SOI_RENDER_ORDER
}

const createField = (
  radius: number,
  color: THREE.Color,
  edgeGradientStrength: number,
) => {
  const material = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: `
      varying vec2 vSoiUv;
      uniform vec3 uSoiColor;
      uniform float uSoiBorderWidthPixels;
      uniform float uSoiEdgeGradientStrength;

      void main() {
        float radiusFromCenter = length(vSoiUv * 2.0 - 1.0);
        float interior = 1.0 - smoothstep(0.0, 0.98, radiusFromCenter);
        float outerField = smoothstep(0.38, 0.98, radiusFromCenter);
        float alpha = ${FIELD_OPACITY.toFixed(3)} * (
          0.32 * interior + uSoiEdgeGradientStrength * outerField
        );
        float radiusGradient = length(vec2(
          dFdx(radiusFromCenter),
          dFdy(radiusFromCenter)
        ));
        float borderWidth = uSoiBorderWidthPixels * radiusGradient;
        float border = 1.0 - smoothstep(
          max(0.0, borderWidth - radiusGradient),
          borderWidth,
          1.0 - radiusFromCenter
        );
        alpha += 0.2 * border;
        gl_FragColor = vec4(uSoiColor, alpha);
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uSoiBorderWidthPixels: { value: BORDER_WIDTH_PIXELS },
      uSoiColor: { value: color },
      uSoiEdgeGradientStrength: { value: edgeGradientStrength },
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
  const edgeGradientStrength = edgeGradientStrengthByVariant[variant]
  const group = new THREE.Group()
  group.name = `${body.name} sphere of influence`
  group.userData.sphereOfInfluence = {
    bodyId: body.id,
    borderWidthPixels: BORDER_WIDTH_PIXELS,
    edgeGradientStrength,
    radiusMeters: body.sphereOfInfluenceRadius,
    variant,
  }
  group.add(createField(radius, color, edgeGradientStrength))

  return { group }
}
