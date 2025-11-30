# Retry API Core

這是一個通用的認證重試核心邏輯庫 (Authentication Retry Core)，旨在解決前端應用程式中處理 Token 過期 (401 Unauthorized) 與自動刷新 Token 的複雜狀態管理問題。

它不依賴於特定的 HTTP Client (如 Axios, Fetch, Nuxt $fetch)，而是透過 **Adapter 模式** 與 **狀態機** 來管理刷新流程與並發請求佇列。

## 特性

- **框架無關**: 可與 Axios, Fetch, Nuxt 等任何 HTTP Client 整合。
- **並發處理**: 當多個請求同時遇到 401 時，只會發送一次刷新 Token 請求，其餘請求會進入佇列等待。
- **狀態管理**: 自動處理 `IDLE` 與 `REFRESHING` 狀態切換。
- **彈性配置**: 支援自定義錯誤判斷邏輯 (不僅限於 HTTP 401)。

## 安裝

```bash
npm install auth-refresh-queue
# 或
pnpm add auth-refresh-queue
```

## 使用方式

### 快速開始 (推薦)

使用 `createAuthRetry` 函數可以快速設定認證重試系統，這是最簡單的使用方式：

```typescript
import { createAuthRetry } from 'auth-refresh-queue/core';

const authQueue = createAuthRetry({
  adapter: {
    refreshToken: async () => {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      return data.accessToken;
    },
    applyToken: (token) => {
      localStorage.setItem('token', token);
    },
    logout: () => {
      localStorage.removeItem('token');
      window.location.href = '/login';
    },
  },
  shouldRefresh: (error) => {
    return error.response?.status === 401 && 
           !error.config?.url?.includes('/auth/refresh');
  },
});

// 在 HTTP Client 攔截器中使用
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (authQueue.isAuthError(error)) {
      await authQueue.on401();
      // 重試原請求
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 進階使用 - 手動配置

如果需要更細緻的控制，可以手動使用 `AuthCore` 類別。

#### 1. 實作 Adapter

首先，你需要實作 `IAdapter` 介面，告訴 Core 如何刷新 Token 以及如何應用新 Token。

```typescript
import { IAdapter } from 'auth-refresh-queue/core';

class MyAxiosAdapter implements IAdapter {
  // 實作刷新 Token 的邏輯
  async refreshToken(): Promise<string | null> {
    try {
      const response = await axios.post('/api/auth/refresh');
      return response.data.accessToken;
    } catch (error) {
      return null; // 刷新失敗
    }
  }

  // 當刷新成功後，更新全域設定 (例如 Axios header)
  applyToken(token: string): void {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // 也可以在這裡更新 LocalStorage 或 Vuex/Pinia 狀態
  }

  // (選用) 當刷新失敗時的清理動作
  logout(): void {
    window.location.href = '/login';
  }
}
```

#### 2. 初始化 AuthCore 並註冊 Adapter

```typescript
import { AuthCore } from 'auth-refresh-queue/core';

// 初始化
const authCore = new AuthCore({
  // (選用) 自定義判斷是否需要刷新的邏輯
  // 設定此選項後，可使用 authCore.isAuthError(error) 來統一判斷
  // 注意：務必排除刷新 Token 本身的 API (如 /auth/refresh)，以免造成無窮迴圈
  shouldRefresh: (error) => {
    return error.response?.status === 401 && 
           !error.config.url.includes('/auth/refresh');
  },
});

// 註冊 Adapter
const adapter = new MyAxiosAdapter();
authCore.registerAdapter(adapter);
```

#### 3. 整合至 HTTP Client 攔截器 (Interceptor)

在你的 HTTP Client 的 Response Interceptor 中呼叫 `authCore.on401(error)`。

#### Axios 範例

```typescript
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 判斷是否為認證錯誤
    // 如果有設定 shouldRefresh，建議使用 authCore.isAuthError(error)
    // 否則可直接判斷 error.response?.status === 401
    if (authCore.isAuthError(error)) {
      try {
        // 呼叫核心邏輯，這會回傳一個 Promise
        // 當 Token 刷新成功後，這個 Promise 會 resolve
        await authCore.on401(error);

        // 刷新成功後，重試原本的請求
        // 注意：這時 axios.defaults.headers 已經被 adapter.applyToken 更新了
        // 但原本的 config.headers 可能還是舊的，需視情況更新
        const config = error.config;
        config.headers['Authorization'] = axios.defaults.headers.common['Authorization'];
        return axios(config);
      } catch (refreshError) {
        // 刷新失敗，通常 Adapter.logout() 已經被呼叫
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
```

## 使用範例

### Fetch API 範例

```typescript
import { createAuthRetry } from 'auth-refresh-queue/core';

const authQueue = createAuthRetry({
  adapter: {
    refreshToken: async () => {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.accessToken;
    },
    applyToken: (token) => {
      localStorage.setItem('access_token', token);
    },
    logout: () => {
      localStorage.clear();
      window.location.href = '/login';
    },
  },
  shouldRefresh: (error) => error?.status === 401,
});

// 包裝 fetch
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('access_token');
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (response.status === 401) {
    await authQueue.on401();
    // 重試
    const newToken = localStorage.getItem('access_token');
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      },
    });
  }

  return response;
}
```

### Nuxt 3 / $fetch 範例

```typescript
// plugins/auth-retry.ts
import { createAuthRetry } from 'auth-refresh-queue/core';

