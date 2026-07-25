import type { ReviewIssue } from './ai-review-types.js';
import { generateIssueId } from './ai-review-types.js';
import type { ReviewPropertyData } from './ai-prompt-builder.js';

export function runDeterministicValidations(propertyData: ReviewPropertyData): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  const titleCheck = validateTitle(propertyData.title);
  if (titleCheck) issues.push(titleCheck);

  const descCheck = validateDescription(propertyData.description);
  if (descCheck) issues.push(descCheck);

  const summaryCheck = validateSummary(propertyData.summary);
  if (summaryCheck) issues.push(summaryCheck);

  const roomCheck = validateRoomConsistency(propertyData);
  if (roomCheck) issues.push(roomCheck);

  const typeCheck = validatePropertyTypeConsistency(propertyData);
  if (typeCheck) issues.push(typeCheck);

  const priceCheck = validatePriceFormat(propertyData);
  if (priceCheck) issues.push(priceCheck);

  const amenityCheck = validateAmenitiesMentioned(propertyData);
  if (amenityCheck) issues.push(amenityCheck);

  return issues;
}

function validateTitle(title: string): ReviewIssue | null {
  const trimmed = (title || '').trim();

  if (!trimmed) {
    return {
      id: generateIssueId(),
      category: 'content_quality',
      severity: 'critical',
      title: 'Missing title',
      description:
        'The property has no title. A title is essential for attracting potential buyers or renters.',
      field: 'title',
    };
  }

  if (trimmed.length < 10) {
    return {
      id: generateIssueId(),
      category: 'content_quality',
      severity: 'major',
      title: 'Title is too short',
      description: `The title is only ${trimmed.length} characters. A good title should include the property type and a key selling point.`,
      field: 'title',
    };
  }

  return null;
}

function validateDescription(description: string): ReviewIssue | null {
  const trimmed = (description || '').trim();

  if (!trimmed) {
    return {
      id: generateIssueId(),
      category: 'content_quality',
      severity: 'critical',
      title: 'Missing description',
      description:
        'The property has no description. A detailed description is crucial for attracting interest.',
      field: 'description',
    };
  }

  if (trimmed.length < 80) {
    return {
      id: generateIssueId(),
      category: 'content_quality',
      severity: 'major',
      title: 'Description is too short',
      description: `The description is only ${trimmed.length} characters. A good description should cover layout, features, and lifestyle benefits.`,
      field: 'description',
    };
  }

  const sentenceCount = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

  if (sentenceCount < 3) {
    return {
      id: generateIssueId(),
      category: 'content_quality',
      severity: 'minor',
      title: 'Description could be more detailed',
      description: `The description has only ${sentenceCount} sentence(s). Aim for at least 3 sentences covering layout, finishes, or lifestyle benefits.`,
      field: 'description',
    };
  }

  return null;
}

function validateSummary(summary: string | undefined): ReviewIssue | null {
  const trimmed = (summary || '').trim();

  if (!trimmed) {
    return {
      id: generateIssueId(),
      category: 'content_quality',
      severity: 'minor',
      title: 'Missing summary',
      description:
        'The property has no summary. A brief summary helps capture attention in search results.',
      field: 'summary',
    };
  }

  return null;
}

function validateRoomConsistency(data: ReviewPropertyData): ReviewIssue | null {
  const listing = `${data.title} ${data.summary || ''} ${data.description}`.toLowerCase();
  const rooms = data.rooms;
  const bathroomNumbers = listing.match(/\b(\d+)\s*-?\s*(br|bedroom|bed|bathroom|ba|bath)\b/gi);
  const actualRooms = rooms === 0 ? 0 : rooms;

  if (bathroomNumbers) {
    for (const match of bathroomNumbers) {
      const num = parseInt(match.match(/\d+/)?.[0] || '', 10);
      const isBath = /\b(bathroom|ba|bath)\b/i.test(match);
      if (!isBath && num !== actualRooms && num > 0 && actualRooms > 0) {
        return {
          id: generateIssueId(),
          category: 'consistency',
          severity: 'critical',
          title: 'Room count mismatch',
          description: `The text mentions "${num} rooms" but the listing data shows ${rooms} ${rooms === 0 ? '(Studio)' : 'rooms'}.`,
          field: 'rooms',
        };
      }
    }
  }

  return null;
}

function validatePropertyTypeConsistency(data: ReviewPropertyData): ReviewIssue | null {
  const listing = `${data.title} ${data.summary || ''} ${data.description}`.toLowerCase();
  const typeMap: Record<string, string[]> = {
    APARTMENT: ['apartment', 'apt', 'flat', 'شقة', 'شق'],
    VILLA: ['villa', 'فيلا'],
    TOWNHOUSE: ['townhouse', 'town house', 'تاون هاوس'],
    PENTHOUSE: ['penthouse', 'بنتهاوس', 'بنت هاوس'],
    ROOM: ['room', 'غرفة'],
    LAND: ['land', 'plot', 'ارض', 'أرض', 'قطعة'],
    BUILDING: ['building', 'مبنى', 'بناية'],
    COMMERCIAL: ['commercial', 'office', 'shop', 'store', 'تجاري', 'مكتب', 'محل'],
  };

  const keywords = typeMap[data.propertyType];
  if (!keywords) return null;

  const hasMatch = keywords.some((kw) => listing.includes(kw));
  if (!hasMatch && data.title.length > 0) {
    return {
      id: generateIssueId(),
      category: 'consistency',
      severity: 'major',
      title: 'Property type not mentioned in text',
      description: `The property type is "${data.propertyType}" but none of the text fields (title, summary, description) mention it explicitly.`,
      field: 'propertyType',
    };
  }

  return null;
}

function validatePriceFormat(data: ReviewPropertyData): ReviewIssue | null {
  if (!data.price || data.price === '0') return null;

  const priceStr = String(data.price);
  if (/^[a-zA-Z]/.test(priceStr)) {
    return {
      id: generateIssueId(),
      category: 'trust_accuracy',
      severity: 'major',
      title: 'Price format issue',
      description: `The price "${data.price}" appears to have an unexpected format. Ensure it contains only numbers.`,
      field: 'price',
    };
  }

  return null;
}

function validateAmenitiesMentioned(data: ReviewPropertyData): ReviewIssue | null {
  const listing = `${data.title} ${data.summary || ''} ${data.description}`.toLowerCase();

  const unmatched = data.amenities.filter((a) => {
    const normalized = a.replace(/[_-]/g, ' ').toLowerCase();
    return !listing.includes(normalized);
  });

  if (unmatched.length > 0) {
    return {
      id: generateIssueId(),
      category: 'consistency',
      severity: 'minor',
      title: 'Amenities not mentioned',
      description: `The following amenities are selected but not mentioned in the description, summary, or title: ${unmatched.join(', ')}. Add them to the description to improve buyer interest.`,
      field: 'description',
    };
  }

  return null;
}
