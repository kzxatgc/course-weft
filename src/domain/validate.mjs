/**
 * Nonthrowing catalogue-record and draft-ID validation for EnrollFix.
 * All functions return { ok: boolean, reason: string | null }.
 */

export const VALID_WEEKDAYS = Object.freeze([
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]);

export const KNOWN_SEAT_STATES = Object.freeze(['open', 'full', 'unknown']);

/**
 * Authoritative rule for the linked lecture in this demo.
 * Kept separate from catalogue records so removing or corrupting catalogue metadata fails closed.
 */
export const REQUIRED_LINK_RULES = Object.freeze({
  'BIO-214': Object.freeze([
    Object.freeze({ component: 'lab', linkedGroup: 'BIO-214-labs', min: 1, max: 1 }),
  ]),
});

/**
 * Check if a section meeting has a valid weekday and positive time duration.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function hasValidTime(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    typeof item.day === 'string' &&
    VALID_WEEKDAYS.includes(item.day) &&
    Number.isInteger(item.start) &&
    Number.isInteger(item.end) &&
    item.start >= 0 &&
    item.start <= 1440 &&
    item.end >= 0 &&
    item.end <= 1440 &&
    item.end > item.start
  );
}

/**
 * Check if a section has a recognized seat state.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function hasValidSeatState(item) {
  if (!item || typeof item !== 'object') return false;
  return typeof item.seat === 'string' && KNOWN_SEAT_STATES.includes(item.seat);
}

/**
 * Check if a section has valid synthetic capacity and enrollment counts.
 * If counts are omitted (generic unknown-seat record), returns true.
 * If counts are provided, requires capacity > 0 and 0 <= enrolled <= capacity.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function hasValidCounts(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.enrolled === undefined && item.capacity === undefined) {
    return true;
  }
  return (
    Number.isInteger(item.capacity) &&
    item.capacity > 0 &&
    Number.isInteger(item.enrolled) &&
    item.enrolled >= 0 &&
    item.enrolled <= item.capacity
  );
}

/**
 * Check basic structural validity of a catalogue array without inspecting meeting times.
 *
 * @param {unknown} catalogue
 * @returns {boolean}
 */
function hasValidCatalogStructure(catalogue) {
  if (!Array.isArray(catalogue)) return false;
  const seen = new Set();
  for (const item of catalogue) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.id !== 'string' || item.id.trim() === '') return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
  }
  return true;
}

/**
 * Test whether two section meetings overlap on the same day.
 * Uses half-open intervals [start, end) so adjacent meetings (e.g. 600..660 and 660..720) do not clash.
 *
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function overlaps(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (typeof a.day !== 'string' || typeof b.day !== 'string') return false;
  if (
    !Number.isInteger(a.start) ||
    !Number.isInteger(a.end) ||
    !Number.isInteger(b.start) ||
    !Number.isInteger(b.end)
  ) {
    return false;
  }
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

/**
 * Validate that linked course components satisfy min/max constraints and are not orphaned.
 *
 * @param {Array<any>} chosen
 * @param {Map<string, any>} byId
 * @returns {{ ok: boolean, reason?: string | null }}
 */
export function validateLinks(chosen, byId) {
  for (const parent of chosen) {
    for (const requirement of parent.requires ?? []) {
      if (
        !requirement ||
        typeof requirement.component !== 'string' ||
        typeof requirement.linkedGroup !== 'string' ||
        !Number.isInteger(requirement.min) ||
        requirement.min < 0 ||
        !Number.isInteger(requirement.max) ||
        requirement.max < requirement.min
      ) {
        return { ok: false, reason: 'malformed-link-requirement' };
      }
      const matching = chosen.filter(
        (candidate) =>
          candidate.component === requirement.component &&
          candidate.linkedGroup === requirement.linkedGroup &&
          candidate.requiredBy === parent.id
      );
      if (matching.length < requirement.min || matching.length > requirement.max) {
        return { ok: false, reason: 'linked-group-invalid' };
      }
    }
  }

  for (const child of chosen) {
    if (!child.linkedGroup) continue;
    const parent = byId.get(child.requiredBy);
    const parentIsSelected = chosen.some((candidate) => candidate.id === child.requiredBy);
    const hasMatchingRequirement = parent?.requires?.some(
      (requirement) =>
        requirement.component === child.component &&
        requirement.linkedGroup === child.linkedGroup
    );
    if (!parentIsSelected || !hasMatchingRequirement) {
      return { ok: false, reason: 'orphan-linked-section' };
    }
  }

  return { ok: true, reason: null };
}

