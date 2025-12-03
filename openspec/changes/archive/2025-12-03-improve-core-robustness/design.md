# Design Document: Core Robustness Improvements

## Overview
This document details the technical design decisions for improving the robustness of the authentication retry core logic.

## Problem Analysis

### 1. Promise Resolution Semantics (Critical)
**Current Behavior:**
```typescript
process(): void {
  this.queue.forEach(task => task.resolve())  // Resolves with undefined
  this.clear()
}
```

**Issue:** Promises resolve with `undefined`, which provides no semantic information about success.

**Impact:** External code cannot distinguish between "queue processed" vs "queue cleared without processing".

**Decision:** Resolve with `true` to provide explicit success signal.

**Rationale:**
- Boolean `true` is a clear, unambiguous success indicator
- Maintains simple API (no complex return types needed)
- Allows external code to verify queue processing occurred
- Minimal breaking change risk (most code doesn't check the resolved value)

### 2. Default Error Detection (Medium)
**Current Behavior:**
```typescript
isAuthError(error: unknown): boolean {
  if (this.options.shouldRefresh) {
    return this.options.shouldRefresh(error)
  }
  return false  // Always false if no custom logic
}
```

**Issue:** Returns `false` for all errors when `shouldRefresh` is not provided, making the method nearly useless as a default.

**Impact:** Users must always provide `shouldRefresh`, reducing out-of-the-box utility.

**Decision:** Implement heuristic-based default detection for common HTTP error structures.

**Design:**
```typescript
isAuthError(error: unknown): boolean {
  if (this.options.shouldRefresh) {
    return this.options.shouldRefresh(error)
  }
  
  // Default heuristics for common error structures
  const err = error as any
  
  // Check for common HTTP 401 patterns:
  // 1. Axios-style: { response: { status: 401 } }
  // 2. Fetch-style: { status: 401 }
  // 3. Response object: response.status === 401
  return err?.response?.status === 401 || 
         err?.status === 401 ||
         (err instanceof Response && err.status === 401)
}
```

**Rationale:**
- Covers majority of HTTP client error structures
- Still allows custom logic via `shouldRefresh`
- Fails safe (false positives unlikely, false negatives covered by custom logic)
- Improves developer experience for simple use cases

**Trade-offs Considered:**
- **Alternative 1:** Throw error if no `shouldRefresh` provided
  - Rejected: Too strict, breaks ease-of-use
- **Alternative 2:** Try to detect all possible error structures
  - Rejected: Impossible to be comprehensive, adds maintenance burden
- **Alternative 3:** Keep returning `false`
  - Rejected: Poor developer experience

### 3. Queue Overflow Protection (Medium)
**Current Behavior:** Unlimited queue growth.

**Issue:** In high-traffic scenarios with refresh failures, queue can grow unbounded.

**Decision:** Add configurable `maxQueueSize` with safe default.

**Design:**
```typescript
// In AuthCoreOptions
export interface AuthCoreOptions {
  shouldRefresh?: (error: unknown) => boolean
  maxQueueSize?: number  // Default: 100
}

// In RequestQueue
export class RequestQueue {
  private queue: Task[] = []
  private maxSize: number
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }
  
  add(task: Task): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error(`Queue overflow: maximum size of ${this.maxSize} exceeded`)
    }
    this.queue.push(task)
  }
}
```

**Rationale:**
- Default of 100 is reasonable for most applications
- Fail-fast behavior prevents silent memory issues
- Configurable for high-traffic scenarios
- Error message is clear and actionable

**Trade-offs Considered:**
- **Alternative 1:** Reject oldest tasks when full
  - Rejected: Silently dropping requests is dangerous
- **Alternative 2:** Use a circular buffer
  - Rejected: Adds complexity, overflow should be rare
- **Alternative 3:** No limit
  - Rejected: Current state, proven problematic

### 4. Observability Improvements (Low)
**Issue:** No way to inspect internal state for debugging/monitoring.

**Decision:** Add read-only state accessors.

**Design:**
```typescript
export class AuthCore implements IAuthCore {
  // ... existing code ...
  
  /**
   * Check if token refresh is currently in progress.
   * Useful for debugging and monitoring.
   */
  get refreshing(): boolean {
    return this.isRefreshing
  }
  
  /**
   * Get the current number of queued requests.
   * Useful for monitoring queue buildup.
   */
  get queueSize(): number {
    return this.queue.size()
  }
}

export class RequestQueue {
  // ... existing code ...
  
  /**
   * Get current queue size.
   */
  size(): number {
    return this.queue.length
  }
}
```

**Rationale:**
- Getters provide read-only access (no mutation risk)
- Essential for production debugging
- Enables metrics collection
- Minimal API surface expansion

## Implementation Strategy

### Phase 1: Foundation (Queue Improvements)
1. Update `RequestQueue` constructor to accept `maxSize`
2. Implement overflow check in `add()`
3. Add `size()` method
4. Update `process()` to resolve with `true`
5. Add comprehensive tests

### Phase 2: Core Improvements (AuthCore)
1. Update `AuthCore` constructor to pass `maxQueueSize` to queue
2. Implement default `isAuthError()` heuristics
3. Add `refreshing` and `queueSize` getters
4. Update tests for new behaviors

### Phase 3: Integration
1. Update `createAuthRetry` to expose new options
2. Ensure backward compatibility
3. Run full test suite
4. Validate with ESLint

## Testing Strategy

### Unit Tests - RequestQueue
- ✅ Existing: add, clear, process, rejectAll
- 🆕 Queue overflow when exceeding maxSize
- 🆕 Process resolves with true
- 🆕 size() returns accurate count
- 🆕 Custom maxSize configuration

### Unit Tests - AuthCore
- ✅ Existing: Basic refresh flow, concurrent requests, failures
- 🆕 Default isAuthError detects axios-style errors
- 🆕 Default isAuthError detects fetch-style errors
- 🆕 Default isAuthError detects Response objects
- 🆕 Custom shouldRefresh overrides defaults
- 🆕 refreshing getter reflects state accurately
- 🆕 queueSize getter reflects queue accurately
- 🆕 Queue overflow during refresh triggers error

### Integration Tests
- 🆕 High concurrency scenarios (simulate 100+ concurrent requests)
- 🆕 Queue overflow recovery
- 🆕 Monitoring getters during full refresh cycle

## Backward Compatibility

### Guaranteed Compatible
- ✅ All existing constructor signatures remain valid
- ✅ All existing method signatures unchanged
- ✅ Default behavior changes are additive (new capabilities)
- ✅ Optional configuration parameters

### Potential Issues (Mitigated)
- ⚠️ `process()` now resolves with `true` instead of `undefined`
  - **Mitigation:** Very unlikely anyone checks this value
  - **Detection:** Tests would fail if this is relied upon
- ⚠️ `isAuthError()` may return `true` where it returned `false` before
  - **Mitigation:** Only affects code that didn't provide `shouldRefresh` and called `isAuthError()` directly
  - **Detection:** Tests should cover this scenario

## Performance Considerations

### Memory
- **Impact:** Minimal - only adds one number (maxSize) and getter methods
- **Improvement:** Overflow protection prevents unbounded growth

### CPU
- **Impact:** Negligible - heuristic checks are simple property accesses
- **Improvement:** None, but not degraded

### Network
- **Impact:** None - no changes to network behavior

## Security Considerations
- No authentication logic changes
- No sensitive data exposure through getters
- Overflow protection prevents potential DoS via queue exhaustion

## Monitoring & Metrics
After this change, applications can:
- Track `queueSize` over time to detect issues
- Monitor `refreshing` state duration
- Alert on queue overflow errors
- Correlate refresh failures with queue buildup

## Rollout Plan
1. Merge changes to main branch
2. Release as minor version (backward compatible)
3. Update documentation with new options
4. Monitor for unexpected issues
5. Gather feedback on default behaviors

## Future Enhancements (Out of Scope)
- Configurable overflow behavior (reject vs queue)
- Metrics/telemetry hooks
- Retry logic within core
- Advanced queue strategies (priority, TTL)
