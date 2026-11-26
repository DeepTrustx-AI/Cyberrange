import React, { useState } from 'react';
import { Activity, AlertTriangle, Building2, Network, Radio, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import type { EmsTelemetryState } from './types';

type StageView = 'substation' | 'city' | 'network';

interface CisfGridStageProps {
  telemetry: EmsTelemetryState | null;
  wsStatus: 'connecting' | 'live' | 'disconnected';
  onReconnect: () => void;
}

const BAY_IDS = ['BAY-01', 'BAY-02', 'BAY-03', 'BAY-04', 'BAY-05', 'BAY-06'] as const;

const DISTRICTS = [
  { key: 'hospital', name: 'Trauma Hospital', tier: 1 },
  { key: 'water', name: 'Water Works', tier: 1 },
  { key: 'metro', name: 'Metro Rail', tier: 2 },
  { key: 'airport', name: 'Airport ATC', tier: 2 },
  { key: 'industrial', name: 'Industrial Corridor', tier: 3 },
  { key: 'municipal', name: 'Municipal Blocks', tier: 3 },
] as const;

const PURDUE_ZONES = [
  { id: 'L4_CORP', label: 'L4 Corporate', cidr: '10.204.10.0/24', note: 'Untrusted office network' },
  { id: 'L35_DMZ', label: 'L3.5 OT DMZ', cidr: '10.204.20.0/24', note: 'Historian :8085 and jump host :8086' },
  { id: 'L3_CTRL', label: 'L3 Control Room', cidr: '10.204.25.0/24', note: 'SCADA Master and EMS :3002' },
  { id: 'L1_FIELD', label: 'L1 Field Switchyard', cidr: '10.204.30.0/24', note: 'RTU-1 (.11) and RTU-2 (.12) IEC-104 :2404' },
  { id: 'RESPONDER', label: 'Responder Station', cidr: '10.204.40.0/24', note: 'Your isolated analyst shell' },
];

function fmtNum(val: number | undefined, suffix: string, digits = 2): string {
  if (typeof val !== 'number' || Number.isNaN(val)) return 'N/A';
  return `${val.toFixed(digits)} ${suffix}`;
}

export const CisfGridStage: React.FC<CisfGridStageProps> = ({ telemetry, wsStatus, onReconnect }) => {
  const [view, setView] = useState<StageView>('substation');
  const blinded = telemetry?.shim_active === true;
  const lockouts = telemetry?.lockouts ?? [];
  const bays = telemetry?.bays ?? {};
  const breakers = telemetry?.breakers ?? {};
  const districts = telemetry?.districts ?? {};
  const islandMw = typeof telemetry?.gen_mw === 'number' ? telemetry.gen_mw : telemetry?.island_mw;
  const isStale = wsStatus === 'disconnected' && telemetry !== null;

  return (
    <section
      aria-label="Suryanagar 220/132/33 kV Living Lab Stage"
      className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              SN-220-MAIN Suryanagar Substation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live SCADA telemetry stream (no simulated values while offline)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[var(--line)] bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950" role="tablist" aria-label="Stage view">
            {[
              { id: 'substation' as const, label: 'Substation', icon: Activity },
              { id: 'city' as const, label: 'City Grid', icon: Building2 },
              { id: 'network' as const, label: 'Network', icon: Network },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-brand-600 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              wsStatus === 'live'
                ? 'bg-mint-50 text-mint-700 dark:bg-mint-950/60 dark:text-mint-300'
                : wsStatus === 'connecting'
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
            }`}
          >
            <Radio className="h-3 w-3" />
            {wsStatus === 'live' ? 'Live telemetry' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>

          {wsStatus === 'disconnected' && (
            <button
              type="button"
              onClick={onReconnect}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className="h-3 w-3" />
              Reconnect
            </button>
          )}
        </div>
      </div>

      {wsStatus !== 'live' && !telemetry ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-slate-50 p-5 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Waiting for authenticated live telemetry over <code className="font-mono text-xs">/api/v1/ot-grid/proxy/ems/ws</code>.
        </div>
      ) : (
        <div className={isStale ? 'opacity-65 transition-opacity' : 'transition-opacity'}>
          {isStale && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Telemetry stream disconnected. Showing the last received frame until reconnected.
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {blinded ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                HMI view: unverified (check field captures against control room screen)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-700 dark:bg-mint-950/60 dark:text-mint-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                True field telemetry verified
              </span>
            )}
            {lockouts.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/70 dark:text-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Lockout 86 active: {lockouts.join(', ')}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {[
              { label: 'Bus 33 kV C1', value: fmtNum(telemetry?.bus_33kv_c1_kv, 'kV') },
              { label: 'Bus 33 kV C2', value: fmtNum(telemetry?.bus_33kv_c2_kv, 'kV') },
              { label: 'Frequency', value: fmtNum(telemetry?.freq_hz, 'Hz') },
              { label: 'Island load', value: fmtNum(islandMw, 'MW', 1) },
              {
                label: 'TR-1 / TR-2',
                value: `${typeof telemetry?.tr1_mva_pct === 'number' ? telemetry.tr1_mva_pct.toFixed(1) : '--'}% / ${typeof telemetry?.tr2_mva_pct === 'number' ? telemetry.tr2_mva_pct.toFixed(1) : '--'}%`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-[var(--line)] bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{stat.label}</div>
                <div className="tabular mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {view === 'substation' && (
            <div className="mt-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Substation breaker polarity (ANSI/IEC)</span>
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-medium text-rose-700 dark:text-rose-300">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    Red = Closed (live)
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-mint-700 dark:text-mint-300">
                    <span className="h-2 w-2 rounded-full bg-mint-600" />
                    Green = Open (safe)
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {BAY_IDS.map((bayId, idx) => {
                  const bay = bays[bayId];
                  const brk = breakers[bayId];
                  const isClosed = bay?.closed ?? brk?.closed ?? false;
                  const mwVal = typeof bay?.mw === 'number' ? bay.mw : brk?.mw;
                  const mw = typeof mwVal === 'number' ? `${mwVal.toFixed(1)} MW` : '--';
                  const rtuLabel = bay?.rtu ? bay.rtu.toUpperCase() : idx < 3 ? 'RTU-1' : 'RTU-2';
                  const subtitle =
                    !blinded && bay?.label
                      ? `${bay.label}${typeof bay.tier === 'number' && bay.tier > 0 ? ` · T${bay.tier}` : ''}`
                      : `${rtuLabel} · 33 kV feeder`;
                  return (
                    <div
                      key={bayId}
                      className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/70"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{bayId}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isClosed
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200'
                              : 'bg-mint-50 text-mint-700 dark:bg-mint-950/60 dark:text-mint-300'
                          }`}
                        >
                          {isClosed ? 'CLOSED' : 'OPEN'}
                        </span>
                        <div className="tabular mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {mw}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'city' && (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {DISTRICTS.map((item) => {
                const st = districts[item.key];
                const isLit = st === 'lit';
                const isDiesel = st === 'diesel';
                return (
                  <div
                    key={item.key}
                    className={`rounded-2xl border p-3 ${
                      isLit
                        ? 'border-mint-200 bg-mint-50/60 dark:border-mint-900/60 dark:bg-mint-950/30'
                        : isDiesel
                          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30'
                          : 'border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        Tier {item.tier}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {isLit
                        ? 'Energized via 33 kV feeder'
                        : isDiesel
                          ? 'On emergency diesel backup'
                          : st === 'dark'
                            ? 'Supply interrupted'
                            : 'Waiting for district telemetry'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'network' && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PURDUE_ZONES.map((z) => (
                <div
                  key={z.id}
                  className="rounded-2xl border border-[var(--line)] bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{z.label}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{z.cidr}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{z.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
