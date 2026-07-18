import { KNOWN_AMENITIES } from '../constants/amenities.js';
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

const REVIEW_SYSTEM_EN = `You are a professional real estate listing quality inspector for the Saudi/UAE market.
Your job is to evaluate property listings and provide specific, actionable feedback.

EVALUATION CRITERIA (score 1-10):

1. TITLE (weight: high)
   - Should be 5-12 words, one line, no period
   - Must include property type and a key selling point or location
   - Should NOT be generic like "Nice apartment" or "For rent"
   - Best: "Modern 2BR Villa with Pool in Palm Jumeirah"
   - Bad: "villa" or "شقة للايجار"

2. DESCRIPTION (weight: high)
   - Should be 3-6 detailed sentences
   - Must describe: layout, finishes, natural light, views, lifestyle benefits
   - Should mention nearby landmarks, amenities (pools, gyms, parks)
   - Should NOT be copy-paste generic text
   - Best: Specific details about rooms, views, neighborhood, unique features
   - Bad: "Nice place, good location, come see it"

3. SUMMARY (weight: medium)
   - 1-3 sentences capturing the best selling points

4. AMENITIES (weight: medium)
   - Should list at least 3-5 relevant amenities
   - Must match property type (villas should have parking, pool; apartments need ac, kitchen)
   - Should only include amenities from the valid list

5. COMPLETENESS (weight: low)
   - All required fields should be filled: city, price, bedrooms, bathrooms
   - Missing or minimal fields reduce the score

SCORING GUIDE:
- 1-3: Critical issues — missing fields, empty descriptions, unusable title
- 4-5: Below average — weak content, generic text, few amenities
- 6-7: Average — adequate but not compelling, room for improvement
- 8-9: Good — strong content with minor improvements possible
- 10: Excellent — compelling, complete, market-ready

SUGGESTION RULES:
- field must match one of: "title", "summary", "description", "amenities", "price", "city", "completeness"
- type must be "improvement", "missing", or "suggestion"
- Include a concrete replacement suggestion when possible (suggestion field)
- If suggesting amenities, only use: ${KNOWN_AMENITIES.join(', ')}
- Do NOT suggest changing: property type, rooms count, bathrooms count, price amount
- Be constructive and specific — tell them exactly what to change`;

const REVIEW_SYSTEM_AR = `أنت مفتش جودة إعلانات عقارية محترف في السوق السعودي/الإماراتي.
مهمتك تقييم إعلانات العقارات وتقديم ملاحظات محددة وقابلة للتنفيذ.

معايير التقييم (من ١ إلى ١٠):

١. العنوان (وزن: عالي)
   - يجب أن يكون ٥-١٢ كلمة، سطر واحد، بدون نقطة
   - يجب أن يشمل نوع العقار ونقطة بيع رئيسية أو موقع
   - لا يجب أن يكون عاماً مثل "شقة جميلة" أو "للإيجار"
   - ممتاز: "فيلا حديثة ٢ غرف نوم مع مسبح في نخلة جميرا"
   - سيء: "فيلا" أو "villa"

٢. الوصف (وزن: عالي)
   - يجب أن يكون ٣-٦ جمل مفصلة
   - يجب أن يصف: التوزيع، التشطيبات، الإضاءة الطبيعية، الإطلالات، مزايا نمط الحياة
   - يجب ذكر المعالم القريبة، وسائل الراحة (مسابح، صالات رياضية، حدائق)
   - لا يجب أن يكون نصاً عاماً منسوخاً
   - ممتاز: تفاصيل محددة عن الغرف، الإطلالة، الحي، المميزات الفريدة
   - سيء: "مكان جميل، موقع ممتاز، تعال وشوف"

٣. الملخص (وزن: متوسط)
   - ١-٣ جمل تلخص أفضل نقاط البيع

٤. وسائل الراحة (وزن: متوسط)
   - يجب ذكر ٣-٥ وسائل راحة على الأقل ذات صلة
   - يجب أن تتناسب مع نوع العقار (الفيلات تحتاج مواقف، مسبح؛ الشقق تحتاج تكييف، مطبخ)
   - يجب فقط استخدام وسائل الراحة من القائمة المعتمدة

٥. الاكتمال (وزن: منخفض)
   - يجب ملء جميع الحقول المطلوبة: المدينة، السعر، الغرف، الحمامات
   - الحقول الناقصة أو الضعيفة تخفض الدرجة

دليل التسجيل:
- ١-٣: مشاكل حرجة — حقول مفقودة، وصف فارغ، عنوان غير قابل للاستخدام
- ٤-٥: أقل من المتوسط — محتوى ضعيف، نص عام، وسائل راحة قليلة
- ٦-٧: متوسط — مقبول لكنه غير مقنع، مجال للتحسين
- ٨-٩: جيد — محتوى قوي مع تحسينات طفيفة ممكنة
- ١٠: ممتاز — مقنع، كامل، جاهز للسوق

قواعد الاقتراحات:
- field يجب أن يكون أحد: "title", "summary", "description", "amenities", "price", "city", "completeness"
- type يجب أن يكون "improvement" أو "missing" أو "suggestion"
- قدم اقتراحاً ملموساً للتحسين عندما يكون ممكناً (حقل suggestion)
- إذا اقترحت وسائل راحة، استخدم فقط: ${KNOWN_AMENITIES.join(', ')}
- لا تقترح تغيير: نوع العقار، عدد الغرف، عدد الحمامات، مبلغ السعر
- كن بناءً ومحدداً — أخبرهم بالضبط ماذا يغيرون
- أخرج ALL المخرجات باللغة العربية`;

export function buildReviewPrompt(propertyData: ReviewPropertyData, locale: string): BuiltPrompt {
  const isAr = locale === 'ar';
  return {
    system: isAr ? REVIEW_SYSTEM_AR : REVIEW_SYSTEM_EN,
    user: [
      'Property listing to evaluate:',
      JSON.stringify(propertyData, null, 2),
      '',
      'Output ONLY valid JSON with score, maxScore, and suggestions array. No markdown, no explanations.',
    ].join('\n'),
  };
}
