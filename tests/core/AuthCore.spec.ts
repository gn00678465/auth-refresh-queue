import type { IAdapter } from '../../src/core/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthCore } from '../../src/core/AuthCore'

describe('authCore', () => {
  let authCore: AuthCore
  let adapter: IAdapter

  beforeEach(() => {
    authCore = new AuthCore()
    adapter = {
      refreshToken: vi.fn(),
      applyToken: vi.fn(),
      logout: vi.fn(),
    }
    authCore.registerAdapter(adapter)
  })

  it('should trigger refresh on 401', async () => {
    (adapter.refreshToken as any).mockResolvedValue('new-token')

    const promise = authCore.on401()

    expect(adapter.refreshToken).toHaveBeenCalled()
    await expect(promise).resolves.toBe(true)
    expect(adapter.applyToken).toHaveBeenCalledWith('new-token')
  })

  it('should queue concurrent requests', async () => {
    // Make refreshToken slow
    (adapter.refreshToken as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('new-token'), 10)))

    const p1 = authCore.on401()
    const p2 = authCore.on401()

    expect(adapter.refreshToken).toHaveBeenCalledTimes(1)

    await Promise.all([p1, p2])

    expect(adapter.applyToken).toHaveBeenCalledWith('new-token')
  })

  it('should handle refresh failure', async () => {
    (adapter.refreshToken as any).mockRejectedValue(new Error('Refresh failed'))

    const p1 = authCore.on401()

    await expect(p1).rejects.toThrow('Refresh failed')
    expect(adapter.logout).toHaveBeenCalled()
  })

  it('should handle refresh returning null', async () => {
    (adapter.refreshToken as any).mockResolvedValue(null)

    const p1 = authCore.on401()

    await expect(p1).rejects.toThrow('Token refresh failed')
    expect(adapter.logout).toHaveBeenCalled()
  })

  it('should use custom error logic if provided', () => {
    const shouldRefresh = vi.fn().mockReturnValue(true)
    const core = new AuthCore({ shouldRefresh })

    expect(core.isAuthError({ status: 401 })).toBe(true)
    expect(shouldRefresh).toHaveBeenCalledWith({ status: 401 })
  })

  it('should detect axios-style 401 errors by default', () => {
    const core = new AuthCore()
    const axiosError = { response: { status: 401 } }

    expect(core.isAuthError(axiosError)).toBe(true)
  })

  it('should detect fetch-style 401 errors by default', () => {
    const core = new AuthCore()
    const fetchError = { status: 401 }

    expect(core.isAuthError(fetchError)).toBe(true)
  })

  it('should detect Response object 401 errors by default', () => {
    const core = new AuthCore()
    const response = new Response(null, { status: 401 })

    expect(core.isAuthError(response)).toBe(true)
  })

  it('should return false for non-401 errors by default', () => {
    const core = new AuthCore()
    const error403 = { response: { status: 403 } }
    const error500 = { status: 500 }

    expect(core.isAuthError(error403)).toBe(false)
    expect(core.isAuthError(error500)).toBe(false)
  })

  it('custom shouldRefresh overrides default detection', () => {
    const shouldRefresh = vi.fn().mockReturnValue(false)
    const core = new AuthCore({ shouldRefresh })
    const axiosError = { response: { status: 401 } }

    // Even though it's a 401, custom logic returns false
    expect(core.isAuthError(axiosError)).toBe(false)
    expect(shouldRefresh).toHaveBeenCalledWith(axiosError)
  })

  it('refreshing getter reflects state accurately during lifecycle', async () => {
    (adapter.refreshToken as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('new-token'), 10)))

    expect(authCore.refreshing).toBe(false)

    const promise = authCore.on401()
    expect(authCore.refreshing).toBe(true)

    await promise
    expect(authCore.refreshing).toBe(false)
  })

  it('queueSize getter reflects queue accurately during lifecycle', async () => {
    (adapter.refreshToken as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('new-token'), 20)))

    expect(authCore.queueSize).toBe(0)

    const p1 = authCore.on401()
    expect(authCore.queueSize).toBe(1)

    const p2 = authCore.on401()
    const p3 = authCore.on401()
    expect(authCore.queueSize).toBe(3)

    await Promise.all([p1, p2, p3])
    expect(authCore.queueSize).toBe(0)
  })

  it('queue overflow during concurrent requests throws error', async () => {
    const core = new AuthCore({ maxQueueSize: 5 })
    core.registerAdapter(adapter)

    ;(adapter.refreshToken as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('new-token'), 50)))

    // Start first request - starts refresh
    const p1 = core.on401()

    // Add 4 more - fills queue to max (total 5)
    const p2 = core.on401()
    const p3 = core.on401()
    const p4 = core.on401()
    const p5 = core.on401()

    // 6th request should throw
    await expect(core.on401()).rejects.toThrow('Queue overflow: maximum size of 5 exceeded')

    // Clean up
    await Promise.all([p1, p2, p3, p4, p5])
  })
})
