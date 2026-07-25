import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeQualityScore,
  resetIssueCounter,
  generateIssueId,
} from '../src/services/ai-review-types.js';
import type { ReviewIssue } from '../src/services/ai-review-types.js';

beforeEach(() => {
  resetIssueCounter();
});

function issue(severity: ReviewIssue['severity'], field?: string): ReviewIssue {
  return {
    id: generateIssueId(),
    category: 'consistency',
    severity,
    title: 'Test issue',
    description: 'Test description',
    field,
  };
}

describe('computeQualityScore', () => {
  it('starts at 100 for no issues', () => {
    expect(computeQualityScore([])).toBe(100);
  });

  it('data-critical issues deduct 25 each', () => {
    expect(computeQualityScore([issue('critical', 'rooms')])).toBe(75);
    expect(
      computeQualityScore([issue('critical', 'rooms'), issue('critical', 'propertyType')]),
    ).toBe(50);
    expect(
      computeQualityScore([
        issue('critical', 'rooms'),
        issue('critical', 'propertyType'),
        issue('critical', 'bathrooms'),
      ]),
    ).toBe(25);
    expect(
      computeQualityScore([
        issue('critical', 'rooms'),
        issue('critical', 'propertyType'),
        issue('critical', 'bathrooms'),
        issue('critical', 'price'),
      ]),
    ).toBe(0);
  });

  it('text-critical issues use diminishing returns', () => {
    expect(computeQualityScore([issue('critical', 'title')])).toBe(92);
    expect(computeQualityScore([issue('critical', 'title'), issue('critical', 'summary')])).toBe(
      88,
    );
    expect(
      computeQualityScore([
        issue('critical', 'title'),
        issue('critical', 'summary'),
        issue('critical', 'description'),
      ]),
    ).toBe(85);
  });

  it('major issues use diminishing returns', () => {
    expect(computeQualityScore([issue('major', 'description')])).toBe(95);
    expect(computeQualityScore([issue('major', 'description'), issue('major', 'title')])).toBe(92);
    expect(
      computeQualityScore([
        issue('major', 'title'),
        issue('major', 'summary'),
        issue('major', 'description'),
      ]),
    ).toBe(91);
  });

  it('minor issues use diminishing returns', () => {
    expect(computeQualityScore([issue('minor', 'amenities')])).toBe(98);
    expect(computeQualityScore([issue('minor', 'amenities'), issue('minor', 'title')])).toBe(97);
  });

  it('suggestions use diminishing returns', () => {
    expect(computeQualityScore([issue('suggestion', 'description')])).toBe(99);
    expect(
      computeQualityScore([issue('suggestion', 'description'), issue('suggestion', 'summary')]),
    ).toBe(98);
  });

  it('mixed data+text critical — data issues dominate', () => {
    expect(computeQualityScore([issue('critical', 'rooms'), issue('critical', 'title')])).toBe(67);
  });

  it('critical issue with findText/replaceWith on structured field is text-critical', () => {
    const textFixable = {
      ...issue('critical', 'rooms'),
      findText: '1-bedroom',
      replaceWith: '3-bedroom',
    };
    expect(computeQualityScore([textFixable])).toBe(92);
  });

  it('critical issue on structured field without text fix is data-critical', () => {
    expect(computeQualityScore([issue('critical', 'rooms')])).toBe(75);
  });

  it('user review with 1 critical + 2 text-critical + 3 major + 2 minor = ~51', () => {
    const score = computeQualityScore([
      { ...issue('critical', 'rooms') },
      { ...issue('critical', 'propertyType'), findText: '1-bedroom', replaceWith: '3-bedroom' },
      { ...issue('critical', 'rooms'), findText: '1-bedroom', replaceWith: '3-bedroom' },
      issue('major', 'title'),
      issue('major', 'description'),
      issue('major', 'description'),
      issue('minor', 'amenities'),
      issue('minor', 'amenities'),
    ]);
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(55);
    expect(score).toBe(51);
  });

  it('issues without a field are treated as data-critical', () => {
    expect(computeQualityScore([issue('critical')])).toBe(75);
  });

  it('example from the Abdoun listing — 3 text-critical + 3 major + 2 minor = ~73', () => {
    const score = computeQualityScore([
      issue('critical', 'title'),
      issue('critical', 'summary'),
      issue('critical', 'description'),
      issue('major', 'title'),
      issue('major', 'description'),
      issue('major', 'description'),
      issue('minor', 'amenities'),
      issue('minor', 'amenities'),
    ]);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThanOrEqual(80);
    expect(score).toBe(73);
  });

  it('never goes below 0', () => {
    const criticalDataIssues = Array.from({ length: 10 }, () => issue('critical', 'rooms'));
    expect(computeQualityScore(criticalDataIssues)).toBe(0);
  });
});
