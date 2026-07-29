export const sphereOfInfluenceVariants = [
  'field-1px',
  'field-2px',
  'field-3px',
  'field-4px',
] as const

export type SphereOfInfluenceVariant =
  (typeof sphereOfInfluenceVariants)[number]

const sphereOfInfluenceVariantByFlagValue: Record<
  string,
  SphereOfInfluenceVariant
> = {
  '1': 'field-1px',
  '2': 'field-2px',
  '3': 'field-3px',
  '4': 'field-4px',
}

export const parseSphereOfInfluenceVariant = (
  value: string | null,
): SphereOfInfluenceVariant | null =>
  value === null ? null : (sphereOfInfluenceVariantByFlagValue[value] ?? null)
