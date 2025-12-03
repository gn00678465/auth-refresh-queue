# Improve Core Robustness

## Summary
This change enhances the robustness and reliability of the core authentication retry logic by addressing identified issues in queue management, error detection, and system monitoring capabilities.

## Background
After comprehensive code analysis (documented in `.serena/memories/core-code-analysis.md`), several issues were identified that could impact system reliability:

1. **Critical**: `RequestQueue.process()` resolves promises without values, potentially causing confusion for awaiting code
2. **Medium**: `isAuthError()` returns `false` by default when no custom logic is provided, which may not align with user expectations
3. **Medium**: No queue size limits, risking memory overflow in high-traffic scenarios
4. **Low**: Limited observability - no way to monitor queue state or refresh status

## Motivation
These improvements are essential for:
- **Production Reliability**: Prevent memory leaks and provide clear promise resolution semantics
- **Developer Experience**: Provide sensible defaults that work out-of-the-box for common scenarios
- **Observability**: Enable debugging and monitoring in production environments
- **Quality Assurance**: Ensure comprehensive test coverage for edge cases

## Goals
1. Fix promise resolution semantics in `RequestQueue.process()`
2. Provide sensible default behavior for `isAuthError()` to detect common 401 error structures
3. Add configurable queue size limits with overflow protection
4. Expose queue monitoring capabilities for debugging and metrics
5. Ensure all changes maintain backward compatibility
6. Achieve 100% test coverage for new functionality

## Non-Goals
- Changing the core adapter pattern or public API signatures
- Adding retry logic within the core (remains the responsibility of external interceptors)
- Implementing automatic error detection for all HTTP clients (adapter-specific)
- Performance optimization (this change focuses on correctness and reliability)

## Scope
This change affects:
- `src/core/RequestQueue.ts` - Queue management improvements
- `src/core/AuthCore.ts` - Error detection defaults and monitoring
- `src/core/types.ts` - New configuration options
- `tests/core/RequestQueue.spec.ts` - Enhanced test coverage
- `tests/core/AuthCore.spec.ts` - Additional edge case tests

## Impact Analysis
- **Breaking Changes**: None - all changes are backward compatible
- **Migration Required**: No - new features are opt-in via configuration
- **Documentation Updates**: README examples should demonstrate new capabilities
- **Testing Requirements**: New unit tests for all added functionality

## Success Criteria
- [x] All existing tests continue to pass
- [x] New tests cover all identified issues and edge cases
- [x] Queue overflow protection works as expected
- [x] Default `isAuthError()` correctly identifies common 401 patterns
- [x] Monitoring methods return accurate state information
- [x] ESLint and type checks pass without errors
- [x] Code coverage remains at or above current levels

## Related Changes
- Builds upon `implement-core-retry-logic` (archived)
- Addresses issues identified in core code analysis

## References
- Core code analysis: `.serena/memories/core-code-analysis.md`
- Original spec: `openspec/specs/core-logic/spec.md`
- Test files: `tests/core/AuthCore.spec.ts`, `tests/core/RequestQueue.spec.ts`
