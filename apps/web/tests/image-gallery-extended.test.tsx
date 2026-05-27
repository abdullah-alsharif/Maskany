import { describe, it, expect, vi } from 'vitest';
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

describe('ImageGallery — fullscreen interactions (T-064)', () => {
  it('opens fullscreen when the open gallery button is clicked', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    expect(screen.getByRole('button', { name: /close fullscreen/i })).toBeInTheDocument();
  });

  it('closes fullscreen when the close button is clicked', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    fireEvent.click(screen.getByRole('button', { name: /close fullscreen/i }));
    expect(screen.queryByRole('button', { name: /close fullscreen/i })).not.toBeInTheDocument();
  });

  it('navigates to a specific image via dot buttons in fullscreen', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    fireEvent.click(screen.getByRole('button', { name: /go to image 3/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('renders the "Show all N photos" button on desktop when >1 images', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    const showAll = screen.getByText(/show all 3 photos/i);
    expect(showAll).toBeInTheDocument();
  });

  it('renders image navigation arrows in fullscreen', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    expect(screen.getByRole('button', { name: /next image/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous image/i })).not.toBeInTheDocument();
  });

  it('shows previous image arrow after advancing', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /open fullscreen gallery/i }));
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /previous image/i })).toBeInTheDocument();
  });

  it('increments photo counter when swiping left on mobile', () => {
    const { container } = render(<ImageGallery images={images} alt="Villa" />);
    const track = container.firstElementChild as HTMLElement;
    fireEvent.touchStart(track, { touches: [{ clientX: 300 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(track);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('decrements photo counter when swiping right after advancing', () => {
    const { container } = render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /go to image 2/i }));
    const track = container.firstElementChild as HTMLElement;
    fireEvent.touchStart(track, { touches: [{ clientX: 50 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 250 }] });
    fireEvent.touchEnd(track);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('handles single image layout without crashing', () => {
    const single = [makeImage('only', 0)];
    const { container } = render(<ImageGallery images={single} alt="Solo" />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('loads first image eagerly and others lazily', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    const imgs = screen.getAllByRole('img');
    const eagerImgs = imgs.filter((img) => img.getAttribute('loading') === 'eager');
    const lazyImgs = imgs.filter((img) => img.getAttribute('loading') === 'lazy');
    expect(eagerImgs.length).toBeGreaterThanOrEqual(2); // mobile + desktop
    expect(lazyImgs.length).toBeGreaterThan(0);
  });

  it('renders placeholder skeleton before images load', () => {
    const { container } = render(<ImageGallery images={images} alt="Villa" />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('updates counter to the dot index when a dot is clicked', () => {
    render(<ImageGallery images={images} alt="Villa" />);
    fireEvent.click(screen.getByRole('button', { name: /go to image 2/i }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('does not render dots for a single image', () => {
    const single = [makeImage('only', 0)];
    render(<ImageGallery images={single} alt="Solo" />);
    expect(screen.queryByRole('button', { name: /go to image/i })).not.toBeInTheDocument();
  });
});
