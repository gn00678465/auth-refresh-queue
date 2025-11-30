import type { AuthCoreOptions } from './AuthCore'
import type { IAdapter } from './types'
import { AuthCore } from './AuthCore'

export interface CreateAuthRetryOptions extends AuthCoreOptions {
  adapter: IAdapter
}

export interface AuthRetryInstance {
  /**
   * Handle 401 authentication errors.
   * This will refresh the token and retry queued requests.
   */
  on401: () => Promise<unknown>

  /**
   * Check if an error is an authentication error.
   */
  isAuthError: (error: unknown) => boolean

  /**
   * Update the adapter at runtime if needed.
   */
  updateAdapter: (newAdapter: IAdapter) => void
}

/**
 * Creates and configures an authentication retry system.
 * This is a convenience wrapper around AuthCore for easier setup.
 *
 * @example
 * ```ts
 * const authQueue = createAuthRetry({
 *   adapter: {
 *     refreshToken: async () => {
 *       const response = await fetch('/api/refresh')
 *       const data = await response.json()
 *       return data.token
 *     },
 *     applyToken: (token) => {
 *       localStorage.setItem('token', token)
 *     },
 *     logout: () => {
 *       localStorage.removeItem('token')
 *       window.location.href = '/login'
 *     }
 *   },
 *   shouldRefresh: (error) => error.response?.status === 401
 * })
 *
 * // Use in your HTTP interceptor
 * await authQueue.on401()
 * ```
 */
export function createAuthRetry(options: CreateAuthRetryOptions): AuthRetryInstance {
  const { adapter, ...coreOptions } = options
  const core = new AuthCore(coreOptions)
  core.registerAdapter(adapter)

  return {
    /**
     * Handle 401 authentication errors.
     * This will refresh the token and retry queued requests.
     */
    on401: () => core.on401(),

    /**
     * Check if an error is an authentication error.
     */
    isAuthError: (error: unknown) => core.isAuthError(error),

    /**
     * Update the adapter at runtime if needed.
     */
    updateAdapter: (newAdapter: IAdapter) => core.registerAdapter(newAdapter),
  }
}
