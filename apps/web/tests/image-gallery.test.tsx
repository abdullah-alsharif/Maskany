import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageGallery } from '../src/components/image-gallery';
import type { PropertyMedia } from '../src/types/property';

const makeImage = (id: string, i: number): PropertyMedia => ({
  id,
  mediaType: 'IMAGE',
  url: `https://cdn.example.com/${id}.webp`,
  thumbnailUrl: `https://cdn.example.com/${id}-thumb.webp`,
  altText: `Image ${id}`,
  mimeType: 'image/webp',
  fileSize: 1000,
  width: 1600,
  height: 1200,
  duration: null,
  sortOrder: i,
});

const images: PropertyMedia[] = [makeImage('a', 0), makeImage('b', 1), makeImage('c', 2)];

describe('ImageGallery', () => {
  it('renders every image with alt text', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    const imgs = screen.getAllByRole('img');
    // each image renders in both the mobile slide and desktop grid
    expect(imgs).toHaveLength(6);
    expect(imgs.filter((img) => img.getAttribute('alt') === 'Image a')).toHaveLength(2);
    expect(imgs.filter((img) => img.getAttribute('alt') === 'Image b')).toHaveLength(2);
    expect(imgs.filter((img) => img.getAttribute('alt') === 'Image c')).toHaveLength(2);
  });

  it('renders a photo counter showing the active index and total', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('renders a dot indicator button per image', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    expect(screen.getByRole('button', { name: /go to image 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to image 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to image 3/i })).toBeInTheDocument();
  });

  it('marks the first dot as current on initial render', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    expect(screen.getByRole('button', { name: /go to image 1/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('clicking a later dot jumps to that image (counter updates)', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /go to image 3/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('swipe left (touch delta < -threshold) advances to the next image', () => {
    const { container } = render(<ImageGallery images={images} alt="Villa" />);
    const track = container.firstElementChild as HTMLElement;
    fireEvent.touchStart(track, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(track);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('swipe right (touch delta > threshold) returns to the previous image', () => {
    const { container } = render(<ImageGallery images={images} alt="Villa" />);
    // first advance to image 2
    fireEvent.click(screen.getByRole('button', { name: /go to image 2/i }));
    const track = container.firstElementChild as HTMLElement;
    fireEvent.touchStart(track, { touches: [{ clientX: 50 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(track);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('renders a fallback when there are no images', () => {
    render(<ImageGallery images={[]} alt="Villa" />);
    expect(screen.getByText(/no images/i)).toBeInTheDocument();
  });

  it('does not close fullscreen when the image is clicked (T-031 AC)', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    // Sanity: fullscreen is open — close button present
    expect(screen.getByRole('button', { name: /close fullscreen/i })).toBeInTheDocument();
    // Click directly on the image (pick the first of two renderings)
    const img = screen.getAllByRole('img', { name: /image a/i })[0];
    fireEvent.click(img);
    // Still in fullscreen
    expect(screen.getByRole('button', { name: /close fullscreen/i })).toBeInTheDocument();
  });

  it('closes fullscreen when Escape is pressed (T-031 AC)', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    expect(screen.getByRole('button', { name: /close fullscreen/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: /close fullscreen/i })).not.toBeInTheDocument();
  });

  it('advances to the next image on ArrowRight in fullscreen (T-031 AC)', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('goes to the previous image on ArrowLeft in fullscreen (T-031 AC)', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    // Advance to image 2 via dot
    fireEvent.click(screen.getByRole('button', { name: /go to image 2/i }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('ignores Escape and arrow keys when not in fullscreen (T-031 AC)', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    // Pressing arrow keys outside of fullscreen should not navigate
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});
