export const sphereOfInfluenceVariants = [
  'gradient-zoom-compensation-0pct',
  'gradient-zoom-compensation-25pct',
  'gradient-zoom-compensation-50pct',
  'gradient-zoom-compensation-75pct',
  'gradient-zoom-compensation-100pct',
] as const

export type SphereOfInfluenceVariant =
  (typeof sphereOfInfluenceVariants)[number]

const sphereOfInfluenceVariantByFlagValue: Record<
  string,
  SphereOfInfluenceVariant
> = {
  '1': 'gradient-zoom-compensation-0pct',
  '2': 'gradient-zoom-compensation-25pct',
  '3': 'gradient-zoom-compensation-50pct',
  '4': 'gradient-zoom-compensation-75pct',
  '5': 'gradient-zoom-compensation-100pct',
}

export const parseSphereOfInfluenceVariant = (
  value: string | null,
): SphereOfInfluenceVariant | null =>
  value === null ? null : (sphereOfInfluenceVariantByFlagValue[value] ?? null)
