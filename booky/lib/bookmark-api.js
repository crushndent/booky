/**
 * Gets the full bookmark tree
 * @returns {Promise<Array>} Bookmark tree from chrome.bookmarks.getTree()
 */
export async function getFullTree() {
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

/**
 * Clears all bookmarks from root folders
 * Does NOT delete root folders (Chrome won't allow it)
 * @returns {Promise<void>}
 */
export async function clearAllBookmarks() {
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
      for (const child of rootFolder.children) {
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

/**
 * Recursively creates folders and bookmarks
 * @param {string} parentId - Parent folder ID
 * @param {Array} nodes - Array of {title, url?, children?}
 * @returns {Promise<number>} Count of items created
 */
export async function createTree(parentId, nodes) {
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

/**
 * Replaces all bookmarks with new tree
 * @param {Array} tree - Parsed bookmark tree
 * @returns {Promise<number>} Total count of items created
 */
export async function replaceAllBookmarks(tree) {
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
