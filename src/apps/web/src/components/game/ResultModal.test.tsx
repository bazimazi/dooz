import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { ResultModal } from './ResultModal';

function renderModal() {
  return renderWithRouter(
    <div>
      <button type="button">behind the panel</button>
      <ResultModal title="you Won!" art={null} onRestart={vi.fn()} />
    </div>,
  );
}

describe('ResultModal', () => {
  it('moves focus into the panel', async () => {
    await renderModal();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  /**
   * `aria-modal="true"` is a promise, not an instruction to the browser. Without
   * a trap the board and the controls behind the panel stay in the tab order,
   * and a keyboard user tabs out of a dialog that claims nothing is outside it.
   */
  it('keeps tab inside the panel', async () => {
    await renderModal();
    const outside = screen.getByRole('button', { name: 'behind the panel' });

    for (let press = 0; press < 6; press++) {
      await userEvent.tab();
      expect(outside).not.toHaveFocus();
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    }
  });

  it('hides the rest of the page from assistive technology', async () => {
    await renderModal();
    expect(
      screen.getByRole('button', { name: 'behind the panel' }).closest('[inert]'),
    ).not.toBeNull();
  });

  it('gives the page back when it closes', async () => {
    const { unmount } = await renderModal();
    unmount();
    render(
      <div>
        <button type="button">behind the panel</button>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'behind the panel' }).closest('[inert]')).toBeNull();
  });
});
