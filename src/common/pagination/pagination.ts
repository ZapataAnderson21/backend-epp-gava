import { PaginationQueryDto } from './pagination-query.dto';

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function getPaginationArgs(query: PaginationQueryDto) {
  const currentPage = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;

  return {
    currentPage,
    pageSize,
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginationMeta(
  currentPage: number,
  pageSize: number,
  totalItems: number,
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}

export function buildPaginatedData<T>(
  items: T[],
  totalItems: number,
  query: PaginationQueryDto,
): PaginatedData<T> {
  const { currentPage, pageSize } = getPaginationArgs(query);

  return {
    items,
    pagination: buildPaginationMeta(currentPage, pageSize, totalItems),
  };
}
