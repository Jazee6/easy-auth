export type PaginationItem = number | "left" | "right";

export function getPaginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages: PaginationItem[] = [1];
  if (page > 3) pages.push("left");
  for (
    let current = Math.max(2, page - 1);
    current <= Math.min(totalPages - 1, page + 1);
    current++
  ) {
    pages.push(current);
  }
  if (page < totalPages - 2) pages.push("right");
  pages.push(totalPages);
  return pages;
}
