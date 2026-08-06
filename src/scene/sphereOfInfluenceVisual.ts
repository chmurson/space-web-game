import * as THREE from 'three'

import type { SphereOfInfluenceVariant } from '../config/featureFlags'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body } from '../simulation/types'

const CIRCLE_SEGMENTS = 192
const BORDER_WIDTH_PIXELS = 1
const EDGE_GRADIENT_END = 0.98
const EDGE_GRADIENT_START = 0.38
const EDGE_GRADIENT_STRENGTH = 1.5
const FIELD_OPACITY = 0.045
const LOCAL_ZOOM_TAPER_START_MULTIPLIER = 10
const SOI_RENDER_ORDER = -8
const WHITE = new THREE.Color('#ffffff')
const maxZoomGradientWidthScaleByVariant: Record<
  SphereOfInfluenceVariant,
  number
> = {
  'gradient-max-zoom-width-25pct': 0.25,
  'gradient-max-zoom-width-15pct': 0.15,
  'gradient-max-zoom-width-10pct': 0.1,
  'gradient-max-zoom-width-5pct': 0.05,
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

const createField = (radius: number, color: THREE.Color) => {
  const material = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: `
      varying vec2 vSoiUv;
      uniform vec3 uSoiColor;
      uniform float uSoiBorderWidthPixels;
      uniform float uSoiEdgeGradientWidthScale;

      void main() {
        float radiusFromCenter = length(vSoiUv * 2.0 - 1.0);
        float interior = 1.0 - smoothstep(
          0.0,
          ${EDGE_GRADIENT_END.toFixed(2)},
          radiusFromCenter
        );
        float outerFieldWidth = ${(
          EDGE_GRADIENT_END - EDGE_GRADIENT_START
        ).toFixed(2)} * uSoiEdgeGradientWidthScale;
        float outerFieldStart = ${EDGE_GRADIENT_END.toFixed(2)} - outerFieldWidth;
        float outerField = smoothstep(
          outerFieldStart,
          ${EDGE_GRADIENT_END.toFixed(2)},
          radiusFromCenter
        );
        float alpha = ${FIELD_OPACITY.toFixed(3)} * (
          0.32 * interior + ${EDGE_GRADIENT_STRENGTH.toFixed(2)} * outerField
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
      uSoiEdgeGradientWidthScale: { value: 1 },
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
  const maxZoomGradientWidthScale = maxZoomGradientWidthScaleByVariant[variant]
  const group = new THREE.Group()
  group.name = `${body.name} sphere of influence`
  group.userData.sphereOfInfluence = {
    bodyId: body.id,
    borderWidthPixels: BORDER_WIDTH_PIXELS,
    edgeGradientStrength: EDGE_GRADIENT_STRENGTH,
    maxZoomGradientWidthScale,
    radiusMeters: body.sphereOfInfluenceRadius,
    variant,
  }
  group.add(createField(radius, color))

  return { group }
}

export const updateSphereOfInfluenceVisualViewport = (
  group: THREE.Group,
  options: {
    maxViewportSize: number
    minViewportSize: number
    viewportSize: number
  },
) => {
  const metadata = group.userData.sphereOfInfluence as {
    maxZoomGradientWidthScale: number
  }
  const viewportRatio = THREE.MathUtils.clamp(
    options.viewportSize / options.maxViewportSize,
    0,
    1,
  )
  const localZoomTaperStart = Math.min(
    options.maxViewportSize,
    options.minViewportSize * LOCAL_ZOOM_TAPER_START_MULTIPLIER,
  )
  let localZoomProgress = 0
  if (localZoomTaperStart > options.minViewportSize) {
    localZoomProgress =
      1 -
      THREE.MathUtils.smoothstep(
        options.viewportSize,
        options.minViewportSize,
        localZoomTaperStart,
      )
  } else if (options.viewportSize <= options.minViewportSize) {
    localZoomProgress = 1
  }
  const localGradientWidthScale = THREE.MathUtils.lerp(
    1,
    metadata.maxZoomGradientWidthScale,
    localZoomProgress,
  )
  const gradientWidthScale = viewportRatio * localGradientWidthScale
  const field = group.getObjectByName('soi-field-fill') as THREE.Mesh<
    THREE.CircleGeometry,
    THREE.ShaderMaterial
  >
  field.material.uniforms.uSoiEdgeGradientWidthScale.value = gradientWidthScale
}
