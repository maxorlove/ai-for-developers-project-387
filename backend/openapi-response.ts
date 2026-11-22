import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Ajv2020 } from 'ajv/dist/2020.js'
import type formatsPlugin from 'ajv-formats'
import openapi from '../api/generated/openapi.json' with { type: 'json' }

const addFormats = createRequire(import.meta.url)('ajv-formats') as typeof formatsPlugin.default
const ajv = new Ajv2020({ strictSchema: false })
addFormats(ajv)
ajv.addSchema(openapi, 'booking-api')

export async function assertJsonResponse(response: Response, method: string, path: string) {
  assert.match(response.headers.get('content-type') ?? '', /^application\/json(?:;|$)/i)

  const escapedPath = path.replaceAll('~', '~0').replaceAll('/', '~1')
  const schema = ajv.getSchema(
    `booking-api#/paths/${escapedPath}/${method}/responses/${response.status}/content/application~1json/schema`,
  )
  assert.ok(schema, `OpenAPI response for ${method} ${path} (${response.status})`)

  const body: unknown = await response.json()
  assert.ok(schema(body), ajv.errorsText(schema.errors))
  return body
}
