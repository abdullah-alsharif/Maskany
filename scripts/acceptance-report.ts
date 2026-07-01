/**
 * Acceptance Checklist Report Generator.
 *
 * Scans all test files for `[AC-XX]` patterns and outputs a markdown table:
 * AC code | Criteria | Status | Test file.
 *
 * Usage:
 *   pnpm tsx scripts/acceptance-report.ts [--e2e]
 *
 * Without --e2e only API tests are scanned. With --e2e it also scans
 * Playwright spec files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

interface AcEntry {
  code: string;
  criteria: string;
  file: string;
  line: number;
}

function findTestFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath, pattern));
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findAcCodesInFile(filePath: string): AcEntry[] {
  const content = readFileSync(filePath, 'utf8');
  const entries: AcEntry[] = [];
  const lines = content.split('\n');
  const acRegex = /\[(AC-[\w-]+)\]\s+(.+)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(acRegex);
    if (match) {
      const relPath = path.relative(ROOT, filePath);
      entries.push({
        code: match[1],
        criteria: match[2].trim(),
        file: relPath,
        line: i + 1,
      });
    }
  }

  return entries;
}

function getAllAcEntries(): AcEntry[] {
  const includeE2e = process.argv.includes('--e2e');

  const apiDir = path.join(ROOT, 'apps/api/tests');
  const apiFiles = findTestFiles(apiDir, /\.test\.ts$/);

  const allEntries: AcEntry[] = [];
  for (const file of apiFiles) {
    allEntries.push(...findAcCodesInFile(file));
  }

  if (includeE2e) {
    const e2eDir = path.join(ROOT, 'apps/web/e2e');
    const e2eFiles = findTestFiles(e2eDir, /\.spec\.ts$/);
    for (const file of e2eFiles) {
      allEntries.push(...findAcCodesInFile(file));
    }
  }

  return allEntries;
}

const CRITERIA_MAP: Record<string, string> = {
  'AC-01': 'User can register with phone + name + optional email',
  'AC-02': 'OTP is sent via SMS for phone, email for email',
  'AC-03': 'OTP expires after 5 minutes',
  'AC-04': 'Max 3 OTP requests per identifier per hour',
  'AC-05': 'Login via phone or email sends OTP',
  'AC-06': 'JWT access token (15min) + refresh token (7d) issued on verify',
  'AC-07': 'Refresh token rotation invalidates old token',
  'AC-08': 'Logout invalidates refresh token',
  'AC-09': 'Unauthenticated user cannot access protected routes',
  'AC-10': 'Anyone can view published listings (paginated, 20/page)',
  'AC-11': 'Only authenticated owners can create listings',
  'AC-12': 'Only the listing owner can edit their listing',
  'AC-13': 'Only the listing owner can soft-delete (set inactive)',
  'AC-14': 'Up to 10 images and 3 videos per listing',
  'AC-15': 'Images processed to WebP with thumbnail',
  'AC-16': 'Property detail page shows all required fields',
  'AC-17': 'Property card shows cover image, title, location, price, badge, rating, rooms',
  'AC-18': 'Full-text search across title, summary, description, location',
  'AC-19': 'Search debounced at 300ms',
  'AC-20': 'Category chips filter by property type',
  'AC-21': 'All filter parameters composable with AND logic',
  'AC-22': 'Filters serialized to query params (shareable URLs)',
  'AC-23': 'Sort by newest, price asc/desc, highest rated',
  'AC-24': 'Only authenticated users can leave a review',
  'AC-25': 'One review per user per property (update, not duplicate)',
  'AC-26': 'Property owner cannot review own listing',
  'AC-27': 'Average rating + review_count updated on review change',
  'AC-28': 'Reviews paginated at 10 per page, newest first',
  'AC-29': 'Rating distribution bar chart displayed',
  'AC-30': 'WhatsApp button opens wa.me deep link with pre-filled message',
  'AC-31': 'Phone number in international format without + or spaces',
  'AC-32': 'FAB on detail page, icon-only on card',
  'AC-33': 'Bottom nav with 4 tabs: Home, Search, Favorites, Profile',
  'AC-34': 'Pull-to-refresh on listing pages',
  'AC-35': 'Swipe gestures for image gallery',
  'AC-36': 'Skeleton loading states during data fetch',
  'AC-37': 'Error states with retry buttons',
  'AC-38': 'Input validation on all API endpoints (zod)',
  'AC-39': 'Rate limiting on auth endpoints (429 after 20 attempts)',
  'AC-40': 'WCAG 2.1 AA — keyboard nav, focus mgmt, alt text, contrast',
  'AC-41': 'All pages have semantic HTML5 + meta tags',
  'AC-42': 'Complete browser-level user journey (E2E acceptance smoke test)',
};

function main() {
  const entries = getAllAcEntries();

  const byCode = new Map<string, AcEntry[]>();
  for (const entry of entries) {
    const existing = byCode.get(entry.code) ?? [];
    existing.push(entry);
    byCode.set(entry.code, existing);
  }

  const allAcCodes = Object.keys(CRITERIA_MAP);

  let report = '# Acceptance Checklist Report\n\n';
  report += '| AC Code | Criteria | Status | Test File |\n';
  report += '|---------|----------|--------|-----------|\n';

  for (const code of allAcCodes) {
    const criteria = CRITERIA_MAP[code] ?? 'Unknown criteria';
    const fileEntries = byCode.get(code);
    const testFile = fileEntries ? fileEntries.map((e) => `${e.file}:${e.line}`).join('<br>') : '—';
    const status = fileEntries ? '✅ IMPLEMENTED' : '❌ NOT FOUND';
    report += `| ${code} | ${criteria} | ${status} | ${testFile} |\n`;
  }

  report += '\n## Summary\n\n';
  const totalCovered = allAcCodes.filter((c) => byCode.has(c)).length;
  report += `- **Total AC codes**: ${allAcCodes.length}\n`;
  report += `- **Covered**: ${totalCovered}\n`;
  report += `- **Missing**: ${allAcCodes.length - totalCovered}\n`;
  report += `- **Total test entries found**: ${entries.length}\n`;
  report += `- **API entries**: ${entries.filter((e) => e.file.startsWith('apps/api')).length}\n`;
  report += `- **E2E entries**: ${entries.filter((e) => e.file.startsWith('apps/web')).length}\n`;

  const includeE2e = process.argv.includes('--e2e');
  if (!includeE2e) {
    report += '\n> Run with `--e2e` to include Playwright spec files in the scan.\n';
  }

  report += '\n> Run `pnpm test` and `pnpm test:e2e` to execute the tests.\n';

  console.log(report);
}

main();
