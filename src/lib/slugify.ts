export interface SlugifyResult {
  slug: string;
  wasModified: boolean;
}

/**
 * Convert a name to a URL/filesystem-safe slug.
 * - Lowercase
 * - Non-alphanumeric characters become hyphens
 * - Collapse consecutive hyphens
 * - Trim leading/trailing hyphens
 */
export function slugify(name: string): SlugifyResult {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    slug,
    wasModified: slug !== name
  };
}
