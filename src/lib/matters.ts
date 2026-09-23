export interface MatterListParams {
  serviceCategoryId?: string;
  workflowStatus?: string;
  assignmentStatus?: string;
  paymentStatus?: string;
  landCityCode?: string;
  page?: number;
  limit?: number;
}

export function extractMatterList(payload: any): any[] {
  if (typeof window !== 'undefined') {
    const shape = Array.isArray(payload)
      ? 'array'
      : Array.isArray(payload?.items)
        ? 'items'
        : Array.isArray(payload?.data)
          ? 'data'
          : typeof payload;
    const count = Array.isArray(payload)
      ? payload.length
      : Array.isArray(payload?.items)
        ? payload.items.length
        : Array.isArray(payload?.data)
          ? payload.data.length
          : 0;
    console.info('[matters] payload shape:', shape, 'count:', count, 'payload:', payload);
  }

  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
  }
  return [];
}

export function buildMatterListParams(params: MatterListParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 100,
    workflowStatus: params.workflowStatus,
    assignmentStatus: params.assignmentStatus,
    paymentStatus: params.paymentStatus,
    serviceCategoryId: params.serviceCategoryId,
    landCityCode: params.landCityCode,
  };
}
