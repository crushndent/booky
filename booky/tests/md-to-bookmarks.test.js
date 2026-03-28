import { test, describe } from 'node:test';
import assert from 'node:assert';
import { markdownToBookmarkTree } from '../lib/md-to-bookmarks.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

describe('Basic Parsing Tests', () => {
  test('Empty string returns empty array', () => {
    const result = markdownToBookmarkTree('');
    assert.deepStrictEqual(result, []);
  });

  test('Single H1 + bookmark', () => {
    const md = '# Bookmarks Bar\n\n- [G](https://g.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Bookmarks Bar', children: [{ title: 'G', url: 'https://g.com' }] }
    ]);
  });

  test('Nested folders: H1 > H2 > bookmark', () => {
    const md = '# Root\n\n## Sub\n\n- [Link](https://example.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Root', children: [{ title: 'Sub', children: [{ title: 'Link', url: 'https://example.com' }] }] }
    ]);
  });

  test('Multiple roots: Two H1 sections', () => {
    const md = '# First\n\n- [A](https://a.com)\n\n# Second\n\n- [B](https://b.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'First', children: [{ title: 'A', url: 'https://a.com' }] },
      { title: 'Second', children: [{ title: 'B', url: 'https://b.com' }] }
    ]);
  });

  test('Fixture: simple-bookmarks.md structure matches expected', () => {
    const mdContent = readFileSync(join(fixturesDir, 'simple-bookmarks.md'), 'utf-8');
    const result = markdownToBookmarkTree(mdContent);
    const expected = [
      {
        title: 'Bookmarks Bar',
        children: [
          { title: 'Google', url: 'https://www.google.com' },
          { title: 'GitHub', url: 'https://github.com' }
        ]
      },
      {
        title: 'Other bookmarks',
        children: [
          { title: 'Wikipedia', url: 'https://en.wikipedia.org' }
        ]
      }
    ];
    assert.deepStrictEqual(result, expected);
  });
});

describe('Heading Level Mapping Tests', () => {
  test('H1 = root folder', () => {
    const md = '# Root\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [{ title: 'Root', children: [] }]);
  });

  test('H2 = subfolder of H1', () => {
    const md = '# Root\n\n## Sub\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Root', children: [{ title: 'Sub', children: [] }] }
    ]);
  });

  test('H3 after H1 (skipping H2): Deep is child of Root', () => {
    const md = '# Root\n\n### Deep\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Root', children: [{ title: 'Deep', children: [] }] }
    ]);
  });

  test('H2 after H3: Sibling is child of most recent H1, not Deep', () => {
    const md = '# Root\n\n### Deep\n\n## Sibling\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Root', children: [{ title: 'Deep', children: [] }, { title: 'Sibling', children: [] }] }
    ]);
  });
});

describe('Link Parsing Tests', () => {
  test('Standard link', () => {
    const md = '# Folder\n\n- [Title](https://url)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Folder', children: [{ title: 'Title', url: 'https://url' }] }
    ]);
  });

  test('Escaped brackets in title', () => {
    const md = '# Folder\n\n- [\\[React\\]](https://react.dev)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Folder', children: [{ title: '[React]', url: 'https://react.dev' }] }
    ]);
  });

  test('URL with parens', () => {
    const md = '# Folder\n\n- [Wiki](https://en.wikipedia.org/wiki/Foo_(bar))\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Folder', children: [{ title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Foo_(bar)' }] }
    ]);
  });

  test('No URL, just text: skipped', () => {
    const md = '# Folder\n\n- Plain text line\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [{ title: 'Folder', children: [] }]);
  });

  test('Multiple links on one line: only first extracted', () => {
    const md = '# Folder\n\n- [A](https://a.com) and [B](https://b.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Folder', children: [{ title: 'A', url: 'https://a.com' }] }
    ]);
  });
});

describe('Malformed Input Tests', () => {
  test('No headings, just links: placed under default root', () => {
    const md = '- [A](https://a.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Imported Bookmarks', children: [{ title: 'A', url: 'https://a.com' }] }
    ]);
  });

  test('Broken link syntax: skipped, no crash', () => {
    const md = '# Folder\n\n- [Title(url)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [{ title: 'Folder', children: [] }]);
  });

  test('Empty lines between items: ignored, parsing continues', () => {
    const md = '# Folder\n\n- [A](https://a.com)\n\n\n- [B](https://b.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Folder', children: [{ title: 'A', url: 'https://a.com' }, { title: 'B', url: 'https://b.com' }] }
    ]);
  });

  test('Non-bookmark markdown: ignored gracefully', () => {
    const md = '# Folder\n\nThis is a paragraph.\n\n```\ncode block\n```\n\n- [Link](https://example.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Folder', children: [{ title: 'Link', url: 'https://example.com' }] }
    ]);
  });

  test('Heading with no following content: empty folder created', () => {
    const md = '# Empty\n\n# Next\n\n- [Link](https://example.com)\n';
    const result = markdownToBookmarkTree(md);
    assert.deepStrictEqual(result, [
      { title: 'Empty', children: [] },
      { title: 'Next', children: [{ title: 'Link', url: 'https://example.com' }] }
    ]);
  });
});
