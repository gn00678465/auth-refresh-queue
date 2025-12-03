import type { IAdapter, IAuthCore } from './types'
import { RequestQueue } from './RequestQueue'

export interface AuthCoreOptions {
  /**
   * Custom logic to determine if an error is an authentication error.
   * If not provided, the system uses default heuristics to detect common 401 error patterns.
   */
  shouldRefresh?: (error: unknown) => boolean
  /**
   * Maximum number of requests that can be queued while waiting for token refresh.
   * Defaults to 100. When exceeded, new requests will throw a queue overflow error.
   */
  maxQueueSize?: number
}

export class AuthCore implements IAuthCore {
  private isRefreshing = false
  private queue: RequestQueue
  private adapter: IAdapter | null = null

  constructor(private options: AuthCoreOptions = {}) {
    this.queue = new RequestQueue(options.maxQueueSize)
  }

  registerAdapter(adapter: IAdapter): void {
    this.adapter = adapter
  }

  /**
   * Checks if the given error matches the configured authentication error criteria.
   * If no custom logic is provided, uses default heuristics to detect common 401 error patterns:
   * - Axios-style: { response: { status: 401 } }
   * - Fetch-style: { status: 401 }
   * - Response object: response.status === 401
   */
  isAuthError(error: unknown): boolean {
    if (this.options.shouldRefresh) {
      return this.options.shouldRefresh(error)
    }

    // Default heuristics for common HTTP 401 error structures
    const err = error as any

    // Check for common patterns:
    // 1. Axios-style: { response: { status: 401 } }
    // 2. Fetch-style: { status: 401 }
    // 3. Response object: response.status === 401
    return err?.response?.status === 401
      || err?.status === 401
      || (err instanceof Response && err.status === 401)
  }

  /**
   * Check if token refresh is currently in progress.
   * Useful for debugging and monitoring.
   */
  get refreshing(): boolean {
    return this.isRefreshing
  }

  /**
   * Get the current number of queued requests.
   * Useful for monitoring queue buildup.
   */
  get queueSize(): number {
    return this.queue.size()
  }

  async on401(): Promise<unknown> {
    // If we are already refreshing, just queue the request
    if (this.isRefreshing) {
      return new Promise<unknown>((resolve, reject) => {
        this.queue.add({ resolve, reject })
      })
    }

    // Start refreshing
    this.isRefreshing = true

    // Queue the current request too, because it failed and needs retry
    const currentRequestPromise = new Promise<unknown>((resolve, reject) => {
      this.queue.add({ resolve, reject })
    })

    try {
      if (!this.adapter) {
        throw new Error('Adapter not registered')
      }

      const newToken = await this.adapter.refreshToken()

      if (newToken) {
        this.adapter.applyToken(newToken)
        this.queue.process() // Resolve all queued requests
      }
      else {
        // Refresh failed (returned null)
        this.handleRefreshFailure(new Error('Token refresh failed'))
      }
    }
    catch (refreshError) {
      this.handleRefreshFailure(refreshError)
    }
    finally {
      this.isRefreshing = false
    }

    return currentRequestPromise
  }

  private handleRefreshFailure(error: unknown): void {
    this.queue.rejectAll(error)
    if (this.adapter?.logout) {
      this.adapter.logout()
    }
  }
}
