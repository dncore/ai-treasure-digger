# AI Treasure Digger — 修正架构设计

> 基于 2026-05-09 初版设计的架构评审修正。标注了每项修正的原因（Why）。

## 1. 架构

**单进程 + 后台扫描线程：** Tauri v2 (Rust + WebView2 + React)

```
┌──────────────────────────────────────────────────────────────┐
│                     Tauri 单进程应用                           │
│                                                              │
│  ┌──────────────┐     ┌───────────────────┐                  │
│  │  React 前端   │◄───►│  Tauri Commands   │                  │
│  │  (WebView2)   │     │  (读取缓存状态)     │                  │
│  └──────────────┘     └─────────┬─────────┘                  │
│                                 │ read                       │
│                       ┌─────────┴─────────┐                  │
│                       │  ScanState (Arc)   │◄──── events      │
│                       │  共享扫描缓存        │                  │
│                       └─────────┬─────────┘                  │
│                                 │ write                       │
│                       ┌─────────┴─────────┐                  │
│                       │  Background Scanner│                  │
│                       │  (tokio::spawn)    │                  │
│                       │  定时扫描，非阻塞    │                  │
│                       └───────────────────┘                  │
│                              │                               │
│                    ┌─────────┴─────────┐                     │
│                    │   Windows API     │                     │
│                    │   / System Calls  │                     │
│                    └───────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

**修正原因（Why）：** 初版设计在 `async fn scan_services()` 中直接执行同步系统调用（EnumProcesses、注册表读取等），会阻塞 tokio worker thread，5 秒刷新间隔下会导致 UI 卡顿。改为后台 tokio task 周期扫描，Commands 只读取缓存状态。

- 前端通过 `invoke()` 调用 Tauri commands → 读取共享缓存 → 返回结构化数据 → 前端渲染
- 后台扫描线程独立运行，通过 Tauri events 通知前端数据变更
- 分发方式：免安装便携 exe（~3-5MB）

## 2. 检测逻辑

### 2.1 两级检测策略

**修正原因（Why）：** 初版关键词库包含 `"ai"` `"api"` `"chat"` 等泛化词，单个关键词即触发匹配，误报率极高。用户首次看到自己的文本编辑器被标成"AI 服务"就会失去信任。

#### 第一层：硬匹配（低误报）

已知 AI 进程的精确签名匹配：

| 进程 | 匹配规则 | 类型 |
|------|---------|------|
| Ollama | 命令行包含 `ollama` | NodeProcess/PythonProcess |
| LM Studio | exe 路径包含 `lm-studio` 或 `lmstudio` | NodeProcess |
| Jupyter Notebook | 命令行包含 `jupyter-notebook` 或 `jupyter notebook` | PythonProcess |
| Jupyter Lab | 命令行包含 `jupyter-lab` 或 `jupyter lab` | PythonProcess |
| Gradio | 命令行包含 `gradio` | PythonProcess |
| Streamlit | 命令行包含 `streamlit run` | PythonProcess |
| FastAPI/Uvicorn | 命令行包含 `uvicorn` | PythonProcess |
| Flask | 命令行包含 `flask run` 或 `python -m flask` | PythonProcess |
| Node AI Server | 命令行包含 `node` 且 exe 为 `node.exe` | NodeProcess |
| Python AI Script | 命令行包含 `python` 且 exe 为 `python*.exe` | PythonProcess |
| Docker | Docker Engine API / `docker ps` | DockerContainer |
| WSL | `wsl --list --running --verbose` | WslInstance |

硬匹配规则：只要命令行包含上述签名，即标记为 AI 服务，不再检查关键词。

#### 第二层：软匹配（多词共现）

当硬匹配未命中时，使用关键词多词共现检测。要求：**至少 2 个来自不同类别的关键词同时出现**。

关键词分为 4 个互斥类别（同类别内不累计）：

| 类别 | 关键词 |
|------|--------|
| AI 模型 | `ollama`, `llama`, `gpt`, `openai`, `model`, `inference` |
| AI 应用 | `langchain`, `chat`, `bot`, `agent` |
| Web 服务 | `flask`, `fastapi`, `gradio`, `streamlit`, `uvicorn`, `jupyter`, `serve` |
| API 接口 | `api`, `endpoint` |

共现规则：命令行中同时包含来自 ≥2 个类别的关键词时，标记为 AI 服务。

**示例：**
- `python app.py` → 仅 0 个类别关键词 → **不匹配**（正确，普通脚本）
- `python api.py` → 仅 API 类别 1 个 → **不匹配**（正确，普通 API）
- `python api.py --model gpt` → AI模型 + API 两个类别 → **匹配**
- `node serve.js` → 仅 Web服务 1 个 → **不匹配**（正确，普通 Node 服务）
- `node serve.js --chat` → Web服务 + AI应用 两个类别 → **匹配**

### 2.2 端口-进程关联

扫描端口时记录对应的 PID（`GetExtendedTcpTable` 返回的 `dwOwningPid`），然后在进程检测中通过 PID 关联端口到服务。

### 2.3 自启动检测范围

- 注册表 Run 键：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`、`HKLM\Software\Microsoft\Windows\CurrentVersion\Run`
- 任务计划程序：`schtasks /query /fo LIST /v`（LIST 格式而非 CSV，字段名稳定）

