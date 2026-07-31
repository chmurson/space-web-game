export const sphereOfInfluenceVariants = [
  'field-gradient-1x',
  'field-gradient-1.5x',
  'field-gradient-2x',
  'field-gradient-2.5x',
  'field-gradient-3x',
] as const

export type SphereOfInfluenceVariant =
  (typeof sphereOfInfluenceVariants)[number]

const sphereOfInfluenceVariantByFlagValue: Record<
  string,
  SphereOfInfluenceVariant
> = {
  '1': 'field-gradient-1x',
  '2': 'field-gradient-1.5x',
  '3': 'field-gradient-2x',
  '4': 'field-gradient-2.5x',
  '5': 'field-gradient-3x',
}

export const parseSphereOfInfluenceVariant = (
  value: string | null,
): SphereOfInfluenceVariant | null =>
  value === null ? null : (sphereOfInfluenceVariantByFlagValue[value] ?? null)
