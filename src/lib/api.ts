import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DetectedService,
  ResourceSummary,
  CleanupTarget,
  AppSettings,
  BatchResult,
} from "./types";

// --- Scan ---

export async function getServices(): Promise<DetectedService[]> {
  return invoke<DetectedService[]>("get_services");
}

export async function getResourceSummary(): Promise<ResourceSummary> {
  return invoke<ResourceSummary>("get_resource_summary");
}

export async function getTopConsumers(n: number): Promise<DetectedService[]> {
  return invoke<DetectedService[]>("get_top_consumers", { n });
}

// --- Service operations ---

export async function stopService(id: string): Promise<void> {
  return invoke("stop_service", { id });
}

export async function stopServices(ids: string[]): Promise<BatchResult> {
  return invoke<BatchResult>("stop_services", { ids });
}

// --- Autostart ---

export async function disableAutostart(id: string): Promise<void> {
  return invoke("disable_autostart", { id });
}

export async function restoreAutostart(id: string): Promise<void> {
  return invoke("restore_autostart", { id });
}

// --- Cleanup ---

export async function getCleanupTargets(id: string): Promise<CleanupTarget[]> {
  return invoke<CleanupTarget[]>("get_cleanup_targets", { id });
}

export async function startCleanup(id: string, selectedPaths: string[]): Promise<void> {
  return invoke("start_cleanup", { id, selectedPaths });
}

export async function abortCleanup(): Promise<void> {
  return invoke("abort_cleanup");
}

// --- Scan control ---

export async function triggerScan(): Promise<void> {
  return invoke("trigger_scan");
}

// --- System ---

export async function restartAsAdmin(): Promise<void> {
  return invoke("restart_as_admin");
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

// --- Events ---

export function onServiceChanged(callback: (services: DetectedService[]) => void): Promise<UnlistenFn> {
  return listen<DetectedService[]>("service-changed", (event) => callback(event.payload));
}

export interface CleanupProgress {
  current: number;
  total: number;
  current_path: string;
  deleted: string[];
  failed: string[];
}

export function onCleanupProgress(callback: (progress: CleanupProgress) => void): Promise<UnlistenFn> {
  return listen<CleanupProgress>("cleanup-progress", (event) => callback(event.payload));
}
