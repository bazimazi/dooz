import { modeById } from '@/game/engine';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmoteBar } from '@/game/components/EmoteBar';
import { ModePicker } from '@/game/components/ModePicker';
import { Segmented, Toggle } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';

/**
 * The accessibility behaviour a refactor can silently break.
 *
 * Contrast and target size are checked against a real browser by
 * `scripts/a11y-audit.mjs`, because jsdom has neither layout nor colour. What
 * *is* checkable here is the semantics and the keyboard: the roles, the names,
 * the roving tab stops and the arrow keys. Those are the parts that quietly
 * stop working when a component is restyled.
 */

describe('every icon-only control is named', () => {
  it('requires a label and uses it for both the name and the tooltip', () => {
    render(
      <IconButton label="Take back the last move">
        <span aria-hidden="true">x</span>
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Take back the last move' });
    expect(button).toHaveAttribute('title', 'Take back the last move');
  });
});

describe('Segmented', () => {
  it('is a radio group, not a row of buttons', () => {
    render(
      <Segmented
        label="Bot difficulty"
        value="medium"
        onChange={vi.fn()}
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
        ]}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'Bot difficulty' });
    const options = within(group).getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(options[1]).toBeChecked();
  });

  it('reports the choice when one is made', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Theme"
        value="system"
        onChange={onChange}
        options={[
          { value: 'system', label: 'Auto' },
          { value: 'light', label: 'Light' },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});

describe('Toggle', () => {
  it('is a switch with a state a screen reader can read', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Practice hints" checked={false} onChange={onChange} />);

    const toggle = screen.getByRole('switch', { name: /Practice hints/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Tabs', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma' },
  ];

  it('is a tablist with exactly one selected tab', () => {
    render(<Tabs label="Mode" value="b" onChange={vi.fn()} options={options} />);

    const tabs = within(screen.getByRole('tablist', { name: 'Mode' })).getAllByRole('tab');
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('is one tab stop, whichever tab is selected', () => {
    render(<Tabs label="Mode" value="c" onChange={vi.fn()} options={options} />);

    const stops = screen.getAllByRole('tab').filter((tab) => tab.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveTextContent('Gamma');
  });

  it('moves between tabs with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Mode" value="b" onChange={onChange} options={options} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('c');

    onChange.mockClear();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('does not run off either end', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Mode" value="a" onChange={onChange} options={options} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ModePicker', () => {
  it('is a radio group of modes with one tab stop', () => {
    render(<ModePicker value="classic" onChange={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Game mode' });
    const modes = within(group).getAllByRole('radio');

    expect(modes.length).toBeGreaterThan(4);
    expect(modes.filter((mode) => mode.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /Classic/ })).toBeChecked();
  });

  it('moves the selection with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<ModePicker value="classic" onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('grid-6');
  });

  it('names every mode, so the list is readable without the previews', () => {
    render(<ModePicker value="classic" onChange={vi.fn()} />);

    for (const mode of ['Classic', 'Grid 6', 'Ultimate', 'Misère']) {
      expect(screen.getByRole('radio', { name: new RegExp(mode) })).toBeInTheDocument();
    }
    expect(modeById('ultimate').rules.length).toBeGreaterThan(2);
  });
});

describe('EmoteBar', () => {
  it('spells out what each emote says, rather than relying on the glyph', () => {
    render(<EmoteBar onSend={vi.fn()} muted={false} onMuteChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Send: Good game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send: Your turn' })).toBeInTheDocument();
  });

  it('exposes the mute state as a pressed button', async () => {
    const onMuteChange = vi.fn();
    render(<EmoteBar onSend={vi.fn()} muted onMuteChange={onMuteChange} />);

    const mute = screen.getByRole('button', { name: 'Unmute your opponent' });
    expect(mute).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(mute);
    expect(onMuteChange).toHaveBeenCalledWith(false);
  });

  it('stops offering emotes while the connection is down', () => {
    render(<EmoteBar onSend={vi.fn()} muted={false} onMuteChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Send: Good game' })).toBeDisabled();
  });
});
