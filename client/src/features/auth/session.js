import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/resources.js';

export const ME_KEY = ['me'];

/** The logged-in user, or null. A 401 simply means "not logged in". */
export function useSession() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await authApi.me()).user;
      } catch (err) {
        if (err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}
