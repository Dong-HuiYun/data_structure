# 智慧城市極端氣候自動監測系統

**作業主題：Queue 與 Decision Tree 在智慧城市 IoT 感測器數據緩衝的應用**
**網頁檔名：`smart_city_climate.html`**
**完成工具：Claude Sonnet（AI 協作完成）**

---

## 一、作業思考與題目設計

### 1.1 核心問題

現代智慧城市佈滿大量 IoT 感測器，持續回傳風速、水位、地震波、空氣品質等數據。當極端氣候事件（颱風、洪患、地震、有毒氣體外洩、熱浪）發生時，系統會在短時間內產生大量異常訊號，面臨兩大挑戰：

1. **數據爆量**：尖峰時段訊息到達速率 λ 遠超平時，若後端處理能力不足，訊息將大量積壓甚至遺失。
2. **緊急程度不一**：不同事件的危急程度差異極大，必須確保「最緊急的事件優先被處理與通報」，而非單純先進先出。

### 1.2 解決方案設計思路

結合兩種核心資料結構：

| 資料結構 | 在本系統的角色 |
|----------|---------------|
| **Priority Queue（優先權佇列）** | 緩衝感測器訊息，依緊急程度排序，確保高優先事件先被處理 |
| **Decision Tree（決策樹）** | 對每一筆感測數據分類，判斷屬於哪個等級（緊急/警告/注意/正常），決定後續行動 |

### 1.3 題目定義

> 設計一個可自動監測城市中極端氣候事件的即時監測系統，支援颱風、洪患、地震、有毒氣體外洩、熱浪五大情境，依事件等級即時記錄、通報並視覺化呈現。

---

## 二、系統架構與方法說明

### 2.1 感測器層（12 個感測器）

系統模擬 12 種 IoT 感測器持續採集數據：

| 感測器 | 單位 | 警告閾值 | 緊急閾值 | 關聯事件 |
|--------|------|----------|----------|----------|
| 風速 | m/s | 20 | 35 | 颱風 |
| 降雨量 | mm/h | 30 | 80 | 洪患 |
| 水位 | cm | 300 | 500 | 洪患 |
| 地震波 | gal | 80 | 250 | 地震 |
| 一氧化碳 | ppm | 50 | 200 | 毒氣外洩 |
| 二氧化硫 | ppm | 2 | 10 | 毒氣外洩 |
| 氣溫 | °C | 40 | 45 | 熱浪 |
| 相對濕度 | % | 95 | 100 | 洪患 |
| 氣壓 | hPa | 970 (低) | 955 (低) | 颱風 |
| 建物振動 | mm/s | 5 | 15 | 地震 |
| PM2.5 | μg/m³ | 75 | 150 | 毒氣外洩 |
| UV 指數 | — | 8 | 11 | 熱浪 |

### 2.2 優先權佇列機制（M/M/1 佇列理論）

採用 M/M/1 佇列模型，即：

- **到達過程（M）**：感測器訊息以 Poisson 過程到達，到達率為 λ（msg/s）
- **服務過程（M）**：後端以指數分布服務，服務率為 μ = 8 msg/s（固定）
- **單一服務台（1）**：單一處理通道

關鍵公式：

```
系統利用率  ρ = λ / μ
平均等待數  Lq = ρ² / (1 - ρ)   （僅在 ρ < 1 時穩定）
```

訊息依緊急程度分為四個優先級，高優先級訊息插隊優先處理：

```
P0 — 緊急 Critical  （λ 暴增至 7–9 msg/s，ρ → 0.9，Lq 急劇上升）
P1 — 警告 Warning   （λ ≈ 4 msg/s，ρ ≈ 0.5）
P2 — 注意 Watch     （λ ≈ 2 msg/s，ρ ≈ 0.25）
P3 — 正常 Normal    （λ ≈ 1 msg/s，ρ ≈ 0.13）
```

當 ρ 接近 1 時，Lq 趨近於無窮大——這正是極端事件造成系統過載的數學根源，也是優先權佇列存在的必要性。

### 2.3 決策樹分類邏輯

每 2 秒從所有感測器讀取最新數值，送入決策樹：

```
根節點：讀取所有感測器數據
│
├─ 是否有 Critical 數值？
│    ├─ 是 → 觸發 P0 緊急警報，立即通報相關單位，寫入緊急日誌
│    └─ 否 ↓
│
├─ 是否有 Warning 數值？
│    ├─ 是 → 觸發 P1 警告通知，提醒值班人員
│    └─ 否 ↓
│
├─ 是否有 Watch 數值？
│    ├─ 是 → 記錄 P2 注意事件，列入觀察清單
│    └─ 否 ↓
│
└─ 全部正常 → 寫入 P3 正常日誌
```

