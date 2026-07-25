import { describe, expect, it, beforeEach } from 'vitest';
import { runDeterministicValidations } from '../src/services/deterministic-validators.js';
import { resetIssueCounter } from '../src/services/ai-review-types.js';
import type { ReviewPropertyData } from '../src/services/ai-prompt-builder.js';

beforeEach(() => {
  resetIssueCounter();
});

describe('Expanded deterministic validators', () => {
  it('[T038] detects rooms count mismatch between text and structured data', () => {
    const data: ReviewPropertyData = {
      title: '1BR Apartment',
      summary: '',
      description: 'This is a 1-bedroom apartment.',
      propertyType: 'APARTMENT',
      rooms: 3,
      bathrooms: 2,
      city: 'Dubai',
      price: '500000',
      amenities: [],
    };
    const issues = runDeterministicValidations(data);
    const roomIssue = issues.find((i) => i.field === 'rooms');
    expect(roomIssue).toBeDefined();
  });

  it('[T038] detects property type mismatch between text and structured data', () => {
    const data: ReviewPropertyData = {
      title: 'Beautiful Villa for Sale',
      summary: 'Luxury villa',
      description: 'A beautiful villa with pool.',
      propertyType: 'APARTMENT',
      rooms: 3,
      bathrooms: 2,
      city: 'Dubai',
      price: '500000',
      amenities: [],
    };
    const issues = runDeterministicValidations(data);
    const typeIssue = issues.find((i) => i.field === 'propertyType');
    expect(typeIssue).toBeDefined();
  });

  it('[T038] detects invalid price format (non-numeric, missing currency)', () => {
    const data: ReviewPropertyData = {
      title: 'Test',
      summary: '',
      description: 'Test description here for the property.',
      propertyType: 'APARTMENT',
      rooms: 2,
      bathrooms: 1,
      city: 'Dubai',
      price: 'AED500000',
      amenities: [],
    };
    const issues = runDeterministicValidations(data);
    const priceIssue = issues.find((i) => i.field === 'price');
    expect(priceIssue).toBeDefined();
  });

  it('[T038] detects amenities selected but never mentioned in any text field', () => {
    const data: ReviewPropertyData = {
      title: 'Nice Apartment',
      summary: '',
      description: 'A nice apartment in Dubai.',
      propertyType: 'APARTMENT',
      rooms: 2,
      bathrooms: 1,
      city: 'Dubai',
      price: '500000',
      amenities: ['pool', 'gym', 'parking'],
    };
    const issues = runDeterministicValidations(data);
    const amenityIssue = issues.find((i) => i.title.includes('Amenities'));
    expect(amenityIssue).toBeDefined();
    expect(amenityIssue!.description).toContain('pool');
  });

  it('[T038] returns no issues when all checks pass', () => {
    const data: ReviewPropertyData = {
      title: 'Luxury 2BR Apartment in Dubai Marina',
      summary: 'Beautiful apartment with pool and gym',
      description:
        'A stunning 2-bedroom apartment with pool and gym access. Located in Dubai Marina with parking available. This apartment offers modern living spaces.',
      propertyType: 'APARTMENT',
      rooms: 2,
      bathrooms: 1,
      city: 'Dubai',
      area: 'Marina',
      price: '500000',
      amenities: ['pool', 'gym', 'parking'],
    };
    const issues = runDeterministicValidations(data);
    expect(issues.length).toBe(0);
  });
});
