# Project Context

## Purpose
建立一個自動化的請求重試機制，主要用於處理 API 呼叫遇到 401 Unauthorized 錯誤時的情境。當偵測到 401 錯誤，系統應自動觸發 Refresh Token 流程，並將失敗的請求重新發送。

## Tech Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **Package Manager**: pnpm
- **Build Tool**: tsup
- **Testing Framework**: Vitest
- **Compatibility**: Axios, Nuxt Fetch (ofetch), Native Fetch

## Project Conventions

### Directory Structure
```
retry-api/
├── src/
│   ├── core/           # 純 JavaScript 實作的核心邏輯 (Pure JS)
│   ├── nuxt/           # Nuxt 模組整合層
│   ├── adapters/       # 各種 HTTP Client 的轉接器實作
│   └── index.ts        # 主要進入點
├── tests/              # 測試檔案
├── package.json
└── tsconfig.json
```

### Code Style
- **Linter**: 使用 ESLint 進行程式碼品質檢查。
- **Formatting**: 程式碼格式需符合 Prettier 與 ESLint 設定規範。
- **Naming**: 變數與函式使用 `camelCase`，類別與介面使用 `PascalCase`。

### Architecture Patterns
- **Core-Extension Architecture (核心-擴充架構)**:
  採用多入口 (Multi-entry) 策略發布 npm 套件，以確保核心邏輯與框架實作分離：
  - `retry-api/core`: 純 JavaScript 實作的核心邏輯 (Pure JS)，不依賴特定框架，包含狀態管理與佇列機制。
  - `retry-api/nuxt`: 專為 Nuxt 設計的整合層 (Nuxt Module/Plugin)，提供自動注入與設定。

- **Adapter Pattern (轉接器模式)**:
  核心層 (`core`) 透過定義統一的 Adapter 介面與外部溝通，讓使用者能注入不同的 HTTP Client (如 Axios, ofetch) 而不修改核心程式碼。

- **Request Queueing (請求佇列)**:
  實作暫存機制。當 Token 刷新時，攔截並暫存後續的 401 請求，待刷新完成後重試。

### Testing Strategy
- 使用 **Vitest** 進行單元測試。
- 針對核心邏輯 (`core`) 撰寫高覆蓋率的測試。
- 模擬各種 HTTP Client 的行為以測試 Adapter。

### Git Workflow
- **Branching Strategy**: 採用 GitHub Flow。
  - `main`: 主分支，隨時保持可部署狀態。
  - Feature branches: 從 `main` 分支建立，開發完成後透過 Pull Request 合併回 `main`。
- **Commit Conventions**: 遵循 Conventional Commits 規範。
  - 格式: `<type>(<scope>): <subject>`
  - 範例: `feat(core): add request queue mechanism`, `fix(nuxt): resolve plugin injection issue`

## Domain Context
理解 Token Refresh 的標準流程：攔截 401 -> 暫停請求 -> 刷新 Token -> 重發請求。需處理多個請求同時失敗時的並發控制，確保只發送一次 Refresh Token 請求，並在成功後通知所有等待中的請求重試。

## Important Constraints
此專案的核心需求為「彈性 (Flexibility)」。架構設計必須能夠適配多種 HTTP 請求方式，包括但不限於 Axios, Nuxt Fetch, 以及原生的 Native Fetch API。實作上應避免與單一框架過度耦合。

## External Dependencies
- **Peer Dependencies (Optional)**:
  - `axios`: 若使用者選擇 Axios 作為請求客戶端時需安裝。
  - `ofetch`: 若使用者選擇 Nuxt Fetch / ofetch 作為請求客戶端時需安裝。
  - `nuxt`: 僅在使用 `retry-api/nuxt` 模組時需要。

- **System Interactions**:
  - **Backend API**: 本專案不依賴特定後端服務，但預期後端需遵循標準 HTTP 協定：
    - Access Token 過期時回傳 `401 Unauthorized`。
    - 提供 Refresh Token Endpoint 以獲取新的 Access Token。
