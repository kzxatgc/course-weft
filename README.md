# Course Weft

**Plan a timetable, see the clash, review a repair, and decide before changing
your draft.**

Course Weft is an interactive academic-planning prototype built for the
Hyperbloom October UI/UX and Web Design Hackathon. It explores how a student
registration interface can make course conflicts and their possible fixes
easier to understand.

## The idea

Choosing a course can affect several parts of a weekly schedule. A conflict
message alone does not show what would need to change. Course Weft lets a
viewer try a sample course, inspect a generated repair, and choose whether to
apply it to a reversible local timetable draft.

## Explore the prototype

1. Review the initial timetable and the fictional enrolment/capacity counts.
2. In **Scenarios**, select **Repair available**. Request BIO-214 and choose
   **Find valid repair** to inspect a generated plan.
3. Review the proposed **Add** and **Swap** sections. Unchanged courses remain
   in the draft; the preview does not show a separate **Keep** card.
4. Choose **Apply repair**, then use **Undo** to restore the previous draft.
5. Select **No repair available** and try BIO-214 again to see the known-data
   case where no valid repair can be found.

The no-repair example is specific to its sample catalogue: Lab A overlaps
MATH-A, while Lab B is full. It illustrates a refusal outcome for this
configured case, not a conclusion about real schedules.

## Designed interactions

- **Review before applying:** inspect course additions and replacements before
  they affect the timetable draft.
- **Reversible planning:** apply and undo repairs without submitting a
  registration.
- **Keyboard support:** navigate controls with the keyboard; optional Q hints
  identify available contextual repair or alert actions.
- **Responsive presentation:** the workspace adapts to compact viewports, and
  motion effects respect reduced-motion preferences.
- **Optional sound:** interaction cues can be muted in Settings.
- **Scenario switching:** compare a repair-available example with a configured
  no-repair outcome.

These are implemented interface behaviors, not a claim of accessibility
conformance or user-study validation.

## Data and privacy boundary

All student and lecturer identities, courses, meeting times, enrolment counts,
and capacities are fictional sample data. The profile identity is Bill Andrew
(BA), a display-only demo persona. Availability counts illustrate the
interface and are not live seat counts.

The application does not connect to university registration records. Applying
a repair changes only the local draft in the browser; it does not enroll, drop,
reserve, or submit courses. Do not enter real student information or use this
prototype to make actual registration decisions.

Theme and sound preferences may be stored in browser local storage. This is not
a student account or registration record.

## Repair implementation

This project dynamically generates candidate repairs from the current draft
and sample catalogue, then validates candidates before presenting them.
Unchanged sections remain selected. The visible preview shows new sections
under **Add** and replacements under **Swap**.

The current interface does not offer a precomputed-plan mode or a
dynamic-to-precomputed fallback. Repair results describe only the bundled
sample data; they do not establish eligibility, policy compliance, or
correctness for a real institution.

## Technology

- React and React DOM
- Vite
- Tailwind CSS with the Vite plugin, plus project CSS
- Motion for selected transitions
- Lucide React for icons
- Howler.js for optional sound cues

Use Node.js 20.19 or later in the 20.x line, or Node.js 22.12 or later in the
22.x line, with npm. These versions satisfy the Vite version recorded in the
lockfile.

## Run locally

From the `course-weft` project directory:

```sh
npm ci
npm run dev
```

Vite prints the local development address. Stop the server with Ctrl+C.

To run the automated tests and production build:

```sh
npm test
npm run build
```

The test command runs `node --test tests/*.test.mjs`. The build runs the
offline source guard, then creates the production files in `dist/`. The source
guard checks for selected network API names; it is not a security audit.

On Windows, `open_course_weft.bat` is the convenience launcher. It installs
dependencies with `npm ci` if needed, builds the application, starts a Vite
preview server at `http://127.0.0.1:4173/`, waits for it to respond, and opens
the browser. Keep the command window open while using that preview.

## Project limits

Course Weft is a prototype for exploring an interface concept. It is not an
institution-approved advising or registration system. The sample catalogue,
availability, and repair outcomes are fictional; no live data integration,
research study, or institutional validation is claimed.
