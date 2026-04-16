/**
 * T-028 — ImageUploader unit tests.
 *
 * Tests behavior only: file selection, preview rendering, deletion,
 * reorder, and max-count enforcement.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImageUploader } from '../src/components/image-uploader';

function makeFile(name: string, size = 1024, type = 'image/jpeg'): File {
  const file = new File(['x'.repeat(size)], name, { type });
  return file;
}

beforeEach(() => {
  // Stub createObjectURL / revokeObjectURL — happy-dom may not implement them.
  const urls = new Map<File, string>();
  let counter = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (file: File) => {
      const existing = urls.get(file);
      if (existing) return existing;
      counter += 1;
      const url = `blob:preview-${counter}-${file.name}`;
      urls.set(file, url);
      return url;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => {
      /* noop in tests */
    },
  });
});

describe('ImageUploader', () => {
  it('renders the drop zone with instruction text', () => {
    render(<ImageUploader files={[]} onChange={() => undefined} />);
    expect(screen.getByLabelText(/upload images/i)).toBeInTheDocument();
    expect(screen.getByText(/drop|tap|choose/i)).toBeInTheDocument();
  });

  it('calls onChange with selected files when the user picks images', () => {
    const onChange = vi.fn();
    render(<ImageUploader files={[]} onChange={onChange} />);

    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    const fileA = makeFile('a.jpg');
    const fileB = makeFile('b.jpg');
    fireEvent.change(input, { target: { files: [fileA, fileB] } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as File[];
    expect(next).toHaveLength(2);
    expect(next[0].name).toBe('a.jpg');
    expect(next[1].name).toBe('b.jpg');
  });

  it('renders a preview image for each selected file', () => {
    const files = [makeFile('a.jpg'), makeFile('b.jpg')];
    render(<ImageUploader files={files} onChange={() => undefined} />);

    const previews = screen.getAllByRole('img');
    expect(previews).toHaveLength(2);
    expect(previews[0].getAttribute('src')).toContain('blob:');
  });

  it('removes a file when its delete button is pressed', () => {
    const onChange = vi.fn();
    const files = [makeFile('a.jpg'), makeFile('b.jpg')];
    render(<ImageUploader files={files} onChange={onChange} />);

    const deleteButtons = screen.getAllByRole('button', { name: /remove image/i });
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as File[];
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('b.jpg');
  });

  it('enforces a 10-image maximum and surfaces a warning', () => {
    const onChange = vi.fn();
    const existing = Array.from({ length: 8 }, (_, i) => makeFile(`file-${i}.jpg`));
    render(<ImageUploader files={existing} onChange={onChange} />);

    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    const incoming = [
      makeFile('x1.jpg'),
      makeFile('x2.jpg'),
      makeFile('x3.jpg'),
      makeFile('x4.jpg'),
    ];
    fireEvent.change(input, { target: { files: incoming } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as File[];
    expect(next).toHaveLength(10);
    expect(screen.getByRole('alert')).toHaveTextContent(/max|10/i);
  });

  it('reorders images when move-up is pressed', () => {
    const onChange = vi.fn();
    const files = [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')];
    render(<ImageUploader files={files} onChange={onChange} />);

    const moveUps = screen.getAllByRole('button', { name: /move up/i });
    // First preview has no move-up, so 2 buttons total (for b and c)
    expect(moveUps).toHaveLength(2);
    fireEvent.click(moveUps[0]); // moves "b" above "a"

    const next = onChange.mock.calls[0][0] as File[];
    expect(next.map((f) => f.name)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
  });

  it('rejects files larger than 5MB with an inline error', () => {
    const onChange = vi.fn();
    render(<ImageUploader files={[]} onChange={onChange} />);

    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    const oversized = makeFile('huge.jpg', 6 * 1024 * 1024);
    const ok = makeFile('small.jpg', 1024);
    fireEvent.change(input, { target: { files: [oversized, ok] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/5\s*MB|too large|exceed/i);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as File[];
    expect(next.map((f) => f.name)).toEqual(['small.jpg']);
  });

  it('does not invoke onChange when every selected file is oversized', () => {
    const onChange = vi.fn();
    render(<ImageUploader files={[]} onChange={onChange} />);

    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    const oversized = makeFile('huge.jpg', 6 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [oversized] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/5\s*MB|too large|exceed/i);
  });
});
