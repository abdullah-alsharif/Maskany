import { KNOWN_AMENITIES } from '../constants/amenities.js';
import { PROPERTY_TYPES } from '../validators/property-validators.js';
import type { EnhanceRequest } from '../validators/ai-validators.js';

export interface BuiltPrompt {
  system: string;
  user: string;
}

export interface TranslationFields {
  title: string;
  summary?: string;
  description: string;
  city: string;
  area?: string;
  country: string;
}

export interface ReviewPropertyData {
  title: string;
  summary?: string;
  description: string;
  propertyType: string;
  rooms: number;
  bathrooms: number;
  city: string;
  area?: string;
  price: string;
  amenities: string[];
}

export interface PropertyMetadata {
  propertyType: string;
  rooms: number;
  bathrooms: number;
  city: string;
  area?: string;
  country: string;
  price: string;
  currency: string;
  priceUnit: string;
  areaSqm?: number;
  amenities: string[];
  features?: string[];
}

const SYSTEM_PROMPT = `You are a helpful real estate copywriting assistant for Maskany. Your job is to make property text clearer, more attractive, and more professional.

RULES:
- Keep all facts exactly as given: rooms, bathrooms, price, area, city, amenities
- Do not add fake features or contact info
- Output only the improved text — no labels, no quotes, no explanations
- Short paragraphs (2-3 sentences)
- Match the requested language exactly

You will receive property metadata, current field value, field type, and an action. Follow the action instruction.`;

const SYSTEM_PROMPT_AR = `أنت مساعد كتابة محتوى عقاري لمنصة ماسكاني. مهمتك جعل نص العقار أكثر وضوحاً وجاذبية واحترافية.

القواعد:
- حافظ على جميع الحقائق كما هي: الغرف، الحمامات، السعر، المساحة، المدينة، وسائل الراحة
- لا تضف ميزات وهمية أو معلومات اتصال
- أخرج النص المحسّن فقط — لا تسميات ولا علامات اقتباس ولا شروحات
- فقرات قصيرة (2-3 جمل)
- طابق اللغة المطلوبة تمامًا

ستتلقى البيانات الوصفية للعقار، قيمة الحقل الحالي، نوع الحقل، والإجراء المطلوب. اتبع التعليمات.`;

const ACTION_INSTRUCTIONS: Record<string, string> = {
  enhance:
    'Improve wording and flow. Fix grammar. Keep ALL facts intact. Make it more compelling without exaggeration.',
  rewrite: 'Complete rewrite with fresh structure. Keep ALL facts exactly as provided.',
  shorten: 'Condense to essential information only. Remove repetition and fluff.',
  expand: 'Add 2-3 sentences of descriptive detail about lifestyle or nearby attractions.',
  fix_grammar:
    'Correct grammar, spelling, punctuation only. Do not change any creative content, word choice, or structure.',
  simplify: 'Use simpler vocabulary and shorter sentences. Aim for reading age 12-14.',
  persuasive: 'Add emotional hooks and subtle call-to-action. Keep ALL facts factual.',
  generate_title:
    'Generate a short, catchy title (max 120 chars, one line, no period). It must be a title, not a sentence or paragraph.',
  generate_summary: 'Generate a brief 1-2 sentence summary. Capture the essence of the property.',
  generate_neighborhood:
    'Generate a factual description of the neighborhood. Mention nearby landmarks, transport, shops. 1-2 sentences.',
  generate_highlights:
    'Generate 3-5 bullet points highlighting the best features of this property.',
};

function systemForLocale(locale: string): string {
  return locale === 'ar' ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT;
}

