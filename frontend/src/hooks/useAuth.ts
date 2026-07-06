import { useEffect, useMemo, useState } from 'react';
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

    getCurrentUser()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('newoon_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return useMemo(() => ({ user, loading, setUser }), [user, loading]);
}
