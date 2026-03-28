import { bookmarkTreeToMarkdown } from '../lib/bookmarks-to-md.js';
import { markdownToBookmarkTree } from '../lib/md-to-bookmarks.js';
import { getAuthToken, listFolders, findFile, readFile, writeFile } from '../lib/drive-api.js';
import { getFullTree, clearAllBookmarks, createTree, replaceAllBookmarks } from '../lib/bookmark-api.js';
import { exportToLocalFile, importFromLocalFile, isLocalFileAccessSupported } from '../lib/file-system.js';

const DEFAULT_FILENAME = 'chrome-bookmarks.md';

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['driveFolderId', 'driveFolderName', 'bookmarksFilename'],
      (result) => {
        resolve({
          driveFolderId: result.driveFolderId || null,
          driveFolderName: result.driveFolderName || null,
          bookmarksFilename: result.bookmarksFilename || DEFAULT_FILENAME
        });
      }
    );
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      {
        driveFolderId: settings.folderId,
        driveFolderName: settings.folderName,
        bookmarksFilename: settings.filename || DEFAULT_FILENAME
      },
      () => resolve({ success: true })
    );
  });
}

async function handleExport() {
  try {
    const settings = await getSettings();
    
    if (!settings.driveFolderId) {
      return { success: false, error: 'No folder configured' };
    }

    const tree = await getFullTree();
    const markdown = bookmarkTreeToMarkdown(tree);
    
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication failed' };
    }

    await writeFile(
      token,
      settings.driveFolderId,
      settings.bookmarksFilename,
      markdown
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Export failed' };
  }
}

async function handleExportLocal() {
  try {
    const tree = await getFullTree();
    const markdown = bookmarkTreeToMarkdown(tree);
    
    const result = await exportToLocalFile(markdown);
    return result;
  } catch (error) {
    return { success: false, error: error.message || 'Local export failed' };
  }
}

async function handleImportLocal() {
  try {
    const result = await importFromLocalFile();
    
    if (!result.success) {
      return result;
    }

    let tree;
    try {
      tree = markdownToBookmarkTree(result.content);
    } catch (parseError) {
      return { success: false, error: `Parse error: ${parseError.message}` };
    }

    await replaceAllBookmarks(tree);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Local import failed' };
  }
}

async function handleImport() {
  try {
    const settings = await getSettings();
    
    if (!settings.driveFolderId) {
      return { success: false, error: 'No folder configured' };
    }

    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication failed' };
    }

    const file = await findFile(token, settings.driveFolderId, settings.bookmarksFilename);
    
    if (!file) {
      return { success: false, error: 'No bookmarks file found' };
    }

    const markdown = await readFile(token, file.id);
    
    let tree;
    try {
      tree = markdownToBookmarkTree(markdown);
    } catch (parseError) {
      return { success: false, error: `Parse error: ${parseError.message}` };
    }

    await replaceAllBookmarks(tree);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Import failed' };
  }
}

async function handleListFolders() {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Authentication failed' };
    }

    const folders = await listFolders(token);
    return { success: true, folders };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to list folders' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handlers = {
      export: handleExport,
      import: handleImport,
      exportLocal: handleExportLocal,
      importLocal: handleImportLocal,
      listFolders: handleListFolders,
      getSettings: async () => {
        const settings = await getSettings();
        return { success: true, settings };
      },
      saveSettings: async () => {
        return saveSettings({
          folderId: message.folderId,
          folderName: message.folderName,
          filename: message.filename
        });
      },
      checkLocalFileSupport: async () => {
        return { success: true, supported: isLocalFileAccessSupported() };
      }
    };

    const handler = handlers[message.action];
    
    if (!handler) {
      sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      return false;
    }

    handler()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message || 'Unknown error' });
      });

    return true;
  });
