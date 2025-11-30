# 設計文件：核心重試機制 (Core Retry Mechanism)

## Architecture Overview

核心層 (`core`) 採用 **Observer Pattern** 與 **State Pattern** 的混合設計。它不直接發送 HTTP 請求，而是作為一個「控制器 (Controller)」，監聽 HTTP Client 回報的錯誤，並指揮 Client 進行暫停、刷新與重試。

### Components

1.  **AuthCore (Controller)**
    - 負責維護當前的認證狀態 (`TokenStatus`)。
    - 暴露 `handle401` 方法供 Adapter 呼叫。
    - 管理 `RequestQueue`。

2.  **RequestQueue**
    - 一個簡單的 FIFO 佇列，儲存待重試的請求 (Promise resolve/reject handlers 或 callback)。

3.  **Adapter Interface**
    - 為了讓 Core 能與不同的 Client 溝通，Adapter 需提供以下能力：
        - `refreshToken()`: 執行實際的刷新 Token API 呼叫。
        - `onTokenRefreshed(token)`: 當刷新成功後，更新 Client 的 Header。
        - (Optional) `logout()`: 刷新失敗時的清理動作。

### State Machine

系統主要有兩種狀態：

- **IDLE**:
    - 正常狀態。
    - 允許請求通過。
    - 當收到 `401` 時 -> 轉為 `REFRESHING`，並觸發 `refreshToken`。

- **REFRESHING**:
    - 正在刷新 Token 中。
    - 收到新的 `401` 或其他請求 -> 加入 `RequestQueue`，不觸發新的刷新。
    - 刷新成功 -> 轉為 `IDLE`，執行 `RequestQueue` 中的所有請求。
    - 刷新失敗 -> 轉為 `IDLE` (或 Error 狀態)，拒絕 `RequestQueue` 中的所有請求。

### Concurrency Handling (並發處理)

當多個請求幾乎同時遇到 401 時：
1.  第一個請求觸發 `handle401`。
2.  `AuthCore` 檢查狀態，發現是 `IDLE`，將狀態設為 `REFRESHING`，並開始呼叫 `adapter.refreshToken()`。該請求被加入佇列。
3.  第二個請求觸發 `handle401`。
4.  `AuthCore` 檢查狀態，發現是 `REFRESHING`，直接將該請求加入佇列，不進行任何操作。
5.  `adapter.refreshToken()` 完成。
6.  `AuthCore` 遍歷佇列，對每個項目執行重試邏輯 (resolve)。

## Data Structures

```typescript
type Task = {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
};

interface IAuthCore {
  // 外部呼叫此方法來回報錯誤
  on401(error: any): Promise<void>;
  
  // 註冊 Adapter
  registerAdapter(adapter: IAdapter): void;
}

interface IAdapter {
  refreshToken(): Promise<string | null>; // 回傳新 Token 或 null (失敗)
  applyToken(token: string): void; // 更新 Client 設定
}
```
