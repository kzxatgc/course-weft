import React, { useReducer } from 'react';
import AppShell from './AppShell.jsx';
import EarlySchedulePreview from './EarlySchedulePreview.jsx';
import { initialState, reduce } from './state/draft-controller.mjs';

/**
 * Root Application Component.
 * Wires the draft-controller pure reducer with AppShell and the schedule workspace.
 */
export default function App() {
  const [state, dispatch] = useReducer(reduce, null, initialState);

  return (
    <AppShell state={state} dispatch={dispatch}>
      <EarlySchedulePreview state={state} dispatch={dispatch} />
    </AppShell>
  );
}
