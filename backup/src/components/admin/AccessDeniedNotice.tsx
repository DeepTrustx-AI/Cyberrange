import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context';
import { homePathFor } from '../../utils/roleMapping';

// Shown in place of a page's content when the server refused its data.
export const AccessDeniedNotice: React.FC<{ reason: string }> = ({ reason }) => {
  const { user } = useAuth();
  return (
    <div role="alert" className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
      <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200">You don't have access to this page</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">{reason}</p>
      <Link
        to={homePathFor(user?.role)}
        className="inline-flex items-center text-xs font-bold text-[#0052CC] dark:text-blue-400 hover:underline"
      >
        Go to your home page
      </Link>
    </div>
  );
};