### 2.4 检测流程

```
应用启动
  ├─► 启动后台扫描线程（tokio::spawn）
  │     ├─► 枚举所有进程 → 两级匹配 → 确定 ServiceType
  │     ├─► 扫描端口（含 PID）→ 关联到进程
  │     ├─► 查询资源占用 (GetProcessTimes / GetProcessMemoryInfo)
  │     ├─► 检测自启动 (注册表 + 任务计划程序)
  │     ├─► Docker 检测
  │     ├─► WSL 检测
  │     ├─► 聚合数据，计算 risk_level
  │     ├─► 更新共享缓存（Arc<RwLock<ScanState>>）
  │     └─► 发送 service-changed 事件
  │
  └─► 前端 invoke() → 读取缓存 → 返回（无阻塞）
```

## 3. 数据模型

```rust
enum ServiceType {
    NodeProcess,
    PythonProcess,
    DockerContainer,
    WslInstance,
}

struct DetectedService {
    id: String,              // type:pid 或 type:container_id
    service_type: ServiceType,
    name: String,
    pid: Option<u32>,
    command_line: String,
    working_dir: String,
    ports: Vec<PortBinding>,
    cpu_usage: f32,
    memory_usage: u64,
    disk_usage: u64,
    is_autostart: bool,
    autostart_source: Option<String>,
    children: Vec<u32>,
    safe_to_stop: bool,
    risk_level: RiskLevel,
    detection_method: DetectionMethod,  // 新增：标记是硬匹配还是软匹配
}

enum DetectionMethod {
    HardMatch,     // 第一层精确签名
    SoftMatch,     // 第二层多词共现
}

struct PortBinding {
    protocol: String,
    local_addr: String,
    remote_addr: Option<String>,
    state: String,
    owning_pid: Option<u32>,  // 新增：端口所属进程 PID
}

enum RiskLevel {
    Safe,       // 无端口监听、无客户端连接
    Caution,    // 有端口监听或有子进程
    Danger,     // 有活跃连接或长时间运行（>1h）
    Critical,   // WSL 实例 / Docker 容器
}
```

**修正原因（Why）：**
- `DetectionMethod`：让前端可以区分可信度，硬匹配的服务高亮显示，软匹配的服务用淡色标记
- `RiskLevel` 四级：初版 Low/Medium/High 太粗糙，任何有端口的进程停了都可能影响客户端，"Low" 给了错误的安全感
- `PortBinding.owning_pid`：端口必须关联到 PID，否则端口数据无法挂到服务卡片上

## 4. UI 设计

### 4.1 整体布局

左侧窄侧边栏（60px 图标模式）+ 右侧主内容区。暗色主题为主，支持切换亮色。

### 4.2 页面（3 页 + 1 模态）

- **Dashboard** — 资源概览卡片 + **Top 5 资源消耗排行** + 自启动服务告警列表
- **Services** — 服务列表页，按类型筛选，多选模式支持批量操作，每个卡片提供停止/禁用自启/清理操作
- **Settings** — 刷新间隔调整、排除规则、导出日志、打开日志目录
- ~~Cleanup 页面~~ → **清理向导 Modal**（从 Service 卡片"清理"按钮触发）

**修正原因（Why）：** 清理操作是从某个具体 Service 触发的，做成独立页面导致空页面+提示文字"请先去 Services 页选服务"，是差的 UX。改为从 Service 卡片直接触发的 Modal 向导。

### 4.3 Dashboard 设计

