# 金門大學學餐 — 動態預約與訂單優化系統
## 設計文件 Design Document

> **檔案**：`kmu_cafeteria_system.html`  
> **技術棧**：Vanilla HTML + CSS + JavaScript，Tailwind CSS CDN，Google Fonts  
> **核心概念**：Rule-based Decision Tree × Multi-Queue Scheduling

---

## 目錄

1. [系統背景與目標](#1-系統背景與目標)
2. [整體架構概覽](#2-整體架構概覽)
3. [UI/UX 設計決策](#3-uiux-設計決策)
4. [核心演算法：決策樹](#4-核心演算法決策樹)
5. [資料結構：多重佇列](#5-資料結構多重佇列)
6. [主要函式流程](#6-主要函式流程)
7. [統計計算邏輯](#7-統計計算邏輯)
8. [模組對照表](#8-模組對照表)
9. [延伸改進方向](#9-延伸改進方向)

---

## 1. 系統背景與目標

金門大學學生用餐時間有限，課堂之間的空檔短則 10 分鐘，長則 40 分鐘以上。傳統單一隊伍的「先來後到」制度，無法區分學生的緊急程度，導致趕課學生和有充裕時間的學生排在同一條隊伍，造成不必要的遲到風險。

本系統模擬一套結合「決策樹自動分類」與「多重佇列差速處理」的訂單優化方案，達成以下目標：

- **降低遲到率**：趕課學生被自動導入快速通道
- **提升廚房效率**：三條流水線平行處理，互不阻塞
- **視覺化管理**：店家後台即時掌握各流水線狀況
- **數據驅動決策**：統計看板提供平均等待時間與快取率

---

## 2. 整體架構概覽

```
┌──────────────────────────────────────────────────────┐
│                    使用者介面 (HTML)                   │
│                                                      │
│  ┌─────────────────┐      ┌──────────────────────┐  │
│  │  區塊 01         │      │  區塊 02               │  │
│  │  點餐表單        │─────▶│  多重佇列看板           │  │
│  │  + 決策樹圖      │      │  Express / Priority  │  │
│  └─────────────────┘      │  Standard            │  │
│                           └──────────┬───────────┘  │
│                                      │              │
│                           ┌──────────▼───────────┐  │
│                           │  區塊 03               │  │
│                           │  統計看板              │  │
│                           │  接單 / 等待 / 快取率  │  │
│                           └──────────────────────┘  │
└──────────────────────────────────────────────────────┘

        ▲ 資料流向：表單輸入 → classifyOrder() → enqueue() → renderQueue() → updateStats()
```

---

## 3. UI/UX 設計決策

### 3.1 視覺主題：深色工業科技風

選用**深夜控制室**作為視覺隱喻——廚房後台就像一個需要 24 小時監控的生產系統，因此採用：

| 設計元素 | 選擇 | 理由 |
|---------|------|------|
| 背景色 | `#0a0e1a` 深海藍黑 | 降低視覺疲勞，突出彩色資訊 |
| 主字體 | Noto Sans TC | 中文排版優雅，多字重 |
| 輔助字體 | Space Mono | 等寬字體強調「機器」感，用於訂單 ID |
| Express 色 | `#00e5a0` 翠綠螢光 | 緊急、快速、立即 |
| Priority 色 | `#fbbf24` 琥珀黃 | 警示、優先、注意 |
| Standard 色 | `#60a5fa` 冰藍 | 穩定、從容、正常 |

### 3.2 顏色語義系統

三種顏色在整個 UI 中保持一致的語義，從表單分類結果、佇列容器霓虹邊框、訂單卡片、統計長條圖到決策樹高亮節點，全部使用同一套 CSS 變數：

```css
--accent-express:  #00e5a0;
--accent-priority: #fbbf24;
--accent-standard: #60a5fa;
```

### 3.3 互動回饋設計

- **決策樹節點高亮**：送出訂單後，畫面左側的決策樹路徑圖會亮起走過的節點，3 秒後自動淡出，讓使用者直觀理解分類邏輯
- **Toast 通知**：每次訂單送出、出餐操作都有右下角滑入的浮動訊息，色調跟隨分類結果
- **訂單卡片動畫**：新增訂單時使用 `slideIn` 關鍵影格，從左側滑入並放大，視覺上模擬「入隊」動作
- **進度條**：以佇列容量 10 筆為基準，即時反映各流水線的飽和程度
- **即時時鐘**：頁首右上角每秒更新，強化「系統運作中」的臨場感

---

## 4. 核心演算法：決策樹

### 4.1 概念說明

決策樹（Decision Tree）是一種樹狀結構的分類模型，每個**內部節點**代表一個特徵的判斷條件，每個**葉節點**代表最終的分類結果。本系統採用**規則基礎決策樹（Rule-based Decision Tree）**，以 if-else 語句手工編碼樹的結構。

### 4.2 樹狀結構圖

```
                    ┌─────────────────┐
                    │   📦 新訂單進入   │  ← 根節點 (Root Node)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  ⏱ 距離上課時間？ │  ← 特徵 1：時間緊迫性
                    └──┬──────┬──────┘
                       │      │      └─────────────────────┐
                  ≤ 10 min  ≤ 25 min                  ≥ 40 min
                       │      │                            │
              ┌────────▼──┐   │                   ┌───────▼──────┐
              │ 🍱 餐點類型？│   │                   │  🔵 Standard │ ← 葉節點
              └──┬──────┬─┘   │                   │  FIFO Queue  │
                 │      │     │                   └──────────────┘
          輕食/飲品  熱食      │
                 │      │     │
        ┌────────▼─┐ ┌──▼────▼──────┐
        │ ⚡ Express│ │ 🟡 Priority   │ ← 葉節點
        │  Queue   │ │   Queue      │
        └──────────┘ └──────────────┘
```

### 4.3 程式碼實現

```javascript
function classifyOrder(timeClass, mealType) {

  // 節點 1：根節點 — 時間緊迫性判斷
  if (timeClass === '10') {

    // 節點 2：左子樹 — 餐點可即取性判斷
    if (mealType === 'sandwich' || mealType === 'drink') {
      return 'express';   // 狀況 A：秒取
    } else {
      return 'priority';  // 狀況 A'：趕時間但熱食仍需製作
    }
  }

  // 節點 3：中子樹 — 有點趕
  if (timeClass === '25') {
    return 'priority';    // 狀況 B：插隊優先製作
  }

  // 節點 4：右子樹（葉節點）— 從容不迫
  return 'standard';      // 狀況 C：正常 FIFO
}
```

### 4.4 分類結果對照表

| 距離上課 | 餐點類型 | 分類結果 | 邏輯說明 |
|---------|---------|---------|---------|
| ≤ 10 分 | 三明治 / 飲品 | ⚡ Express | 即食可秒取，直接到保溫櫃 |
| ≤ 10 分 | 熱門現做主食 | 🟡 Priority | 需製作，但給予最高優先 |
| ≤ 25 分 | 任意 | 🟡 Priority | 稍有時間壓力，插隊處理 |
| ≥ 40 分 | 任意 | 🔵 Standard | 從容入一般 FIFO 隊 |

---

## 5. 資料結構：多重佇列

### 5.1 佇列（Queue）基本概念

佇列是一種**先進先出（FIFO, First-In First-Out）**的線性資料結構：

```
入隊 (Enqueue) →  [ 新 | ... | 舊 ]  → 出隊 (Dequeue)
                     尾端              前端
```

JavaScript 沒有內建 Queue 類別，本系統以**陣列（Array）**模擬：

| Queue 操作 | Array 方法 | 說明 |
|-----------|-----------|------|
| Enqueue（入隊） | `array.push(item)` | 新訂單加入尾端 |
| Dequeue（出隊） | `array.shift()` | 完成訂單從前端移除 |
| Peek Front | `array[0]` | 查看隊首（不移除） |
| Size | `array.length` | 目前隊伍長度 |

### 5.2 三條佇列的差速設計

三條佇列使用相同的 FIFO 結構，但**每個「生產週期（tick）」處理不同數量的訂單**，藉此模擬不同的服務速率：

```javascript
// processTick() 每次點擊的處理量
Express  → dequeue 3 筆   // 取餐台即時出貨
Priority → dequeue 2 筆   // 廚師加速製作
Standard → dequeue 1 筆   // 正常製作節奏
```

### 5.3 訂單物件結構

每筆入隊的訂單為以下格式的 JavaScript 物件：

```javascript
{
  id:        'ORD-0001',       // 自動遞增，補零至 4 位
  name:      '小明',            // 學生暱稱
  mealType:  'drink',          // 'hot' | 'sandwich' | 'drink'
  timeClass: '10',             // '10' | '25' | '40'
  queueType: 'express',        // 分類結果
  estWait:   0,                // 預估等待分鐘 = 當前隊長 × 單筆製作時間
  enqueueAt: 1716019200000,    // Date.now() 時間戳（毫秒）
}
```

### 5.4 預估等待時間公式

```
estimateWait(queueType) = 當前隊伍長度 × 單筆製作速率

單筆製作速率：
  Express  → 0 分鐘/筆（現成即取）
  Priority → 3 分鐘/筆
  Standard → 6 分鐘/筆
```

---

## 6. 主要函式流程

### 6.1 送出訂單完整流程

```
submitOrder()
    │
    ├─ 讀取表單輸入 (timeClass, mealType, name)
    ├─ 基本驗證 (兩個必填欄位)
    ├─ 產生訂單 ID (orderCounter++)
    │
    ├─ classifyOrder(timeClass, mealType)  ← 決策樹
    │       └─ 回傳 queueType
    │
    ├─ estimateWait(queueType)             ← 預估等待
    │       └─ 回傳 estWait (分鐘)
    │
    ├─ 建立 order 物件
    │
    ├─ enqueue(queueType, order)           ← 入隊
    │       ├─ queues[queueType].push(order)
    │       ├─ renderQueue(queueType)      ← 更新 UI
    │       └─ updateStats()              ← 更新統計
    │
    ├─ highlightDecisionTree(...)          ← 視覺高亮
    └─ showToast(...)                      ← 通知訊息
```

### 6.2 廚房出餐（時間流逝）流程

```
processTick()
    │
    ├─ 計算各佇列本次可出餐數
    │       Express:  min(3, queue.length)
    │       Priority: min(2, queue.length)
    │       Standard: min(1, queue.length)
    │
    ├─ dequeue('express',  n)
    ├─ dequeue('priority', n)
    ├─ dequeue('standard', n)
    │       └─ 每筆執行：
    │               queues[type].shift()   ← 從前端移除
    │               doneOrders++
    │               totalWait += estWait
    │               completedLog.unshift() ← 寫入日誌
    │
    ├─ renderQueue(每個 type)              ← 重繪 UI
    ├─ updateStats()                       ← 更新統計
    └─ showToast(出餐摘要)
```

---

## 7. 統計計算邏輯

### 今日總接單量

```
totalOrders += 1   （每次 submitOrder 呼叫時累計）
```

### 平均等待時間

```
avgWait = totalWait / doneOrders

totalWait = 每筆已出餐訂單的 estWait 之總和
```

> 採用「預估等待時間」而非實際時間差，因為模擬環境中時間流逝是由使用者手動 tick，並非真實時間。

### 快速取餐率（防遲到成功率）

```
fastRate = (queueTotals.express + queueTotals.priority) / totalOrders × 100%
```

定義「快速取餐」為被分到 Express 或 Priority 佇列的訂單，代表系統成功識別出有時間壓力的學生並給予優先服務。

---

## 8. 模組對照表

| 函式名稱 | 對應概念 | 所在區塊 |
|---------|---------|---------|
| `classifyOrder()` | 決策樹分類器 | 區塊 01 |
| `estimateWait()` | 等待時間預測 | 區塊 01 |
| `enqueue()` | Queue 入隊操作 | 區塊 02 |
| `dequeue()` | Queue 出隊操作 | 區塊 02 |
| `renderQueue()` | 佇列 UI 渲染 | 區塊 02 |
| `processTick()` | 廚房出餐模擬 | 區塊 02 |
| `highlightDecisionTree()` | 決策路徑可視化 | 區塊 01 |
| `updateStats()` | 統計看板更新 | 區塊 03 |
| `showToast()` | 操作回饋通知 | 全域 |
| `seedOrders()` | 頁面預熱示範 | 初始化 |

---

## 9. 延伸改進方向

以下列出若要將本模擬系統進一步發展為生產系統，可考慮的改進項目：

### 演算法層面
- **機器學習決策樹**：收集歷史訂單數據，使用 ID3 / CART 演算法自動學習最佳分類閾值，取代手工 if-else 規則
- **動態優先權**：Priority Queue 改用 Min-Heap 結構，讓每筆訂單依剩餘課前時間動態調整優先順序（而非只分三級）
- **多維特徵擴展**：加入「點餐時段」、「歷史等候紀錄」、「廚房當前負載」等特徵作為決策樹節點

### 工程層面
- **後端持久化**：以 Node.js + SQLite 儲存真實訂單數據
- **WebSocket 即時同步**：多台裝置（學生手機 + 廚房平板）共享同一個佇列狀態
- **QR Code 整合**：Express Queue 實際產生條碼，學生掃碼即可取餐
- **推播通知**：訂單完成時透過 PWA 推播通知學生

### UX 層面
- **學生端 / 店家端分離**：兩個不同的 View，學生只看訂單狀態，店家才看管理後台
- **歷史趨勢圖**：以折線圖顯示每日各佇列的訂單量變化趨勢
- **高峰期預警**：當 Standard Queue 超過 8 筆時自動提示店家增加人手

---

*文件版本：1.0 · 2026-05-18 · 金門大學學餐系統設計組*
