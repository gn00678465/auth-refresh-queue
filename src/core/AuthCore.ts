import type { IAdapter, IAuthCore } from './types'
import { RequestQueue } from './RequestQueue'

export interface AuthCoreOptions {
  /**
   * Custom logic to determine if an error is an authentication error.
   * If not provided, the system relies on the caller to only call on401 for actual auth errors.
   */
  shouldRefresh?: (error: unknown) => boolean
}

export class AuthCore implements IAuthCore {
  private isRefreshing = false
  private queue = new RequestQueue()
  private adapter: IAdapter | null = null

  constructor(private options: AuthCoreOptions = {}) {}

  registerAdapter(adapter: IAdapter): void {
    this.adapter = adapter
  }

  /**
   * Checks if the given error matches the configured authentication error criteria.
   * If no custom logic is provided, returns true (assuming caller knows what they are doing if they use this).
   * Or maybe it should default to false?
   * Actually, if this method is used by the interceptor, it needs a default.
   * But we don't know the error structure (axios vs fetch).
   * So we can't provide a sensible default without knowing the error type.
   * So we'll just return the result of the option if present, otherwise false?
   * Or maybe this method is just a helper.
   */
  isAuthError(error: unknown): boolean {
    if (this.options.shouldRefresh) {
      return this.options.shouldRefresh(error)
    }
    // Default behavior: if no custom logic, we assume standard 401 check is done by caller
    // or we can check for status 401 if it looks like a standard error?
    // Let's keep it simple: if no predicate, we can't know.
    // But usually the interceptor has the default logic (status === 401).
    return false
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
