export interface FieldFix {
  field: string;
  findText?: string;
  replaceWith?: string;
  suggestion?: string;
}

export interface FixOption {
  label: string;
  field: string;
  findText?: string;
  replaceWith?: string;
  suggestion?: string;
  fixes?: FieldFix[];
}

export interface ReviewIssue {
  id: string;
  category: 'consistency' | 'content_quality' | 'trust_accuracy';
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  title: string;
  description: string;
  field?: string;
  evidence?: string;
  suggestion?: string;
  findText?: string;
  replaceWith?: string;
  alternatives?: FixOption[];
  fixes?: FieldFix[];
}

export interface ReviewResult {
  issues: ReviewIssue[];
  qualityScore: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const TEXT_FIELDS = new Set(['title', 'summary', 'description', 'amenities']);

export function computeQualityScore(issues: ReviewIssue[]): number {
  let dataCritical = 0;
  let textCritical = 0;
  let majorCount = 0;
  let minorCount = 0;
  let suggestionCount = 0;

  for (const issue of issues) {
    if (issue.severity === 'critical') {
      const hasTextFix =
        !!issue.findText || !!issue.replaceWith || (!!issue.field && TEXT_FIELDS.has(issue.field));
      if (hasTextFix) textCritical++;
      else dataCritical++;
    } else if (issue.severity === 'major') majorCount++;
    else if (issue.severity === 'minor') minorCount++;
    else if (issue.severity === 'suggestion') suggestionCount++;
  }

  let deduction = 0;

  deduction += dataCritical * 25;

  for (let i = 0; i < textCritical; i++) deduction += 8 / (i + 1);
  for (let i = 0; i < majorCount; i++) deduction += 5 / (i + 1);
  for (let i = 0; i < minorCount; i++) deduction += 2 / (i + 1);
  for (let i = 0; i < suggestionCount; i++) deduction += 1 / (i + 1);

  return Math.max(0, 100 - Math.round(deduction));
}

let issueCounter = 0;

export function generateIssueId(): string {
  issueCounter += 1;
  return `issue-${issueCounter}`;
}

export function resetIssueCounter(): void {
  issueCounter = 0;
}

const categoryToI18nMap: Record<string, string> = {
  consistency: 'consistency',
  content_quality: 'contentQuality',
  trust_accuracy: 'trustAccuracy',
};

export function mapCategoryToI18n(category: string): string {
  return categoryToI18nMap[category] ?? category;
}
