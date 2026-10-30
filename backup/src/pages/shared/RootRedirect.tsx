import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context';
import { homePathFor } from '../../utils/roleMapping';

export const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        navigate(homePathFor(user.role), { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center p-6 text-center dark:bg-slate-950 dark:text-slate-100">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95 dark:bg-slate-900 dark:border-slate-800">
        {/* Animated Shield Brand Emblem */}
        <div className="w-20 h-20 rounded-3xl bg-blue-50 text-brand-600 border border-blue-100 flex items-center justify-center mx-auto shadow-xs relative group">
          <Shield className="w-10 h-10 animate-shield text-brand-600" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-600"></span>
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-brand-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block mb-2">
            CyberRange Platform Gateway
          </span>
          <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Authenticating Active Session
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed font-normal dark:text-slate-400">
            Validating session tokens and redirecting to your role-based portal destination...
          </p>
        </div>

        {/* Loading Spinner / Progress */}
        <div className="py-2 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-3 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Evaluating Role...
          </span>
        </div>
      </div>
    </div>
  );
};
