/**
 * Compatibility re-export for older imports.
 *
 * Project metadata now lives in `projectsMeta.ts` as the single source of truth.
 */
export {
  projectsMeta as selectedProjectsMeta,
  type ProjectMeta as SelectedProjectMeta,
} from '@/data/projects/projectsMeta';
