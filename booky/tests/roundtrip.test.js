import { bookmarkTreeToMarkdown } from '../lib/bookmarks-to-md.js';
import { markdownToBookmarkTree } from '../lib/md-to-bookmarks.js';
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

function compareTrees(actual, expected) {
  if (!actual && !expected) return true;
  if (!actual || !expected) return false;
  
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!compareTrees(actual[i], expected[i])) return false;
    }
    return true;
  }
  
  const actualTitle = actual.title || '';
  const expectedTitle = expected.title || '';
  if (actualTitle !== expectedTitle) return false;
  
  if (actual.url !== expected.url) return false;
  
  if (actual.children || expected.children) {
    const actualChildren = actual.children || [];
    const expectedChildren = expected.children || [];
    if (!compareTrees(actualChildren, expectedChildren)) return false;
  }
  
  return true;
}

function extractComparableTree(nodes) {
  if (!nodes || !Array.isArray(nodes)) return [];
  
  function processNode(node) {
    if (!node) return null;
    
    if (node.id === '0') {
      if (node.children && node.children.length > 0) {
        return node.children.flatMap(processNode).filter(Boolean);
      }
      return [];
    }
    
    const isFolder = !node.url && (node.children || node.dateAdded !== undefined);
    
    if (isFolder) {
      const result = {
        title: node.title || ''
      };
      if (node.children && node.children.length > 0) {
        result.children = node.children.map(processNode).filter(Boolean);
      }
      return result;
    } else if (node.url) {
      return {
        title: node.title || '',
        url: node.url
      };
    }
    return null;
  }
  
  return nodes.flatMap(processNode).filter(Boolean);
}

test('Simple roundtrip: Export simple tree -> parse MD -> compare to original tree', () => {
  const simpleTree = JSON.parse(readFileSync(new URL('fixtures/simple-bookmarks.json', import.meta.url), 'utf-8'));
  
  const markdown = bookmarkTreeToMarkdown(simpleTree);
  const parsedTree = markdownToBookmarkTree(markdown);
  
  const originalComparable = extractComparableTree(simpleTree);
  
  assert.ok(compareTrees(parsedTree, originalComparable), 'Parsed tree should match original');
});

test('Complex roundtrip: Export complex tree -> parse -> compare', () => {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: 'Google', url: 'https://www.google.com' },
        {
          id: '11',
          title: 'Development',
          children: [
            { id: '110', title: 'React Docs', url: 'https://react.dev' },
            { id: '111', title: 'C++ Advanced', url: 'https://isocpp.org' },
            {
              id: '112',
              title: 'Frontend',
              children: [
                { id: '1120', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
                { id: '1121', title: 'CSS Tricks', url: 'https://css-tricks.com' }
              ]
            }
          ]
        },
        {
          id: '12',
          title: 'Empty Folder',
          children: []
        }
      ]
    },
    {
      id: '2',
      title: 'Other bookmarks',
      children: [
        { id: '20', title: 'Wikipedia', url: 'https://en.wikipedia.org' },
        { id: '21', title: 'YouTube', url: 'https://youtube.com' }
      ]
    }]
  }];
  
  const markdown = bookmarkTreeToMarkdown(tree);
  const parsedTree = markdownToBookmarkTree(markdown);
  
  const originalComparable = extractComparableTree(tree);
  
  assert.ok(compareTrees(parsedTree, originalComparable), 'Parsed tree should match original');
});

test('Parens in title roundtrip: Titles with parentheses survive export -> import', () => {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '11', title: 'Site (Official)', url: 'https://example.com/official' },
        { id: '12', title: 'Name with - dash', url: 'https://example.com/dash' }
      ]
    }]
  }];
  
  const markdown = bookmarkTreeToMarkdown(tree);
  const parsedTree = markdownToBookmarkTree(markdown);
  
  assert.ok(parsedTree.length > 0, 'Should parse tree');
  const bookmarksBar = parsedTree[0];
  assert.equal(bookmarksBar.title, 'Bookmarks Bar');
  assert.equal(bookmarksBar.children.length, 2);
  assert.equal(bookmarksBar.children[0].title, 'Site (Official)');
  assert.equal(bookmarksBar.children[1].title, 'Name with - dash');
});

test('Brackets in title roundtrip: Titles with brackets are escaped on export', () => {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: '[Important] Link', url: 'https://example.com/important' }
      ]
    }]
  }];
  
  const markdown = bookmarkTreeToMarkdown(tree);
  
  assert.ok(markdown.includes('\\['), 'Should escape brackets in markdown output');
  assert.ok(markdown.includes('[Important\\] Link'), 'Should escape closing bracket');
});

test('Empty folders roundtrip: Empty folders preserved through cycle', () => {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: 'Empty Folder', children: [] },
        { id: '11', title: 'Non-Empty Folder', children: [
          { id: '110', title: 'Link', url: 'https://example.com' }
        ]}
      ]
    }]
  }];
  
  const markdown = bookmarkTreeToMarkdown(tree);
  const parsedTree = markdownToBookmarkTree(markdown);
  
  assert.ok(parsedTree.length > 0);
  const bookmarksBar = parsedTree[0];
  const emptyFolder = bookmarksBar.children.find(c => c.title === 'Empty Folder');
  assert.ok(emptyFolder, 'Empty folder should exist');
  assert.ok(emptyFolder.children, 'Empty folder should have children array');
  assert.equal(emptyFolder.children.length, 0, 'Empty folder should have empty children');
});

test('Order preserved: Bookmark order within folders is maintained', () => {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: 'First', url: 'https://first.com' },
        { id: '11', title: 'Second', url: 'https://second.com' },
        { id: '12', title: 'Third', url: 'https://third.com' },
        { id: '13', title: 'Fourth', url: 'https://fourth.com' },
        { id: '14', title: 'Fifth', url: 'https://fifth.com' }
      ]
    }]
  }];
  
  const markdown = bookmarkTreeToMarkdown(tree);
  const parsedTree = markdownToBookmarkTree(markdown);
  
  const bookmarksBar = parsedTree[0];
  assert.equal(bookmarksBar.children[0].title, 'First');
  assert.equal(bookmarksBar.children[1].title, 'Second');
  assert.equal(bookmarksBar.children[2].title, 'Third');
  assert.equal(bookmarksBar.children[3].title, 'Fourth');
  assert.equal(bookmarksBar.children[4].title, 'Fifth');
});

test('Unicode roundtrip: Unicode titles survive the cycle', () => {
  const tree = [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: '日本語ブックマーク', url: 'https://example.jp' },
        { id: '11', title: '中文标题', url: 'https://example.cn' },
        { id: '12', title: 'العربية', url: 'https://example.sa' },
        { id: '13', title: 'Ελληνικά', url: 'https://example.gr' },
        { id: '14', title: 'עברית', url: 'https://example.il' },
        { id: '15', title: 'Emoji 🎉 Title 🚀', url: 'https://example.com' }
      ]
    }]
  }];
  
  const markdown = bookmarkTreeToMarkdown(tree);
  const parsedTree = markdownToBookmarkTree(markdown);
  
  const bookmarksBar = parsedTree[0];
  assert.equal(bookmarksBar.children[0].title, '日本語ブックマーク');
  assert.equal(bookmarksBar.children[1].title, '中文标题');
  assert.equal(bookmarksBar.children[2].title, 'العربية');
  assert.equal(bookmarksBar.children[3].title, 'Ελληνικά');
  assert.equal(bookmarksBar.children[4].title, 'עברית');
  assert.equal(bookmarksBar.children[5].title, 'Emoji 🎉 Title 🚀');
});
