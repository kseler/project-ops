import { useQuery } from '@tanstack/react-query';

import { getDashboard } from '@/api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: getDashboard,
  });
}
