import type { ApiRequest, ApiResponse, MockResponse, ResponseHeader } from '../types/api'

const FALLBACK_HEADERS: ResponseHeader[] = [
  { key: 'content-type', value: 'application/json; charset=utf-8' },
  { key: 'x-powered-by', value: 'Ozai Mock Server' }
]

const byteSize = (value: string): number => {
  try {
    return new TextEncoder().encode(value).length / 1024
  } catch {
    return value.length / 1024
  }
}

/** True when this request has an example response captured from an OpenAPI contract. */
export function hasMockExample(request: ApiRequest): boolean {
  return Boolean(request.mockResponse)
}

const fallbackMock = (request: ApiRequest, url: string): MockResponse => ({
  status: 200,
  statusText: 'OK',
  headers: FALLBACK_HEADERS,
  body: JSON.stringify(
    {
      success: true,
      message: 'This is a generated fallback mock response. Import an OpenAPI contract to get real examples.',
      request: {
        method: request.method,
        url: url || request.url
      },
      data: {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date().toISOString()
      }
    },
    null,
    2
  )
})

/**
 * Returns the request's mock response without touching the network.
 * The small delay keeps the loading state honest during demos.
 */
export function sendMockRequest(request: ApiRequest, resolvedUrl: string): Promise<ApiResponse> {
  const mock = request.mockResponse ?? fallbackMock(request, resolvedUrl)
  const delay = 220 + Math.round(Math.random() * 260)

  return new Promise((resolve) => {
    setTimeout(() => {
      const body = request.method === 'HEAD' ? '' : mock.body
      resolve({
        status: mock.status,
        statusText: mock.statusText,
        headers: mock.headers,
        body,
        timeMs: delay,
        sizeKb: byteSize(body),
        mocked: true
      })
    }, delay)
  })
}