各等級判斷條件（以非低值型感測器為例）：

```javascript
if (value >= sensor.crit)         return 'crit';   // P0
if (value >= sensor.warn)         return 'warn';   // P1
if (value >= sensor.warn * 0.8)   return 'watch';  // P2
return 'normal';                                    // P3
```

---

## 三、執行方法與步驟

### 3.1 開發流程

本系統完全以 AI 協作方式完成，開發流程如下：

```
Step 1  需求描述給 AI
        → 說明想監測哪些氣候事件、需要哪些感測器、
          要包含 Queue 與 Decision Tree 的概念

Step 2  AI 生成第一版互動網頁
        → 包含感測器格、決策樹面板、佇列視覺化、
          警報記錄、M/M/1 公式顯示

Step 3  使用者回饋版面問題
        → 截圖顯示在寬螢幕上文字過度分散

Step 4  AI 重新設計第二版
        → 加入 max-width 限制、改為 4 欄感測器格、
          縮小 padding、優化資訊密度

Step 5  輸出完整說明文件（本 .md 檔）
```

### 3.2 與 AI 的互動過程

**第一輪對話（需求提出）：**

> 使用者：「請探討 Queue 跟樹相關方法在智慧城市的相關應用⋯⋯設計一個可以自動監測城市中發生極端氣候的自動化監測系統⋯⋯」

AI 先分析題目框架，確認核心資料結構選擇（Priority Queue + Decision Tree），再產出互動式 HTML 網頁，包含：

- 12 個感測器即時顯示
- M/M/1 佇列參數動態計算
- 決策樹當前路徑高亮
- 五種極端事件模擬按鈕
- 警報記錄與統計圖表

**第二輪對話（視覺優化）：**

> 使用者：「可以再美化一下你的網頁嗎？從電腦打開網頁，每個文字的距離變得很分散是怎麼回事？」

並附上截圖，AI 診斷出問題：

1. Grid 欄位在寬螢幕無限拉伸，感測器間距過大
2. KPI 數值字體過大（20px 以上），佔位不當
3. 右側欄位寬度設定不足，整體版面失衡

AI 重新設計第二版，主要改動：

- 加入 `max-width: 680px` 容器限制
- 感測器改為 4 欄緊湊佈局（間距從 8px → 6px）
- 統一各區塊 padding 縮小
- KPI 數值字體調整至 20px
- M/M/1 參數改用 2×2 小卡片展示

**第三輪對話（文件輸出）：**

> 使用者：「寫一個 .md 檔案解釋你第二版的網頁⋯⋯」

AI 根據整個開發過程，撰寫本說明文件。

---

## 四、核心程式碼說明

### 4.1 感測器數據結構定義

```javascript
const SENSORS = [
  {
    id: 'wind',
    name: '風速',
    unit: 'm/s',
    base: 5,        // 正常基準值
    rng: 2,         // 正常波動範圍
    warn: 20,       // 警告閾值
    crit: 35,       // 緊急閾值
    type: 'typhoon', // 觸發事件類型
    f: v => v.toFixed(1)  // 顯示格式
  },
  // ... 其餘 11 個感測器
];
```

### 4.2 事件模擬邏輯

```javascript
function simValues() {
  SENSORS.forEach(s => {
    let v = sv[s.id];
    const noise = (Math.random() - 0.5) * s.rng;

    if (activeEvent && s.type === activeEvent) {
      // 觸發事件：數值逐步爬升至緊急閾值
      v = s.base + (s.crit - s.base) * Math.min(tick * 0.12, 1) + noise;
    } else {
      // 正常狀態：在基準值附近隨機波動
      v = s.base + noise;
    }
    sv[s.id] = Math.max(0, v);
  });
}
```

### 4.3 決策樹狀態判斷

```javascript
function status(sensor, value) {
  if (sensor.low) {  // 低值型（如氣壓）
    if (value <= sensor.crit) return 'crit';
    if (value <= sensor.warn) return 'warn';
    if (value <= sensor.warn * 1.05) return 'watch';
    return 'normal';
  }
  if (value >= sensor.crit) return 'crit';
  if (value >= sensor.warn) return 'warn';
  if (value >= sensor.warn * 0.8) return 'watch';
  return 'normal';
}

function worstStatus() {
  const order = ['normal', 'watch', 'warn', 'crit'];
  let worst = 'normal';
  SENSORS.forEach(s => {
    const st = status(s, sv[s.id]);
    if (order.indexOf(st) > order.indexOf(worst)) worst = st;
  });
  return worst;
}
```

### 4.4 M/M/1 佇列計算

