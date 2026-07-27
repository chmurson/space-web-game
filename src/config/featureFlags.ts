export const sphereOfInfluenceVariants = [
  'field',
  'boundary',
  'dashed',
  'contours',
] as const

export type SphereOfInfluenceVariant =
  (typeof sphereOfInfluenceVariants)[number]

const sphereOfInfluenceVariantByFlagValue: Record<
  string,
  SphereOfInfluenceVariant
> = {
  '1': 'field',
  '2': 'boundary',
  '3': 'dashed',
  '4': 'contours',
}

export const parseSphereOfInfluenceVariant = (
  value: string | null,
): SphereOfInfluenceVariant | null =>
  value === null ? null : (sphereOfInfluenceVariantByFlagValue[value] ?? null)