/**
 * Validate a draft array of section IDs against a catalogue.
 *
 * Checks:
 * - draft must be an array
 * - catalogue must have valid structure (array of unique IDs)
 * - every draft ID must be a nonempty string
 * - IDs must be unique within the draft
 * - every ID must exist in the catalogue
 * - every selected section must have recognized seat state ('open', 'full', 'unknown')
 * - every selected section must have valid weekday and meeting time
 * - selected sections must have seat certified as 'open' (fails closed on 'full' or 'unknown')
 * - sections cannot share the same course and component (even with distinct IDs)
 * - sections cannot have conflicting meeting times on the same day
 *
 * @param {unknown} draft
 * @param {unknown} catalogue
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function validateDraft(draft, catalogue) {
  if (!Array.isArray(draft)) {
    return { ok: false, reason: 'draft must be an array' };
  }

  if (!hasValidCatalogStructure(catalogue)) {
    return { ok: false, reason: 'malformed-catalog' };
  }

  const byId = new Map(catalogue.map((s) => [s.id, s]));

  const seen = new Set();
  for (const id of draft) {
    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, reason: 'malformed-or-duplicate-ids' };
    }
    if (seen.has(id)) {
      return { ok: false, reason: `duplicate draft ID: ${id}` };
    }
    seen.add(id);
    if (!byId.has(id)) {
      return { ok: false, reason: `unknown section ID in draft: ${id}` };
    }
  }

  const chosen = [];
  // Validate each chosen section record
  for (const id of draft) {
    const item = byId.get(id);

    if (
      typeof item.course !== 'string' ||
      !item.course.trim() ||
      typeof item.component !== 'string' ||
      !item.component.trim()
    ) {
      return { ok: false, reason: 'malformed-section-record' };
    }

    if (!hasValidSeatState(item)) {
      return { ok: false, reason: 'malformed-seat-state' };
    }

    if (!hasValidCounts(item)) {
      return { ok: false, reason: 'malformed-seat-state' };
    }

    if (item.enrolled !== undefined && item.capacity !== undefined) {
      const expected = item.enrolled < item.capacity ? 'open' : 'full';
      if (item.seat !== expected) {
        return { ok: false, reason: 'malformed-seat-state' };
      }
    }

    if (!hasValidTime(item)) {
      return { ok: false, reason: 'bad-time-or-day' };
    }

    if (item.seat !== 'open') {
      return { ok: false, reason: 'seat-not-certified-open' };
    }

    // Verify authoritative link requirements if this is a known parent section
    const expectedRequirements = REQUIRED_LINK_RULES[item.id];
    if (expectedRequirements) {
      const actualRequirements = item.requires;
      const normalize = (list) =>
        Array.isArray(list)
          ? list
              .map((r) => ({
                component: r?.component,
                linkedGroup: r?.linkedGroup,
                min: r?.min,
                max: r?.max,
              }))
              .sort(
                (a, b) =>
                  String(a.component).localeCompare(String(b.component)) ||
                  String(a.linkedGroup).localeCompare(String(b.linkedGroup))
              )
          : null;
      if (
        JSON.stringify(normalize(actualRequirements)) !==
        JSON.stringify(normalize(expectedRequirements))
      ) {
        return { ok: false, reason: 'malformed-link-requirement' };
      }
    }
    if (item.requires !== undefined && !Array.isArray(item.requires)) {
      return { ok: false, reason: 'malformed-link-requirement' };
    }

    chosen.push(item);
  }

  // Disallow duplicate course and component
  const courseComponents = new Set();
  for (const item of chosen) {
    const key = `${item.course}|${item.component}`;
    if (courseComponents.has(key)) {
      return { ok: false, reason: 'duplicate-course-component' };
    }
    courseComponents.add(key);
  }

  // Pairwise meeting collision check
  for (let i = 0; i < chosen.length; i += 1) {
    for (let j = i + 1; j < chosen.length; j += 1) {
      if (overlaps(chosen[i], chosen[j])) {
        return { ok: false, reason: 'time-conflict' };
      }
    }
  }

  // Enforce linked course requirements
  const linkResult = validateLinks(chosen, byId);
  if (!linkResult.ok) {
    return linkResult;
  }

  return { ok: true, reason: null };
}

/**
 * Validate that a catalogue array is complete and well-formed.
 *
 * Checks:
 * - catalogue must be an array
 * - every record must be an object with unique, nonempty string id
 * - required course and component strings
 * - valid weekday and positive time duration
 * - recognized seat state ('open', 'full', 'unknown')
 * - count bounds and consistency with seat state
 *
 * Note: sections with seat: 'full' remain completely valid catalogue data.
 *
 * @param {unknown} catalogue
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function validateCatalogue(catalogue) {
  if (!Array.isArray(catalogue)) {
    return { ok: false, reason: 'catalogue must be an array' };
  }

  // Pass 1: Ensure all items are objects with unique nonempty string IDs
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
  }

  // Pass 2: Ensure required fields, valid meeting times, and consistent seat/count data
  for (const record of catalogue) {
    const { id } = record;

    // Required course field
    if (typeof record.course !== 'string' || record.course.trim() === '') {
      return { ok: false, reason: `malformed record ${id}: course must be a nonempty string` };
    }

    // Required component field
    if (typeof record.component !== 'string' || record.component.trim() === '') {
      return { ok: false, reason: `malformed record ${id}: component must be a nonempty string` };
    }

    // Meeting time and day validation
    if (!hasValidTime(record)) {
      return { ok: false, reason: 'bad-time-or-day' };
    }

    // Seat state validation
    if (!hasValidSeatState(record)) {
      return { ok: false, reason: 'malformed-seat-state' };
    }

    // Counts validation
    if (!hasValidCounts(record)) {
      return { ok: false, reason: 'malformed-counts' };
    }

    // Seat count consistency
    if (record.enrolled !== undefined && record.capacity !== undefined) {
      const expected = record.enrolled < record.capacity ? 'open' : 'full';
      if (record.seat !== expected) {
        return { ok: false, reason: 'malformed-seat-state' };
      }
    } else if (record.seat !== 'unknown') {
      return { ok: false, reason: 'malformed-seat-state' };
    }
  }

  return { ok: true, reason: null };
}
