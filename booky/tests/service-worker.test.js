import { test } from 'node:test';
import assert from 'node:assert';

const DEFAULT_FILENAME = 'chrome-bookmarks.md';

function createMockServiceWorkerDeps() {
  const state = {
    storedSettings: {
      driveFolderId: 'folder123',
      driveFolderName: 'My Bookmarks',
      bookmarksFilename: 'chrome-bookmarks.md'
    },
    authToken: 'valid-token',
    driveFolders: [
      { id: 'folder1', name: 'Folder 1' },
      { id: 'folder2', name: 'Folder 2' }
    ],
    driveFileId: null,
    driveFileContent: '# Bookmarks\n- [Link](https://example.com)',
    bookmarksTree: [{
      id: '0',
      title: '',
      children: [
        { id: '1', title: 'Bookmarks Bar', children: [] }
      ]
    }],
    createdItems: [],
    messages: [],
    shouldFailAuth: false,
    shouldFailDrive: false,
    shouldFailFindFile: false,
    shouldFailLocalExport: false,
    shouldFailLocalImport: false,
    localFileContent: null
  };
  
  const mockBookmarkApi = {
    getFullTree: async () => state.bookmarksTree,
    clearAllBookmarks: async () => {},
    createTree: async (parentId, nodes) => {
      let count = 0;
      for (const node of nodes) {
        state.createdItems.push({ ...node, parentId });
        count++;
        if (node.children) count += node.children.length;
      }
      return count;
    },
    replaceAllBookmarks: async (tree) => {
      state.createdItems = [...tree];
      return tree.length;
    }
  };
  
  const mockDriveApi = {
    getAuthToken: async () => {
      if (state.shouldFailAuth) throw new Error('Authentication failed');
      return state.authToken;
    },
    listFolders: async () => {
      if (state.shouldFailDrive) throw new Error('Drive error');
      return state.driveFolders;
    },
    findFile: async (token, folderId, filename) => {
      if (state.shouldFailFindFile) throw new Error('Find file error');
      return state.driveFileId;
    },
    readFile: async () => state.driveFileContent,
    writeFile: async () => 'newFileId'
  };
  
  const mockBookmarksToMd = {
    bookmarkTreeToMarkdown: (tree) => '# Bookmarks\n- [Link](https://example.com)'
  };
  
const mockMdToBookmarks = {
    markdownToBookmarkTree: (md) => {
      if (state.shouldFailParse) throw new Error('Parse error');
      return [{ title: 'Imported', children: [] }];
    }
  };

  const mockFileSystem = {
    exportToLocalFile: async (content) => {
      if (state.shouldFailLocalExport) throw new Error('Local export failed');
      state.localFileContent = content;
      return { success: true };
    },
    importFromLocalFile: async () => {
      if (state.shouldFailLocalImport) throw new Error('Local import failed');
      if (state.localFileContent === null) throw new Error('No file selected');
      return { success: true, content: state.localFileContent };
    },
    isLocalFileAccessSupported: () => true
  };

  return {
    state,
    mocks: {
      bookmarkApi: mockBookmarkApi,
      driveApi: mockDriveApi,
      bookmarksToMd: mockBookmarksToMd,
      mdToBookmarks: mockMdToBookmarks,
      fileSystem: mockFileSystem
    }
  };
}

