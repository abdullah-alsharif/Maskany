/**
 * SeoHead — declarative document <head> manager (T-025, PRD §8.4).
 *
 * Sets document.title, description, Open Graph tags, and (optionally) a
 * Schema.org RealEstateListing JSON-LD block. Renders no DOM itself — side
 * effects flow through `useEffect` so multiple pages can mount/unmount the
 * component safely without leaving stale tags behind. All tags it owns are
 * marked with `data-seo-head="true"` for reliable cleanup.
 *
 * Security — property data can contain arbitrary strings (user-supplied title,
 * description, etc.). The JSON-LD serializer replaces every `</` with `<\/`
 * which is still valid JSON (the backslash is stripped on parse) but cannot
 * prematurely close the `<script>` tag.
 */
import { useEffect } from 'react';
import type { Property } from '../types/property';

type OgType = 'website' | 'article';

type SeoHeadProps = {
  title: string;
  description?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: OgType;
  property?: Property;
};

const MANAGED_ATTR = 'data-seo-head';

function setMeta(selector: string, attrs: Record<string, string>): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [key, value] of Object.entries(attrs)) {
      if (key !== 'content') el.setAttribute(key, value);
    }
    el.setAttribute(MANAGED_ATTR, 'true');
    document.head.appendChild(el);
  }
  if (attrs.content !== undefined) el.setAttribute('content', attrs.content);
  return el;
}

function buildRealEstateJsonLd(property: Property): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.summary || property.description,
    image: (property.images ?? []).map((img) => img.url),
    offers: {
      '@type': 'Offer',
      price: property.price,
      priceCurrency: property.currency,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.city,
      addressRegion: property.area,
      addressCountry: property.country,
    },
    numberOfRooms: property.rooms,
    numberOfBathroomsTotal: property.bathrooms,
    floorSize: {
      '@type': 'QuantitativeValue',
      value: property.areaSqm,
      unitCode: 'MTK',
    },
  };
  if (property.reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: property.averageRating,
      reviewCount: property.reviewCount,
    };
  }
  return jsonLd;
}

function serializeJsonLd(data: Record<string, unknown>): string {
  // Prevent </script> escape by replacing `</` with `<\/` — still valid JSON.
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

export function SeoHead({
  title,
  description,
  ogImage,
  ogUrl,
  ogType = 'website',
  property,
}: SeoHeadProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const managed: HTMLElement[] = [];

    if (description !== undefined) {
      managed.push(
        setMeta('meta[name="description"]', { name: 'description', content: description }),
      );
    }
    managed.push(
      setMeta('meta[property="og:title"]', { property: 'og:title', content: title }),
      setMeta('meta[property="og:type"]', { property: 'og:type', content: ogType }),
    );
    if (description !== undefined) {
      managed.push(
        setMeta('meta[property="og:description"]', {
          property: 'og:description',
          content: description,
        }),
      );
    }
    if (ogImage !== undefined) {
      managed.push(
        setMeta('meta[property="og:image"]', { property: 'og:image', content: ogImage }),
      );
    }
    if (ogUrl !== undefined) {
      managed.push(setMeta('meta[property="og:url"]', { property: 'og:url', content: ogUrl }));
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (property) {
      scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.setAttribute(MANAGED_ATTR, 'true');
      scriptEl.textContent = serializeJsonLd(buildRealEstateJsonLd(property));
      document.head.appendChild(scriptEl);
    }

    return () => {
      document.title = previousTitle;
      for (const el of managed) el.parentNode?.removeChild(el);
      if (scriptEl) scriptEl.parentNode?.removeChild(scriptEl);
    };
  }, [title, description, ogImage, ogUrl, ogType, property]);

  return null;
}
