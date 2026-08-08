import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditImageManager, MAX_IMAGES } from '../src/components/edit-image-manager';
import type { PropertyMedia } from '../src/types/property';

const EXISTING: PropertyMedia = {
  id: 'img-1',
  url: '/uploads/a.jpg',
  thumbnailUrl: '/uploads/a-thumb.jpg',
  altText: 'Living room',
  propertyId: 'prop-1',
} as PropertyMedia;

function makeFile(name = 'photo.jpg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

describe('EditImageManager', () => {
  const onExisting = vi.fn();
  const onNew = vi.fn();

  beforeEach(() => {
    onExisting.mockClear();
    onNew.mockClear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-1');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the image count and existing images with thumbnails', () => {
    render(
      <EditImageManager
        existingImages={[EXISTING]}
        newFiles={[]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    expect(screen.getByText('1 of 10 images')).toBeInTheDocument();
    expect(screen.getByAltText('Living room')).toHaveAttribute('src', '/uploads/a-thumb.jpg');
  });

  it('renders a badge and preview URL for each new file', () => {
    render(
      <EditImageManager
        existingImages={[]}
        newFiles={[makeFile('new.png')]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    expect(screen.getByAltText('new.png')).toHaveAttribute('src', 'blob:preview-1');
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('adds accepted files and clears the input value', () => {
    render(
      <EditImageManager
        existingImages={[]}
        newFiles={[]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    const input = screen.getByLabelText('Upload images');
    fireEvent.change(input, { target: { files: [makeFile('one.jpg')] } });
    expect(onNew).toHaveBeenCalledWith([expect.objectContaining({ name: 'one.jpg' })]);
    expect(input).toHaveValue('');
  });

  it('rejects oversized files with a size warning', () => {
    render(
      <EditImageManager
        existingImages={[]}
        newFiles={[]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
        maxFileBytes={100}
      />,
    );
    const input = screen.getByLabelText('Upload images');
    fireEvent.change(input, { target: { files: [makeFile('big.jpg', 2000)] } });
    expect(screen.getByRole('alert')).toHaveTextContent('per-image limit and was skipped');
    expect(onNew).not.toHaveBeenCalled();
  });

  it('warns when adding files would exceed the maximum and keeps the first N', () => {
    render(
      <EditImageManager
        existingImages={[]}
        newFiles={[makeFile('keep.jpg')]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
        maxFiles={2}
      />,
    );
    fireEvent.change(screen.getByLabelText('Upload images'), {
      target: { files: [makeFile('first.jpg'), makeFile('second.jpg')] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('can upload a max of 2 images');
    expect(onNew).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'keep.jpg' }),
      expect.objectContaining({ name: 'first.jpg' }),
    ]);
  });

  it('deletes an existing image after confirmation', () => {
    render(
      <EditImageManager
        existingImages={[EXISTING]}
        newFiles={[]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete image Living room'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onExisting).toHaveBeenCalledWith([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a new file after confirmation and leaves existing images', () => {
    render(
      <EditImageManager
        existingImages={[EXISTING, { ...EXISTING, id: 'img-2' }]}
        newFiles={[makeFile('drop.png')]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete image drop.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onExisting).not.toHaveBeenCalled();
    expect(onNew).toHaveBeenCalledWith([]);
  });

  it('cancels the delete dialog without changes', () => {
    render(
      <EditImageManager
        existingImages={[EXISTING]}
        newFiles={[]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete image Living room'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onExisting).not.toHaveBeenCalled();
    expect(onNew).not.toHaveBeenCalled();
  });

  it('moves an existing image down after a new file', () => {
    render(
      <EditImageManager
        existingImages={[EXISTING]}
        newFiles={[makeFile('second.jpg')]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    fireEvent.click(screen.getByLabelText('Move down Living room'));
    expect(onExisting).toHaveBeenCalledWith([{ ...EXISTING }]);
    expect(onNew).toHaveBeenCalledWith([expect.objectContaining({ name: 'second.jpg' })]);
  });

  it('renders an empty state without an image list', () => {
    expect(MAX_IMAGES).toBe(10);
    const { container } = render(
      <EditImageManager
        existingImages={[]}
        newFiles={[]}
        onExistingImagesChange={onExisting}
        onNewFilesChange={onNew}
      />,
    );
    expect(container.querySelector('ul')).toBeNull();
  });
});
