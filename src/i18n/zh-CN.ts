import en from "./en";

type TranslationKey = keyof typeof en;

const zh: Record<TranslationKey, string> = {
  // Sidebar
  "nav.dashboard": "仪表盘",
  "nav.services": "服务",
  "nav.settings": "设置",

  // Dashboard
  "dash.title": "仪表盘",
  "dash.active_services": "活跃服务",
  "dash.ports_in_use": "监听端口",
  "dash.cpu_usage": "CPU 占用",
  "dash.memory_usage": "内存占用",
  "dash.disk_usage": "磁盘占用",
  "dash.autostart_count": "自启动项",
  "dash.no_services": "未检测到服务",
  "dash.no_services_sub": "你的设备运行良好",
  "dash.top_consumers": "资源消耗排行",

  // Services
  "svc.title": "服务",
  "svc.refresh": "刷新",
  "svc.filter_all": "全部",
  "svc.select_all": "全选",
  "svc.deselect_all": "取消全选",
  "svc.selected": "已选",
  "svc.stop_selected": "停止选中",
  "svc.clear": "清除",
  "svc.no_services": "设备很干净",
  "svc.no_services_sub": "未检测到服务",
  "svc.pid": "进程号",
  "svc.cpu": "CPU",
  "svc.mem": "内存",
  "svc.disk": "磁盘",
  "svc.ports": "个端口",
  "svc.port": "个端口",
  "svc.working_dir": "工作目录",
  "svc.cleanup": "清理",
  "svc.disable": "禁用",
  "svc.stop": "停止",
  "svc.stopping": "停止中...",
  "svc.autostart": "自启动",
  "svc.batch_stop_ok": "已停止 {n} 个服务",
  "svc.batch_stop_partial": "{n} 个已停止，{m} 个失败",

  // Risk levels
  "risk.Safe": "安全",
  "risk.Caution": "注意",
  "risk.Danger": "危险",
  "risk.Critical": "高危",

  // Service types
  "type.NodeProcess": "Node.js",
  "type.PythonProcess": "Python",
  "type.DockerContainer": "Docker",
  "type.WslInstance": "WSL",

  // Cleanup modal
  "cleanup.title": "清理向导",
  "cleanup.step_select": "选择项目",
  "cleanup.step_confirm": "确认",
  "cleanup.step_cleaning": "清理中",
  "cleanup.step_done": "完成",
  "cleanup.category_safe": "可安全删除（可重建）",
  "cleanup.category_warning": "不可重建 — 请谨慎操作",
  "cleanup.category_source": "源代码 — 不建议删除",
  "cleanup.selected_count": "已选 {n} 项",
  "cleanup.total_size": "总大小",
  "cleanup.next": "下一步",
  "cleanup.back": "返回",
  "cleanup.confirm_title": "确认删除",
  "cleanup.confirm_warning": "部分项目删除后不可恢复，请确认。",
  "cleanup.start_cleanup": "开始清理",
  "cleanup.cleaning": "清理中...",
  "cleanup.abort": "中止",
  "cleanup.done": "清理完成！",
  "cleanup.deleted": "已删除 {n} 项",
  "cleanup.close": "关闭",
  "cleanup.no_targets": "未发现可清理项",
  "cleanup.no_targets_sub": "工作目录中未检测到构建产物或缓存",

  // Settings
  "set.title": "设置",
  "set.scan": "扫描设置",
  "set.refresh_interval": "刷新间隔",
  "set.seconds": "秒",
  "set.excluded_paths": "排除路径",
  "set.add_path": "添加排除路径...",
  "set.add": "添加",
  "set.remove": "移除",
  "set.system": "系统",
  "set.restart_admin": "以管理员身份重启",
  "set.restart_admin_sub": "部分进程需要管理员权限才能停止",
  "set.console": "控制台",
  "set.show_console": "显示控制台窗口",
  "set.console_sub": "切换终端窗口以查看实时日志。日志始终写入磁盘。",
  "set.logs": "日志",
  "set.language": "语言",
  "set.language_sub": "界面语言，立即生效。",
  "set.save": "保存设置",
  "set.saving": "保存中...",

  // Toast
  "toast.scan_failed": "扫描失败",
  "toast.service_stopped": "服务已停止",
  "toast.stop_failed": "停止失败",
  "toast.autostart_disabled": "已禁用自启动",
  "toast.autostart_disable_failed": "禁用自启动失败",
  "toast.settings_saved": "设置已保存",
  "toast.settings_save_failed": "保存失败",
  "toast.restart_failed": "重启失败",
  "toast.cleanup_complete": "清理完成",
};

export default zh;
