# AI Treasure Digger

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## Overview

AI Treasure Digger is a desktop application that detects and manages hidden Node.js, Python, Docker, and WSL services running on your Windows machine. Non-technical users often unknowingly start these services and have no idea they're consuming resources, opening ports, or running in the background. This app gives full visibility and control — stop services, disable autostart, and clean up associated files.

Built with **Tauri v2** (Rust + WebView2 + React) — lightweight, fast, and secure.

## Features

- **Full service detection** — Scans ALL Node.js and Python processes, Docker containers, and WSL instances — no keyword filtering, no false negatives
- **4-level risk assessment** — Safe / Caution / Danger / Critical, based on service type, port bindings, and resource usage
- **Background scanning** — Automatic refresh cycle with real-time event emission to the frontend
- **Service management** — Stop individual or batch services, disable autostart entries
- **Cleanup wizard** — 3-tier categorization (Safe / Warning / Source), real-time progress bar, abort support, WSL double-confirm
- **Dark / Light theme** — CSS variable system, persisted to localStorage, respects system preference
- **File logging** — Daily log rotation via `fern`, written to `data/logs/`
- **Portable distribution** — No installer needed on Windows, runs from a single executable (~3-5MB)

## Architecture

```
┌─────────────────────────────────────────────┐
│              Tauri v2 Application            │
│                                             │
│  ┌──────────────┐     ┌──────────────────┐  │
│  │  React SPA    │◄───►│  Tauri Commands  │  │
│  │  (WebView2)   │     │  (Rust Backend)  │  │
│  └──────────────┘     └──────────────────┘  │
│                              │              │
│                    ┌─────────┴─────────┐    │
│                    │   System APIs     │    │
│                    │   / CLI Calls     │    │
│                    └───────────────────┘    │
└─────────────────────────────────────────────┘
```

### Frontend Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Resource overview cards, top 5 consumers, autostart alerts |
| **Services** | Filterable list with type/risk badges, multi-select batch stop, cleanup trigger |
| **Settings** | Refresh interval, excluded paths, log directory |

### Backend Modules

| Module | Responsibility |
|--------|---------------|
| `scanner/` | Process enumeration, port scanning with PID association, Docker/WSL detection |
| `autostart/` | Registry Run key scanning, Task Scheduler enumeration |
| `operator/` | Service stop, autostart enable/disable with backup, file cleanup |
| `safety/` | Path guard (forbidden path validation), WSL confirmation, backup management |
| `logger/` | File logging with daily rotation |

### Tauri Commands

| Command | Description |
|---------|-------------|
| `get_services` | Get all detected services |
| `get_resource_summary` | Aggregate resource statistics |
| `get_top_consumers` | Top N services by resource usage |
| `stop_service` | Stop a single service |
| `stop_services` | Batch stop with `BatchResult` |
| `disable_autostart` | Disable autostart entry (with backup) |
| `restore_autostart` | Restore previously disabled autostart |
| `get_cleanup_targets` | List cleanable paths for a service |
| `start_cleanup` | Execute cleanup with progress events |
| `abort_cleanup` | Abort in-progress cleanup |
| `trigger_scan` | Force an immediate scan |
| `restart_as_admin` | Restart with elevated privileges (Windows) |
| `get_settings` / `save_settings` | Application settings |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 6 + Tailwind CSS 4 |
| Build | Vite 8 |
| Backend | Rust (Tauri v2) |
| System APIs | `windows` crate 0.58 (Win32 APIs) |
| Async Runtime | Tokio |
| Logging | fern + log |
| Package Manager | pnpm 10 |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) LTS
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://www.rust-lang.org/tools/install) stable (1.70+)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

### Install

```bash
git clone https://github.com/dncore/ai-treasure-digger.git
cd ai-treasure-digger
pnpm install
```

### Development

