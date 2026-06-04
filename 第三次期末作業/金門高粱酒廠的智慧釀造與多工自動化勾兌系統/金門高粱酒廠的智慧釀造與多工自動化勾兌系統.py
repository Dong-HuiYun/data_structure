import tkinter as tk
from tkinter import ttk
import random
import time
import math

# ==========================================
# 1. 資料結構實作 (Max-Heap & Queue with Dynamic Callbacks)
# ==========================================

class LiquorBarrel:
    """原酒桶類別"""
    def __init__(self, barrel_id, name, priority):
        self.id = barrel_id
        self.name = name          
        self.priority = priority  
        self.rest_time = 6        # 預設靜置 6 秒

class MaxHeap:
    """安全動畫渲染與回傳排序過程的 Max-Heap"""
    def __init__(self, update_callback=None):
        self.heap = []
        self.update_callback = update_callback  
        self.highlight_nodes = []              

    def insert(self, barrel):
        self.heap.append(barrel)
        self._shift_up(len(self.heap) - 1)
        self.highlight_nodes = []

    def extract_max(self):
        if not self.heap:
            return None
        if len(self.heap) == 1:
            return self.heap.pop()
        
        max_item = self.heap[0]
        # 先安全地移出最後一個節點，並指派給頂端
        last_item = self.heap.pop()
        if self.heap:
            self.heap[0] = last_item
            self._shift_down(0)
        self.highlight_nodes = []
        return max_item

    def _shift_up(self, idx):
        parent = (idx - 1) // 2
        # 防禦機制：確保索引不越界
        if idx >= len(self.heap) or parent < 0:
            return
            
        if idx > 0 and self.heap[idx].priority > self.heap[parent].priority:
            self.highlight_nodes = [idx, parent]
            # 先換資料，確保 draw_all 讀取時陣列是完整的
            self.heap[idx], self.heap[parent] = self.heap[parent], self.heap[idx]
            
            if self.update_callback: 
                self.update_callback()
            
            self._shift_up(parent)

    def _shift_down(self, idx):
        max_idx = idx
        left = 2 * idx + 1
        right = 2 * idx + 2
        heap_len = len(self.heap)

        # 防禦機制：確保當前節點索引安全
        if idx >= heap_len:
            return

        if left < heap_len and self.heap[left].priority > self.heap[max_idx].priority:
            max_idx = left
        if right < heap_len and self.heap[right].priority > self.heap[max_idx].priority:
            max_idx = right

        if idx != max_idx:
            self.highlight_nodes = [idx, max_idx]
            # 先換資料，再跑動畫，徹底阻斷 IndexError
            self.heap[idx], self.heap[max_idx] = self.heap[max_idx], self.heap[idx]
            
            if self.update_callback: 
                self.update_callback()
            
            self._shift_down(max_idx)

# ==========================================
# 2. Tkinter 智慧酒廠大看板
# ==========================================

