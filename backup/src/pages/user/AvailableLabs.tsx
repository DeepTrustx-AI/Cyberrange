import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context';
import { CartDrawer } from '../../components/admin/CartDrawer';
import { LabDetailModal } from '../../components/admin/LabDetailModal';
import type { CartItem } from '../../types/cart';
import { SegmentedBar } from '../../components/ui/SegmentedBar';
import { categoryMeta } from '../../utils/labMeta';
import { labPath } from '../../utils/labRoutes';
import { LabCardMedia } from '../../components/art/LabCardMedia';
import { LabPreviewSheet, type PreviewLab } from '../../components/labs/LabPreviewSheet';
import { ContinueRow, type RowLab } from '../../components/labs/CatalogueRows';
import { labDifficulty, labHours, labSummary, moduleMinutes } from '../../utils/labCopy';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Search,
  Layers,
  ShoppingCart,
  ArrowRight,
  Check,
  Play,
  X,
  Clock,
  Award,
} from 'lucide-react';

interface Lab {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  description: string;
  difficulty: string;
  durationHours: number;
  tags: string[];
  priceInr: number;
  isFree: boolean;
  isPurchased: boolean;
  totalChallenges: number;
  modules: any[];
  moduleTitles: string[];
  moduleMinutes: number[];
  rating?: number;
  reviewCount?: number;
  isCompleted?: boolean;
  certificateId?: string;
  certificatePdfUrl?: string;
  timeSpentSeconds?: number;
  timeSpentDisplay?: string;
  solvedChallenges?: number;
}

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'linux', label: 'Linux infrastructure' },
  { value: 'cloud', label: 'Cloud security' },
  { value: 'crypto', label: 'Cryptography' },
  { value: 'ot', label: 'OT & industrial' },
  { value: 'recon', label: 'Network recon' },
];

const primaryAction =
  'inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryAction =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

