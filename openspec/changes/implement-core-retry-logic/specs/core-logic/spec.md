# Core Logic Spec

## ADDED Requirements

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
