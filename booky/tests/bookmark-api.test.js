import { test } from 'node:test';
import assert from 'node:assert';

function createMockChrome(mockTree) {
  const createdItems = [];
  let idCounter = 100;
  
  const mockBookmarks = {
    getTree: (callback) => {
      callback(mockTree);
    },
    removeTree: (id, callback) => {
      callback();
    },
    create: (bookmark, callback) => {
      const newId = String(++idCounter);
      const result = { ...bookmark, id: newId };
      createdItems.push(result);
      callback(result);
    }
  };
  
  return { bookmarks: mockBookmarks, createdItems };
}

async function getFullTree() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(results);
      }
    });
  });
}

async function clearAllBookmarks() {
  const tree = await getFullTree();
  
  if (!tree || tree.length === 0) {
    return;
  }

  const rootNode = tree[0];
  
  if (!rootNode || !rootNode.children) {
    return;
  }

  for (const rootFolder of rootNode.children) {
    if (rootFolder.children && rootFolder.children.length > 0) {
      for (const child of [...rootFolder.children]) {
        await removeTreeRecursive(child);
      }
    }
  }
}

async function removeTreeRecursive(node) {
  if (node.children && node.children.length > 0) {
    for (const child of [...node.children]) {
      await removeTreeRecursive(child);
    }
  }
  
  await new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(node.id, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

async function createTree(parentId, nodes) {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return 0;
  }

  let count = 0;

  for (const node of nodes) {
    if (node.url) {
      await new Promise((resolve, reject) => {
        chrome.bookmarks.create(
          {
            parentId: parentId,
            title: node.title,
            url: node.url
          },
          () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          }
        );
      });
      count++;
    } else if (node.children) {
      const folder = await new Promise((resolve, reject) => {
        chrome.bookmarks.create(
          {
            parentId: parentId,
            title: node.title
          },
          (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          }
        );
      });
      count++;
      
      const childCount = await createTree(folder.id, node.children);
      count += childCount;
    }
  }

  return count;
}

async function replaceAllBookmarks(tree) {
  if (!tree || !Array.isArray(tree) || tree.length === 0) {
    return 0;
  }

  await clearAllBookmarks();

  const fullTree = await getFullTree();
  
  if (!fullTree || fullTree.length === 0) {
    throw new Error('Unable to get bookmark tree after clearing');
  }

  const rootNode = fullTree[0];
  
  if (!rootNode || !rootNode.children) {
    throw new Error('Invalid bookmark tree structure');
  }

  const rootFolders = rootNode.children;
  const bookmarksBar = rootFolders.find(f => f.id === '1');
  const otherBookmarks = rootFolders.find(f => f.id === '2');

  let totalCount = 0;

  for (const node of tree) {
    let parentId;
    
    if (bookmarksBar && totalCount === 0) {
      parentId = bookmarksBar.id;
    } else if (otherBookmarks) {
      parentId = otherBookmarks.id;
    } else if (bookmarksBar) {
      parentId = bookmarksBar.id;
    } else {
      parentId = rootFolders[0].id;
    }

    const count = await createTree(parentId, [node]);
    totalCount += count;
  }

  return totalCount;
}

test('getFullTree', async () => {
  const mockTree = [{
    id: '0',
    title: '',
    children: [
      { id: '1', title: 'Bookmarks Bar', children: [] },
      { id: '2', title: 'Other bookmarks', children: [] }
    ]
  }];
  
  globalThis.chrome = createMockChrome(mockTree);
  globalThis.chrome.runtime = { lastError: null };
  
  const tree = await getFullTree();
  
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, '0');
  assert.equal(tree[0].children.length, 2);
});

test('clearAllBookmarks - populated', async () => {
  let removeTreeCalls = [];
  
  const mockTree = [{
    id: '0',
    title: '',
    children: [
      { 
        id: '1', 
        title: 'Bookmarks Bar', 
        children: [
          { id: '10', title: 'Folder', children: [{ id: '100', title: 'Link', url: 'https://example.com' }] }
        ] 
      },
      { id: '2', title: 'Other bookmarks', children: [] }
    ]
  }];
  
  globalThis.chrome = {
    bookmarks: {
      getTree: (callback) => callback(mockTree),
      removeTree: (id, callback) => {
        removeTreeCalls.push(id);
        callback();
      }
    },
    runtime: { lastError: null }
  };
  
  await clearAllBookmarks();
  
  assert.ok(removeTreeCalls.length > 0, 'Should call removeTree for non-root items');
  assert.ok(removeTreeCalls.includes('10'), 'Should remove nested folder');
});

