export interface TechSpecPathSource {
  techSpecPhotoPath?: string | null;
  techSpecPhotoPaths?: string[] | null;
}

export function getTechSpecPaths(
  order: TechSpecPathSource | null | undefined,
): string[] {
  const paths = (order?.techSpecPhotoPaths ?? []).filter(Boolean);
  if (paths.length > 0) return paths;
  return order?.techSpecPhotoPath ? [order.techSpecPhotoPath] : [];
}

export function getTechSpecPathAt(
  order: TechSpecPathSource | null | undefined,
  index: number,
): string | null {
  return getTechSpecPaths(order)[index] ?? null;
}

export function hasTechSpecFiles(
  order: TechSpecPathSource | null | undefined,
): boolean {
  return getTechSpecPaths(order).length > 0;
}
