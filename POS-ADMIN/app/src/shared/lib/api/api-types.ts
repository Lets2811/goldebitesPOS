/** Standard success envelope returned by every GB-BE endpoint (see ResponseInterceptor). */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/** Pagination metadata shape returned by list endpoints (see PaginatedResult on the backend). */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Envelope for a paginated list endpoint: `data` is the page of items, `meta` carries pagination info. */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
  timestamp: string;
}
