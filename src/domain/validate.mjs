/**
 * Nonthrowing catalogue-record and draft-ID validation for EnrollFix.
 * All functions return { ok: boolean, reason: string | null }.
 */

/**
 * Validate a draft array of section IDs against a catalogue.
 *
 * Checks:
 * - draft must be an array
 * - every ID must be a nonempty string
 * - IDs must be unique within the draft
 * - every ID must exist in the catalogue
 *
 * @param {unknown} draft
 * @param {Array<{id: string}>} catalogue
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function validateDraft(draft, catalogue) {
  if (!Array.isArray(draft)) {
    return { ok: false, reason: 'draft must be an array' };
  }

  const catalogueIds = new Set(
    Array.isArray(catalogue) ? catalogue.map((s) => s.id) : []
  );

  const seen = new Set();
  for (const id of draft) {
    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, reason: 'draft IDs must be nonempty strings' };
    }
    if (seen.has(id)) {
      return { ok: false, reason: `duplicate draft ID: ${id}` };
    }
    seen.add(id);
    if (!catalogueIds.has(id)) {
      return { ok: false, reason: `unknown section ID in draft: ${id}` };
    }
  }

  return { ok: true, reason: null };
}

/**
 * Validate that a catalogue array has unique IDs.
 *
 * Checks:
 * - catalogue must be an array
 * - every record must be an object with a nonempty string id
 * - IDs must be unique across the catalogue
 *
 * @param {unknown} catalogue
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function validateCatalogue(catalogue) {
  if (!Array.isArray(catalogue)) {
    return { ok: false, reason: 'catalogue must be an array' };
  }

  const seen = new Set();
  for (const record of catalogue) {
    if (typeof record !== 'object' || record === null) {
      return { ok: false, reason: 'catalogue record must be an object' };
    }
    const { id } = record;
    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, reason: 'catalogue record id must be a nonempty string' };
    }
    if (seen.has(id)) {
      return { ok: false, reason: `duplicate catalogue ID: ${id}` };
    }
    seen.add(id);

    // Required course field
    if (typeof record.course !== 'string' || record.course.trim() === '') {
      return { ok: false, reason: `malformed record ${id}: course must be a nonempty string` };
    }

    // Required component field
    if (typeof record.component !== 'string' || record.component.trim() === '') {
      return { ok: false, reason: `malformed record ${id}: component must be a nonempty string` };
    }
  }

  return { ok: true, reason: null };
}
