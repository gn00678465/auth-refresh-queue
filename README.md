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
npm install retry-api
# 或
pnpm add retry-api
```

## 使用方式

### 1. 實作 Adapter

首先，你需要實作 `IAdapter` 介面，告訴 Core 如何刷新 Token 以及如何應用新 Token。

```typescript
import { IAdapter } from 'retry-api/core';

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

### 2. 初始化 AuthCore 並註冊 Adapter

```typescript
import { AuthCore } from 'retry-api/core';

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

### 3. 整合至 HTTP Client 攔截器 (Interceptor)

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

## API 參考

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
