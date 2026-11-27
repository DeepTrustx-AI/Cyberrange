import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { TourPrefsState } from '../types';

export interface V13ApiResponse {
  status: number;
  ok: boolean;
  data: Record<string, unknown>;
}

export interface V13ReadFileResult {
  ok: boolean;
  status: number;
  text: string;
  mtime?: number | null;
  error?: string;
}

export interface V13WriteFileResult {
  ok: boolean;
  status: number;
  mtime?: number | null;
  current_mtime?: number | null;
  error?: string;
}

export interface V13Transport {
  apiJson: (method: string, path: string, payload?: unknown) => Promise<V13ApiResponse>;
  readFile: (filename: string) => Promise<V13ReadFileResult>;
  writeFile: (filename: string, content: string, expectedMtime?: number | null) => Promise<V13WriteFileResult>;
  getEmsWsUrl: () => Promise<string | null>;
  openEmsSocket: () => Promise<WebSocket | null>;
  getTerminalWsUrl: () => Promise<string | null>;
}

export interface V13MountOptions {
  assetBase?: string;
  userId?: number | null;
  assignmentId?: number | null;
  generation?: string | null;
  mode?: string | null;
  transport: V13Transport;
  storyData?: Record<string, unknown>;
  tourData?: Record<string, unknown>;
  loadTourData?: () => Promise<Record<string, unknown> | null>;
  loadStoryData?: () => Promise<Record<string, unknown> | null>;
  initialTourPrefs?: TourPrefsState | null;
  initialPassedModules?: string[];
  onTourPrefsChange?: (prefs: TourPrefsState) => void;
  TerminalCtor?: typeof Terminal;
  FitAddonCtor?: typeof FitAddon;
  initialTheme?: 'daylight' | 'ember';
  onBackToAllLabs?: () => void;
  onEndSession?: () => void;
  onThemeChange?: (nextTheme: 'light' | 'dark') => void;
  onUpstreamLost?: (status: number) => void;
}

export interface V13WorkspaceHandle {
  dispose: () => void;
  setTheme: (nextTheme: 'daylight' | 'ember') => void;
  setModule: (modId: string, silent?: boolean) => void;
  getState: () => Record<string, unknown>;
}

export function mountV13Workspace(options: V13MountOptions): V13WorkspaceHandle;