export function buildEnhancePrompt(request: EnhanceRequest, locale: string): BuiltPrompt {
  const instruction = ACTION_INSTRUCTIONS[request.action] ?? ACTION_INSTRUCTIONS.enhance;

  const userParts: string[] = [];
  userParts.push(
    `Property: ${request.metadata.propertyType}, ${request.metadata.rooms}BR/${request.metadata.bathrooms}BA`,
  );
  userParts.push(
    `Location: ${request.metadata.city}${request.metadata.area ? `, ${request.metadata.area}` : ''}`,
  );
  userParts.push(`Amenities: ${request.metadata.amenities.join(', ')}`);
  userParts.push(`Size: ${request.metadata.areaSqm ? `${request.metadata.areaSqm}m²` : 'N/A'}`);
  userParts.push('');
  const fieldGuidelines: Record<string, string> = {
    title:
      'Short, one-line title (max 120 chars, no period). Must be a title, not a paragraph. Highlight the best feature. Preserve the property type (studio, apartment, villa, etc.) and any location landmarks from the current value.',
    summary:
      'Brief 1-2 sentence overview. Capture the essence of the property. Keep location and property type from the original.',
    description:
      'Detailed 2-3 paragraph description. Start with the best feature, mention lifestyle benefits, end with a subtle invitation.',
    area: 'Factual description of the neighborhood. Mention nearby landmarks, transport, shops. 1-2 sentences.',
    amenities: `List amenities naturally. Group related ones. 1 sentence. Valid keys: ${KNOWN_AMENITIES.join(', ')}.`,
  };
  const guideline = fieldGuidelines[request.fieldType] ?? 'Write naturally for this field type.';

  userParts.push(`Field: ${request.fieldType} — ${guideline}`);
  userParts.push(`Action: ${instruction}`);
  if (request.tone) userParts.push(`Tone: ${request.tone}`);
  userParts.push('');
  userParts.push(`Current value: ${request.currentValue || '(empty)'}`);
  if (request.constraints?.maxLength) {
    userParts.push(`\nIMPORTANT: Do not exceed ${request.constraints.maxLength} characters.`);
  }
  userParts.push('');
  userParts.push('Output only the improved text — no labels, no quotes, no explanations.');
  userParts.push(
    `REMINDER: Do NOT change: rooms (${request.metadata.rooms}), ` +
      `bathrooms (${request.metadata.bathrooms}), price (${request.metadata.price}), ` +
      `amenities (${request.metadata.amenities.join(', ')}). ` +
      'Do NOT add features not listed above.',
  );
  userParts.push(
    'IMPORTANT: Keep the property type (studio/apartment/villa/etc.) and any location landmarks (mall names, districts, landmarks) from the original text. Do not replace them.',
  );

  return {
    system: systemForLocale(locale),
    user: userParts.join('\n'),
  };
}

export function buildTranslationPrompt(
  locale: 'en' | 'ar',
  targetLocale: 'en' | 'ar',
  sourceFields: TranslationFields,
  metadata: PropertyMetadata,
): BuiltPrompt {
  const baseSystem = systemForLocale(locale);
  const sourceLang = locale === 'en' ? 'English' : 'Arabic';
  const targetLang = targetLocale === 'ar' ? 'Arabic' : 'English';
  const systemExt =
    targetLocale === 'ar'
      ? `\nأنت تترجم قائمة عقارات من ${sourceLang} إلى ${targetLang}. حافظ على جميع المعلومات، وكيّف المراجع الثقافية.`
      : `\nYou are translating a property listing from ${sourceLang} to ${targetLang}. Preserve all facts, adapt cultural references.`;

  const userParts = [
    `Translate this property listing from ${locale} to ${targetLocale}.`,
    '',
    `Property: ${metadata.propertyType}, ${metadata.rooms}BR/${metadata.bathrooms}BA`,
    `Location: ${metadata.city}${metadata.area ? `, ${metadata.area}` : ''}`,
    `Amenities: ${metadata.amenities.join(', ')}`,
    '',
    `Title: ${sourceFields.title}`,
    `Summary: ${sourceFields.summary || '(empty)'}`,
    `Description: ${sourceFields.description}`,
    `City: ${sourceFields.city}`,
    `Area/Neighborhood: ${sourceFields.area || '(empty)'}`,
    `Country: ${sourceFields.country}`,
    '',
    'Output a JSON object with keys: title, summary, description, city, area, country.',
    'Keep title under 120 chars, summary under 300 chars.',
    `REMINDER: Do NOT change rooms (${metadata.rooms}), bathrooms (${metadata.bathrooms}), or price (${metadata.price}).`,
  ];

  return {
    system: baseSystem + systemExt,
    user: userParts.join('\n'),
  };
}

export function buildReviewPrompt(propertyData: ReviewPropertyData, locale: string): BuiltPrompt {
  return {
    system:
      systemForLocale(locale) +
      '\nYou analyze listing quality and suggest improvements. Be constructive and specific.',
    user: [
      'Analyze this property listing and output JSON with this exact structure:',
      '{ "score": <1-10>, "maxScore": 10, "suggestions": [{ "field": "<field name>", "severity": "high|medium|low", "message": "<description>", "suggestion": "<replacement text or null>", "type": "improvement|missing|suggestion" }] }',
      '',
      'Property data:',
      JSON.stringify(propertyData, null, 2),
      '',
      'Score based on: title quality, description length & detail, completeness of fields, amenity coverage, translation presence.',
      '',
      `Valid amenity keys: ${KNOWN_AMENITIES.join(', ')}. Only suggest amenities from this list.`,
      `Valid property types: ${PROPERTY_TYPES.join(', ')}. Do not suggest changing the property type.`,
    ].join('\n'),
  };
}
