import type {
  FarTrajectoryPredictionRequestPayload,
  FarTrajectoryPredictionResultPayload,
} from '../prediction/farTrajectoryPrediction'
import type { FarTrajectoryPredictionWorkerMessage } from './trajectoryPredictionWorker'

export type TrajectoryPredictionFarWorkerError = {
  jobId: number | null
  message: string
}

export type TrajectoryPredictionFarWorkerClientHandlers = {
  handleError(error: TrajectoryPredictionFarWorkerError): void
  handleResult(result: FarTrajectoryPredictionResultPayload): void
}

export type TrajectoryPredictionFarWorkerClient = {
  postRequest(request: FarTrajectoryPredictionRequestPayload): void
  terminate(): void
}

export type TrajectoryPredictionFarWorkerClientFactory = (
  handlers: TrajectoryPredictionFarWorkerClientHandlers,
) => TrajectoryPredictionFarWorkerClient

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const isWorkerMessage = (
  message: unknown,
): message is FarTrajectoryPredictionWorkerMessage =>
  typeof message === 'object' &&
  message !== null &&
  'type' in message &&
  ((message as { type: unknown }).type === 'result' ||
    (message as { type: unknown }).type === 'error')

export const createTrajectoryPredictionFarWorkerClient: TrajectoryPredictionFarWorkerClientFactory =
  (handlers) => {
    const worker = new Worker(
      new URL('./trajectoryPredictionWorker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerMessage(event.data)) {
        handlers.handleError({
          jobId: null,
          message: 'Invalid far prediction worker message',
        })
        return
      }

      if (event.data.type === 'error') {
        handlers.handleError(event.data.error)
        return
      }

      handlers.handleResult(event.data.result)
    }
    worker.onerror = (event) => {
      handlers.handleError({
        jobId: null,
        message: event.message,
      })
    }
    worker.onmessageerror = (event) => {
      handlers.handleError({
        jobId: null,
        message: getErrorMessage(event.data),
      })
    }

    return {
      postRequest: (request) => {
        worker.postMessage(request)
      },
      terminate: () => {
        worker.terminate()
      },
    }
  }
