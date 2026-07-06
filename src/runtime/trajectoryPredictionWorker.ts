import {
  type FarTrajectoryPredictionRequestPayload,
  type FarTrajectoryPredictionResultPayload,
  predictFarTrajectory,
} from '../prediction/farTrajectoryPrediction'

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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const workerScope = self as unknown as {
  onmessage:
    | ((event: MessageEvent<FarTrajectoryPredictionRequestPayload>) => void)
    | null
  postMessage(message: FarTrajectoryPredictionWorkerMessage): void
}

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