```
┌──────────────────────────────────────────────────────┐
│  Dashboard                                           │
│                                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │活跃服务 │ │端口占用 │ │CPU使用  │ │内存使用 │       │
│  │   7    │ │   12   │ │ 15.3% │ │ 2.1GB │       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                      │
│  Top 5 资源消耗                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ 1. ollama serve       CPU 8.2%  MEM 1.2GB    │   │
│  │ 2. jupyter-notebook   CPU 3.1%  MEM 540MB    │   │
│  │ 3. gradio app.py      CPU 1.8%  MEM 320MB    │   │
│  │ 4. node server.js     CPU 0.9%  MEM 180MB    │   │
│  │ 5. python -m flask    CPU 0.5%  MEM 120MB    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  自启动服务 (3)                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⚠ Ollama Server    HKCU\Run                  │   │
│  │ ⚠ Jupyter Lab      Task Scheduler            │   │
│  │ ⚠ LM Studio        HKCU\Run                  │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 4.4 Services 页面

- 按类型筛选标签（全部/Node/Python/Docker/WSL）
- **多选模式**：卡片左侧复选框，选中后顶部出现批量操作栏（停止选中、禁用自启）
- 每张卡片显示：名称、类型标签、风险级别、命令行、PID、资源占用、端口
- 操作按钮：停止、禁用自启、**清理**（触发清理 Modal）

### 4.5 清理向导 Modal

从 Service 卡片"清理"按钮触发，分 3 步：

1. **选择清理范围** — 列出可清理项，按三类标记：
   - 🟢 可安全删除（可重建）：`node_modules`, `.venv`, `__pycache__`, `.cache`, `dist`, `build`, `.next`
   - 🟡 需警告删除（不可重建）：`.env.local`, `Dockerfile`, `docker-compose.yml`
   - 🔴 默认不选（源代码）：`src`, `lib`, `app`, `components`, `pages`
2. **WSL 二次确认**（仅 WSL 服务）— 两个复选框必须全勾
3. **执行与进度** — 实时显示当前删除文件、进度、已释放空间

### 4.6 Toast 通知

- 操作成功：绿色 Toast，2 秒自动消失
- 操作失败：红色 Toast，显示错误摘要 + 可展开详情
- 权限不足：Toast + "以管理员身份重启"按钮

## 5. 安全机制

### 5.1 三层防护

**第一层：路径黑名单**

禁止删除的路径模式：
- `C:\Windows\`
- `C:\Program Files\`、`C:\Program Files (x86)\`
- `C:\ProgramData\`
- `C:\Users\*\AppData\Local\Microsoft\`、`...\Roaming\Microsoft\`、`...\Packages\`
- `C:\Users\*\ntuser.*`
- 驱动器根目录

**第二层：清理目标三级分类**

| 分类 | 项目 | 默认选中 | 可重建 |
|------|------|---------|--------|
| 🟢 可安全删除 | `node_modules`, `.venv`, `venv`, `__pycache__`, `.cache`, `.pytest_cache`, `.mypy_cache`, `dist`, `build`, `.next`, `.nuxt` | 是 | 是 |
| 🟡 需警告删除 | `.env.local`, `.env.development.local`, `Dockerfile`, `docker-compose.yml` | 否 | 否 |
| 🔴 源代码 | `src`, `lib`, `app`, `components`, `pages`, `internal`, `pkg`, `cmd` | 否 | 否 |

**修正原因（Why）：** 初版把 `Dockerfile`/`docker-compose.yml` 放在允许删除列表且默认选中。这些是不可重建的源文件，删除后无法恢复。`.env.local` 可能包含 API key，删除同样危险。必须分到警告类别且默认不选中。

**第三层：WSL 专项保护**

- WSL 停止必须二次确认（两个复选框）
- WSL 不提供文件删除选项

### 5.2 操作回滚

| 操作类型 | 可否回滚 | 策略 |
|---------|---------|------|
| 停止进程 | 否 | 提示"停止后需要手动重启" |
| 禁用自启动 | 是 | 备份到 data/backup/，提供"恢复自启动"按钮 |
| 删除文件 | 部分 | 中止时保留已删除部分，停止后续删除 |

### 5.3 错误处理

- 权限不足 → Toast + "以管理员身份重启"按钮
- Docker 未运行 → 静默跳过，UI 显示"Docker 未运行"
- WSL 未安装 → 静默跳过
- 进程已退出 → 标记为"已停止"
- 未知错误 → Toast + 错误详情可展开 + 日志文件路径

### 5.4 日志系统

- 存储：exe 同级 `data/logs/`
- 格式：`YYYY-MM-DD_HH-mm-ss.log`
- 内容：检测结果、用户操作、文件删除详情、错误信息
- 自动清理 30 天前日志
- Settings 提供导出日志和打开日志目录

## 6. Tauri Commands API

```rust
// 扫描（读取缓存，不阻塞）
async fn get_services() -> Result<Vec<DetectedService>, String>;
async fn get_resource_summary() -> Result<ResourceSummary, String>;
async fn get_top_consumers(n: usize) -> Result<Vec<DetectedService>, String>;

// 服务操作
async fn stop_service(id: String) -> Result<(), String>;
async fn stop_services(ids: Vec<String>) -> Result<BatchResult, String>;

// 自启动管理
async fn disable_autostart(id: String) -> Result<(), String>;
async fn restore_autostart(id: String) -> Result<(), String>;