class KKLSizingApp:
    def __init__(self, root):
        self.root = root
        self.root.title("金門酒廠 x 金門大學：智慧釀造與多工自動化勾兌系統 (終極尊榮版)")
        self.root.geometry("1280x850")
        
        # 1. 先建立核心資料結構與狀態（此時 Heap 還是空的）
        self.heap_sys = MaxHeap(update_callback=self.trigger_animation_delay)
        self.static_queue = []  
        self.barrel_counter = 101
        
        self.history_logs = []
        self.stats = {"特級高粱": 0, "金門陳高": 0, "二鍋頭原酒": 0, "戰酒黑金龍": 0}
        self.climate_speedup = False 

        # 2. 先把畫面元件與 Canvas 建立好 (搬移到這裡！)
        self._create_widgets()

        # 3. 最後再把預設的原酒桶推進 Heap 裡（這樣觸發繪圖時就不會出錯了）
        preset_barrels = [
            ("特級高粱", 75), ("金門陳高", 95), ("戰酒黑金龍", 82),
            ("典藏珍品", 88), ("二鍋頭原酒", 92), ("迎賓酒", 60)
        ]
        for name, pri in preset_barrels:
            self.heap_sys.insert(LiquorBarrel(self.barrel_counter, name, pri))
            self.barrel_counter += 1

        # 4. 啟動主動畫迴圈
        self.animate_loop()

    def trigger_animation_delay(self):
        """用來產生 Heap 節點交換時的肉眼可見延遲（加強防禦版）"""
        if hasattr(self, 'canvas') and self.root.winfo_exists():
            try:
                self.draw_all()
                self.root.update()
                time.sleep(0.3)  # 延遲 0.3 秒展示交換軌跡
            except Exception:
                pass # 忽略撞車的微小渲染錯誤，確保程式不閃退


    def _create_widgets(self):
        # 標題區
        title_label = tk.Label(self.root, text="金門高粱酒廠 智慧釀造與多工自動化勾兌系統 (產學合作成果看板)", 
                               font=("Helvetica", 18, "bold"), fg="#8B0000")
        title_label.pack(pady=10)

        # 上方控制面板一
        ctrl_frame = tk.Frame(self.root)
        ctrl_frame.pack(pady=5)

        tk.Label(ctrl_frame, text="新原酒酒款: ", font=("Helvetica", 11)).grid(row=0, column=0, padx=5)
        self.酒款選單 = ttk.Combobox(ctrl_frame, values=["特級高粱", "金門陳高", "二鍋頭原酒", "戰酒黑金龍"], width=12)
        self.酒款選單.current(0)
        self.酒款選單.grid(row=0, column=1, padx=5)

        tk.Label(ctrl_frame, text="優先分數 (50-100): ", font=("Helvetica", 11)).grid(row=0, column=2, padx=5)
        self.分數輸入 = tk.Entry(ctrl_frame, width=5)
        self.分數輸入.insert(0, str(random.randint(65, 95)))
        self.分數輸入.grid(row=0, column=3, padx=5)

        btn_push = tk.Button(ctrl_frame, text="1. 蒸餾入庫 (Push Heap)", bg="#228B22", fg="white", font=("Helvetica", 10, "bold"), command=self.push_to_heap)
        btn_push.grid(row=0, column=4, padx=10)

        btn_pop = tk.Button(ctrl_frame, text="2. 提取勾兌 (Pop Heap -> Queue)", bg="#FF8C00", fg="white", font=("Helvetica", 10, "bold"), command=self.pop_to_queue)
        btn_pop.grid(row=0, column=5, padx=10)

        # 上方控制面板二 (隨機事件與動態調分)
        ctrl_frame2 = tk.Frame(self.root)
        ctrl_frame2.pack(pady=5)

        btn_order = tk.Button(ctrl_frame2, text="⚠ 突發高階訂單！(動態調分逆襲)", bg="#BA55D3", fg="white", font=("Helvetica", 10, "bold"), command=self.trigger_urgent_order)
        btn_order.grid(row=0, column=0, padx=15)

        self.btn_climate = tk.Button(ctrl_frame2, text="❄ 啟動金門經武坑道【微氣候調控】(加速熟成)", bg="#4682B4", fg="white", font=("Helvetica", 10, "bold"), command=self.toggle_climate)
        self.btn_climate.grid(row=0, column=1, padx=15)

        # --- 左右主區塊分流 ---
        layout_frame = tk.Frame(self.root)
        layout_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=5)

        # 左邊：動態大畫布與滾動條
        canvas_frame = tk.Frame(layout_frame)
        canvas_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        v_scrollbar = tk.Scrollbar(canvas_frame, orient=tk.VERTICAL)
        v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        h_scrollbar = tk.Scrollbar(canvas_frame, orient=tk.HORIZONTAL)
        h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)

        self.canvas = tk.Canvas(canvas_frame, bg="#FDF5E6", highlightthickness=1, highlightbackground="#CD853F",
                                yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        v_scrollbar.config(command=self.canvas.yview)
        h_scrollbar.config(command=self.canvas.xview)
        self.canvas.bind_all("<MouseWheel>", lambda event: self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units"))

        # 右邊：產線中央監控日誌與 ERP 看板
        right_frame = tk.Frame(layout_frame, width=280, bg="#FFF8DC", highlightthickness=1, highlightbackground="#D2691E")
        right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        right_frame.pack_propagate(False)

        tk.Label(right_frame, text="📊 KKL 中央生產看板", font=("Helvetica", 12, "bold"), bg="#D2691E", fg="white").pack(fill=tk.X)
        
        # 統計資訊
        self.stats_label = tk.Label(right_frame, text="", font=("Helvetica", 10), bg="#FFF8DC", justify=tk.LEFT)
        self.stats_label.pack(anchor="w", padx=10, pady=10)
        self.update_stats_display()

        tk.Label(right_frame, text="📜 自動裝瓶出廠日誌", font=("Helvetica", 11, "bold"), bg="#8B4513", fg="white").pack(fill=tk.X, pady=(10, 0))
        self.log_box = tk.Text(right_frame, bg="#FFFFFF", font=("Helvetica", 9), state=tk.DISABLED)
        self.log_box.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

    # ==========================================
    # 3. 系統核心邏輯運作
    # ==========================================

    def push_to_heap(self):
        name = self.酒款選單.get()
        try:
            pri = int(self.分數輸入.get())
        except ValueError:
            pri = random.randint(50, 100)
        
        new_barrel = LiquorBarrel(self.barrel_counter, name, pri)
        self.barrel_counter += 1
        self.heap_sys.insert(new_barrel)
        
        self.分數輸入.delete(0, tk.END)
        self.分數輸入.insert(0, str(random.randint(50, 100)))
        self.draw_all()

    def pop_to_queue(self):
        best_barrel = self.heap_sys.extract_max()
        if best_barrel:
            self.static_queue.append((best_barrel, time.time()))
        self.draw_all()

    def trigger_urgent_order(self):
        """功能：突發高階訂單 (動態將末端某桶陳高調高分數，使其 Shift Up 逆襲)"""
        heap = self.heap_sys.heap
        if len(heap) <= 1:
            return
        
        # 隨機選一個非頂端的原酒桶
        target_idx = random.randint(1, len(heap) - 1)
        old_name = heap[target_idx].name
        old_pri = heap[target_idx].priority
        
        # 拔高分數到 105，並重新引發向上調整
        heap[target_idx].priority = 105
        heap[target_idx].name = "★緊急陳高"
        
        self.add_log(f"⚡ 突發訂單：ID {heap[target_idx].id} {old_name}(原評:{old_pri}) 優先度爆升至 105！")
        self.heap_sys._shift_up(target_idx)
        self.heap_sys.highlight_nodes = []
        self.draw_all()

    def toggle_climate(self):
        """功能：切換金門坑道微氣候調控模式 (開/關 加速熟成)"""
        self.climate_speedup = not self.climate_speedup
        if self.climate_speedup:
            self.btn_climate.config(text="🔥 坑道呼吸效應中 (熟成速度 x3)", bg="#FF4500")
            self.add_log("❄ 系統提示：開啟經武坑道恆溫恆濕環境，高粱酒呼吸熟成速度增快 3 倍！")
        else:
            self.btn_climate.config(text="❄ 啟動金門經武坑道【微氣候調控】", bg="#4682B4")
            self.add_log("❄ 系統提示：微氣候調控關閉，恢復正常熟成流速。")

    def add_log(self, text):
        """將紀錄寫入右側日誌"""
        self.log_box.config(state=tk.NORMAL)
        self.log_box.insert(tk.END, text + "\n\n")
        self.log_box.see(tk.END)
        self.log_box.config(state=tk.DISABLED)

    def update_stats_display(self):
        """更新 ERP 生產看板數據"""
        total = sum(self.stats.values())
        text = (f"🎯 總裝瓶出廠量: {total} 箱\n"
                f"---------------------\n"
                f"🍶 特級高粱酒: {self.stats['特級高粱']} 箱\n"
                f"🍶 金門陳年高粱: {self.stats['金門陳高']} 箱\n"
                f"🍶 精釀二鍋頭: {self.stats['二鍋頭原酒']} 箱\n"
                f"🍶 戰酒黑金龍: {self.stats['戰酒黑金龍']} 箱")
        self.stats_label.config(text=text)

    # ==========================================
    # 4. 全動態渲染與動畫刷新
    # ==========================================

    def draw_all(self):
        self.canvas.delete("all")
        heap = self.heap_sys.heap
        
        # 動態精算高度避開堆擠
        depth = math.ceil(math.log2(len(heap) + 1)) if heap else 1
        heap_area_height = max(240, depth * 75 + 40)
        queue_start_y = heap_area_height + 50
        
        total_canvas_height = queue_start_y + 260
        total_canvas_width = max(950, len(heap) * 32, len(self.static_queue) * 160 + 150)
        self.canvas.config(scrollregion=(0, 0, total_canvas_width, total_canvas_height))

        # 裝飾藝術
        self.canvas.create_text(150, 25, text="【發酵與熟成酒窖 Max-Heap】", font=("Helvetica", 12, "bold"), fill="#8B4513")
        self.canvas.create_line(20, queue_start_y - 20, total_canvas_width - 20, queue_start_y - 20, fill="#CD853F", dash=(4, 4), width=2)
        
        q_title = "【實體管路靜置與化學穩定 FIFO Queue】 (🔥 坑道呼吸加速中... x3)" if self.climate_speedup else "【實體管路靜置與化學穩定 FIFO Queue】(正常呼吸靜置中...)"
        self.canvas.create_text(250, queue_start_y, text=q_title, font=("Helvetica", 12, "bold"), fill="#000080")

        # A. 繪製 Max-Heap (具有節點交換動態高亮)
        if heap:
            positions = {}
            max_leaf_nodes = 2 ** (depth - 1)
            tree_width = max(900, max_leaf_nodes * 55)
            
            for i in range(len(heap)):
                level = math.floor(math.log2(i + 1)) if i > 0 else 0
                num_nodes_in_level = 2 ** level
                pos_in_level = i - (2 ** level - 1)
                
                seg_width = tree_width / num_nodes_in_level
                x = seg_width / 2 + pos_in_level * seg_width + 10
                y = 70 + level * 75
                positions[i] = (x, y)

            # 畫支架線
            for i in range(len(heap)):
                left = 2 * i + 1
                right = 2 * i + 2
                if left < len(heap):
                    self.canvas.create_line(positions[i][0], positions[i][1], positions[left][0], positions[left][1], fill="#A0522D", width=2)
                if right < len(heap):
                    self.canvas.create_line(positions[i][0], positions[i][1], positions[right][0], positions[right][1], fill="#A0522D", width=2)

            # 畫酒甕節點
            for i, barrel in enumerate(heap):
                x, y = positions[i]
                
                # 動態交換高亮判定
                if i in self.heap_sys.highlight_nodes:
                    color = "#FF1493"  # 交換中的酒罐變粉紅色流光
                    outline_color = "#FFD700"
                    outline_w = 3
                elif i == 0:
                    color = "#8B0000"  # 頂端老酒深紅色
                    outline_color = "#5C2E0B"
                    outline_w = 1
                else:
                    color = "#D2691E"  # 普通原酒罈黃褐色
                    outline_color = "#5C2E0B"
                    outline_w = 1
                
                radius_x, radius_y = (22, 16) if depth < 5 else (18, 13)
                self.canvas.create_oval(x-radius_x, y-radius_y, x+radius_x, y+radius_y+4, fill=color, outline=outline_color, width=outline_w)
                self.canvas.create_rectangle(x-(radius_x//2), y-radius_y-5, x+(radius_x//2), y-radius_y, fill="#FFD700", outline="#5C2E0B")
                
                font_sz = 9 if depth < 5 else 7
                self.canvas.create_text(x, y-2, text=barrel.name[:4], fill="white", font=("Helvetica", font_sz, "bold"))
                self.canvas.create_text(x, y+9, text=f"ID:{barrel.id}|{barrel.priority}", fill="#FFFFE0", font=("Helvetica", font_sz-1))
                
                if i == 0:
                    self.canvas.create_text(x, y-32, text="★ 首選勾兌原酒", fill="#FF4500", font=("Helvetica", 9, "bold"))
        else:
            self.canvas.create_text(450, 150, text="儲酒窖目前空置，請蒸餾新原酒入庫。", fill="gray", font=("Helvetica", 12))

        # B. 繪製 Queue (加上管路外框與流動倒數)
        pipe_y = queue_start_y + 45
        self.canvas.create_rectangle(40, pipe_y, total_canvas_width - 40, pipe_y + 120, outline="#4682B4", width=3, fill="#F0F8FF")
        self.canvas.create_text(110, pipe_y - 15, text="⇐ ［自動裝瓶線］(FIFO 出口)", font=("Helvetica", 10, "bold"), fill="#228B22")
        self.canvas.create_text(total_canvas_width - 120, pipe_y - 15, text="⇐ ［勾兌管路］(入口)", font=("Helvetica", 10, "bold"), fill="#696969")

        if self.static_queue:
            for idx, (barrel, _) in enumerate(self.static_queue):
                # 剩餘時間顯示
                remaining = barrel.rest_time
                is_ready = remaining <= 0
                bg_color = "#3CB371" if is_ready else "#4169E1"
                
                qx = 120 + idx * 160
                qy = pipe_y + 60
                self.canvas.create_oval(qx-40, qy-30, qx+40, qy+35, fill=bg_color, outline="#1C39BB", width=2)
                self.canvas.create_rectangle(qx-20, qy-38, qx+20, qy-28, fill="#FFD700", outline="#1C39BB")
                
                self.canvas.create_text(qx, qy-10, text=barrel.name, fill="white", font=("Helvetica", 10, "bold"))
                self.canvas.create_text(qx, qy+8, text=f"ID: {barrel.id}", fill="#FFFFE0", font=("Helvetica", 9))
                
                if is_ready:
                    self.canvas.create_text(qx, qy+24, text="融合完畢 ✓", fill="#ADFF2F", font=("Helvetica", 9, "bold"))
                else:
                    self.canvas.create_text(qx, qy+24, text=f"靜置中:{remaining:.1f}s", fill="#FFFFFF", font=("Helvetica", 9))
        else:
            self.canvas.create_text(450, pipe_y + 60, text="勾兌管路目前無酒液靜置中。", fill="gray", font=("Helvetica", 11))

    def animate_loop(self):
        """核心計時器：每 100ms 更新一次。處理 Queue 時間遞減與先進先出出庫"""
        # 根據是否開啟坑道微氣候調控，時間遞減速度不同
        tick = 0.1 * (3.0 if self.climate_speedup else 1.0)
        
        if self.static_queue:
            # 減少 Queue 中所有原酒桶的剩餘靜置時間
            for barrel, entry_time in self.static_queue:
                barrel.rest_time = max(0.0, barrel.rest_time - tick)
            
            # 先進先出 (FIFO) 檢查：只有最前頭 (Index 0) 且時間歸零的酒可以出廠裝瓶
            first_barrel, _ = self.static_queue[0]
            if first_barrel.rest_time <= 0:
                popped_barrel, _ = self.static_queue.pop(0)
                
                # 更新中央看板數據 (排除緊急/測試命名標籤)
                clean_name = popped_barrel.name.replace("★緊急", "")
                if clean_name in self.stats:
                    self.stats[clean_name] += 1
                else:
                    self.stats["特級高粱"] += 1  # 預設分類
                
                # 寫入歷史日誌
                now_str = time.strftime("%H:%M:%S", time.localtime())
                self.add_log(f"［{now_str}］🍾 裝瓶出廠成功！\n流水號: ID {popped_barrel.id}\n酒款: {clean_name}")
                self.update_stats_display()
                
        self.draw_all()
        self.root.after(100, self.animate_loop)

if __name__ == "__main__":
    root = tk.Tk()
    app = KKLSizingApp(root)
    root.mainloop()
