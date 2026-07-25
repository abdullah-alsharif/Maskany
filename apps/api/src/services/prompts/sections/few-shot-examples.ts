import type { SectionRenderer } from '../types.js';

export const fewShotExamplesRenderer: SectionRenderer = (section, context) => {
  const examples = context.fewShotExamples as Array<{ input: string; output: string }> | undefined;
  if (!examples || examples.length === 0) return null;
  return examples
    .map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`)
    .join('\n\n');
};
