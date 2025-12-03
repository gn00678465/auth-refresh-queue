# core-logic Specification Deltas

This file contains modifications to the core-logic capability specification.

---

## ADDED Requirements

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

## MODIFIED Requirements

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

## Notes
- All existing requirements remain valid and unchanged unless explicitly listed under MODIFIED
- The MODIFIED requirement enhances the existing "彈性錯誤判斷" by adding default behavior
- All changes are backward compatible - existing custom logic continues to work
- New capabilities are opt-in via configuration or usage of new APIs
