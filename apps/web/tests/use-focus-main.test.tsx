import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import { useFocusMain } from '../src/hooks/use-focus-main';
import { setCurrentPath, resetRouter } from './mocks/next-navigation';

function Harness() {
  useFocusMain();
  return null;
}

beforeEach(() => {
  resetRouter();
});

afterEach(() => {
  resetRouter();
});

describe('useFocusMain (T-025, PRD §8.5)', () => {
  it('moves focus to the #main-content element when the route changes', async () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    document.body.appendChild(main);

    setCurrentPath('/');
    render(<Harness />);

    await act(async () => {
      setCurrentPath('/search');
    });

    // After pathname change the hook must focus the main landmark.
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(main);
    document.body.removeChild(main);
  });

  it('does nothing when no #main-content element is present', async () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    setCurrentPath('/');
    render(<Harness />);

    await new Promise((r) => setTimeout(r, 0));
    // Focus should not have been hijacked (no main element to focus).
    expect(document.activeElement).toBe(button);
    document.body.removeChild(button);
  });
});
