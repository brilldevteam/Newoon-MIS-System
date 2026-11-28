import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Query parameters shared by the list tables: search, sort, quick tab, filters and paging all run on the server.
// Each list reads the filters it supports and ignores the rest; the server validates every value, and the access
// scoping of each list (tenant, role) is applied before any of these.
export class TableQueryDto {
  // Free-text search.
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  // One of the sort keys the list allows; anything else falls back to the list's default.
  @IsOptional() @IsString() @MaxLength(40) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  // Quick tab (a group of statuses) and the filter-panel values.
  @IsOptional() @IsString() @MaxLength(60) tab?: string;
  @IsOptional() @IsString() @MaxLength(60) status?: string;
  @IsOptional() @IsString() @MaxLength(60) type?: string;
  @IsOptional() @IsString() @MaxLength(60) role?: string;
  @IsOptional() @IsString() @MaxLength(60) risk?: string;
}

export type TablePage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  // Rows per quick tab (ignoring the tab itself, but not the search or filters), keyed by tab.
  counts: Record<string, number>;
};

export function pagingOf(query: TableQueryDto) {
  const pageSize = Math.min(query.pageSize || 20, 100);
  const requested = query.page || 1;
  return { pageSize, requested, skip: (requested - 1) * pageSize, take: pageSize };
}

// The last page that has rows, so a page past the end (after a delete or a narrower filter) shows the last page.
export function clampPage(requested: number, total: number, pageSize: number) {
  return Math.min(requested, Math.max(1, Math.ceil(total / pageSize)));
}

export function searchTerm(query: TableQueryDto) {
  return (query.q || '').trim().slice(0, 100);
}
