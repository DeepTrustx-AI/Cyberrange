import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { TourPrefsState } from '../types';

export interface V13ApiResponse {
  status: number;
  ok: boolean;
  data: Record<string, unknown>;
}

export interface V13Transport {
  apiJson: (method: string, path: string, payload?: unknown) => Promise<V13ApiResponse>;
  readFile: (filename: string) => Promise<{ ok: boolean; status: number; text: string }>;
  writeFile: (filename: string, content: string) => Promise<{ ok: boolean; status: number }>;
  getEmsWsUrl: () => string | null;
  openEmsSocket: () => WebSocket | null;
  getTerminalWsUrl: () => Promise<string | null>;
}

export interface V13MountOptions {
  assetBase?: string;
  transport: V13Transport;
  storyData?: Record<string, unknown>;
  tourData?: Record<string, unknown>;
  initialTourPrefs?: TourPrefsState;
  onTourPrefsChange?: (prefs: TourPrefsState) => void;
  TerminalCtor?: typeof Terminal;
  FitAddonCtor?: typeof FitAddon;
  initialTheme?: 'daylight' | 'ember';
  lockedFullOp?: boolean;
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
