import { StrictMode, useEffect, useState } from 'react';
import { type RouterHistory, useRouter } from '@tanstack/react-router';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { useDialog } from './useDialog';
import { useClosing } from './useClosing';

function Panel({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  const { close } = useClosing(onClose);
  const ref = useDialog<HTMLDivElement>(close);
  return (
    <div role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
      <button onClick={close}>Close</button>
      {children}
    </div>
  );
}

describe('dialog lifecycle', () => {
  it('owns one history entry in StrictMode and preserves repeated local selections on Back', async () => {
    let history!: RouterHistory;
    function Harness() {
      const currentHistory = useRouter().history;
      useEffect(() => {
        history = currentHistory;
      }, [currentHistory]);
      const [open, setOpen] = useState(false);
      const [choice, setChoice] = useState(0);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <output aria-label="Choice">{choice}</output>
          {open ? (
            <Panel onClose={() => setOpen(false)}>
              <button onClick={() => setChoice((value) => value + 1)}>Change</button>
            </Panel>
          ) : null}
        </>
      );
    }
    await renderWithRouter(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    for (let index = 0; index < 4; index++)
      await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(history.location.state['__TSR_index']).toBe(1);
    act(() => history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Choice')).toHaveTextContent('4');
    expect(history.location.state['__TSR_index']).toBe(0);
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('only closes the top dialog on Escape and retains the outer scroll lock', async () => {
    function Harness() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(false);
      return outer ? (
        <Panel onClose={() => setOuter(false)}>
          <button onClick={() => setInner(true)}>Inner</button>
          {inner ? <Panel onClose={() => setInner(false)} /> : null}
        </Panel>
      ) : (
        <button>Outside</button>
      );
    }
    await renderWithRouter(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Inner' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
  });
});
