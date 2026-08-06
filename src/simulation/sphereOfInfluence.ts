export const calculateSphereOfInfluenceRadius = (options: {
  bodyMass: number
  orbitalSemiMajorAxis: number
  primaryMass: number
}) =>
  options.orbitalSemiMajorAxis *
  (options.bodyMass / options.primaryMass) ** (2 / 5)
