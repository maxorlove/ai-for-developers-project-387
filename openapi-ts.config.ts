import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'api/generated/openapi.json',
  output: {
    path: 'api/generated/sdk',
    importFileExtension: '.ts',
  },
  plugins: ['@hey-api/typescript', '@hey-api/sdk', '@hey-api/client-fetch', 'fastify'],
})
