export interface IAdapter {
  refreshToken: () => Promise<string | null>
  applyToken: (token: string) => void
  logout?: () => void
}

export interface IAuthCore {
  on401: () => Promise<unknown>
  registerAdapter: (adapter: IAdapter) => void
}

export interface Task {
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}
