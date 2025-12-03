# core-logic Specification

## Purpose
TBD - created by archiving change implement-core-retry-logic. Update Purpose after archive.
## Requirements
### Requirement: 核心狀態管理與 401 攔截
The system MUST maintain authentication state and correctly switch from IDLE to REFRESHING state when receiving a 401 error signal.

#### Scenario: 初始狀態
- **Given** `AuthCore` 剛被初始化
- **Then** 系統狀態應為 `IDLE`
- **And** 請求佇列應為空

#### Scenario: 首次偵測到 401 錯誤
- **Given** 系統狀態為 `IDLE`
- **When** 呼叫 `on401` 方法
- **Then** 系統狀態應轉變為 `REFRESHING`
- **And** 應呼叫 Adapter 的 `refreshToken` 方法
- **And** 該請求應被加入重試佇列

#### Scenario: 刷新期間偵測到後續 401 錯誤
- **Given** 系統狀態為 `REFRESHING` (正在刷新 Token)
- **When** 再次呼叫 `on401` 方法 (來自其他並發請求)
- **Then** 系統狀態應保持 `REFRESHING`
- **And** **不應** 再次呼叫 Adapter 的 `refreshToken` 方法
- **And** 該請求應被加入重試佇列

### Requirement: Token 刷新成功處理
When Token refresh succeeds, the system MUST resume service and retry all pending requests.

#### Scenario: 刷新成功
- **Given** 系統狀態為 `REFRESHING` 且佇列中有多個待重試請求
- **When** Adapter 的 `refreshToken` 方法成功回傳新的 Token
- **Then** 應呼叫 Adapter 的 `applyToken` 方法更新 Token
- **And** 佇列中的所有請求應被依序釋放 (Resolve) 以進行重試
- **And** 系統狀態應恢復為 `IDLE`

### Requirement: Token 刷新失敗處理
When Token refresh fails, the system MUST handle the error properly to avoid infinite loops.

#### Scenario: 刷新失敗
- **Given** 系統狀態為 `REFRESHING` 且佇列中有多個待重試請求
- **When** Adapter 的 `refreshToken` 方法失敗 (拋出錯誤或回傳 null)
- **Then** 佇列中的所有請求應被拒絕 (Reject)，回傳刷新失敗的錯誤
- **And** 系統狀態應恢復為 `IDLE` (或特定的 Error 狀態，視實作而定，但需確保能處理下一次登入)

### Requirement: 彈性錯誤判斷
The system MUST allow configuring custom logic to identify authentication errors **and** provide sensible defaults for common HTTP error structures when no custom logic is provided.

#### Scenario: Default Axios-Style Error Detection
- **Given** no custom `shouldRefresh` function is configured
- **When** `isAuthError` is called with an error object `{ response: { status: 401 } }`
- **Then** the system MUST return `true`
- **And** the system MUST identify this as an authentication error

#### Scenario: Default Fetch-Style Error Detection
- **Given** no custom `shouldRefresh` function is configured
- **When** `isAuthError` is called with an error object `{ status: 401 }`
- **Then** the system MUST return `true`

#### Scenario: Default Response Object Detection
- **Given** no custom `shouldRefresh` function is configured
- **When** `isAuthError` is called with a Response object where `response.status === 401`
- **Then** the system MUST return `true`

#### Scenario: Default Non-401 Error Detection
- **Given** no custom `shouldRefresh` function is configured
- **When** `isAuthError` is called with an error object `{ response: { status: 403 } }`
- **Then** the system MUST return `false`

#### Scenario: Custom Logic Overrides Default (Existing - Enhanced)
- **Given** system is configured with custom `shouldRefresh` function checking `code: 'TOKEN_EXPIRED'`
- **When** `isAuthError` receives an error with `{ status: 401 }`
- **Then** the custom logic MUST be used (not the default heuristics)
- **And** the result MUST depend on the custom function's logic

#### Scenario: 擴充錯誤判斷邏輯 (Existing - Unchanged)
- **Given** 系統配置了自定義的錯誤判斷函式 (例如：檢查 response body 中的 `code: 'TOKEN_EXPIRED'`)
- **When** 收到一個 HTTP 200 但包含 `code: 'TOKEN_EXPIRED'` 的回應
- **Then** 系統應判定此為認證錯誤
- **And** 觸發 Token 刷新流程 (轉變為 `REFRESHING` 狀態)

---

### Requirement: Queue Size Management
The system MUST prevent unbounded queue growth by enforcing configurable size limits and providing overflow protection.

#### Scenario: Queue Overflow Protection
- **Given** the queue is configured with `maxQueueSize: 10`
- **When** 10 requests are already queued
- **And** an 11th request attempts to call `on401`
- **Then** the system MUST throw an error with message containing "Queue overflow"
- **And** the error message MUST indicate the maximum size exceeded
- **And** the 11th request MUST NOT be added to the queue

#### Scenario: Default Queue Size Limit
- **Given** no `maxQueueSize` is configured
- **When** `AuthCore` is initialized
- **Then** the default maximum queue size MUST be 100
- **And** the system MUST accept up to 100 concurrent requests
- **And** the 101st request MUST trigger an overflow error

#### Scenario: Custom Queue Size Configuration
- **Given** `maxQueueSize: 5` is configured in `AuthCoreOptions`
- **When** `AuthCore` is initialized with these options
- **Then** the maximum queue size MUST be 5
- **And** overflow MUST occur on the 6th request

### Requirement: Queue State Observability
The system MUST expose read-only access to internal state for monitoring and debugging purposes.

#### Scenario: Query Current Queue Size
- **Given** 3 requests are currently queued
- **When** `authCore.queueSize` is accessed
- **Then** it MUST return `3`
- **And** subsequent additions MUST update the count immediately

#### Scenario: Query Refresh Status
- **Given** token refresh is currently in progress
- **When** `authCore.refreshing` is accessed
- **Then** it MUST return `true`
- **And** once refresh completes, it MUST return `false`

#### Scenario: Queue Size After Process
- **Given** 5 requests were queued
- **When** the queue is successfully processed
- **Then** `authCore.queueSize` MUST return `0`

#### Scenario: Queue Size After Reject All
- **Given** 5 requests were queued
- **When** the queue is rejected with an error
- **Then** `authCore.queueSize` MUST return `0`

### Requirement: Promise Resolution Semantics
The system MUST provide explicit success signals when resolving queued promises to enable verification by external code.

#### Scenario: Queue Process Resolution Value
- **Given** a request is queued and awaiting token refresh
- **When** token refresh succeeds
- **And** the queue is processed
- **Then** the queued promise MUST resolve with value `true`
- **And** external code MUST be able to verify processing occurred

#### Scenario: Multiple Requests Resolution
- **Given** 3 concurrent requests are queued
- **When** token refresh succeeds and queue is processed
- **Then** all 3 promises MUST resolve with value `true`
- **And** no promise MUST resolve with `undefined`

---

