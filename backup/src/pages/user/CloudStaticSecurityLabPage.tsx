import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';

type ModuleId = 'iac-remediation' | 'kubernetes-remediation';
type LabFile = { filename: string; content: string };
type Finding = { id: string; severity: string; title: string; recommendation: string; files: string[] };

const MODULES: { id: ModuleId; title: string; points: number; description: string }[] = [
  {
    id: 'iac-remediation',
    title: 'IaC exposure remediation',
    points: 250,
    description: 'Harden Terraform and CloudFormation templates without deploying either template.',
  },
  {
    id: 'kubernetes-remediation',
    title: 'Kubernetes manifest hardening',
    points: 250,
    description: 'Harden a Kubernetes manifest without applying it to a cluster.',
  },
];

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export const CloudStaticSecurityLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [moduleId, setModuleId] = useState<ModuleId>('iac-remediation');
  const [files, setFiles] = useState<LabFile[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const activeModule = useMemo(
    () => MODULES.find((module) => module.id === moduleId) ?? MODULES[0],
    [moduleId],
  );

  const loadWorkspace = useCallback(async (target: ModuleId) => {
    setLoading(true);
    setError('');
    setResult('');
    setFindings([]);
    try {
      const response = await apiFetch(`/api/v1/cloud-static-labs/${target}/workspace`);
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to load this workspace.'));
      setFiles(payload.files ?? []);
    } catch (err) {
      setFiles([]);
      setError(err instanceof Error ? err.message : 'Unable to load this workspace.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void loadWorkspace(moduleId); }, [moduleId, loadWorkspace]);

  const updateFile = (filename: string, content: string) => {
    setFiles((current) => current.map((file) => file.filename === filename ? { ...file, content } : file));
    setResult('');
  };

  const runCheck = async (submit: boolean) => {
    setWorking(true);
    setError('');
    setResult('');
    try {
      const response = await apiFetch(`/api/v1/cloud-static-labs/${moduleId}/${submit ? 'submit' : 'scan'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, 'The security check could not be completed.'));
      setFindings(payload.findings ?? []);
      if (submit) {
        setResult(payload.passed
          ? `Module completed. ${payload.completion?.points_awarded ?? 0} points awarded.`
          : payload.message || 'Submission needs more remediation.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The security check could not be completed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button onClick={() => navigate('/labs')} className="mb-2 text-sm text-sky-300 hover:text-sky-200">← Back to labs</button>
            <h1 className="text-2xl font-bold">Cloud Configuration Hardening</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Edit static configuration only. This lab never deploys infrastructure, calls cloud APIs, or applies Kubernetes manifests.</p>
          </div>
          <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">STATIC ANALYSIS ONLY</span>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {MODULES.map((module) => (
            <button key={module.id} onClick={() => setModuleId(module.id)} className={`rounded-xl border px-4 py-3 text-left transition ${moduleId === module.id ? 'border-sky-400 bg-sky-500/20 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}>
              <div className="font-semibold">{module.title}</div><div className="mt-1 text-xs opacity-75">{module.points} points</div>
            </button>
          ))}
        </div>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="font-semibold">{activeModule.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{activeModule.description}</p>
            {loading ? <p className="py-12 text-center text-slate-400">Loading workspace…</p> : files.map((file) => (
              <label key={file.filename} className="mt-5 block">
                <span className="mb-2 block font-mono text-xs text-sky-300">{file.filename}</span>
                <textarea value={file.content} onChange={(event) => updateFile(file.filename, event.target.value)} spellCheck={false} className="h-80 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-sky-400" />
              </label>
            ))}
            <div className="mt-5 flex flex-wrap gap-3">
              <button disabled={working || loading} onClick={() => void runCheck(false)} className="rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-sky-300 disabled:opacity-50">{working ? 'Checking…' : 'Scan configuration'}</button>
              <button disabled={working || loading} onClick={() => void runCheck(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Submit remediation</button>
            </div>
            {error && <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
            {result && <p className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/60 p-3 text-sm text-emerald-200">{result}</p>}
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="font-semibold">Security findings</h2>
            <p className="mt-1 text-xs text-slate-400">Run a scan after each change. A successful submission requires zero findings.</p>
            {findings.length === 0 ? <p className="mt-5 text-sm text-slate-500">No findings to show yet.</p> : <ul className="mt-5 space-y-3">{findings.map((finding) => <li key={finding.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3"><div className="text-xs font-bold text-amber-300">{finding.severity}</div><div className="mt-1 text-sm font-semibold">{finding.title}</div><p className="mt-1 text-xs leading-5 text-slate-400">{finding.recommendation}</p></li>)}</ul>}
          </aside>
        </section>
      </div>
    </main>
  );
};

export default CloudStaticSecurityLabPage;
