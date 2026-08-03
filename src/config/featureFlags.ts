export const sphereOfInfluenceVariants = [
  'gradient-max-zoom-width-25pct',
  'gradient-max-zoom-width-15pct',
  'gradient-max-zoom-width-10pct',
  'gradient-max-zoom-width-5pct',
] as const

export type SphereOfInfluenceVariant =
  (typeof sphereOfInfluenceVariants)[number]

const sphereOfInfluenceVariantByFlagValue: Record<
  string,
  SphereOfInfluenceVariant
> = {
  '1': 'gradient-max-zoom-width-25pct',
  '2': 'gradient-max-zoom-width-15pct',
  '3': 'gradient-max-zoom-width-10pct',
  '4': 'gradient-max-zoom-width-5pct',
}

export const parseSphereOfInfluenceVariant = (
  value: string | null,
): SphereOfInfluenceVariant | null =>
  value === null ? null : (sphereOfInfluenceVariantByFlagValue[value] ?? null)
