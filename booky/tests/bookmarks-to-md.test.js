import { describe, it } from 'node:test';
import assert from 'node:assert';
import { bookmarkTreeToMarkdown } from '../lib/bookmarks-to-md.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function readFixture(name) {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

describe('Basic Conversion Tests', () => {
  it('Empty tree: [{id:"0", title:"", children:[]}] returns empty string', () => {
    const tree = [{ id: '0', title: '', children: [] }];
    assert.strictEqual(bookmarkTreeToMarkdown(tree), '');
  });

  it('Single bookmark: Tree with one bookmark under Bookmarks Bar', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: '10', title: 'Title', url: 'https://url' }
        ]
      }]
    }];
    assert.strictEqual(bookmarkTreeToMarkdown(tree), '# Bookmarks Bar\n- [Title](https://url)\n');
  });

  it('Single folder with bookmarks: Folder "Dev" with 2 bookmarks', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Dev',
        children: [
          { id: '10', title: 'GitHub', url: 'https://github.com' },
          { id: '11', title: 'Stack Overflow', url: 'https://stackoverflow.com' }
        ]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Dev'));
    assert.ok(result.includes('- [GitHub](https://github.com)'));
    assert.ok(result.includes('- [Stack Overflow](https://stackoverflow.com)'));
  });

  it('Multiple root folders: Bookmarks Bar + Other Bookmarks both populated', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          children: [{ id: '10', title: 'Link A', url: 'https://a.com' }]
        },
        {
          id: '2',
          title: 'Other bookmarks',
          children: [{ id: '20', title: 'Link B', url: 'https://b.com' }]
        }
      ]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Bookmarks Bar'));
    assert.ok(result.includes('# Other bookmarks'));
    assert.ok(result.includes('- [Link A](https://a.com)'));
    assert.ok(result.includes('- [Link B](https://b.com)'));
  });

  it('Fixture: simple-bookmarks.json matches simple-bookmarks.md exactly', () => {
    const json = JSON.parse(readFixture('simple-bookmarks.json'));
    const expected = readFixture('simple-bookmarks.md');
    assert.strictEqual(bookmarkTreeToMarkdown(json), expected);
  });

  it('Fixture: complex-bookmarks.json matches complex-bookmarks.md exactly', () => {
    const json = JSON.parse(readFixture('complex-bookmarks.json'));
    const expected = readFixture('complex-bookmarks.md');
    assert.strictEqual(bookmarkTreeToMarkdown(json), expected);
  });
});

