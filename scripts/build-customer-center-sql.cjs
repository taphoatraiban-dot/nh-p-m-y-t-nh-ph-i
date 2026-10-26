'use strict';
// Generates a single, non-persistent SQL review transaction.
// Deliberately has no COMMIT/deploy option: production requires separate approval.
const fs = require('node:fs');
const path = require('node:path');

const SOURCES = [
  'prototypes/sql/admin_customer_command.review_only.sql',
  'prototypes/sql/admin_customer_overview.proposal.sql',
  'prototypes/sql/admin_customer_audit.review_only.sql'
];

function buildReviewSql(base = path.join(__dirname, '..')) {
  const sections = SOURCES.map(filename => {
    const content = fs.readFileSync(path.join(base, filename), 'utf8');
    if (!/^begin;\s*$/mi.test(content) || !/^rollback;\s*$/mi.test(content)) {
      throw new Error(`Review-only wrapper is missing: ${filename}`);
    }
    const withoutBegin = content.replace(/^begin;\s*$/mi, '');
    const unwrapped = withoutBegin.replace(/^rollback;\s*$/mi, '');
    if (/^\s*(?:begin|commit|rollback);\s*$/mi.test(unwrapped)) {
      throw new Error(`Unexpected transaction control: ${filename}`);
    }
    return `-- Source: ${filename}\n${unwrapped.trim()}\n`;
  });
  return `-- CUSTOMER CENTER REVIEW ONLY — NEVER DEPLOY AS A MIGRATION.\n` +
    `-- The source SQL files are intentionally non-persistent; this bundle is too.\n` +
    `BEGIN;\n\n${sections.join('\n')}\nROLLBACK;\n`;
}

if (require.main === module) process.stdout.write(buildReviewSql());
module.exports = { buildReviewSql, SOURCES };