```bash
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

Output artifacts are in `src-tauri/target/release/bundle/`.

## Detection Logic

### Process Detection

All running processes are enumerated and classified by executable name:

| Service Type | Detection |
|-------------|-----------|
| **Node.js** | Executable contains `node` or `nodejs` |
| **Python** | Executable contains `python` |
| **Docker** | Running containers via `docker ps` |
| **WSL** | Running instances via `wsl --list --running` |

### Autostart Detection

Scans Windows Registry Run keys and Task Scheduler for entries matching service keywords:

`node`, `python`, `python3`, `pip`, `npm`, `yarn`, `pnpm`, `docker`, `flask`, `fastapi`, `gradio`, `streamlit`, `uvicorn`, `jupyter`, `gunicorn`, `serve`, `http-server`, `live-server`

### Risk Levels

| Level | Criteria |
|-------|----------|
| **Safe** | No ports, minimal resources |
| **Caution** | CPU > 0.1% or memory > 10MB |
| **Danger** | Has active port bindings |
| **Critical** | Docker container or WSL instance |

## Safety Mechanisms

1. **Forbidden paths** — `C:\Windows\`, `C:\Program Files\`, etc. are never deleted
2. **3-tier cleanup categories** — Safe (rebuildable), Warning (not rebuildable like `.env`), Source (code directories, default unchecked)
3. **WSL double-confirm** — Two explicit checkboxes before terminating a WSL instance
4. **Autostart backup** — Disabled entries are backed up to `data/backup/` and can be restored
5. **Cleanup abort** — In-progress cleanup can be cancelled at any time

## CI/CD

Push a `v*` tag to trigger the GitHub Actions build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow builds for 4 platforms and creates a GitHub Release:

| Platform | Artifacts |
|----------|-----------|
| Windows | `.msi`, `.exe` (NSIS), portable `.zip` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Linux | `.deb`, `.AppImage` |

## Windows Defender Warning

When running the portable executable for the first time, Windows Defender may show a warning about an "unknown publisher". This happens because the executable is not code-signed.

**Why this happens:**
- Code signing certificates cost $200-400/year for individuals
- Windows SmartScreen treats unsigned executables as potentially unsafe
- This is normal for open-source projects without commercial backing

**Workarounds:**
1. Click "More info" → "Run anyway" in the SmartScreen dialog
2. Or build from source: `pnpm tauri build` creates a local unsigned build
3. For organizations: consider purchasing an EV code signing certificate

**Future solution:**
We're exploring free code signing options for open-source projects via [SignPath](https://signpath.org/) (free for OSS) + [AppVeyor](https://www.appveyor.com/).

## Administrator Privileges

Some processes cannot be stopped without administrator privileges. If you see "Access is denied" errors:

1. Open Settings in the app
2. Click "Restart as Administrator"
3. Confirm the UAC prompt
4. The app will restart with elevated privileges

This is required because `taskkill` needs admin rights to terminate certain processes.

## License

MIT

---

<a id="中文"></a>

## 概述

AI Treasure Digger 是一款桌面应用，用于检测和管理 Windows 上隐藏运行的 Node.js、Python、Docker 和 WSL 服务。非技术用户经常在不知情的情况下启动了这些服务，却不知道它们在消耗资源、开放端口或在后台运行。本应用提供完整的可见性和控制能力——停止服务、禁用自启动、清理关联文件。

基于 **Tauri v2**（Rust + WebView2 + React）构建——轻量、快速、安全。

## 功能特性

- **全量服务检测** — 扫描所有 Node.js 和 Python 进程、Docker 容器及 WSL 实例——无关键词过滤，不遗漏任何服务
- **四级风险评估** — Safe / Caution / Danger / Critical，基于服务类型、端口绑定和资源占用
- **后台扫描** — 自动刷新周期，实时事件推送至前端
- **服务管理** — 停止单个或批量服务，禁用自启动项
- **清理向导** — 三级分类（安全/警告/源码），实时进度条，支持中断，WSL 双重确认
- **暗色/亮色主题** — CSS 变量系统，持久化到 localStorage，遵循系统偏好
- **文件日志** — 通过 `fern` 实现日志按天轮转，写入 `data/logs/`
- **便携分发** — Windows 上无需安装程序，单文件运行（~3-5MB）

## 架构

```
┌─────────────────────────────────────────────┐
│              Tauri v2 应用                    │
│                                             │
│  ┌──────────────┐     ┌──────────────────┐  │
│  │  React SPA    │◄───►│  Tauri Commands  │  │
│  │  (WebView2)   │     │  (Rust 后端)      │  │
│  └──────────────┘     └──────────────────┘  │
│                              │              │
│                    ┌─────────┴─────────┐    │
│                    │   系统 API         │    │
│                    │   / CLI 调用       │    │
│                    └───────────────────┘    │
└─────────────────────────────────────────────┘
```

### 前端页面

| 页面 | 说明 |
|------|------|
| **Dashboard** | 资源概览卡片、Top 5 资源消耗、自启动告警 |
| **Services** | 可筛选的服务列表，类型/风险标签，多选批量停止，清理触发 |
| **Settings** | 刷新间隔、排除路径、日志目录 |

### 后端模块

| 模块 | 职责 |
|------|------|
| `scanner/` | 进程枚举、端口扫描（含 PID 关联）、Docker/WSL 检测 |
| `autostart/` | 注册表 Run 键扫描、任务计划程序枚举 |
| `operator/` | 服务停止、自启动启用/禁用（含备份）、文件清理 |
| `safety/` | 路径守卫（禁止路径校验）、WSL 确认、备份管理 |
| `logger/` | 文件日志，按天轮转 |

### Tauri 命令

| 命令 | 说明 |
|------|------|
| `get_services` | 获取所有检测到的服务 |
| `get_resource_summary` | 聚合资源统计 |
| `get_top_consumers` | 按资源占用排序的 Top N 服务 |
| `stop_service` | 停止单个服务 |
| `stop_services` | 批量停止，返回 `BatchResult` |
| `disable_autostart` | 禁用自启动项（含备份） |
| `restore_autostart` | 恢复已禁用的自启动项 |
| `get_cleanup_targets` | 列出服务的可清理路径 |
| `start_cleanup` | 执行清理，带进度事件 |
| `abort_cleanup` | 中断正在进行的清理 |
| `trigger_scan` | 强制立即扫描 |
| `restart_as_admin` | 以管理员权限重启（Windows） |
| `get_settings` / `save_settings` | 应用设置 |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript 6 + Tailwind CSS 4 |
| 构建 | Vite 8 |
| 后端 | Rust (Tauri v2) |
| 系统 API | `windows` crate 0.58 (Win32 API) |
| 异步运行时 | Tokio |
| 日志 | fern + log |
| 包管理器 | pnpm 10 |

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) LTS
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://www.rust-lang.org/tools/install) stable (1.70+)
- [Tauri v2 前置依赖](https://v2.tauri.app/start/prerequisites/)

### 安装

```bash
git clone https://github.com/dncore/ai-treasure-digger.git
cd ai-treasure-digger
pnpm install
```

### 开发

```bash
pnpm tauri dev
```

### 构建

```bash
pnpm tauri build
```

构建产物在 `src-tauri/target/release/bundle/`。

## 检测逻辑

### 进程检测

枚举所有运行中的进程，按可执行文件名分类：

| 服务类型 | 检测方式 |
|---------|---------|
| **Node.js** | 可执行文件包含 `node` 或 `nodejs` |
| **Python** | 可执行文件包含 `python` |
| **Docker** | 通过 `docker ps` 获取运行中容器 |
| **WSL** | 通过 `wsl --list --running` 获取运行中实例 |

### 自启动检测

扫描 Windows 注册表 Run 键和任务计划程序，匹配服务关键词：

`node`、`python`、`python3`、`pip`、`npm`、`yarn`、`pnpm`、`docker`、`flask`、`fastapi`、`gradio`、`streamlit`、`uvicorn`、`jupyter`、`gunicorn`、`serve`、`http-server`、`live-server`

### 风险等级

| 等级 | 判定条件 |
|------|----------|
| **Safe** | 无端口，资源占用极少 |
| **Caution** | CPU > 0.1% 或内存 > 10MB |
| **Danger** | 有活跃端口绑定 |
| **Critical** | Docker 容器或 WSL 实例 |

## 安全机制

1. **禁止路径** — `C:\Windows\`、`C:\Program Files\` 等路径永远不会被删除
2. **三级清理分类** — 安全（可重建）、警告（不可重建如 `.env`）、源码（代码目录，默认不选中）
3. **WSL 双重确认** — 终止 WSL 实例前需勾选两个确认框
4. **自启动备份** — 禁用的自启动项备份至 `data/backup/`，可随时恢复
5. **清理中断** — 进行中的清理可随时取消

## CI/CD

推送 `v*` 格式的 tag 触发 GitHub Actions 构建：

```bash
git tag v0.1.0
git push origin v0.1.0
```

工作流为 4 个平台构建，并创建 GitHub Release：

| 平台 | 产物 |
|------|------|
| Windows | `.msi`、`.exe`（NSIS）、便携版 `.zip` |
| macOS（Apple Silicon） | `.dmg` |
| macOS（Intel） | `.dmg` |
| Linux | `.deb`、`.AppImage` |

## Windows Defender 警告

首次运行便携版可执行文件时，Windows Defender 可能显示"未知发布者"警告。这是因为可执行文件没有代码签名。

**原因：**
- 代码签名证书对个人用户需 $200-400/年
- Windows SmartScreen 将未签名可执行文件视为潜在不安全
- 这对于没有商业支持的开源项目是正常现象

**解决方法：**
1. 在 SmartScreen 对话框中点击"更多信息" → "仍要运行"
2. 或从源码构建：`pnpm tauri build` 创建本地未签名构建
3. 对组织：考虑购买 EV 代码签名证书

**未来方案：**
我们正在探索通过 [SignPath](https://signpath.org/)（对 OSS 免费）+ [AppVeyor](https://www.appveyor.com/) 为开源项目提供免费代码签名。

## 管理员权限

某些进程在无管理员权限时无法停止。如果你看到"Access is denied"错误：

1. 在应用中打开设置页面
2. 点击"以管理员身份重启"
3. 确认 UAC 提示
4. 应用将以提升的权限重启

这是因为 `taskkill` 需要管理员权限才能终止某些进程。

## 许可证

MIT
