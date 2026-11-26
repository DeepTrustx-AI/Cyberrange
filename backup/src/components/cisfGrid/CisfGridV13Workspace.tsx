import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import '../mascot/mascot.css';
import './v13/v13Styles.css';
import './v13/v13Tour.css';
import storyData from './v13/data/story.json';
import tourData from './v13/data/tour.json';
import { V13_WORKSPACE_MARKUP } from './v13/v13Markup';
import { mountV13Workspace, type V13WorkspaceHandle } from './v13/ems';
import { createV13PlatformTransport } from './v13/platformTransport';
import type { ApiFetchFn } from './api';
import type { CisfGridMode, TourPrefsState } from './types';
import { useTheme } from '../../context/ThemeContext';

export interface CisfGridV13WorkspaceProps {
  apiFetch: ApiFetchFn;
  token: string | null;
  assignmentId: number | null;
  mode: CisfGridMode;
  initialTourPrefs: TourPrefsState;
  ensureEvalToken: (forceRefresh?: boolean) => Promise<string>;
  onSaveTourPrefs: (prefs: TourPrefsState) => void;
  onProgressUpdated?: (passedModules: string[]) => void;
  onUpstreamLost: (status: number) => void;
  onBackToAllLabs: () => void;
  onEndSession: () => void;
}

export const CisfGridV13Workspace: React.FC<CisfGridV13WorkspaceProps> = ({
  apiFetch,
  token,
  assignmentId,
  mode,
  initialTourPrefs,
  ensureEvalToken,
  onSaveTourPrefs,
  onProgressUpdated,
  onUpstreamLost,
  onBackToAllLabs,
  onEndSession,
}) => {
  const { theme, setTheme } = useTheme();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<V13WorkspaceHandle | null>(null);

  const callbacksRef = useRef({
    ensureEvalToken,
    onSaveTourPrefs,
    onProgressUpdated,
    onUpstreamLost,
    onBackToAllLabs,
    onEndSession,
    setTheme,
    theme,
  });

  useEffect(() => {
    callbacksRef.current = {
      ensureEvalToken,
      onSaveTourPrefs,
      onProgressUpdated,
      onUpstreamLost,
      onBackToAllLabs,
      onEndSession,
      setTheme,
      theme,
    };
  }, [
    ensureEvalToken,
    onSaveTourPrefs,
    onProgressUpdated,
    onUpstreamLost,
    onBackToAllLabs,
    onEndSession,
    setTheme,
    theme,
  ]);

  const initialPrefsRef = useRef(initialTourPrefs);
  const initialThemeRef = useRef(theme);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = V13_WORKSPACE_MARKUP;

    const transport = createV13PlatformTransport({
      apiFetch,
      token,
      assignmentId,
      ensureEvalToken: (force) => callbacksRef.current.ensureEvalToken(force),
      onProgressUpdated: (mods) => callbacksRef.current.onProgressUpdated?.(mods),
      onUpstreamLost: (status) => callbacksRef.current.onUpstreamLost(status),
    });

    const handle = mountV13Workspace({
      assetBase: '/cisf-grid/assets',
      transport,
      storyData: storyData as Record<string, unknown>,
      tourData: tourData as Record<string, unknown>,
      initialTourPrefs: initialPrefsRef.current,
      onTourPrefsChange: (prefs) => callbacksRef.current.onSaveTourPrefs(prefs),
      TerminalCtor: Terminal,
      FitAddonCtor: FitAddon,
      initialTheme: initialThemeRef.current === 'dark' ? 'ember' : 'daylight',
      lockedFullOp: mode === 'full_op',
      onBackToAllLabs: () => callbacksRef.current.onBackToAllLabs(),
      onEndSession: () => callbacksRef.current.onEndSession(),
      onThemeChange: (nextTheme) => {
        if (nextTheme !== callbacksRef.current.theme) {
          void callbacksRef.current.setTheme(nextTheme);
        }
      },
      onUpstreamLost: (status) => callbacksRef.current.onUpstreamLost(status),
    });

    handleRef.current = handle;

    return () => {
      handleRef.current = null;
      handle.dispose();
      host.replaceChildren();
    };
  }, [apiFetch, token, assignmentId, mode]);

  // Keep V13 synced if CyberRange global theme toggles externally.
  useEffect(() => {
    if (!handleRef.current) return;
    handleRef.current.setTheme(theme === 'dark' ? 'ember' : 'daylight');
  }, [theme]);

  return <div ref={hostRef} className="cg-v13-root" data-testid="cisf-v13-workspace" />;
};
