import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  PromptTemplate,
  TemplateSection,
  RenderContext,
  RenderResult,
  SectionRenderer,
  PromptTemplateRegistryOptions,
} from './types.js';
import {
  metadataBlockRenderer,
  fieldGuidelinesRenderer,
  actionInstructionsRenderer,
  guardRulesRenderer,
  toneGuidelinesRenderer,
  constraintsBlockRenderer,
  customInstructionRenderer,
  contentBlockRenderer,
  fewShotExamplesRenderer,
} from './sections/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const arabicChars = (
    text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length;
  const nonArabicChars = text.length - arabicChars;
  return Math.ceil(nonArabicChars / 4) + Math.ceil(arabicChars / 2);
}

interface ExampleFile {
  category: string;
  locale: string;
  examples: Array<Record<string, unknown>>;
}

const exampleCache = new Map<string, ExampleFile>();

export function loadExamples(category: string, locale: string): Array<Record<string, unknown>> {
  const cacheKey = `${category}-${locale}`;
  const cached = exampleCache.get(cacheKey);
  if (cached) return cached.examples;

  const examplesDir = join(__dirname, 'examples');
  const filename = `${category}-${locale}.json`;
  const filePath = join(examplesDir, filename);

  if (!existsSync(filePath)) return [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as ExampleFile;
    exampleCache.set(cacheKey, data);
    return data.examples;
  } catch {
    return [];
  }
}

export function resetExampleCache(): void {
  exampleCache.clear();
}

export class PromptTemplateRegistry {
  private templates: Map<string, PromptTemplate> = new Map();
  private renderers: Map<string, SectionRenderer> = new Map();
  private options: PromptTemplateRegistryOptions;

  constructor(options: PromptTemplateRegistryOptions = {}) {
    this.options = { localeFallback: true, ...options };
    this.registerDefaultRenderers();
  }

  private registerDefaultRenderers(): void {
    this.renderers.set('metadata', metadataBlockRenderer);
    this.renderers.set('field-guidelines', fieldGuidelinesRenderer);
    this.renderers.set('action-instructions', actionInstructionsRenderer);
    this.renderers.set('guard-rules', guardRulesRenderer);
    this.renderers.set('tone-guidelines', toneGuidelinesRenderer);
    this.renderers.set('constraints-block', constraintsBlockRenderer);
    this.renderers.set('custom-instruction', customInstructionRenderer);
    this.renderers.set('content-block', contentBlockRenderer);
    this.renderers.set('few-shot-examples', fewShotExamplesRenderer);
  }

  register(template: PromptTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template "${template.id}" is already registered`);
    }
    this.templates.set(template.id, template);
  }

  registerRenderer(sectionId: string, renderer: SectionRenderer): void {
    this.renderers.set(sectionId, renderer);
  }

  getTemplate(kind: string, locale: string): PromptTemplate | undefined {
    const id = `${kind}-${locale}-v1`;
    return this.templates.get(id);
  }

  getVersion(kind: string, locale: string, version: string): PromptTemplate {
    const id = `${kind}-${locale}-${version}`;
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template "${id}" not found`);
    }
    return template;
  }

  listVersions(kind?: string, locale?: string): string[] {
    const ids: string[] = [];
    for (const id of this.templates.keys()) {
      if (kind && !id.startsWith(kind)) continue;
      if (locale && !id.includes(locale)) continue;
      ids.push(id);
    }
    return ids.sort();
  }

  resolveSectionContent(section: TemplateSection, contextLocale: string): string | null {
    if (section.localeContent[contextLocale]) {
      return section.localeContent[contextLocale];
    }
    if (this.options.localeFallback && section.localeContent.en) {
      console.warn(
        `[PromptTemplateRegistry] Locale fallback: "${contextLocale}" not found for section "${section.id}", using "en"`,
      );
      return section.localeContent.en;
    }
    return null;
  }

  evaluateCondition(condition: string | undefined, context: RenderContext): boolean {
    if (!condition) return true;
    const match = condition.match(/^has(.+)$/);
    if (match) {
      const key = match[1].charAt(0).toLowerCase() + match[1].slice(1);
      return !!context[key];
    }
    return (context[condition] as boolean) ?? true;
  }

  render(
    kind: string,
    locale: string,
    context: RenderContext,
    options?: { version?: string; tokenBudget?: number },
  ): RenderResult {
    const version = options?.version || 'v1';
    const template = this.getVersion(kind, locale, version);

    const renderedSections: Array<{ id: string; content: string; tokenCount: number }> = [];
    const userParts: string[] = [];

    for (const section of template.sections) {
      if (
        section.required === false &&
        section.condition &&
        !this.evaluateCondition(section.condition, context)
      ) {
        continue;
      }

      const sectionContent = this.resolveSectionContent(section, locale);
      if (sectionContent === null) {
        if (section.required) {
          throw new Error(
            `Required section "${section.id}" has no content for locale "${locale}" and no fallback available`,
          );
        }
        continue;
      }

      const renderer = this.renderers.get(section.id);
      let content: string | null;
      if (renderer) {
        content = renderer(section, context);
      } else {
        content = sectionContent;
      }

      if (content !== null) {
        const tokenCount = estimateTokens(content);
        renderedSections.push({ id: section.id, content, tokenCount });
        userParts.push(content);
      }
    }

    let sections = renderedSections;
    const budget = options?.tokenBudget;
    if (budget !== undefined) {
      let currentTotal = sections.reduce((sum, s) => sum + s.tokenCount, 0);
      if (currentTotal > budget) {
        let prunedSections = [...sections];
        while (true) {
          currentTotal = prunedSections.reduce((sum, s) => sum + s.tokenCount, 0);
          if (currentTotal <= budget) break;

          const nonRequired = prunedSections
            .map((s, i) => ({ s, i, tmplSection: template.sections.find((ts) => ts.id === s.id) }))
            .filter((x) => x.tmplSection && !x.tmplSection.required)
            .sort((a, b) => (a.tmplSection?.weight ?? 0) - (b.tmplSection?.weight ?? 0));

          if (nonRequired.length === 0) break;

          const toRemove = nonRequired[0];
          const sectionLabel = `${toRemove.s.id} (weight ${toRemove.tmplSection?.weight})`;
          prunedSections = prunedSections.filter((_, i) => i !== toRemove.i);
          console.log(
            `[PromptTemplateRegistry] Pruned section "${sectionLabel}" to meet token budget`,
          );
        }
        sections = prunedSections;
      }
    }

    const user = sections.map((s) => s.content).join('\n\n');
    const tokenTotal = sections.reduce((sum, s) => sum + s.tokenCount, 0);

    return {
      system: template.systemPrompt,
      user,
      sections,
      tokenTotal,
      templateId: template.id,
      templateVersion: template.version,
    };
  }

  loadTemplatesFromDirectory(dirPath?: string): void {
    const templatesDir = dirPath || join(__dirname, 'templates');
    const files = readdirSync(templatesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const content = readFileSync(join(templatesDir, file), 'utf-8');
      const template = JSON.parse(content) as PromptTemplate;
      this.register(template);
    }
  }
}

export let defaultRegistry: PromptTemplateRegistry | null = null;

export function getDefaultRegistry(): PromptTemplateRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new PromptTemplateRegistry({ localeFallback: true });
    defaultRegistry.loadTemplatesFromDirectory();
  }
  return defaultRegistry;
}

export function resetDefaultRegistry(): void {
  defaultRegistry = null;
}
