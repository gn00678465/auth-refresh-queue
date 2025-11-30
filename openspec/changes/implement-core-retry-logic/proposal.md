# 提案：實作核心重試邏輯 (Implement Core Retry Logic)

## Summary
本提案旨在建立 `retry-api` 的核心邏輯層 (`core`)。這將是一個純 JavaScript/TypeScript 的實作，負責處理 401 Unauthorized 錯誤的攔截、Token 刷新流程的狀態管理，以及並發請求的佇列 (Queueing) 機制。此核心層將不依賴任何特定的 HTTP Client (如 Axios 或 fetch)，而是透過 Adapter 模式來進行整合。

## Motivation
目前的專案目標是提供一個通用的重試機制。為了達成「彈性 (Flexibility)」的架構需求，我們必須將重試邏輯從特定的 HTTP 框架中抽離出來。透過實作一個獨立的核心層，我們可以確保業務邏輯的一致性，並能輕易地擴充支援 Nuxt、Axios 或原生 Fetch。

## Proposed Changes
1.  **定義核心介面**: 建立 `IAuthLogic` 與 `IAdapter` 介面。
2.  **實作狀態機**: 管理 `IDLE` (閒置) 與 `REFRESHING` (刷新中) 狀態，防止重複發送刷新請求。
3.  **實作請求佇列**: 當正在刷新 Token 時，暫存後續進入的請求。
4.  **錯誤處理**: 定義刷新失敗時的行為 (如登出或拋出錯誤)。

## Timeline
預計在核心邏輯實作完成後，接續進行 Axios 與 Nuxt 的 Adapter 實作 (將在後續的提案中處理)。
