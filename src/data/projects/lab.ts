/**
 * Lab Project Metadata
 *
 * Purpose:
 * Declares which translated lab entries are allowed to appear on the projects page.
 *
 * Context:
 * Read by the projects page when filtering localized lab content.
 *
 * Dependencies:
 * - `projectsData` message files that provide the translated item bodies
 *
 * Notes:
 * - Keep this as an allowlist; translated content is filtered against these IDs.
 * - Add IDs here before expecting new lab items to render.
 */
export type LabItemMeta = {
  id: string;
};

// Derived values
export const labItemsMeta: LabItemMeta[] = [
  { id: 'lab-001' },
  { id: 'lab-002' },
  { id: 'lab-003' },
];
