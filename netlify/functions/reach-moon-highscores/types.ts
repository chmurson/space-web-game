import type {
  ReachMoonHighscorePeriod,
  ReachMoonHighscoreRecord,
  ReachMoonHighscoreRollup,
} from '../../../src/scenario/specific-scenarios/reachMoonHighscores'

export type BlobListResult = {
  blobs: { etag: string; key: string }[]
  directories: string[]
}

export type HighscoreBlobStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown | null>
  getWithMetadata(
    key: string,
    options: { type: 'json' },
  ): Promise<{ data: unknown; etag?: string } | null>
  list(options: {
    prefix?: string
    paginate: true
  }): AsyncIterable<BlobListResult>
  list(options?: { paginate?: false; prefix?: string }): Promise<BlobListResult>
  setJSON(
    key: string,
    data: unknown,
    options?: { onlyIfMatch?: string; onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }>
}

export type PeriodRollups = Partial<
  Record<ReachMoonHighscorePeriod, ReachMoonHighscoreRollup>
>

export type ApiErrorCode =
  | 'invalid_highscore'
  | 'invalid_json'
  | 'invalid_period'
  | 'invalid_receipt_secret'
  | 'invalid_receipt'
  | 'method_not_allowed'
  | 'missing_body'
  | 'missing_receipt_secret'
  | 'storage_error'

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode
    details?: unknown
    message: string
  }
}

export type LeaderboardResponse = {
  rollups: PeriodRollups
}

export type SubmitResponse = LeaderboardResponse & {
  record: ReachMoonHighscoreRecord
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { code: ApiErrorCode; message: string; ok: false; status: number }
