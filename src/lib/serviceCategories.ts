import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  requiresBpn: boolean;
  requiresNotaryAssignment: boolean;
  createdAt: string;
  updatedAt: string;
}

type CategoryNameSource = {
  serviceCategoryId?: string | null;
  serviceCategory?: { name?: string | null } | null;
  serviceName?: string | null;
  serviceCategoryName?: string | null;
};

export function extractServiceCategories(payload: unknown): ServiceCategory[] {
  if (Array.isArray(payload)) return payload as ServiceCategory[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: ServiceCategory[] }).data;
  }
  return [];
}

export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  const response = await api.get('/api/v1/matters/service-categories');
  return extractServiceCategories(response.data);
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: fetchServiceCategories,
  });
}

export function getServiceCategoryName(
  matter: CategoryNameSource,
  categories: ServiceCategory[],
  fallback = 'Layanan tidak tersedia',
): string {
  const categoryName = categories.find((category) => category.id === matter.serviceCategoryId)?.name;
  return categoryName || matter.serviceCategory?.name || matter.serviceName || matter.serviceCategoryName || fallback;
}
