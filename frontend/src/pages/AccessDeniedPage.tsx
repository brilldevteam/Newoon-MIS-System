import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { defaultRouteForUser, roleList } from '../utils/access-control';

export function AccessDeniedPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Access restricted</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">This login cannot open that workflow step.</h1>
      <p className="mt-3 text-sm text-slate-600">
        Your current role is {roleList(user)}. Use the role assigned for the current review stage, or login as Company Admin for full tenant testing.
      </p>
      <Link
        to={defaultRouteForUser(user)}
        className="mt-5 inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Go to my workspace
      </Link>
    </div>
  );
}
