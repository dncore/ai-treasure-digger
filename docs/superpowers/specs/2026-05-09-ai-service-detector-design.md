# AI Treasure Digger - Design Spec

Windows 桌面应用，检测并管理设备上 AI 生成的临时服务（Node、Python、Docker、WSL），提供停止、禁用自启动、可选文件清理功能。

## 1. 架构

**单进程架构：** Tauri v2 (Rust + WebView2 + React)

```
┌─────────────────────────────────────────────┐
│              Tauri 单进程应用                  │
│                                             │
│  ┌──────────────┐     ┌──────────────────┐  │
│  │  React 前端   │◄───►│  Tauri Commands  │  │
│  │  (WebView2)   │     │  (Rust 后端)      │  │
│  └──────────────┘     └──────────────────┘  │
│                              │              │
│                    ┌─────────┴─────────┐    │
│                    │   Windows API     │    │
│                    │   / System Calls  │    │
│                    └───────────────────┘    │
└─────────────────────────────────────────────┘
```

- 前端通过 `invoke()` 调用 Tauri commands → Rust 执行系统操作 → 返回结构化数据 → 前端渲染
- 所有检测逻辑在主进程，通过 async commands 避免阻塞 UI
- 分发方式：免安装便携 exe（~3-5MB）

## 2. 检测逻辑

### 2.1 服务识别策略（多维度启发式）

| 维度 | 检测方式 | 示例 |
|------|---------|------|
| 进程类型 | 枚举进程 exe 路径，匹配 node.exe/python.exe/docker/wsl | `C:\Program Files\nodejs\node.exe` |
| 启动命令行 | 读取进程命令行参数，匹配 AI 关键词 | `node server.js`、`python -m flask` |
| 端口监听 | 遍历 TCP/UDP 监听端口，关联到 PID | PID 1234 监听 :3000 |
| 工作目录 | 读取进程 cwd，检测 AI 项目特征文件 | `.env`、`package.json`、`requirements.txt` |
| Docker 容器 | Docker Engine API (`GET /containers/json`) | `docker ps` 等效 |
| WSL 实例 | `wsl --list --running --verbose` | Ubuntu-22.04 running |

### 2.2 AI 关键词库

`ollama`、`langchain`、`flask`、`fastapi`、`gradio`、`streamlit`、`jupyter`、`uvicorn`、`openai`、`llama`、`gpt`、`ai`、`model`、`serve`、`inference`、`api`、`chat`、`bot`、`agent`

### 2.3 自启动检测范围

- 注册表 Run 键：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`、`HKLM\Software\Microsoft\Windows\CurrentVersion\Run`
- 任务计划程序：通过 ITaskService 枚举所有任务

### 2.4 检测流程

```
应用启动
  ├─► 枚举所有进程 → 提取 exe 路径、命令行、cwd → 匹配 ServiceType
  ├─► 扫描端口 (GetExtendedTcpTable/GetExtendedUdpTable) → 关联到 PID
  ├─► 查询资源占用 (GetProcessTimes / GetProcessMemoryInfo)
  ├─► 检测自启动 (注册表 + 任务计划程序)
  ├─► Docker 检测 (HTTP → npipe: //./pipe/docker_engine)
  ├─► WSL 检测 (wsl --list --running --verbose)
  └─► 聚合数据，计算 risk_level，返回前端
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
    disk_usage: u64,              // 工作目录下匹配 ALLOWED_CLEANUP_TARGETS 的文件总大小
    is_autostart: bool,
    autostart_source: Option<String>,
    children: Vec<u32>,
    safe_to_stop: bool,
    risk_level: RiskLevel,
}

struct PortBinding {
    protocol: String,
    local_addr: String,
    remote_addr: Option<String>,
    state: String,
}

