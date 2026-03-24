/**
<<<<<<< Updated upstream
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
=======
 * labItemsMeta
 *
 * Purpose:
 * Stores the canonical ids for experiments shown in the lab section.
 *
 * Context:
 * Used to keep the projects archive aligned with the curated lab entries in translation data.
 *
 * Notes:
 * Ids act as the contract between static metadata and localized content.
 */

>>>>>>> Stashed changes
export type LabItemMeta = {
  id: string;
};

// Derived values
export const labItemsMeta: LabItemMeta[] = [
  { id: 'lab-001' },
  { id: 'lab-002' },
  { id: 'lab-003' },
];
