/**
 * SeoHead — declarative document <head> manager (T-025, PRD §8.4).
 *
 * Sets document.title, description, Open Graph tags, and (optionally) a
 * Schema.org RealEstateListing JSON-LD block. Renders no DOM itself — side
 * effects flow through `useEffect`. Unlike the original implementation, this
 * version never removes elements from the DOM during cleanup, avoiding
 * `removeChild` race conditions with Next.js's built-in head management.
 *
 * Security — property data can contain arbitrary strings (user-supplied title,
 * description, etc.). The JSON-LD serializer replaces every `</` with `<\/`
 * which is still valid JSON (the backslash is stripped on parse) but cannot
 * prematurely close the `<script>` tag.
 */
import { useEffect, useRef } from 'react';
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

function upsertMeta(selector: string, createAttrs: Record<string, string>): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [key, value] of Object.entries(createAttrs)) {
      if (key !== 'content') el.setAttribute(key, value);
    }
    el.setAttribute(MANAGED_ATTR, 'true');
    document.head.appendChild(el);
  }
  if (createAttrs.content !== undefined) el.setAttribute('content', createAttrs.content);
  return el;
}

function getOrCreateScript(id: string): HTMLScriptElement {
  let el = document.head.querySelector<HTMLScriptElement>(`script[data-seo-head="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute(MANAGED_ATTR, id);
    document.head.appendChild(el);
  }
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
  const previousTitle = useRef('');

  useEffect(() => {
    previousTitle.current = document.title;
    document.title = title;

    if (description !== undefined) {
      upsertMeta('meta[name="description"]', { name: 'description', content: description });
    }
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType });
    if (description !== undefined) {
      upsertMeta('meta[property="og:description"]', {
        property: 'og:description',
        content: description,
      });
    }
    if (ogImage !== undefined) {
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: ogImage });
    }
    if (ogUrl !== undefined) {
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: ogUrl });
    }

    if (property) {
      const scriptEl = getOrCreateScript('real-estate-ld');
      scriptEl.type = 'application/ld+json';
      scriptEl.textContent = serializeJsonLd(buildRealEstateJsonLd(property));
    }

    return () => {
      document.title = previousTitle.current;
    };
  }, [title, description, ogImage, ogUrl, ogType, property]);

  return null;
}
