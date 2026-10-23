import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getDocument, getSearchIndex, pages, repositoryUrl, resolveLink} from '../../docs/lib/documents.mjs';

test('all registered pages have unique routes and readable canonical Markdown', () => {
  assert.equal(new Set(pages.map(page => page.slug)).size, pages.length);
  assert.equal(new Set(pages.map(page => page.source)).size, pages.length);
  for (const page of pages) {
    assert.match(getDocument(page.slug).content, /^# /m, page.source);
  }
  assert.equal(getDocument('missing'), undefined);
});

test('Markdown links resolve from their source directory', () => {
  assert.equal(resolveLink('README.md', 'docs/usage.md'), '/usage/');
  assert.equal(resolveLink('docs/plugins.md', '../plugins/planning/README.md#usage'), '/plugins/planning/#usage');
  assert.equal(resolveLink('plugins/search/README.md', '../../docs/ci.md?view=full#testing'), '/ci/?view=full#testing');
  assert.equal(resolveLink('docs/usage.md', 'architecture.md#boundaries'), '/architecture/#boundaries');
});

test('non-page repository links retain GitHub source destinations', () => {
  assert.equal(resolveLink('README.md', '.claude-plugin/marketplace.json'), `${repositoryUrl}/blob/main/.claude-plugin/marketplace.json`);
  assert.equal(resolveLink('docs/usage.md', '../AGENTS.md'), `${repositoryUrl}/blob/main/AGENTS.md`);
});

test('external, absolute, and fragment links are preserved', () => {
  for (const href of ['https://example.com', 'mailto:hello@example.com', '#section', '/usage/', '//example.com', '?view=full', '']) {
    assert.equal(resolveLink('README.md', href), href);
  }
});

test('search includes the full text of every published page', () => {
  const index = getSearchIndex();
  assert.equal(index.length, pages.length);
  assert.ok(index.every(page => page.text && page.title && page.group && page.href));
  assert.match(index.find(page => page.href === '/plugins/planning/').text, /durable-plans/);
});