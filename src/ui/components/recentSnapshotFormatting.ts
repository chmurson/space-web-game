export const formatRecentSnapshotSavedAt = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.valueOf()) ? date.toLocaleTimeString() : 'Unknown'
}
