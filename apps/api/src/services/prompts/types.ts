export interface TemplateSection {
  id: string;
  weight: number;
  required: boolean;
  condition?: string;
  localeContent: Record<string, string>;
}

export interface PromptTemplate {
  id: string;
  kind: string;
  locale: string;
  version: string;
  systemPrompt: string;
  sections: TemplateSection[];
  createdAt: string;
}

export type SectionRenderer = (section: TemplateSection, context: RenderContext) => string | null;

export interface RenderContext {
  locale: string;
  fieldType?: string;
  action?: string;
  currentValue?: string;
  metadata?: Record<string, unknown>;
  customInstruction?: string;
  tone?: string;
  constraints?: { maxLength?: number; minLength?: number };
  [key: string]: unknown;
}

export interface RenderResult {
  system: string;
  user: string;
  sections: Array<{ id: string; content: string; tokenCount: number }>;
  tokenTotal: number;
  templateId: string;
  templateVersion: string;
}

export interface PromptTemplateRegistryOptions {
  tokenBudget?: number;
  localeFallback?: boolean;
}
