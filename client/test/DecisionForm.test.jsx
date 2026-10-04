import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionForm } from '../src/features/case/DecisionForm.jsx';
import { renderWithProviders } from './render.jsx';

const analysis = {
  _id: 'a1',
  policyVersion: 1,
  recommendation: { proposedAction: 'remove' },
  aiFindings: [],
  ruleFindings: [],
};
const clauses = [{ code: 'HAR-1', title: 'Targeted harassment', text: 'No insults.' }];

function renderForm() {
  return renderWithProviders(
    <DecisionForm caseId="c1" analysis={analysis} clauses={clauses} recommendedClauses={['HAR-1']} />,
  );
}

describe('DecisionForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says what the human is doing on the button', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Approve: remove content' })).toBeInTheDocument();
  });

  it('requires a rationale when the action is modified, and keeps submit disabled until valid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('radio', { name: /Modify/ }));
    await user.selectOptions(screen.getByLabelText('Action'), 'label');
    const submit = screen.getByRole('button', { name: 'Modify: label content' });
    await user.click(submit);

    expect(screen.getByText('Rationale is required when you modify the action')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('Why this decision?'), 'Mild insult, label it.');
    expect(submit).toBeEnabled();
    expect(screen.queryByText('Rationale is required when you modify the action')).not.toBeInTheDocument();
  });
});
