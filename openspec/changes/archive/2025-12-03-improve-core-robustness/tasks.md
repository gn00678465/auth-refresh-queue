# Implementation Tasks

This document outlines the ordered implementation tasks for the core robustness improvements.

## Phase 1: RequestQueue Enhancements

### Task 1.1: Add Queue Size Limit Configuration
- [x] Update `RequestQueue` constructor to accept optional `maxSize` parameter (default: 100)
- [x] Store `maxSize` as private property
- [x] **Validation**: Constructor accepts parameter and stores it correctly
- [x] **Files**: `src/core/RequestQueue.ts`

### Task 1.2: Implement Overflow Protection
- [x] Add overflow check at the start of `add()` method
- [x] Throw descriptive error when queue length >= maxSize
- [x] Error message must include the maximum size value
- [x] **Validation**: Test that 101st request throws error with default config
- [x] **Files**: `src/core/RequestQueue.ts`

### Task 1.3: Add Queue Size Accessor
- [x] Implement public `size()` method that returns `queue.length`
- [x] **Validation**: Method returns accurate count before and after operations
- [x] **Files**: `src/core/RequestQueue.ts`

### Task 1.4: Fix Promise Resolution Semantics
- [x] Update `process()` to call `task.resolve(true)` instead of `task.resolve()`
- [x] **Validation**: Resolved promises receive `true` value
- [x] **Files**: `src/core/RequestQueue.ts`

### Task 1.5: Test RequestQueue Changes
- [x] Add test: "should enforce default max queue size of 100"
- [x] Add test: "should enforce custom max queue size"
- [x] Add test: "should throw error with descriptive message on overflow"
- [x] Add test: "should return accurate queue size via size() method"
- [x] Add test: "should resolve queued promises with true on process()"
- [x] **Validation**: All new tests pass, existing tests still pass
- [x] **Files**: `tests/core/RequestQueue.spec.ts`

---

## Phase 2: AuthCore Enhancements

### Task 2.1: Add maxQueueSize Configuration Option
- [x] Update `AuthCoreOptions` interface to include optional `maxQueueSize?: number`
- [x] **Validation**: TypeScript compilation succeeds
- [x] **Files**: `src/core/AuthCore.ts`, `src/core/types.ts` (if interface moved)

### Task 2.2: Pass maxQueueSize to RequestQueue
- [x] In `AuthCore` constructor, pass `options.maxQueueSize` to `new RequestQueue()`
- [x] Handle undefined case (let RequestQueue use its default)
- [x] **Validation**: Queue uses custom size when provided
- [x] **Files**: `src/core/AuthCore.ts`

### Task 2.3: Implement Default isAuthError Logic
- [x] Update `isAuthError()` method to check common 401 patterns when no custom logic
- [x] Check: `error?.response?.status === 401` (Axios-style)
- [x] Check: `error?.status === 401` (Fetch-style)
- [x] Check: `error instanceof Response && error.status === 401` (Response object)
- [x] Custom `shouldRefresh` must still take precedence
- [x] **Validation**: Returns true for common 401 patterns, false for others
- [x] **Files**: `src/core/AuthCore.ts`

### Task 2.4: Add Observability Getters
- [x] Add `get refreshing(): boolean` that returns `this.isRefreshing`
- [x] Add `get queueSize(): number` that returns `this.queue.size()`
- [x] **Validation**: Getters return accurate real-time values
- [x] **Files**: `src/core/AuthCore.ts`

### Task 2.5: Test AuthCore Changes
- [x] Add test: "should detect axios-style 401 errors by default"
- [x] Add test: "should detect fetch-style 401 errors by default"
- [x] Add test: "should detect Response object 401 errors by default"
- [x] Add test: "should return false for non-401 errors by default"
- [x] Add test: "custom shouldRefresh overrides default detection"
- [x] Add test: "refreshing getter reflects state accurately during lifecycle"
- [x] Add test: "queueSize getter reflects queue accurately during lifecycle"
- [x] Add test: "queue overflow during concurrent requests throws error"
- [x] **Validation**: All new tests pass, existing tests still pass
- [x] **Files**: `tests/core/AuthCore.spec.ts`

---

## Phase 3: Integration & Quality

### Task 3.1: Update createAuthRetry Exports
- [x] Verify `AuthCoreOptions` with new fields is properly exported
- [x] Ensure `createAuthRetry` passes through `maxQueueSize` option
- [x] **Validation**: TypeScript users can access new options via types
- [x] **Files**: `src/core/createAuthRetry.ts`, `src/core/index.ts`

### Task 3.2: Run Full Test Suite
- [x] Execute `pnpm test` or equivalent
- [x] Verify all existing tests pass
- [x] Verify all new tests pass
- [x] Check test coverage remains at or above current levels
- [x] **Validation**: Zero test failures, coverage maintained
- [x] **Command**: `pnpm test`

### Task 3.3: ESLint & Type Checking
- [x] Run `pnpm lint` (or ESLint command)
- [x] Fix any linting errors (no `any` types, follow conventions)
- [x] Verify TypeScript compilation with `tsc --noEmit`
- [x] **Validation**: Zero ESLint errors, zero TypeScript errors
- [x] **Commands**: `pnpm lint`, `pnpm type-check` (if available)

### Task 3.4: Update Type Exports
- [x] Verify `AuthCoreOptions` is exported from main index
- [x] Ensure new methods/getters are properly typed
- [x] **Validation**: Import statements work correctly for consumers
- [x] **Files**: `src/core/types.ts`, `src/core/index.ts`

### Task 3.5: Code Review Preparation
- [x] Review all changes for code quality
- [x] Ensure consistent code style with existing codebase
- [x] Verify all TODO/FIXME comments are addressed
- [x] Check that design.md decisions were followed
- [x] **Validation**: Code is clean, well-documented, follows conventions

---

## Phase 4: Verification

### Task 4.1: Integration Testing (Manual)
- [x] Create a simple test script that simulates 50+ concurrent 401 errors
- [x] Verify queue overflow protection works
- [x] Verify monitoring getters provide accurate information
- [x] Test default `isAuthError()` with real error objects
- [x] **Validation**: System behaves as expected under load

### Task 4.2: Backward Compatibility Check
- [x] Verify existing code without new options still works
- [x] Test that promise resolution change doesn't break existing awaits
- [x] Confirm no breaking changes to public API
- [x] **Validation**: All compatibility requirements met

### Task 4.3: Final Validation
- [x] All tasks above marked complete
- [x] All tests passing (unit + integration)
- [x] ESLint clean
- [x] TypeScript compilation clean
- [x] No regression in existing functionality
- [x] **Validation**: Ready for code review and merge

---

## Dependencies & Parallelization

### Can be done in parallel:
- Task 1.1-1.4 (RequestQueue changes) 
- Task 2.1 (Interface updates)

### Sequential dependencies:
- Task 1.5 requires 1.1-1.4 complete
- Task 2.2 requires 1.1 complete (RequestQueue constructor updated)
- Task 2.3 requires 2.1 complete
- Task 2.4 requires 1.3 complete (queue.size() available)
- Task 2.5 requires 2.1-2.4 complete
- Phase 3 requires Phases 1-2 complete
- Phase 4 requires Phase 3 complete

---

## Rollback Plan
If critical issues are discovered:
1. Revert changes to `RequestQueue.process()` (restore `resolve()` without argument)
2. Disable default `isAuthError()` logic (return to `return false`)
3. Make `maxQueueSize` default to `Infinity` (disable overflow protection)
4. Hide observability getters behind feature flag

Each component is independently revertable without affecting others.