// 清理
async fn get_cleanup_targets(id: String) -> Result<Vec<CleanupTarget>, String>;
async fn start_cleanup(id: String, selected_paths: Vec<String>) -> Result<(), String>;
async fn abort_cleanup() -> Result<(), String>;

// 扫描控制
async fn trigger_scan() -> Result<(), String>;  // 手动触发即时扫描

// 系统
async fn restart_as_admin() -> Result<(), String>;
async fn get_settings() -> Result<AppSettings, String>;
async fn save_settings(settings: AppSettings) -> Result<(), String>;
```

事件通道（Rust → 前端）：
- `service-changed`：扫描完成后发送完整服务列表
- `cleanup-progress`：`{ current_file, completed, total, freed_bytes }`

## 7. 项目结构

```
ai-treasure-digger/
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── icons/
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands.rs
│       ├── scanner/
│       │   ├── mod.rs
│       │   ├── process.rs        # 两级检测
│       │   ├── port.rs           # 含 PID 关联
│       │   ├── resource.rs
│       │   ├── docker.rs
│       │   └── wsl.rs
│       ├── autostart/
│       │   ├── mod.rs
│       │   ├── registry.rs
│       │   └── task_scheduler.rs # LIST 格式解析
│       ├── operator/
│       │   ├── mod.rs
│       │   ├── stop.rs
│       │   ├── autostart_mgr.rs
│       │   └── cleanup.rs
│       ├── safety/
│       │   ├── mod.rs
│       │   ├── guard.rs
│       │   ├── wsl_confirm.rs
│       │   └── backup.rs
│       └── models.rs
├── src/                          # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx       # 3 项：Dashboard/Services/Settings
│   │   ├── dashboard/
│   │   │   └── Dashboard.tsx     # 含 Top 5 排行
│   │   ├── services/
│   │   │   ├── Services.tsx      # 含多选模式
│   │   │   └── CleanupModal.tsx  # 清理向导 Modal
│   │   ├── settings/
│   │   │   └── Settings.tsx
│   │   └── ui/
│   │       └── Toast.tsx         # Toast 通知组件
│   ├── hooks/
│   │   ├── useServices.ts
│   │   └── useToast.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
│   └── styles/
│       └── globals.css
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 8. 技术选型汇总

| 层面 | 选型 | 理由 |
|------|------|------|
| 桌面框架 | Tauri v2 | 单 exe、小体积、Rust 性能、WebView2 原生 |
| 后端语言 | Rust | 直接调用 Windows API、内存安全、零成本抽象 |
| 前端框架 | React 18 + TypeScript | 生态最大、Tauri 支持最成熟 |
| CSS 方案 | Tailwind CSS | 快速开发、暗色主题天然支持、小包体积 |
| UI 组件库 | shadcn/ui | 可定制、无运行时依赖、现代设计语言 |
| 构建工具 | Vite | Tauri 默认集成、HMR 快速 |
| 应用数据 | exe 同级 data/ 目录 | 便携模式，不写入 AppData |

## 9. 修正清单（与初版的差异）

| # | 初版 | 修正 | 原因 |
|---|------|------|------|
| 1 | 单关键词匹配 AI 服务 | 两级检测：硬匹配 + 多类别共现 | 单词 `"ai"`/`"api"` 误报率极高 |
| 2 | async command 内直接执行系统调用 | 后台 tokio task 扫描 + 共享缓存 | 同步系统调用阻塞 tokio runtime，5s 刷新下 UI 卡顿 |
| 3 | RiskLevel 三级 (Low/Medium/High) | 四级 (Safe/Caution/Danger/Critical) | 有端口 = 有客户端在连接，"Low" 给了错误安全感 |
| 4 | Cleanup 作为独立页面 | 从 Service 卡片触发的 Modal 向导 | 独立页面导致空页面+提示文字，差的 UX |
| 5 | 批量操作为全局按钮 | 多选模式 + 选中后批量操作栏 | 一键停所有 Node 不合理，用户通常想选特定的 |
| 6 | Dockerfile 默认可删除 | 分到"需警告"类，默认不选 | 不可重建的源文件，删除即丢失 |
| 7 | Dashboard 只有数字卡片 | 新增 Top 5 资源消耗排行 | 用户打开 Dashboard 最想知道"谁在吃资源" |
| 8 | 端口扫描不关联 PID | PortBinding 含 owning_pid | 端口数据无法挂到服务卡片上 |
| 9 | schtasks CSV 格式输出 | 改为 LIST 格式 | CSV 字段顺序跨 Windows 版本不稳定 |
| 10 | 无 DetectionMethod 字段 | 新增，区分硬/软匹配 | 前端可按可信度差异化展示 |