```javascript
function updateQueue() {
  const lambdaBase = { normal: 1, watch: 2, warn: 4, crit: 7 }[worstStatus()];
  const lambda = Math.max(0.5, lambdaBase + (Math.random() - 0.5));
  const mu = 8;                        // 固定服務率
  const rho = Math.min(lambda / mu, 0.99);  // 系統利用率
  const lq = rho * rho / (1 - rho);   // 平均等待數 (M/M/1 公式)

  // 更新顯示
  document.getElementById('mm-l').textContent = lambda.toFixed(1);
  document.getElementById('mm-r').textContent = rho.toFixed(2);
  document.getElementById('mm-q').textContent = lq.toFixed(2);
}
```

### 4.5 優先權佇列訊息生成與排序

```javascript
// 依事件等級新增訊息至佇列
const count = { normal: 0, watch: 1, warn: 2, crit: 4 }[worst];
for (let i = 0; i < count + Math.floor(Math.random() * 2); i++) {
  const priority = worst === 'crit' && Math.random() < 0.5 ? 0 :
                   worst === 'warn' && Math.random() < 0.5 ? 1 :
                   worst === 'watch' && Math.random() < 0.5 ? 2 : 3;
  queueItems.push({ priority, id: tick + '_' + i });
}

// 依優先權排序（P0 最優先）
queueItems.sort((a, b) => a.priority - b.priority);
```

---

## 五、模擬成果展示

### 5.1 正常狀態

- 所有 12 個感測器標示「正常」（綠色）
- 決策樹路徑：根節點 → 三次「否」判斷 → 寫入 P3 正常日誌
- λ ≈ 1 msg/s，ρ ≈ 0.13，Lq ≈ 0.02（佇列幾乎空閒）

### 5.2 模擬颱風事件

觸發後 tick 累積，風速與氣壓感測器數值快速變化：

- 風速：5 m/s → 35+ m/s（超過緊急閾值）
- 氣壓：1013 hPa → 950 hPa（低於緊急閾值）
- 決策樹：第一節點判斷為「緊急」，立即走向 P0 分支
- λ 暴增至 7+ msg/s，ρ → 0.875，Lq → 6.1（佇列積壓明顯）
- 警報記錄即時新增「緊急 P0」條目，感測器磚格出現紅色閃爍動畫

### 5.3 模擬有毒氣體外洩

- CO、SO₂、PM2.5 三項感測器同步升高
- 系統判定最差狀態為「緊急」，啟動 P0 通報
- 佇列中出現大量 P0 紅色標籤，插隊排在 P2/P3 之前優先處理

### 5.4 恢復正常

點擊「恢復正常」後：

- `activeEvent` 清空，所有感測器回到 base 值附近波動
- 決策樹重新走向 P3 正常日誌路徑
- λ 降低，ρ 與 Lq 回落至低位

---

## 六、成果討論

### 6.1 Queue 理論的實際意義

本系統清楚展示了 M/M/1 佇列理論的核心性質：當 ρ 趨近 1 時，系統進入不穩定狀態，Lq 趨向無窮大。這在現實中對應「極端事件發生時，若未使用優先權佇列而採純 FIFO，緊急警報可能會被大量低優先級數據淹沒，導致通報延遲」。

優先權佇列（Priority Queue）解決此問題：無論訊息到達順序為何，P0 緊急訊息永遠排在最前面被處理，確保關鍵資訊即時送達。

### 6.2 Decision Tree 的優勢

決策樹在本場景的優勢在於：

- **可解釋性高**：每一次判斷路徑都可視覺化呈現，值班人員能理解系統為何發出警報
- **計算效率佳**：相較於複雜機器學習模型，決策樹每筆數據的判斷時間為 O(depth)，適合即時系統
- **規則易調整**：閾值與分支條件可依城市需求動態調整

### 6.3 AI 協作心得

本作業全程透過與 Claude AI 對話完成，互動模式為：

1. 提出概念需求 → AI 設計整體架構
2. 提出視覺問題（附截圖）→ AI 診斷並重新設計
3. 提出文件需求 → AI 整合輸出報告

AI 的主要貢獻包括：將抽象的資料結構概念（Queue、Decision Tree）轉化為可互動的視覺化展示，以及即時根據使用者回饋調整 UI 設計。整個開發過程約需 3 輪對話、15 分鐘完成，展示了 AI 輔助學習與開發的高效率。

---

## 七、附錄：檔案說明

| 檔案 | 說明 |
|------|------|
| `smart_city_climate.html` | 主程式，完整互動式監測系統網頁 |
| `smart_city_climate_report.md` | 本說明文件 |

### 使用說明

1. 以瀏覽器開啟 `smart_city_climate.html`
2. 系統自動啟動，感測器每 2 秒更新一次
3. 點擊底部事件按鈕模擬各種極端氣候
4. 點擊任一感測器磚格可向 AI 詢問詳細說明
5. 點擊「清除記錄」可重置警報計數

---
