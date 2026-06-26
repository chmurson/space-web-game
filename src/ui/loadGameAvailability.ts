import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'

export const isLoadGameAvailable = () => readDebugScenarioSnapshot() !== null

export const runLoadGameAction = (action: () => void) => {
  if (!isLoadGameAvailable()) {
    return false
  }

  action()
  return true
}