async function createHandler(state, mocks) {
  async function getSettings() {
    return {
      driveFolderId: state.storedSettings.driveFolderId,
      driveFolderName: state.storedSettings.driveFolderName,
      bookmarksFilename: state.storedSettings.bookmarksFilename || DEFAULT_FILENAME
    };
  }
  
  async function saveSettings(settings) {
    state.storedSettings.driveFolderId = settings.folderId;
    state.storedSettings.driveFolderName = settings.folderName;
    state.storedSettings.bookmarksFilename = settings.filename || DEFAULT_FILENAME;
    return { success: true };
  }
  
  async function handleExport() {
    try {
      const settings = await getSettings();
      
      if (!settings.driveFolderId) {
        return { success: false, error: 'No folder configured' };
      }

      const tree = await mocks.bookmarkApi.getFullTree();
      const markdown = mocks.bookmarksToMd.bookmarkTreeToMarkdown(tree);
      
      const token = await mocks.driveApi.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication failed' };
      }

      await mocks.driveApi.writeFile(
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
      const tree = await mocks.bookmarkApi.getFullTree();
      const markdown = mocks.bookmarksToMd.bookmarkTreeToMarkdown(tree);
      
      const result = await mocks.fileSystem.exportToLocalFile(markdown);
      return result;
    } catch (error) {
      return { success: false, error: error.message || 'Local export failed' };
    }
  }

  async function handleImport() {
    try {
      const settings = await getSettings();
      
      if (!settings.driveFolderId) {
        return { success: false, error: 'No folder configured' };
      }

      const token = await mocks.driveApi.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication failed' };
      }

      const fileId = await mocks.driveApi.findFile(token, settings.driveFolderId, settings.bookmarksFilename);
      
      if (!fileId) {
        return { success: false, error: 'No bookmarks file found' };
      }

      const markdown = await mocks.driveApi.readFile(token, fileId);
      
      let tree;
      try {
        tree = mocks.mdToBookmarks.markdownToBookmarkTree(markdown);
      } catch (parseError) {
        return { success: false, error: `Parse error: ${parseError.message}` };
      }

      await mocks.bookmarkApi.replaceAllBookmarks(tree);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Import failed' };
    }
  }

  async function handleImportLocal() {
    try {
      const result = await mocks.fileSystem.importFromLocalFile();
      
      if (!result.success) {
        return result;
      }

      let tree;
      try {
        tree = mocks.mdToBookmarks.markdownToBookmarkTree(result.content);
      } catch (parseError) {
        return { success: false, error: `Parse error: ${parseError.message}` };
      }

      await mocks.bookmarkApi.replaceAllBookmarks(tree);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Local import failed' };
    }
  }

  async function handleListFolders() {
    try {
      const token = await mocks.driveApi.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication failed' };
      }

      const folders = await mocks.driveApi.listFolders(token);
      return { success: true, folders };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to list folders' };
    }
  }

  async function checkLocalFileSupport() {
    return { success: true, supported: mocks.fileSystem.isLocalFileAccessSupported() };
  }

  return {
    getSettings,
    saveSettings,
    handleExport,
    handleExportLocal,
    handleImport,
    handleImportLocal,
    handleListFolders,
    checkLocalFileSupport
  };
}

test('Export success', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleExport();
  
  assert.equal(result.success, true);
});

test('Export no folder configured', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.storedSettings.driveFolderId = null;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleExport();
  
  assert.equal(result.success, false);
  assert.equal(result.error, 'No folder configured');
});

test('Export auth failure', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.shouldFailAuth = true;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleExport();
  
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Authentication failed'));
});

test('Export Drive write failure', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const originalWriteFile = mocks.driveApi.writeFile;
  mocks.driveApi.writeFile = async () => { throw new Error('Drive quota exceeded'); };
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleExport();
  
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Drive quota exceeded'));
});

test('Import success', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.driveFileId = 'file123';
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleImport();
  
  assert.equal(result.success, true);
});

test('Import file not found', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.driveFileId = null;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleImport();
  
  assert.equal(result.success, false);
  assert.equal(result.error, 'No bookmarks file found');
});

test('Import parse failure', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.driveFileId = 'file123';
  state.shouldFailParse = true;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleImport();
  
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Parse error'));
});

test('listFolders', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleListFolders();
  
  assert.equal(result.success, true);
  assert.equal(result.folders.length, 2);
  assert.equal(result.folders[0].id, 'folder1');
  assert.equal(result.folders[1].id, 'folder2');
});

test('getSettings', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.getSettings();
  
  assert.equal(result.driveFolderId, 'folder123');
  assert.equal(result.driveFolderName, 'My Bookmarks');
  assert.equal(result.bookmarksFilename, 'chrome-bookmarks.md');
});

test('saveSettings', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.saveSettings({
    folderId: 'newFolder456',
    folderName: 'New Folder',
    filename: 'custom-bookmarks.md'
  });
  
  assert.equal(result.success, true);
  assert.equal(state.storedSettings.driveFolderId, 'newFolder456');
  assert.equal(state.storedSettings.driveFolderName, 'New Folder');
  assert.equal(state.storedSettings.bookmarksFilename, 'custom-bookmarks.md');
});

test('Export local success', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleExportLocal();
  
  assert.equal(result.success, true);
  assert.equal(state.localFileContent, '# Bookmarks\n- [Link](https://example.com)');
});

test('Export local failure', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.shouldFailLocalExport = true;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleExportLocal();
  
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Local export failed'));
});

test('Import local success', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.localFileContent = '# Bookmarks\n- [Link](https://example.com)';
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleImportLocal();
  
  assert.equal(result.success, true);
});

test('Import local failure - file system error', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.shouldFailLocalImport = true;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleImportLocal();
  
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Local import failed'));
});

test('Import local failure - parse error', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  state.localFileContent = '# Bookmarks\n- [Link](https://example.com)';
  state.shouldFailParse = true;
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.handleImportLocal();
  
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Parse error'));
});

test('Check local file support', async () => {
  const { state, mocks } = createMockServiceWorkerDeps();
  const handlers = await createHandler(state, mocks);
  
  const result = await handlers.checkLocalFileSupport();
  
  assert.equal(result.success, true);
  assert.equal(result.supported, true);
});
