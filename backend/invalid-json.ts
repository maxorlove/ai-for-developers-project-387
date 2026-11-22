import type { FastifyError } from 'fastify'
import type { ValidationError } from '../api/generated/sdk/index.ts'

export function invalidJsonResponse(error: FastifyError, message: string): ValidationError {
  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
    return { code: 'validation_error', message }
  }

  throw error
}
