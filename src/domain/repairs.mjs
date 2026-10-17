/**
 * Repair enumeration for EnrollFix course registration.
 *
 * Enumerates valid schedule repairs as a direct add or explicitly declared
 * same-course/component swaps, preferring plans with at most one swap and
 * searching for two-swap plans only when no simpler plan is valid. Linked
 * courses support exactly one child requirement (min:1, max:1). Multiple linked requirements are unsupported
 * and yield no candidates.
 *
 * Complete schedules are independently validated before inclusion. First-step
 * suggestions validate only the immediate change and defer linked requirements.
 * Results are deduplicated by sorted ID set and ordered by fewest swaps, then IDs.
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
 * - A swap + add: one section is replaced by its declared alternate, with a
 *   two-section swap considered only when no valid direct/single-swap plan exists.
 *
 * All combinations are fully validated by validateDraft before inclusion.
 * Results are deduplicated and ordered by fewest swaps, then lexically by IDs.
 *
 * @param {string[]} draftIds - Current selected section IDs
 * @param {object[]} catalog - Full section catalogue
 * @param {string} [requestedId] - Section to add (defaults to REQUESTED_SECTION_ID)
 * @param {{firstStep?: boolean}} [options] - Return only the immediate repair step when true
 * @returns {Array<{ids: string[], swap: {old:string, replacement:string}|null, swaps: Array<{old:string, replacement:string}>, added: string[], kept: string[]}>}
 */
export function enumerateRepairs(
  draftIds,
  catalog,
  requestedId = REQUESTED_SECTION_ID,
  { firstStep = false } = {}
) {
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

  // Determine the linked-child option sets for the requested section
  const optionSets = firstStep ? [[]] : linkedOptionSets(requested, byId);
  if (optionSets.length === 0) return [];

  const swapChoices = draftIds.map((oldId) =>
    getValidSwaps([oldId], byId).filter((choice) => choice.old)
  );
  function findCandidates(maxSwaps) {
    const swapCombinations = [];
    function enumerateSwapCombinations(index, selectedSwaps) {
      if (index === swapChoices.length) {
        swapCombinations.push(selectedSwaps);
        return;
      }

      enumerateSwapCombinations(index + 1, selectedSwaps);
      if (selectedSwaps.length >= maxSwaps) return;
      for (const choice of swapChoices[index]) {
        enumerateSwapCombinations(index + 1, [...selectedSwaps, choice]);
      }
    }
    enumerateSwapCombinations(0, []);

    const candidates = [];
    for (const swaps of swapCombinations) {
      for (const linkedIds of optionSets) {
        const swappedOutIds = new Set(swaps.map((swap) => swap.old));
        const next = draftIds.filter((id) => !swappedOutIds.has(id));
        next.push(...swaps.map((swap) => swap.replacement));
        if (!next.includes(requestedId)) next.push(requestedId);
        for (const linkedId of linkedIds) {
          if (!next.includes(linkedId)) next.push(linkedId);
        }

        const uniqueIds = [...new Set(next)];
        if (uniqueIds.length !== next.length) continue;

        const linkedIdsToAdd = new Set(linkedIds.filter((id) => !draftIds.includes(id)));
        const stepIds = uniqueIds.filter((id) => !linkedIdsToAdd.has(id));
        const candidateIds = firstStep ? stepIds : uniqueIds;
        let validation = validateDraft(uniqueIds, catalog);

        if (!validation.ok) {
          if (
            !firstStep ||
            !['linked-group-invalid', 'orphan-linked-section'].includes(validation.reason)
          ) continue;

          const stagedValidation = validateDraft(candidateIds, catalog);
          const withoutRequested = validateDraft(
            candidateIds.filter((id) => id !== requestedId),
            catalog
          );
          if (
            !['linked-group-invalid', 'orphan-linked-section'].includes(stagedValidation.reason) ||
            !withoutRequested.ok
          ) continue;

          validation = {
            ...stagedValidation,
            ok: true,
            reason: null,
            stagedLinkedRequirement: true,
            completionPending: true,
          };
        } else {
          validation = {
            ...validation,
            stagedLinkedRequirement: firstStep && linkedIdsToAdd.size > 0,
          };
        }

        candidates.push({
          ids: candidateIds.slice().sort((a, b) => a.localeCompare(b)),
          swap: swaps[0] || null,
          swaps,
          added: candidateIds.filter((id) => !draftIds.includes(id)).sort((a, b) => a.localeCompare(b)),
          kept: draftIds.filter((id) => !swappedOutIds.has(id)).slice().sort((a, b) => a.localeCompare(b)),
          validation: Object.freeze(validation),
        });
      }
    }
    return candidates;
  }

  const singleSwapCandidates = findCandidates(1);
  const completeSingleSwapCandidates = singleSwapCandidates.filter(
    (candidate) => !candidate.validation.completionPending
  );
  let results = completeSingleSwapCandidates;

  if (results.length === 0) {
    const twoSwapCandidates = findCandidates(2);
    const completeTwoSwapCandidates = twoSwapCandidates.filter(
      (candidate) => !candidate.validation.completionPending
    );
    results = completeTwoSwapCandidates.length > 0
      ? completeTwoSwapCandidates
      : firstStep
        ? singleSwapCandidates
        : [];
  }

  // Deduplicate by final sorted ID key
  const deduplicated = new Map();
  for (const candidate of results) {
    const key = candidate.ids.join('|');
    if (!deduplicated.has(key)) deduplicated.set(key, candidate);
  }

  // Prefer the smallest change set, then use IDs for deterministic ordering.
  return [...deduplicated.values()].sort(
    (a, b) =>
      a.swaps.length - b.swaps.length ||
      a.ids.join('|').localeCompare(b.ids.join('|'))
  );
}

/**
 * Re-derive and validate a candidate from current state at use time.
 * Never trusts a stored valid flag or UI object property.
 *
 * Checks that candidateIds exactly matches one of the candidate repair option sets
 * produced by enumerateRepairs for the current draft, catalog, requestedId, and options.
 *
 * @param {string[]} draftIds - Current selected section IDs
 * @param {string[]} candidateIds - Proposed candidate section IDs to revalidate
 * @param {object[]} catalog - Full section catalogue
 * @param {string} [requestedId] - Requested section ID (defaults to REQUESTED_SECTION_ID)
 * @param {{firstStep?: boolean}} [options] - Candidate enumeration mode to revalidate against
 * @returns {boolean}
 */
export function isCurrentCandidate(
  draftIds,
  candidateIds,
  catalog,
  requestedId = REQUESTED_SECTION_ID,
  options = {}
) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) return false;
  if (candidateIds.some((id) => typeof id !== 'string' || !id)) return false;
  if (new Set(candidateIds).size !== candidateIds.length) return false;

  const sortedCandidate = [...candidateIds].sort((a, b) => a.localeCompare(b));
  const candidateKey = sortedCandidate.join('|');

  return enumerateRepairs(draftIds, catalog, requestedId, options).some(
    (candidate) => candidate.ids.join('|') === candidateKey
  );
}
