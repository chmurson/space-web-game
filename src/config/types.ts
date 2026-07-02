export type GameConfig = {
  assistTarget: {
    autoSelectNearestSurface: boolean
    switchRangeMultiplier: number
  }
  tabTitleSuffix?: string
  camera: {
    distance: number
    elevationDegrees: number
    viewport: {
      default: number
      minDivisor: number
      max: number
    }
    spacecraftModelZoomThreshold: number
  }
  controls: {
    autopilotRotationRate: number
    timeWarps: number[]
  }
  trajectory: {
    horizon: {
      defaultHours: number
      minHours: number
      defaultMaxHours: number
      maxHours: number
    }
    loopTrim: {
      maxRevolutions: number
    }
    rendering: {
      dashPixels: number
      gapPixels: number
      replaceLineGeometryOnUpdate: boolean
      endMarkerRadius: number
      endMarkerMinScreenRadius: number
    }
    sampling: {
      maxIntegrationStepSeconds: number
      refreshInterval: number
      targetMaxSteps: number
      stepOptionsSeconds: number[]
    }
  }
}

export type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends Array<infer Item>
    ? Item[]
    : T[Key] extends object
      ? DeepPartial<T[Key]>
      : T[Key]
}
