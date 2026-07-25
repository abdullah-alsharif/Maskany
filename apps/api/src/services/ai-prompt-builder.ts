import { KNOWN_AMENITIES } from '../constants/amenities.js';
import type { EnhanceRequest } from '../validators/ai-validators.js';
import { PromptTemplateRegistry, loadExamples } from './prompts/registry.js';

export interface BuiltPrompt {
  system: string;
  user: string;
  templateId?: string;
  templateVersion?: string;
  sections?: Array<{ id: string; tokenCount: number }>;
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

export type Locale = 'en' | 'ar';

let _registry: PromptTemplateRegistry | null = null;

function getRegistry(): PromptTemplateRegistry {
  if (!_registry) {
    _registry = new PromptTemplateRegistry({ localeFallback: true });
    _registry.loadTemplatesFromDirectory(new URL('./prompts/templates', import.meta.url).pathname);
  }
  return _registry;
}

export function resetRegistryForTest(): void {
  _registry = null;
}

export function getTemplateInfo(
  kind: 'enhance' | 'review',
  locale: Locale,
  version?: string,
): {
  templateId: string;
  templateVersion: string;
  sections: Array<{ id: string; tokenCount: number }>;
} {
  const registry = getRegistry();
  try {
    const result = registry.render(kind, locale, { locale }, version ? { version } : undefined);
    return {
      templateId: result.templateId,
      templateVersion: result.templateVersion,
      sections: result.sections,
    };
  } catch {
    return { templateId: `unknown-${kind}-${locale}`, templateVersion: 'unknown', sections: [] };
  }
}

function t(locale: Locale, en: string, ar: string): string {
  return locale === 'ar' ? ar : en;
}

function formatRooms(rooms: number, locale: Locale): string {
  if (rooms === 0) return t(locale, 'Studio', 'استوديو');
  return `${rooms}BR`;
}

function metadataString(meta: PropertyMetadata, locale: Locale): string {
  const lines: string[] = [];
  lines.push(`--- ${t(locale, 'PROPERTY METADATA', 'بيانات العقار')} ---`);
  lines.push(
    `${t(locale, 'Type:', 'النوع:')} ${meta.propertyType}, ${formatRooms(meta.rooms, locale)}/${meta.bathrooms}BA`,
  );
  lines.push(
    `${t(locale, 'Location:', 'الموقع:')} ${meta.city}${meta.area ? `, ${meta.area}` : ''}`,
  );
  lines.push(`${t(locale, 'Price:', 'السعر:')} ${meta.price}`);
  lines.push(
    `${t(locale, 'Amenities:', 'وسائل الراحة:')} ${meta.amenities.length ? meta.amenities.join(', ') : t(locale, '(none selected)', '(غير محدد)')}`,
  );
  if (meta.areaSqm) {
    lines.push(`${t(locale, 'Size:', 'المساحة:')} ${meta.areaSqm}m²`);
  }
  return lines.join('\n');
}

function systemForLocale(locale: Locale, kind: 'enhance' | 'review' = 'enhance'): string {
  const registry = getRegistry();
  try {
    const result = registry.render(kind, locale, { locale });
    return result.system;
  } catch {
    return '';
  }
}

const ACTION_INSTRUCTIONS: Record<string, Record<Locale, string>> = {
  enhance: {
    en: 'Improve wording and flow. Fix grammar. Keep ALL facts intact. Make it more compelling without exaggeration.',
    ar: 'حسّن الصياغة والتدفق. صحّح القواعد. حافظ على جميع الحقائق. اجعل النص أكثر جاذبية دون مبالغة.',
  },
  rewrite: {
    en: 'Complete rewrite with fresh structure. Keep ALL facts exactly as provided.',
    ar: 'إعادة كتابة كاملة بهيكل جديد. حافظ على جميع الحقائق كما هي.',
  },
  shorten: {
    en: 'Condense to essential information only. Remove repetition and fluff.',
    ar: 'اختصر إلى المعلومات الأساسية فقط. أزل التكرار والحشو.',
  },
  expand: {
    en: 'Add 2-3 sentences of descriptive detail about lifestyle or nearby attractions.',
    ar: 'أضف 2-3 جمل من التفاصيل الوصفية عن نمط الحياة أو المعالم القريبة.',
  },
  fix_grammar: {
    en: 'Correct grammar, spelling, punctuation only. Do not change any creative content, word choice, or structure.',
    ar: 'صحّح القواعد والإملاء وعلامات الترقيم فقط. لا تغير أي محتوى إبداعي أو اختيار الكلمات أو البنية.',
  },
  simplify: {
    en: 'Use simpler vocabulary and shorter sentences. Aim for reading age 12-14.',
    ar: 'استخدم مفردات أبسط وجمل أقصر. استهدف مستوى قراءة 12-14 سنة.',
  },
  persuasive: {
    en: 'Add emotional hooks and subtle call-to-action. Keep ALL facts factual.',
    ar: 'أضف خطافات عاطفية ودعوة خفيفة للعمل. حافظ على جميع الحقائق.',
  },
  professional: {
    en: 'Use formal, polished language suitable for professional real estate. Maintain a confident, authoritative tone.',
    ar: 'استخدم لغة رسمية ومصقولة مناسبة للعقارات الاحترافية. حافظ على نبرة واثقة وموثوقة.',
  },
  luxury: {
    en: 'Use sophisticated, aspirational language. Emphasise exclusivity, premium finishes, and lifestyle prestige.',
    ar: 'استخدم لغة راقية وطموحة. ركّز على الحصرية والتشطيبات الفاخرة ومكانة نمط الحياة.',
  },
  friendly: {
    en: 'Use warm, approachable language. Write as if speaking to a friend. Keep it inviting and natural.',
    ar: 'استخدم لغة دافئة وقريبة. اكتب وكأنك تتحدث مع صديق. اجعل النص جذاباً وطبيعياً.',
  },
  generate_title: {
    en: 'Generate a short, catchy title (max 120 chars, one line, no period). It must be a title, not a sentence or paragraph.',
    ar: 'أنشئ عنواناً قصيراً وجذاباً (حد أقصى 120 حرفاً، سطر واحد، لا نقطة في النهاية). يجب أن يكون عنواناً وليس جملة أو فقرة.',
  },
  generate_summary: {
    en: 'Generate a brief 1-2 sentence summary. Capture the essence of the property.',
    ar: 'أنشئ ملخصاً موجزاً من 1-2 جملة. التقط جوهر العقار.',
  },
  generate_neighborhood: {
    en: 'Generate a factual description of the neighborhood. Mention nearby landmarks, transport, shops. 1-2 sentences.',
    ar: 'أنشئ وصفاً واقعياً للحي. اذكر المعالم القريبة ووسائل النقل والمتاجر. 1-2 جمل.',
  },
  generate_highlights: {
    en: 'Generate 3-5 bullet points highlighting the best features of this property.',
    ar: 'أنشئ 3-5 نقاط تلخّص أبرز ميزات هذا العقار.',
  },
};

const FIELD_GUIDELINES: Record<string, Record<Locale, string>> = {
  title: {
    en: 'Short, one-line title (max 120 chars, no period). Must be a title, not a paragraph. Highlight the best feature. Preserve the property type and any location landmarks from the current value.',
    ar: 'عنوان قصير من سطر واحد (حد أقصى 120 حرفاً، لا نقطة). يجب أن يكون عنواناً وليس فقرة. أبرز أفضل ميزة. حافظ على نوع العقار وأي معالم موقع من النص الحالي.',
  },
  summary: {
    en: 'Brief 1-2 sentence overview. Capture the essence of the property. Keep location and property type from the original.',
    ar: 'نظرة عامة موجزة من 1-2 جملة. التقط جوهر العقار. حافظ على الموقع ونوع العقار من النص الأصلي.',
  },
  description: {
    en: 'Detailed 2-3 paragraph description. Start with the best feature, mention lifestyle benefits, end with a subtle invitation.',
    ar: 'وصف مفصل من 2-3 فقرات. ابدأ بأفضل ميزة، اذكر فوائد نمط الحياة، وانتهِ بدعوة لطيفة.',
  },
  area: {
    en: 'Factual description of the neighborhood. Mention nearby landmarks, transport, shops. 1-2 sentences.',
    ar: 'وصف واقعي للحي. اذكر المعالم القريبة ووسائل النقل والمتاجر. 1-2 جمل.',
  },
  city: {
    en: 'Refine the city name or include a brief, factual note about the city or district. Keep it concise.',
    ar: 'حسّن اسم المدينة أو أضف ملاحظة واقعية موجزة عن المدينة أو الحي. كن موجزاً.',
  },
  amenities: {
    en: 'List amenities naturally. Group related ones. 1 sentence.',
    ar: 'اذكر وسائل الراحة بشكل طبيعي. جمّع المتشابهة منها. جملة واحدة.',
  },
  highlights: {
    en: 'Generate 3-5 bullet points highlighting the best features. Each bullet one line. Keep factual.',
    ar: 'أنشئ 3-5 نقاط تلخّص أبرز الميزات. كل نقطة في سطر. حافظ على الدقة الواقعية.',
  },
};

const TONE_GUIDELINES: Record<string, Record<Locale, string>> = {
  professional: {
    en: 'Use formal, polished language. Avoid slang and contractions. Sound confident and authoritative.',
    ar: 'استخدم لغة رسمية ومصقولة. تجنب العامية والاختصارات. كن واثقاً وموثوقاً.',
  },
  luxury: {
    en: 'Use sophisticated vocabulary. Emphasise exclusivity, premium materials, and prestige. Create desire.',
    ar: 'استخدم مفردات راقية. ركّز على الحصرية والمواد الفاخرة والمكانة. أثِر الرغبة.',
  },
  friendly: {
    en: 'Use warm, conversational language. Write as if describing the property to a friend.',
    ar: 'استخدم لغة دافئة ومحادثة. اكتب وكأنك تصف العقار لصديق.',
  },
  warm: {
    en: 'Use inviting, welcoming language. Emphasise comfort, coziness, and feeling at home.',
    ar: 'استخدم لغة جذابة ومرحبة. ركّز على الراحة والدفء والشعور بالمنزل.',
  },
};

function instructionBlock(action: string, locale: Locale): string {
  const instruction = ACTION_INSTRUCTIONS[action];
  if (!instruction) {
    return `${t(locale, 'Action:', 'الإجراء:')} ${ACTION_INSTRUCTIONS.enhance[locale]}`;
  }
  return `${t(locale, 'Action:', 'الإجراء:')} ${instruction[locale]}`;
}

function fieldBlock(fieldType: string, locale: Locale): string {
  const guideline = FIELD_GUIDELINES[fieldType];
  if (!guideline) {
    return `${t(locale, 'Field:', 'الحقل:')} ${fieldType} — ${t(locale, 'Write naturally for this field type.', 'اكتب بشكل طبيعي لهذا النوع من الحقول.')}`;
  }
  return `${t(locale, 'Field:', 'الحقل:')} ${fieldType} — ${guideline[locale]}`;
}

function toneBlock(tone: string | undefined, locale: Locale): string | null {
  if (!tone) return null;
  const guideline = TONE_GUIDELINES[tone];
  if (!guideline) {
    return `${t(locale, 'Tone:', 'النبرة:')} ${tone}`;
  }
  return `${t(locale, 'Tone:', 'النبرة:')} ${guideline[locale]}`;
}

function constraintBlock(
  constraints: { maxLength?: number; minLength?: number } | undefined,
  locale: Locale,
): string | null {
  if (!constraints?.maxLength && !constraints?.minLength) return null;
  const parts: string[] = [];
  if (constraints.maxLength) {
    parts.push(
      `${t(locale, 'Do not exceed', 'لا تتجاوز')} ${constraints.maxLength} ${t(locale, 'characters.', 'حرفاً.')}`,
    );
  }
  if (constraints.minLength) {
    parts.push(
      `${t(locale, 'Do not output fewer than', 'لا تقل عن')} ${constraints.minLength} ${t(locale, 'characters.', 'حرفاً.')}`,
    );
  }
  return `--- ${t(locale, 'CONSTRAINTS', 'القيود')} ---\n${parts.join(' ')}`;
}

function guardBlock(meta: PropertyMetadata, locale: Locale): string {
  const lines: string[] = [];
  lines.push(`--- ${t(locale, 'RULES', 'القواعد')} ---`);
  lines.push(
    t(
      locale,
      `- Do NOT change: rooms (${meta.rooms}), bathrooms (${meta.bathrooms}), price (${meta.price})`,
      `- لا تغير: الغرف (${meta.rooms})، الحمامات (${meta.bathrooms})، السعر (${meta.price})`,
    ),
  );
  lines.push(
    t(
      locale,
      `- Keep currency (${meta.currency}) and price unit (${meta.priceUnit}) unchanged`,
      `- حافظ على العملة (${meta.currency}) ووحدة السعر (${meta.priceUnit}) كما هي`,
    ),
  );
  lines.push(
    t(
      locale,
      `- Keep the property type (${meta.propertyType}) and location landmarks from the original text`,
      `- حافظ على نوع العقار (${meta.propertyType}) ومعالم الموقع من النص الأصلي`,
    ),
  );
  if (meta.areaSqm) {
    lines.push(
      t(
        locale,
        `- Keep area (${meta.areaSqm}m²) unchanged`,
        `- حافظ على المساحة (${meta.areaSqm}m²) كما هي`,
      ),
    );
  }
  lines.push(
    t(
      locale,
      '- Output only the improved text — no labels, no quotes, no explanations',
      '- أخرج النص المحسّن فقط — لا تسميات ولا علامات اقتباس ولا شروحات',
    ),
  );
  return lines.join('\n');
}

function contentBlock(currentValue: string, locale: Locale): string {
  return [
    `--- ${t(locale, 'CONTENT TO PROCESS', 'المحتوى المراد معالجته')} ---`,
    `${t(locale, 'Current value:', 'القيمة الحالية:')}`,
    currentValue || t(locale, '(empty)', '(فارغ)'),
  ].join('\n');
}

function customInstructionBlock(instruction: string | undefined, locale: Locale): string | null {
  if (!instruction?.trim()) return null;
  return [`--- ${t(locale, 'CUSTOM INSTRUCTION', 'تعليمات مخصصة')} ---`, instruction.trim()].join(
    '\n',
  );
}

function amenitiesHint(fieldType: string, locale: Locale): string | null {
  if (fieldType !== 'amenities') return null;
  return `${t(locale, 'Valid amenity keys:', 'مفاتيح وسائل الراحة الصالحة:')} ${KNOWN_AMENITIES.join(', ')}`;
}

export function buildEnhancePrompt(request: EnhanceRequest, locale: Locale): BuiltPrompt {
  const parts: string[] = [];

  parts.push(metadataString(request.metadata, locale));
  parts.push('');
  parts.push(fieldBlock(request.fieldType, locale));
  parts.push(instructionBlock(request.action, locale));
  const custom = customInstructionBlock(request.customInstruction, locale);
  if (custom) parts.push(custom);
  const tone = toneBlock(request.tone, locale);
  if (tone) parts.push(tone);
  const constraints = constraintBlock(request.constraints, locale);
  if (constraints) parts.push(constraints);
  parts.push(guardBlock(request.metadata, locale));
  const hint = amenitiesHint(request.fieldType, locale);
  if (hint) parts.push(hint);
  parts.push('');
  parts.push(contentBlock(request.currentValue, locale));

  const info = getTemplateInfo('enhance', locale, request.promptVersion);

  return {
    system: systemForLocale(locale),
    user: parts.join('\n'),
    templateId: info.templateId,
    templateVersion: info.templateVersion,
    sections: info.sections,
  };
}

export function buildTranslationPrompt(
  locale: Locale,
  targetLocale: Locale,
  sourceFields: TranslationFields,
  metadata: PropertyMetadata,
  promptVersion?: string,
): BuiltPrompt {
  const sourceLang = locale === 'en' ? 'English' : 'Arabic';
  const targetLang = targetLocale === 'ar' ? 'Arabic' : 'English';

  const systemExt =
    targetLocale === 'ar'
      ? `\nأنت تترجم قائمة عقارات من ${sourceLang} إلى ${targetLang}. حافظ على جميع المعلومات، وكيّف المراجع الثقافية.`
      : `\nYou are translating a property listing from ${sourceLang} to ${targetLang}. Preserve all facts, adapt cultural references.`;

  const parts: string[] = [];

  parts.push(metadataString(metadata, locale));
  parts.push('');
  parts.push(`--- ${t(locale, 'TEXT TO TRANSLATE', 'النص المراد ترجمته')} ---`);
  parts.push(`${t(locale, 'Title:', 'العنوان:')} ${sourceFields.title}`);
  parts.push(
    `${t(locale, 'Summary:', 'الملخص:')} ${sourceFields.summary || t(locale, '(empty)', '(فارغ)')}`,
  );
  parts.push(`${t(locale, 'Description:', 'الوصف:')} ${sourceFields.description}`);
  parts.push(`${t(locale, 'City:', 'المدينة:')} ${sourceFields.city}`);
  parts.push(
    `${t(locale, 'Area/Neighborhood:', 'المنطقة/الحي:')} ${sourceFields.area || t(locale, '(empty)', '(فارغ)')}`,
  );
  parts.push(`${t(locale, 'Country:', 'البلد:')} ${sourceFields.country}`);
  parts.push('');
  parts.push(
    t(
      locale,
      'Output a JSON object with keys: title, summary, description, city, area, country.',
      'أخرج كائن JSON بالمفاتيح: title, summary, description, city, area, country.',
    ),
  );
  parts.push(
    t(
      locale,
      'Keep title under 120 chars, summary under 300 chars.',
      'اجعل العنوان أقل من 120 حرفاً والملخص أقل من 300 حرف.',
    ),
  );

  const unchangedParts: string[] = [
    `rooms (${metadata.rooms})`,
    `bathrooms (${metadata.bathrooms})`,
    `price (${metadata.price})`,
    `currency (${metadata.currency})`,
    `price unit (${metadata.priceUnit})`,
  ];
  if (metadata.areaSqm) unchangedParts.push(`area (${metadata.areaSqm}m²)`);

  parts.push(
    t(
      locale,
      `Do NOT change: ${unchangedParts.join(', ')}.`,
      `لا تغير: ${unchangedParts.join(', ')}.`,
    ),
  );

  const info = getTemplateInfo('enhance', locale, promptVersion);

  return {
    system: systemForLocale(locale) + systemExt,
    user: parts.join('\n'),
    templateId: info.templateId,
    templateVersion: info.templateVersion,
    sections: info.sections,
  };
}

export function buildReviewPrompt(
  propertyData: ReviewPropertyData,
  locale: Locale,
  promptVersion?: string,
): BuiltPrompt {
  const structuredLines: string[] = [
    `${t(locale, 'Property Type:', 'نوع العقار:')} ${propertyData.propertyType}`,
    `${t(locale, 'Bedrooms:', 'غرف النوم:')} ${propertyData.rooms}`,
    `${t(locale, 'Bathrooms:', 'الحمامات:')} ${propertyData.bathrooms}`,
    `${t(locale, 'City:', 'المدينة:')} ${propertyData.city}${propertyData.area ? `, ${propertyData.area}` : ''}`,
    `${t(locale, 'Price:', 'السعر:')} ${propertyData.price}`,
    `${t(locale, 'Amenities:', 'وسائل الراحة:')} ${propertyData.amenities.join(', ') || t(locale, '(none)', '(غير محدد)')}`,
  ];

  const exampleCategories = ['consistency', 'content_quality', 'trust_accuracy'] as const;
  const exampleParts: string[] = [];
  for (const cat of exampleCategories) {
    const examples = loadExamples(cat, locale);
    if (examples.length > 0) {
      exampleParts.push(`\n--- ${t(locale, 'EXAMPLES -', 'أمثلة -')} ${cat.toUpperCase()} ---`);
      for (const ex of examples.slice(0, 2)) {
        exampleParts.push(`${JSON.stringify(ex, null, 2)}`);
      }
    }
  }

  const parts: string[] = [
    t(locale, 'Analyze this property listing for issues:', 'حلل إعلان العقار هذا بحثاً عن مشاكل:'),
    '',
    `--- ${t(locale, 'STRUCTURED DATA', 'البيانات المنظمة')} ---`,
    structuredLines.join('\n'),
    '',
    `--- ${t(locale, 'TEXT FIELDS', 'الحقول النصية')} ---`,
    `${t(locale, 'Title:', 'العنوان:')} ${propertyData.title}`,
    `${t(locale, 'Summary:', 'الملخص:')} ${propertyData.summary || t(locale, '(empty)', '(فارغ)')}`,
    `${t(locale, 'Description:', 'الوصف:')} ${propertyData.description}`,
    '',
    t(
      locale,
      'Output ONLY valid JSON with an issues array. No markdown, no explanations.',
      'أخرج JSON صالحاً فقط مع مصفوفة issues. لا ماركداون ولا شروحات.',
    ),
  ];

  if (exampleParts.length > 0) {
    parts.push(...exampleParts);
  }

  const info = getTemplateInfo('review', locale, promptVersion);

  return {
    system: systemForLocale(locale, 'review'),
    user: parts.join('\n'),
    templateId: info.templateId,
    templateVersion: info.templateVersion,
    sections: info.sections,
  };
}
