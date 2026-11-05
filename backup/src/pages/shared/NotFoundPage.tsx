import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Mascot } from '../../components/mascot/Mascot';
import { AmbientBackground } from '../../components/ui/AmbientBackground';

// A missing page: the mascot scratches its head, and two ways back. "Home" goes
// to the root, which sends students and admins to their own dashboards.
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="isolate grid min-h-screen place-items-center bg-slate-100 p-6 text-center text-slate-900 dark:bg-slate-950 dark:text-white">
      <AmbientBackground />
      <div className="rise-in flex max-w-md flex-col items-center">
        <Mascot pose="think" size={136} interactive />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">This page wandered off</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          Error 404: the link may be old, or the page has moved. Let's get you back to your labs.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-white dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-slate-950"
          >
            Take me home
          </Link>
        </div>
      </div>
    </div>
  );
};
