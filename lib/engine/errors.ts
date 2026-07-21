export type EngineErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'GAME_NOT_FOUND'
  | 'INVALID_ACTION'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CODE_EXHAUSTED'

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'EngineError'
  }
}
export function engineErrorResponse(error: unknown): {
  error: { code: string; message: string }
  status: number
} {
  if (error instanceof EngineError) {
    return {
      error: { code: error.code, message: error.message },
      status: error.status,
    }
  }

  console.error(error)
  return {
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    status: 500,
  }
}
