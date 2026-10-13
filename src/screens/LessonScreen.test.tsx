import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { isLessonComplete, useLessonStore } from '@/features/lessons/store';
import { renderWithRouter } from '@/test/router';
import { LessonScreen } from './LessonScreen';

const cell = (row: number, column: number, contents = 'empty') =>
  screen.getByRole('gridcell', { name: `row ${row}, column ${column}, ${contents}` });

describe('lesson screen', () => {
  beforeEach(() => {
    localStorage.clear();
    useLessonStore.getState().reset();
  });

  it('walks a lesson: intro, a wrong move taken back, hints, and completion', async () => {
    await renderWithRouter(<LessonScreen id="classic-three-in-a-row" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Win and block' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('You have two in a row. Finish it.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Step 1 of 3' })).toBeInTheDocument();

    // A wrong move lands, is explained, and is lifted again.
    await userEvent.click(cell(1, 2));
    expect(screen.getByText(/That is not three in a row/)).toBeInTheDocument();
    await waitFor(() => expect(cell(1, 2)).toBeInTheDocument(), { timeout: 3000 });

    await userEvent.click(screen.getByRole('button', { name: 'Show a hint' }));
    expect(screen.getByText(/Your diagonal runs corner to corner/)).toBeInTheDocument();
    expect(screen.getByText('Suggested move')).toBeInTheDocument();

    // The hinted square says so to a screen reader, not only with a ring.
    await userEvent.click(cell(3, 1, 'empty, suggested move'));
    expect(screen.getByText(/Always check for your own win first/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next step' }));

    await userEvent.click(cell(3, 3));
    await userEvent.click(screen.getByRole('button', { name: 'Next step' }));

    expect(isLessonComplete('classic-three-in-a-row')).toBe(false);
    await userEvent.click(cell(1, 3));
    expect(isLessonComplete('classic-three-in-a-row')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Lesson complete' },
      { timeout: 3000 },
    );
    expect(dialog).toHaveTextContent('1 of');
    expect(within(dialog).getByRole('button', { name: 'Next lesson' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'All lessons' })).toBeInTheDocument();
  });

  it('says so when a lesson does not exist', async () => {
    await renderWithRouter(<LessonScreen id="no-such-lesson" />);
    expect(screen.getByText('Lesson not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All lessons' })).toBeInTheDocument();
  });
});
