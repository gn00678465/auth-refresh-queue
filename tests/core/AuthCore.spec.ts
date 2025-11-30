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

    const promise = authCore.on401(new Error('401'))

    expect(adapter.refreshToken).toHaveBeenCalled()
    await expect(promise).resolves.toBeUndefined()
    expect(adapter.applyToken).toHaveBeenCalledWith('new-token')
  })

  it('should queue concurrent requests', async () => {
    // Make refreshToken slow
    (adapter.refreshToken as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('new-token'), 10)))

    const p1 = authCore.on401(new Error('401-1'))
    const p2 = authCore.on401(new Error('401-2'))

    expect(adapter.refreshToken).toHaveBeenCalledTimes(1)

    await Promise.all([p1, p2])

    expect(adapter.applyToken).toHaveBeenCalledWith('new-token')
  })

  it('should handle refresh failure', async () => {
    (adapter.refreshToken as any).mockRejectedValue(new Error('Refresh failed'))

    const p1 = authCore.on401(new Error('401'))

    await expect(p1).rejects.toThrow('Refresh failed')
    expect(adapter.logout).toHaveBeenCalled()
  })

  it('should handle refresh returning null', async () => {
    (adapter.refreshToken as any).mockResolvedValue(null)

    const p1 = authCore.on401(new Error('401'))

    await expect(p1).rejects.toThrow('Token refresh failed')
    expect(adapter.logout).toHaveBeenCalled()
  })

  it('should use custom error logic if provided', () => {
    const shouldRefresh = vi.fn().mockReturnValue(true)
    const core = new AuthCore({ shouldRefresh })

    expect(core.isAuthError({ status: 401 })).toBe(true)
    expect(shouldRefresh).toHaveBeenCalledWith({ status: 401 })
  })
})