test('clearAllBookmarks - already empty', async () => {
  let removeTreeCalls = [];
  
  const mockTree = [{
    id: '0',
    title: '',
    children: [
      { id: '1', title: 'Bookmarks Bar', children: [] },
      { id: '2', title: 'Other bookmarks', children: [] }
    ]
  }];
  
  globalThis.chrome = {
    bookmarks: {
      getTree: (callback) => callback(mockTree),
      removeTree: (id, callback) => {
        removeTreeCalls.push(id);
        callback();
      }
    },
    runtime: { lastError: null }
  };
  
  await clearAllBookmarks();
  
  assert.equal(removeTreeCalls.length, 0, 'Should not call removeTree when empty');
});

test('createTree - flat', async () => {
  const createdItems = [];
  
  globalThis.chrome = {
    bookmarks: {
      create: (bookmark, callback) => {
        const item = { ...bookmark, id: String(100 + createdItems.length) };
        createdItems.push(item);
        callback(item);
      }
    },
    runtime: { lastError: null }
  };
  
  const nodes = [
    { title: 'Google', url: 'https://google.com' },
    { title: 'GitHub', url: 'https://github.com' }
  ];
  
  const count = await createTree('1', nodes);
  
  assert.equal(count, 2);
  assert.equal(createdItems.length, 2);
  assert.equal(createdItems[0].title, 'Google');
  assert.equal(createdItems[0].url, 'https://google.com');
  assert.equal(createdItems[1].title, 'GitHub');
});

test('createTree - nested', async () => {
  const createdItems = [];
  
  globalThis.chrome = {
    bookmarks: {
      create: (bookmark, callback) => {
        const item = { ...bookmark, id: String(100 + createdItems.length) };
        createdItems.push(item);
        callback(item);
      }
    },
    runtime: { lastError: null }
  };
  
  const nodes = [
    { 
      title: 'Development', 
      children: [
        { title: 'GitHub', url: 'https://github.com' },
        { title: 'Stack Overflow', url: 'https://stackoverflow.com' }
      ] 
    }
  ];
  
  const count = await createTree('1', nodes);
  
  assert.equal(count, 3, 'Should count folder + 2 bookmarks');
  assert.equal(createdItems.length, 3);
  assert.equal(createdItems[0].title, 'Development');
  assert.ok(!createdItems[0].url, 'First item should be a folder');
  assert.equal(createdItems[1].title, 'GitHub');
  assert.equal(createdItems[2].title, 'Stack Overflow');
});

test('createTree - uses returned IDs', async () => {
  const parentIds = [];
  
  globalThis.chrome = {
    bookmarks: {
      create: (bookmark, callback) => {
        parentIds.push(bookmark.parentId);
        const item = { ...bookmark, id: String(100 + parentIds.length) };
        callback(item);
      }
    },
    runtime: { lastError: null }
  };
  
  const nodes = [
    { 
      title: 'Folder', 
      children: [
        { title: 'Link', url: 'https://example.com' }
      ] 
    }
  ];
  
  await createTree('1', nodes);
  
  assert.equal(parentIds[0], '1', 'Folder should be created with parentId 1');
  assert.ok(parseInt(parentIds[1]) >= 100, 'Link should be created inside the folder');
});

test('replaceAllBookmarks', async () => {
  const createdItems = [];
  let removeTreeCalls = [];
  
  const initialTree = [{
    id: '0',
    title: '',
    children: [
      { id: '1', title: 'Bookmarks Bar', children: [{ id: '10', title: 'Old', url: 'https://old.com' }] },
      { id: '2', title: 'Other bookmarks', children: [] }
    ]
  }];
  
  globalThis.chrome = {
    bookmarks: {
      getTree: (callback) => callback(initialTree),
      removeTree: (id, callback) => {
        removeTreeCalls.push(id);
        callback();
      },
      create: (bookmark, callback) => {
        const item = { ...bookmark, id: String(100 + createdItems.length) };
        createdItems.push(item);
        callback(item);
      }
    },
    runtime: { lastError: null }
  };
  
  const newTree = [
    { 
      title: 'New Folder',
      children: [
        { title: 'New Link', url: 'https://new.com' }
      ]
    }
  ];
  
  const count = await replaceAllBookmarks(newTree);
  
  assert.ok(removeTreeCalls.includes('10'), 'Should clear old bookmarks');
  assert.equal(count, 2, 'Should count folder + bookmark');
  assert.equal(createdItems.length, 2);
  assert.equal(createdItems[0].title, 'New Folder');
  assert.equal(createdItems[1].title, 'New Link');
});