enum RiskLevel {
    Low,       // 普通进程，停止无副作用
    Medium,    // 有未保存数据的可能
    High,      // WSL 实例，停止会丢失数据
}
```

## 4. UI 设计

### 4.1 整体布局

左侧窄侧边栏（60px 图标模式）+ 右侧主内容区。暗色主题为主，支持切换亮色。

### 4.2 页面

- **Dashboard** — 资源概览卡片（活跃服务数、端口占用、CPU/内存/磁盘占用）+ 自启动服务告警列表
- **Services** — 服务列表页，按类型筛选（全部/Node/Python/Docker/WSL），支持搜索，每个服务一张卡片展示关键信息，提供停止/禁用自启/详情操作
- **Cleanup** — 从 ServiceDetail 触发清理向导，分3步：选择清理范围 → WSL二次确认（仅WSL服务） → 执行与进度
- **Settings** — 刷新间隔调整、排除规则、导出日志、打开日志目录

### 4.3 交互细节

- 停止操作加 loading 状态，完成后卡片变灰移入"已停止"区域
- 批量操作：Services 页顶部"停止所有 Node 进程"、"停止所有 Python 进程"快捷按钮
- 清理向导"中止"按钮立即停止当前文件删除，保留已完成操作
- Dashboard 默认 5 秒刷新，Services 页 10 秒刷新
- 无服务时显示空状态插画 + "你的设备很干净"

### 4.4 WSL 二次确认

- 两个复选框必须全部勾选才能激活"确认停止"按钮
- WSL 清理不提供文件删除选项（WSL 文件系统由 WSL 管理，外部删除不可控）

## 5. 安全机制

### 5.1 三层防护

**第一层：操作白名单**

禁止删除的路径模式：
- `C:\Windows\`
- `C:\Program Files\`、`C:\Program Files (x86)\`
- `C:\ProgramData\`
- `C:\Users\*\AppData\Local\Microsoft\`、`...\Roaming\Microsoft\`、`...\Packages\`
- `C:\Users\*\ntuser.*`
- 驱动器根目录

允许删除的文件/目录名（AI 临时文件特征）：
- `node_modules`、`.venv`、`venv`、`__pycache__`、`.cache`、`.pytest_cache`、`.mypy_cache`
- `dist`、`build`、`.next`、`.nuxt`
- `.env.local`、`.env.development.local`
- `Dockerfile`、`docker-compose.yml`

源代码目录（默认不选中，允许用户手动勾选）：
- `src`、`lib`、`app`、`components`、`pages`、`internal`、`pkg`、`cmd`

**第二层：运行时校验**

每次删除操作前：
1. 路径匹配禁止模式 → 拒绝
2. 路径在允许名单中 → 可选删除
3. 路径在源代码目录 → 默认不选中，显示警告

**第三层：WSL 专项保护**

- WSL 停止必须二次确认
- WSL 不提供文件删除选项

### 5.2 操作回滚

| 操作类型 | 可否回滚 | 策略 |
|---------|---------|------|
| 停止进程 | 否 | 提示"停止后需要手动重启" |
| 禁用自启动 | 是 | 备份到 data/backup/，提供"恢复自启动"按钮 |
| 删除文件 | 部分 | 中止时保留已删除部分，停止后续删除 |

### 5.3 错误处理

- 权限不足 → 提示"需要管理员权限" + "以管理员身份重启"按钮
- Docker 未运行 → 静默跳过，UI 显示"Docker 未运行"
- WSL 未安装 → 静默跳过，同上
- 进程已退出 → 标记为"已停止"，无错误提示
- 未知错误 → Toast + 错误详情可展开 + 日志文件路径

### 5.4 日志系统

- 存储：exe 同级 `data/logs/`（便携模式）
- 格式：`YYYY-MM-DD_HH-mm-ss.log`
- 内容：检测结果、用户操作、文件删除详情、错误信息
- 自动清理 30 天前日志
- Settings 提供导出日志和打开日志目录

## 6. Tauri Commands API

```rust
// 扫描检测
async fn scan_services() -> Result<Vec<DetectedService>, String>;
async fn get_resource_summary() -> Result<ResourceSummary, String>;

// 服务操作
async fn stop_service(id: String) -> Result<(), String>;
async fn stop_services_by_type(service_type: ServiceType) -> Result<BatchResult, String>;

// 自启动管理
async fn disable_autostart(id: String) -> Result<(), String>;
async fn restore_autostart(id: String) -> Result<(), String>;

// 清理
async fn get_cleanup_targets(id: String) -> Result<Vec<CleanupTarget>, String>;
async fn start_cleanup(id: String, selected_paths: Vec<String>) -> Result<(), String>;
async fn abort_cleanup() -> Result<(), String>;

// 系统
async fn restart_as_admin() -> Result<(), String>;
async fn get_settings() -> Result<AppSettings, String>;
async fn save_settings(settings: AppSettings) -> Result<(), String>;
```

事件通道（Rust → 前端）：
- `cleanup-progress`：当前文件、完成数/总数、已释放字节数
- `service-changed`：服务 ID + 新状态

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
│       │   ├── process.rs
│       │   ├── port.rs
│       │   ├── resource.rs
│       │   ├── docker.rs
│       │   └── wsl.rs
│       ├── autostart/
│       │   ├── mod.rs
│       │   ├── registry.rs
│       │   └── task_scheduler.rs
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
│   │   ├── dashboard/
│   │   ├── services/
│   │   ├── cleanup/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   └── styles/
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
| 前端框架 | React 18 + TypeScript | 生态最大、组件库丰富、Tauri 支持最成熟 |
| CSS 方案 | Tailwind CSS | 快速开发、暗色主题天然支持、小包体积 |
| UI 组件库 | shadcn/ui | 可定制、无运行时依赖、现代设计语言 |
| 构建工具 | Vite | Tauri 默认集成、HMR 快速 |
| 应用数据 | exe 同级 data/ 目录 | 便携模式，不写入 AppData |