export const AvailableLabs: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state — mirrors admin LabMarketplace
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  // Detail Modal State
  const [selectedModalLab, setSelectedModalLab] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'purchased'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [rentals, setRentals] = useState<any[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);

  /* ─── Fetch Labs from Backend ─────────────────────────────── */
  const fetchLabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/labs');
      if (!res.ok) throw new Error();
      const items: any[] = await res.json();
      const normalized: Lab[] = (Array.isArray(items) ? items : []).map((item) => {
        const isCommandLine = (item?.id || '').toLowerCase().includes('command-line');
        const catRaw = String(item?.category ?? 'linux').toLowerCase();
        const fixed = item?.priceInr ?? item?.price_inr ?? 0;
        const labId = item?.id ?? '';
        const modules = (Array.isArray(item?.modules) ? item.modules : []).map((module: any) =>
          typeof module === 'string' ? module : { ...module, durationMinutes: moduleMinutes(labId, module?.id ?? '', module?.durationMinutes ?? 0) },
        );
        const named = modules.filter((module: any) => (typeof module === 'string' ? module : module?.title ?? module?.name));
        return {
          id: item?.id ?? '',
          title: item?.title ?? item?.name ?? '',
          category: catRaw,
          categoryLabel: item?.category ?? catRaw,
          description: labSummary(item?.id ?? '', String(item?.shortDescription ?? item?.description ?? '')),
          difficulty: labDifficulty(labId, String(item?.difficulty ?? 'beginner').toLowerCase()),
          durationHours: labHours(labId, isCommandLine ? 6 : (item?.durationHours ?? 1.5)),
          // Skills that only repeat the category add nothing to the card.
          tags: (Array.isArray(item?.skillsCovered) ? item.skillsCovered : []).filter(
            (tag: unknown) => typeof tag === 'string' && !catRaw.includes(tag.toLowerCase()),
          ),
          priceInr: fixed,
          isFree: item?.isFree !== undefined ? item.isFree : fixed === 0,
          isPurchased: item?.isPurchased ?? false,
          totalChallenges: item?.totalChallenges ?? (modules.length || 5),
          modules,
          moduleTitles: named.map((module: any) => (typeof module === 'string' ? module : module.title ?? module.name)),
          moduleMinutes: named.map((module: any) => (typeof module === 'string' ? 0 : module.durationMinutes ?? 0)),
          rating: item?.rating ?? 4.9,
          reviewCount: item?.reviewCount ?? 120,
          isCompleted: item?.isCompleted ?? false,
          certificateId: item?.certificateId ?? '',
          certificatePdfUrl: item?.certificatePdfUrl ?? '',
          timeSpentSeconds: item?.timeSpentSeconds ?? 0,
          timeSpentDisplay: item?.timeSpentDisplay ?? '',
          solvedChallenges: item?.solvedChallenges ?? 0,
        };
      });
      // Filter out internal labs (puzzle labs now show as a normal card, not excluded)
      setLabs(normalized.filter(l =>
        !l.id.toLowerCase().includes('techcorp')
      ));
    } catch {
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  /* ─── Fetch Cart from Backend ─────────────────────────────── */
  const fetchCart = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch { /* ignore */ }
  }, [apiFetch]);

  /* ─── Fetch Purchased/Rented Labs ─────────────────────────── */
  const fetchRentals = useCallback(async () => {
    setRentalsLoading(true);
    try {
      const res = await apiFetch('/api/v1/user/rentals');
      if (res.ok) setRentals(await res.json());
    } catch { /* ignore */ }
    finally { setRentalsLoading(false); }
  }, [apiFetch]);

  useEffect(() => { fetchLabs(); fetchCart(); }, [fetchLabs, fetchCart]);
  useEffect(() => { if (activeTab === 'purchased') fetchRentals(); }, [activeTab, fetchRentals]);

  // Sync search with URL
  useEffect(() => { setSearchTerm(urlSearch); }, [urlSearch]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim()) setSearchParams({ search: val });
    else {
      const p = new URLSearchParams(searchParams);
      p.delete('search'); p.delete('q');
      setSearchParams(p);
    }
  };

  /* ─── Detail Modal ─────────────────────────────────────────
     Certificate PDF rendering happens synchronously server-side, but a
     transient render failure leaves certificatePdfUrl empty until the next
     /labs call retries it (see certificate_manager.get_or_issue_certificate).
     If the cached lab list still shows a completed lab with no cert yet,
     refetch on open so a since-repaired certificate shows up without the
     student needing to reload the page. */
  const openLabDetails = async (lab: Lab) => {
    setSelectedModalLab(lab);
    setIsModalOpen(true);
    if (!lab.isCompleted || lab.certificatePdfUrl) return;
    try {
      const res = await apiFetch('/api/v1/labs');
      if (!res.ok) return;
      const items: any[] = await res.json();
      const fresh = (Array.isArray(items) ? items : []).find((i) => i?.id === lab.id);
      if (!fresh) return;
      const patch = { certificatePdfUrl: fresh.certificatePdfUrl ?? '', certificateId: fresh.certificateId ?? '' };
      setSelectedModalLab((prev: any) => (prev && prev.id === lab.id ? { ...prev, ...patch } : prev));
      setLabs((prev) => prev.map((l) => (l.id === lab.id ? { ...l, ...patch } : l)));
    } catch { /* keep showing the "generating" state — next open will retry */ }
  };

  /* ─── Cart Operations (mirror admin LabMarketplace) ──────── */
  const handleAddToCart = async (lab: Lab) => {
    if (cartItems.some(i => i.lab_id === lab.id)) { setIsCartOpen(true); return; }
    setAddingToCart(lab.id);
    // Optimistic update
    const optimistic: CartItem = {
      id: Date.now(),
      lab_id: lab.id,
      lab_title: lab.title,
      price_inr: lab.priceInr,
      hours_purchased: 1,
      item_total: lab.priceInr,
    };
    setCartItems(prev => [...prev, optimistic]);
    setIsCartOpen(true);
    try {
      const res = await apiFetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_id: lab.id, lab_title: lab.title, hours_purchased: 1 })
      });
      if (res.ok || res.status === 409) {
        // Refresh from server to get server-computed price
        await fetchCart();
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch { /* ignore */ }
    finally { setAddingToCart(null); }
  };

  const handleUpdateHours = async (id: number | string, hours: number) => {
    setCartItems(prev => prev.map(item =>
      item.id === id ? { ...item, hours_purchased: hours, item_total: (item.price_inr ?? 0) * hours } : item
    ));
    try {
      await apiFetch(`/api/v1/cart/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours_purchased: hours })
      });
      await fetchCart(); // Refresh for correct server-side total
    } catch { /* ignore */ }
  };

  const handleRemoveCartItem = async (id: number | string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    try {
      await apiFetch(`/api/v1/cart/items/${id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('cart-updated'));
    } catch { /* ignore */ }
  };

  const handleClearCart = async () => {
    setCartItems([]);
    try {
      await apiFetch('/api/v1/cart', { method: 'DELETE' });
      window.dispatchEvent(new Event('cart-updated'));
    } catch { /* ignore */ }
  };

  const handleProceedToCheckout = async (_summary: any) => {
    // Navigate to cart page for student Razorpay flow
    setIsCartOpen(false);
    navigate('/cart');
  };

  /* ─── Navigate to lab session ─────────────────────────────── */
  const launchLab = (lab: Lab) => {
    const id = lab.id.toLowerCase().replace(/[\s_-]+/g, '-');
    if (id === 'linux-security-workshop') navigate('/labs/linux-security-workshop');
    else if (id === 'race-conditions-lab') navigate('/labs/race-conditions-lab');
    else if (id === 'linux-sysadmin-lab') navigate('/labs/linux-sysadmin');
    else if (id === 'command-line-lab') navigate('/labs/command-line-lab/session/sess-cll-01');
    else if (id === 'cryptography-lab') navigate('/labs/cryptography-lab/session/sess-crypto-01');
    else if (id === 'compliance-portal') navigate('/labs/compliance-portal/session/sess-compliance-01');
    else if (id === 'kubernetes-drift-lab') navigate('/labs/kubernetes-drift-lab');
    else if (id === 'cloud-static-security-lab') navigate('/labs/cloud-static-security-lab');
    else if (id === 'cloud-security-lab' || id === 'cloudcorp-aws-lab' || id.includes('cloud')) navigate('/labs/cloud-security-lab/session/sess-cloud-01');
    else if (id.includes('puzzle')) navigate('/puzzle');
    else navigate(`/labs/${lab.id}/session/sess-123`);
  };

  /* ─── Filtered labs ───────────────────────────────────────── */
  const filteredLabs = labs.filter(lab => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q
      || lab.title.toLowerCase().includes(q)
      || lab.description.toLowerCase().includes(q)
      || lab.category.toLowerCase().includes(q)
      || lab.tags.some(t => t.toLowerCase().includes(q));
    const matchesCat = selectedCategory === 'all' || lab.category.includes(selectedCategory);
    const matchesDiff = selectedDifficulty === 'all' || lab.difficulty === selectedDifficulty;
    return matchesSearch && matchesCat && matchesDiff;
  });

  const solvedOf = (lab: Lab) => (lab.isCompleted ? lab.modules.length || lab.totalChallenges : lab.solvedChallenges ?? 0);
  const moduleCountOf = (lab: Lab) => lab.modules.length || lab.totalChallenges || 5;
  const browsing = !searchTerm.trim() && selectedCategory === 'all' && selectedDifficulty === 'all';

  const rowLabs = useMemo<RowLab[]>(
    () => labs.map((lab) => ({
      id: lab.id,
      title: lab.title,
      category: lab.category,
      moduleCount: lab.modules.length || lab.totalChallenges || 5,
      solved: lab.isCompleted ? lab.modules.length || lab.totalChallenges : lab.solvedChallenges ?? 0,
      isCompleted: Boolean(lab.isCompleted),
    })),
    [labs],
  );

  const previewSource = labs.find((lab) => lab.id === previewId) ?? null;
  const preview: PreviewLab | null = previewSource && {
    id: previewSource.id,
    title: previewSource.title,
    category: previewSource.category,
    categoryLabel: categoryMeta(previewSource.category).label,
    difficulty: previewSource.difficulty,
    summary: previewSource.description,
    durationHours: previewSource.durationHours,
    moduleTitles: previewSource.moduleTitles,
    moduleMinutes: previewSource.moduleMinutes,
    solved: previewSource.solvedChallenges ?? 0,
    isCompleted: Boolean(previewSource.isCompleted),
  };
  const closePreview = useCallback(() => setPreviewId(null), []);

  const labAction = (lab: Lab, inSheet = false) => {
    const isFree = lab.isFree || lab.priceInr === 0;
    const isInCart = cartItems.some(i => i.lab_id === lab.id);
    const started = (lab.solvedChallenges ?? 0) > 0;
    if (lab.isCompleted) {
      return (
        <button onClick={() => openLabDetails(lab)} className={secondaryAction}>
          <Award className="h-4 w-4 text-emerald-600" />
          Certificate
        </button>
      );
    }
    if (isFree || lab.isPurchased) {
      return (
        <>
          {lab.isPurchased && !isFree && (
            <span className="hidden items-center gap-1 text-xs font-medium text-emerald-700 sm:flex dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Purchased
            </span>
          )}
          <button onClick={() => launchLab(lab)} className={primaryAction}>
            {started ? <ArrowRight className="h-4 w-4" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {started ? 'Resume' : inSheet ? 'Launch lab' : 'Launch'}
          </button>
        </>
      );
    }
    return (
      <>
        {!inSheet && (
          <button onClick={() => setPreviewId(lab.id)} className={secondaryAction}>
            Details
          </button>
        )}
        <button
          disabled={isInCart || addingToCart === lab.id}
          onClick={() => handleAddToCart(lab)}
          className={isInCart ? `${secondaryAction} cursor-default text-slate-500` : primaryAction}
        >
          {isInCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {isInCart ? 'In cart' : addingToCart === lab.id ? 'Adding…' : `Add · ₹${lab.priceInr.toLocaleString('en-IN')}/hr`}
        </button>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Labs</h1>
          <p className="mt-2 max-w-lg text-[15px] text-slate-500 dark:text-slate-400">
            Hands-on cybersecurity labs on real machines, graded automatically.
          </p>
        </div>
        <button onClick={() => setIsCartOpen(true)} className={`${secondaryAction} self-start sm:self-auto`}>
          <ShoppingCart className="h-4 w-4" />
          Cart
          {cartItems.length > 0 && (
            <span className="ml-0.5 rounded-full bg-brand-600 px-1.5 text-xs font-semibold tabular text-white">{cartItems.length}</span>
          )}
        </button>
      </header>

      <div className="space-y-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <nav className="flex shrink-0 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800" aria-label="Lab lists">
          {(['all', 'purchased'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'all' ? 'All labs' : 'Purchased'}
              {tab === 'all' && !loading && <span className="ml-1.5 tabular text-slate-400">{labs.length}</span>}
            </button>
          ))}
        </nav>

          {activeTab === 'all' && (
            <>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search by name, skill or topic"
                aria-label="Search labs"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white [&::-webkit-search-cancel-button]:hidden"
              />
              {searchTerm && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value)}
              aria-label="Filter by difficulty"
              className="h-10 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Any difficulty</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
            </>
          )}
        </div>
        {activeTab === 'all' && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-1 pt-3 dark:border-slate-800" role="group" aria-label="Filter by category">
              {CATEGORY_FILTERS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedCategory(option.value)}
                  aria-pressed={selectedCategory === option.value}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    selectedCategory === option.value
                      ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

        )}
      </div>

      {activeTab === 'all' && (
        loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
                <div className="skeleton h-44 rounded-none" />
                <div className="space-y-3 p-5">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-3.5 w-full" />
                  <div className="skeleton h-3.5 w-4/5" />
                  <div className="flex justify-between pt-4">
                    <div className="skeleton h-3.5 w-28" />
                    <div className="skeleton h-9 w-24 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredLabs.length === 0 ? (
          <EmptyState
            art="radar"
            title="No labs match these filters"
            body="Try a different search, or clear the filters to see every lab."
            action={
              <button
                onClick={() => { handleSearchChange(''); setSelectedCategory('all'); setSelectedDifficulty('all'); }}
                className={secondaryAction}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="space-y-8">
          {browsing && (
            <ContinueRow
              labs={rowLabs}
              onResume={(id) => {
                const lab = labs.find((l) => l.id === id);
                if (lab) launchLab(lab);
              }}
            />
          )}
          <section aria-label="All labs">
          {browsing && <h2 className="mb-3 font-display text-lg font-semibold text-slate-900 dark:text-white">Every lab</h2>}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredLabs.map((lab, index) => {
              const moduleCount = moduleCountOf(lab);
              const isRuntimeShield = lab.id === 'iso-runtime-shield-workshop';
              const started = (lab.solvedChallenges ?? 0) > 0;
              const meta = categoryMeta(lab.category);

              return (
                <article
                  key={lab.id}
                  className="rise-in group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-900 dark:ring-slate-800"
                  style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                >
                  <button onClick={() => setPreviewId(lab.id)} className="block text-left" aria-label={`About ${lab.title}`}>
                    <LabCardMedia labId={lab.id} category={lab.category} difficulty={lab.difficulty} complete={Boolean(lab.isCompleted)} />
                  </button>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug text-slate-900 dark:text-white">
                      <button onClick={() => setPreviewId(lab.id)} className="text-left hover:underline hover:decoration-slate-300 hover:underline-offset-4">
                        {lab.title}
                      </button>
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{lab.description}</p>

                    {!isRuntimeShield && (started || lab.isCompleted) && (
                      <div className="mt-4 flex items-center gap-3">
                        <SegmentedBar done={solvedOf(lab)} total={moduleCount} />
                        <span className={`shrink-0 text-xs font-medium tabular ${lab.isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {lab.isCompleted ? 'Complete' : `${lab.solvedChallenges ?? 0}/${moduleCount}`}
                        </span>
                      </div>
                    )}

                    {lab.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {lab.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5"><meta.icon className="h-3.5 w-3.5" />{meta.label}</span>
                        {!isRuntimeShield && <span className="flex items-center gap-1.5 tabular" title="Modules"><Layers className="h-3.5 w-3.5" />{moduleCount}</span>}
                        {lab.durationHours > 0 && (
                          <span className="flex items-center gap-1.5 tabular"><Clock className="h-3.5 w-3.5" />{lab.durationHours} h</span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">{labAction(lab)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          </section>
          </div>
        )
      )}

      {activeTab === 'purchased' && (
        rentalsLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-44 rounded-3xl" />
            ))}
          </div>
        ) : rentals.length === 0 ? (
          <EmptyState
            art="rack"
            title="No purchased labs yet"
            body="Labs you buy appear here with the hours you have left on each."
            action={<button onClick={() => setActiveTab('all')} className={primaryAction}>Browse labs</button>}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rentals.map(lab => {
              const hasHours = (lab.hours_remaining ?? 0) > 0;
              return (
                <article key={lab.id} className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
                  <span className={`flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${hasHours ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${hasHours ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden="true" />
                    {hasHours ? 'Active' : 'Expired'}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">{lab.lab_title}</h3>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500 dark:text-slate-400">Hours remaining</dt>
                      <dd className="font-medium tabular text-slate-900 dark:text-white">{lab.hours_remaining ?? 0} h</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500 dark:text-slate-400">Rate</dt>
                      <dd className="font-medium tabular text-slate-900 dark:text-white">₹{(lab.fixed_rate ?? 0).toLocaleString('en-IN')} / hr</dd>
                    </div>
                  </dl>
                  {hasHours && (
                    <button onClick={() => navigate(labPath(lab.lab_id))} className={`${primaryAction} mt-6 justify-center`}>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Launch lab
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )
      )}

      {/* ── Cart Drawer (same as admin) ──────────────────────── */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateHours={handleUpdateHours}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <LabPreviewSheet
        lab={preview}
        onClose={closePreview}
        action={previewSource ? labAction(previewSource, true) : null}
      />

      <LabDetailModal
        lab={selectedModalLab}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