export default defineNuxtPlugin(() => {
  const authQueue = createAuthRetry({
    adapter: {
      refreshToken: async () => {
        const { data } = await $fetch('/api/auth/refresh', {
          method: 'POST',
        });
        return data.accessToken;
      },
      applyToken: (token) => {
        const cookie = useCookie('token');
        cookie.value = token;
      },
      logout: () => {
        navigateTo('/login');
      },
    },
    shouldRefresh: (error) => error?.statusCode === 401,
  });

  // 設置全域攔截器
  const { $fetch } = useNuxtApp();
  
  return {
    provide: {
      authQueue,
    },
  };
});
```

## API 參考

### `createAuthRetry(options)`

**便捷函數**，用於快速建立並配置認證重試系統。

#### 參數

- `options: CreateAuthRetryOptions`
  - `adapter: IAdapter` - 必填。適配器實例，定義如何刷新和應用 Token
  - `shouldRefresh?: (error: unknown) => boolean` - 選用。自定義判斷錯誤是否觸發刷新的邏輯

#### 返回值

返回 `AuthRetryInstance` 物件，包含以下方法：

- `on401(): Promise<unknown>` - 處理 401 認證錯誤，自動刷新 Token 並重試佇列中的請求
- `isAuthError(error: unknown): boolean` - 判斷錯誤是否為認證錯誤
- `updateAdapter(newAdapter: IAdapter): void` - 在運行時更新適配器

#### 範例

```typescript
const authQueue = createAuthRetry({
  adapter: {
    refreshToken: async () => {
      const res = await fetch('/api/refresh');
      const data = await res.json();
      return data.token;
    },
    applyToken: (token) => {
      localStorage.setItem('token', token);
    },
    logout: () => {
      window.location.href = '/login';
    },
  },
  shouldRefresh: (error) => error?.response?.status === 401,
});

// 使用
await authQueue.on401();
```

### `AuthCore`

#### `constructor(options?: AuthCoreOptions)`

- `options.shouldRefresh`: `(error: any) => boolean`
  - 選用。自定義判斷錯誤是否觸發刷新的邏輯。

#### `registerAdapter(adapter: IAdapter): void`

- 註冊適配器。必須在使用 `on401` 前呼叫。

#### `on401(error: any): Promise<void>`

- 當發生認證錯誤時呼叫此方法。
- 如果系統處於 `IDLE` 狀態，會切換至 `REFRESHING` 並呼叫 `adapter.refreshToken()`。
- 如果系統已處於 `REFRESHING` 狀態，會將請求加入佇列。
- 回傳的 Promise 會在 Token 刷新成功後 resolve，或在失敗時 reject。

#### `isAuthError(error: any): boolean`

- 根據建構時傳入的 `shouldRefresh` 邏輯判斷錯誤是否為認證錯誤。

### `IAdapter`

- `refreshToken(): Promise<string | null>`: 執行刷新 API。回傳新 Token 字串，失敗回傳 `null`。
- `applyToken(token: string): void`: 應用新 Token (如更新 Header)。
- `logout?(): void`: (選用) 刷新失敗時的登出處理。

## 常見問題

### 如何避免刷新 API 本身觸發無窮迴圈？

在 `shouldRefresh` 中排除刷新 Token 的 API：

```typescript
shouldRefresh: (error) => {
  return error.response?.status === 401 && 
         !error.config?.url?.includes('/auth/refresh');
}
```

### 如何在多個 HTTP Client 中使用同一個 authQueue 實例？

將 `authQueue` 實例導出並在需要的地方引用：

```typescript
// auth.ts
export const authQueue = createAuthRetry({ /* ... */ });

// axios-client.ts
import { authQueue } from './auth';
axios.interceptors.response.use(/* ... */);

// fetch-client.ts
import { authQueue } from './auth';
// 使用同一個實例
```

### Token 刷新失敗後會發生什麼？

1. 所有佇列中的請求都會被 reject
2. 如果 adapter 有定義 `logout()` 方法，會自動呼叫
3. 你可以在 interceptor 的 catch block 中處理後續邏輯

## 授權

MIT
