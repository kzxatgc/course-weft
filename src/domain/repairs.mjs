/**
 * Repair enumeration for EnrollFix course registration.
 *
 * Enumerates valid schedule repairs as direct add or at most one explicitly
 * declared same-course/component swap. Linked courses support exactly one
 * child requirement (min:1, max:1). Multiple linked requirements are unsupported
 * and yield no candidates.
 *
 * All candidates are independently validated before inclusion. Results are
 * deduplicated by final sorted ID set and ordered no-swap-first then lexically.
 */

import { validateDraft } from './validate.mjs';
import { REQUESTED_SECTION_ID } from './catalog.mjs';

/**
 * Check that a catalogue is well-formed: an array of objects with unique,
 * non-empty string IDs.
 *
 * @param {unknown} catalog
 * @returns {boolean}
 */
function hasValidCatalog(catalog) {
  if (!Array.isArray(catalog)) return false;
  if (catalog.some((item) => !item || typeof item.id !== 'string' || !item.id)) return false;
  return new Set(catalog.map((item) => item.id)).size === catalog.length;
}

/**
 * Collect all valid single-swap options from the current draft.
 * A swap is valid only if the replacement was explicitly declared in the
 * original section's `alternates` array and shares the same course and component.
 *
 * Also includes the no-swap option { old: null, replacement: null }.
 *
 * @param {string[]} draftIds
 * @param {Map<string, object>} byId
 * @returns {{ old: string|null, replacement: string|null }[]}
 */
function getValidSwaps(draftIds, byId) {
  const choices = [{ old: null, replacement: null }];
  for (const oldId of draftIds) {
    const old = byId.get(oldId);
    if (!old) continue;
    for (const replacementId of old.alternates ?? []) {
      const replacement = byId.get(replacementId);
      if (!replacement || replacement.id === old.id) continue;
      if (replacement.course !== old.course || replacement.component !== old.component) continue;
      choices.push({ old: old.id, replacement: replacement.id });
    }
  }
  return choices;
}

/**
 * Build the list of linked-child ID sets for the requested section.
 * Supports exactly one linked requirement with min:1, max:1.
 * Any other configuration returns an empty array (no candidates).
 *
 * @param {object} requested - The requested section record
 * @param {Map<string, object>} byId
 * @returns {string[][]} Array of linked-ID arrays (each is one valid child combination)
 */
function linkedOptionSets(requested, byId) {
  const requirements = requested.requires ?? [];
  // No linked requirements: direct add with no child needed
  if (requirements.length === 0) return [[]];
  // Only exactly one linked requirement (min:1, max:1) is supported
  if (requirements.length !== 1) return [];
  const requirement = requirements[0];
  if (requirement.min !== 1 || requirement.max !== 1) return [];
  const options = [];
  for (const [, item] of byId) {
    if (
      item.component === requirement.component &&
      item.linkedGroup === requirement.linkedGroup &&
      item.requiredBy === requested.id
    ) {
      options.push([item.id]);
    }
  }
  return options;
}

/**
 * Enumerate valid schedule repairs for adding a requested section to the draft.
 *
 * A repair is either:
 * - A direct add (no swap): requestedId + any linked children added to the current draft.
 * - A swap + add: one section in the draft is replaced by its declared alternate,
 *   then requestedId + any linked children are added.
 *
 * At most one swap is considered per candidate. All candidates are fully validated
 * by validateDraft before inclusion. Results are deduplicated and ordered
 * no-swap-first, then lexically by joined IDs.
 *
 * @param {string[]} draftIds - Current selected section IDs
 * @param {object[]} catalog - Full section catalogue
 * @param {string} [requestedId] - Section to add (defaults to REQUESTED_SECTION_ID)
 * @returns {Array<{ids: string[], swap: {old:string, replacement:string}|null, added: string[], kept: string[]}>}
 */
export function enumerateRepairs(draftIds, catalog, requestedId = REQUESTED_SECTION_ID) {
  // Guard: validate inputs before any processing
  if (
    !Array.isArray(draftIds) ||
    draftIds.some((id) => typeof id !== 'string') ||
    new Set(draftIds).size !== draftIds.length ||
    !hasValidCatalog(catalog)
  ) {
    return [];
  }

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const requested = byId.get(requestedId);

  // Guard: requested section must exist in catalogue and not already be in draft
  if (!requested || draftIds.includes(requestedId)) return [];

  // Guard: all draft items must resolve to known catalogue entries
  if (draftIds.some((id) => !byId.get(id))) return [];

  // Guard: base draft must itself be valid before attempting any repair
  if (!validateDraft(draftIds, catalog).ok) return [];

  // Determine the linked-child option sets for the requested section
  const optionSets = linkedOptionSets(requested, byId);
  if (optionSets.length === 0) return [];

  const swaps = getValidSwaps(draftIds, byId);
  const results = [];

  for (const swap of swaps) {
    for (const linkedIds of optionSets) {
      // Build the candidate ID list: remove swapped-out section, add replacement + request + linked
      const next = draftIds.filter((id) => !swap.old || id !== swap.old);
      if (swap.replacement) next.push(swap.replacement);
      next.push(requestedId, ...linkedIds);

      // Dedup within this candidate (guards against edge cases)
      const uniqueIds = [...new Set(next)];
      if (uniqueIds.length !== next.length) continue;

      // Independently validate the full candidate
      const validation = validateDraft(uniqueIds, catalog);
      if (!validation.ok) continue;

      results.push({
        ids: uniqueIds.slice().sort((a, b) => a.localeCompare(b)),
        swap: swap.old ? { old: swap.old, replacement: swap.replacement } : null,
        added: uniqueIds.filter((id) => !draftIds.includes(id)).sort((a, b) => a.localeCompare(b)),
        kept: draftIds.filter((id) => id !== swap.old).slice().sort((a, b) => a.localeCompare(b)),
        validation,
      });
    }
  }

  // Deduplicate by final sorted ID key
  const deduplicated = new Map();
  for (const candidate of results) {
    const key = candidate.ids.join('|');
    if (!deduplicated.has(key)) deduplicated.set(key, candidate);
  }

  // Order: no-swap candidates first, then lexically by ID key
  return [...deduplicated.values()].sort(
    (a, b) =>
      Number(Boolean(a.swap)) - Number(Boolean(b.swap)) ||
      a.ids.join('|').localeCompare(b.ids.join('|'))
  );
}
