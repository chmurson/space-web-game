import {
  createFarTrajectoryPredictor,
  type FarTrajectoryPredictionRequestPayload,
  type FarTrajectoryPredictionResultPayload,
} from '../prediction/farTrajectoryPrediction'
import { getErrorMessage } from './errorMessage'

export type FarTrajectoryPredictionWorkerMessage =
  | {
      result: FarTrajectoryPredictionResultPayload
      type: 'result'
    }
  | {
      error: {
        jobId: number
        message: string
      }
      type: 'error'
    }

const workerScope = self as unknown as {
  onmessage:
    | ((event: MessageEvent<FarTrajectoryPredictionRequestPayload>) => void)
    | null
  postMessage(message: FarTrajectoryPredictionWorkerMessage): void
}
const predictFarTrajectory = createFarTrajectoryPredictor()

workerScope.onmessage = (
  event: MessageEvent<FarTrajectoryPredictionRequestPayload>,
) => {
  try {
    workerScope.postMessage({
      result: predictFarTrajectory(event.data),
      type: 'result',
    })
  } catch (error) {
    workerScope.postMessage({
      error: {
        jobId: event.data.jobId,
        message: getErrorMessage(error),
      },
      type: 'error',
    })
  }
}