describe('Nesting Depth Tests', () => {
  it('Depth 1 subfolder: Folder inside root produces ## heading', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: '10', title: 'Top Link', url: 'https://top.com' },
          {
            id: '11',
            title: 'Subfolder',
            children: [{ id: '110', title: 'Sub Link', url: 'https://sub.com' }]
          }
        ]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('## Subfolder'));
  });

  it('Depth 5 subfolder: 5 levels deep produces ###### heading (H6)', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Root',
        children: [{
          id: '2',
          title: 'L1',
          children: [{
            id: '3',
            title: 'L2',
            children: [{
              id: '4',
              title: 'L3',
              children: [{
                id: '5',
                title: 'L4',
                children: [{
                  id: '6',
                  title: 'L5',
                  children: [{ id: '7', title: 'Deep', url: 'https://deep.com' }]
                }]
              }]
            }]
          }]
        }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Root'));
    assert.ok(result.includes('## L1'));
    assert.ok(result.includes('### L2'));
    assert.ok(result.includes('#### L3'));
    assert.ok(result.includes('##### L4'));
    assert.ok(result.includes('###### L5'));
  });

  it('Depth 6+ subfolder: 7 levels deep is capped at ###### (H6)', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Root',
        children: [{
          id: '2',
          title: 'L1',
          children: [{
            id: '3',
            title: 'L2',
            children: [{
              id: '4',
              title: 'L3',
              children: [{
                id: '5',
                title: 'L4',
                children: [{
                  id: '6',
                  title: 'L5',
                  children: [{
                    id: '7',
                    title: 'L6',
                    children: [{
                      id: '8',
                      title: 'L7',
                      children: [{ id: '9', title: 'Deep', url: 'https://deep.com' }]
                    }]
                  }]
                }]
              }]
            }]
          }]
        }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Root'));
    assert.ok(result.includes('## L1'));
    assert.ok(result.includes('### L2'));
    assert.ok(result.includes('#### L3'));
    assert.ok(result.includes('##### L4'));
    assert.ok(result.includes('###### L5'));
    assert.ok(result.includes('###### L6'));
    assert.ok(result.includes('###### L7'));
    assert.ok(!result.includes('#######'));
  });

  it('Mixed depths: Bookmarks at various levels have correct heading levels', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Root Folder',
        children: [
          { id: '10', title: 'Root Link', url: 'https://root.com' },
          {
            id: '11',
            title: 'Level 1 Folder',
            children: [
              { id: '110', title: 'L1 Link', url: 'https://l1.com' },
              {
                id: '111',
                title: 'Level 2 Folder',
                children: [{ id: '1110', title: 'L2 Link', url: 'https://l2.com' }]
              }
            ]
          }
        ]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.match(/^# Root Folder/m));
    assert.ok(result.match(/^## Level 1 Folder/m));
    assert.ok(result.match(/^### Level 2 Folder/m));
  });
});

describe('Special Characters Tests', () => {
  it('Brackets in title: [React] Docs escapes to - [\\[React\\] Docs](url)', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: '[React] Docs', url: 'https://react.dev' }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('- [\\[React\\] Docs](https://react.dev)'));
  });

  it('Parentheses in title: Foo (bar) escapes to - [Foo \\(bar\\)](url)', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: 'Foo (bar)', url: 'https://example.com' }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('- [Foo \\(bar\\)](https://example.com)'));
  });

  it('Parentheses in URL: https://en.wikipedia.org/wiki/Foo_(bar) is preserved', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Foo_(bar)' }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('(https://en.wikipedia.org/wiki/Foo_(bar))'));
  });

  it('Unicode title: 日本語ブックマーク passes through as-is', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: '日本語ブックマーク', url: 'https://example.jp' }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('- [日本語ブックマーク](https://example.jp)'));
  });

  it('Empty title: Bookmark with title: "" renders as - [](url)', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: '', url: 'https://example.com' }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('- [](https://example.com)') || result.includes('- [Untitled](https://example.com)'));
  });

  it('Pipe in title: A | B is handled appropriately', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: 'A | B', url: 'https://example.com' }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('A | B'));
  });
});

describe('Edge Cases Tests', () => {
  it('Empty folder: Folder with no children shows heading with no list items', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{ id: '10', title: 'Empty Folder', children: [] }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Empty Folder'));
    assert.ok(!result.includes('- ['));
  });

  it('Folder with only subfolders: Shows heading then sub-headings without direct bookmarks', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [{
          id: '10',
          title: 'Parent Folder',
          children: [
            { id: '100', title: 'Subfolder A', children: [{ id: '1000', title: 'Link', url: 'https://link.com' }] },
            { id: '101', title: 'Subfolder B', children: [] }
          ]
        }]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Parent Folder'));
    assert.ok(result.includes('## Subfolder A'));
    assert.ok(result.includes('## Subfolder B'));
  });

  it('Mobile Bookmarks root: Third root node produces # Mobile Bookmarks section', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [
        { id: '1', title: 'Bookmarks Bar', children: [] },
        { id: '2', title: 'Other bookmarks', children: [] },
        { id: '3', title: 'Mobile Bookmarks', children: [{ id: '30', title: 'Mobile Link', url: 'https://mobile.com' }] }
      ]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('# Mobile Bookmarks'));
    assert.ok(result.includes('- [Mobile Link](https://mobile.com)'));
  });

  it('Bookmark with no URL: {title: "separator", url: undefined} is skipped', () => {
    const tree = [{
      id: '0',
      title: '',
      children: [{
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: '10', title: 'Link A', url: 'https://a.com' },
          { id: '11', title: 'separator', url: undefined },
          { id: '12', title: 'Link B', url: 'https://b.com' }
        ]
      }]
    }];
    const result = bookmarkTreeToMarkdown(tree);
    assert.ok(result.includes('- [Link A](https://a.com)'));
    assert.ok(result.includes('- [Link B](https://b.com)'));
    assert.ok(!result.includes('separator'));
  });
});
