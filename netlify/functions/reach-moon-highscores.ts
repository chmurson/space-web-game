import { handleGet } from './reach-moon-highscores/get'
import { handlePost } from './reach-moon-highscores/post'
import { createErrorResponse } from './reach-moon-highscores/responses'

export const config = {
  path: [
    '/api/reach-moon/highscores',
    '/.netlify/functions/reach-moon-highscores',
  ],
  rateLimit: {
    aggregateBy: ['ip', 'domain'],
    windowLimit: 120,
    windowSize: 60,
  },
}

export default async function handler(request: Request): Promise<Response> {
  const now = new Date()

  if (request.method === 'GET') {
    return handleGet(request, now)
  }
  if (request.method === 'POST') {
    return handlePost(request, now)
  }

  const response = createErrorResponse(
    405,
    'method_not_allowed',
    'Use GET to read highscores or POST to submit one.',
  )
  response.headers.set('allow', 'GET, POST')

  return response
}
