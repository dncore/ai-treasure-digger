# AI Treasure Digger

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## Overview

AI Treasure Digger is a cross-platform desktop application that detects and manages AI-generated temporary services on your device. It identifies Node.js, Python, Docker, and WSL instances that may have been spun up by AI tools, and provides capabilities to stop them, disable autostart behavior, and optionally clean up associated files.

Built with **Tauri v2** (Rust + WebView2 + React) — lightweight, fast, and secure.

## Features

- **Two-tier AI service detection** — Hard match (known AI process signatures like Ollama, LM Studio, Jupyter, Gradio) + Soft match (multi-category keyword co-occurrence to reduce false positives)
- **4-level risk assessment** — Safe / Caution / Danger / Critical, based on service type, port bindings, and resource usage
- **Background scanning** — Automatic 5-second refresh cycle with real-time event emission to the frontend
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

### Tier 1: Hard Match

Known AI process signatures matched against command lines:

`ollama`, `lm-studio`, `lmstudio`, `jupyter-notebook`, `jupyter-lab`, `gradio`, `streamlit run`, `uvicorn`, `flask run`

### Tier 2: Soft Match

Multi-category keyword co-occurrence — at least 2 of 4 categories must match:

| Category | Keywords |
|----------|----------|
| AI Model | ollama, llama, gpt, openai, model, inference |
| AI App | langchain, chat, bot, agent |
| Web Service | flask, fastapi, gradio, streamlit, uvicorn, jupyter, serve |
| API | api, endpoint |

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

The workflow builds for 4 platforms and creates a draft GitHub Release:

| Platform | Artifacts |
|----------|-----------|
| Windows | `.msi`, `.exe` (NSIS) |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Linux | `.deb`, `.AppImage` |

## License

MIT

---

<a id="中文"></a>

## 概述

AI Treasure Digger 是一款跨平台桌面应用，用于检测和管理设备上由 AI 工具创建的临时服务。它能识别 Node.js、Python、Docker 和 WSL 实例，提供停止服务、禁用自启动、可选文件清理功能。

基于 **Tauri v2**（Rust + WebView2 + React）构建——轻量、快速、安全。

## 功能特性

- **两级 AI 服务检测** — 硬匹配（已知 AI 进程签名如 Ollama、LM Studio、Jupyter、Gradio）+ 软匹配（多类别关键词共现，降低误报率）
- **四级风险评估** — Safe / Caution / Danger / Critical，基于服务类型、端口绑定和资源占用
- **后台扫描** — 自动 5 秒刷新周期，实时事件推送至前端
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

### 第一层：硬匹配

已知 AI 进程签名，直接匹配命令行：

`ollama`、`lm-studio`、`lmstudio`、`jupyter-notebook`、`jupyter-lab`、`gradio`、`streamlit run`、`uvicorn`、`flask run`

### 第二层：软匹配

多类别关键词共现——4 个类别中至少匹配 2 个：

| 类别 | 关键词 |
|------|--------|
| AI 模型 | ollama, llama, gpt, openai, model, inference |
| AI 应用 | langchain, chat, bot, agent |
| Web 服务 | flask, fastapi, gradio, streamlit, uvicorn, jupyter, serve |
| API | api, endpoint |

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

工作流为 4 个平台构建，并创建 GitHub Release 草稿：

| 平台 | 产物 |
|------|------|
| Windows | `.msi`、`.exe`（NSIS） |
| macOS（Apple Silicon） | `.dmg` |
| macOS（Intel） | `.dmg` |
| Linux | `.deb`、`.AppImage` |

## 许可证

MIT
