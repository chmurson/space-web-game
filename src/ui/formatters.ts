import type { BodyInfluence } from "../simulation/bodyInfluence";

export const formatDistance = (meters: number) => {
  if (meters >= 1_000_000) {
    return `${Math.round(meters / 1_000_000).toLocaleString()} Mm`;
  }

  return `${Math.round(meters / 1_000).toLocaleString()} km`;
};

export const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  if (seconds >= 24 * 3600) {
    return `${(seconds / (24 * 3600)).toLocaleString(undefined, { maximumFractionDigits: 1 })}d`;
  }

  return `${(seconds / 3600).toFixed(1)}h`;
};

export const formatSpecificEnergy = (energy: number) => `${(energy / 1_000).toFixed(1)} kJ/kg`;

export const formatAcceleration = (acceleration: number) => {
  if (acceleration >= 0.01) {
    return acceleration.toFixed(3);
  }
  if (acceleration >= 0.0001) {
    return acceleration.toFixed(5);
  }

  return acceleration.toExponential(2);
};

export const formatBodyInfluences = (influences: BodyInfluence[]) =>
  influences
    .map((influence) => `${influence.body.name} ${formatAcceleration(influence.acceleration)} m/s^2 (${(influence.share * 100).toFixed(1)}%)`)
    .join(" | ");
