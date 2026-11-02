import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { AuthUser, getCurrentUser } from '../services/auth.service';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('newoon_token');
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    let sequence = 0;
    function refresh() {
      const request = ++sequence;
      if (!localStorage.getItem('newoon_token')) { setUser(null); setLoading(false); return; }
      getCurrentUser()
        .then((next) => { if (active && request === sequence) setUser(next); })
        .catch((error: unknown) => {
          if (active && request === sequence && isAxiosError(error) && [401, 403].includes(error.response?.status || 0)) {
            localStorage.removeItem('newoon_token'); setUser(null);
          }
        })
        .finally(() => { if (active && request === sequence) setLoading(false); });
    }
    const storage = (event: StorageEvent) => { if (event.key === 'newoon_access_updated') refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('access-updated', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('access-updated', refresh);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  return useMemo(() => ({ user, loading, setUser }), [user, loading]);
}
