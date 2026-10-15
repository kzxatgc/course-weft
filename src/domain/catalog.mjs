/**
 * catalog.mjs — backward-compatibility re-export shim.
 *
 * The canonical source has moved to available-courses.mjs.
 * This shim re-exports everything so existing domain tests and any
 * code that still imports from catalog.mjs continue to work.
 * New code should import from ./available-courses.mjs directly.
 */
export {
  REQUESTED_SECTION_ID,
  INITIAL_DRAFT,
  MAIN_CATALOG,
  catalogForScenario,
} from './available-courses.mjs';
