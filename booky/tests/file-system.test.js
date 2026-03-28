import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { exportToLocalFile, importFromLocalFile, isLocalFileAccessSupported } from '../lib/file-system.js';

describe('file-system.js', () => {
  describe('isLocalFileAccessSupported()', () => {
    it('returns false when File System Access API is not available', () => {
      // Temporarily remove the APIs
      const originalShowSaveFilePicker = globalThis.window?.showSaveFilePicker;
      const originalShowOpenFilePicker = globalThis.window?.showOpenFilePicker;
      
      if (globalThis.window) {
        delete globalThis.window.showSaveFilePicker;
        delete globalThis.window.showOpenFilePicker;
      }
      
      assert.strictEqual(isLocalFileAccessSupported(), false);
      
      // Restore
      if (globalThis.window && originalShowSaveFilePicker) {
        globalThis.window.showSaveFilePicker = originalShowSaveFilePicker;
      }
      if (globalThis.window && originalShowOpenFilePicker) {
        globalThis.window.showOpenFilePicker = originalShowOpenFilePicker;
      }
    });
    
    it('returns true when File System Access API is available', () => {
      // Mock the APIs
      if (!globalThis.window) {
        globalThis.window = {};
      }
      globalThis.window.showSaveFilePicker = () => {};
      globalThis.window.showOpenFilePicker = () => {};
      
      assert.strictEqual(isLocalFileAccessSupported(), true);
    });
  });

  describe('exportToLocalFile()', () => {
    let mockFileHandle;
    let mockWritable;

    beforeEach(() => {
      mockWritable = {
        write: mock.fn(() => Promise.resolve()),
        close: mock.fn(() => Promise.resolve())
      };
      
      mockFileHandle = {
        createWritable: mock.fn(() => Promise.resolve(mockWritable))
      };
      
      globalThis.window = {
        showSaveFilePicker: mock.fn(() => Promise.resolve(mockFileHandle))
      };
    });

    afterEach(() => {
      delete globalThis.window;
    });

    it('successfully exports content to local file', async () => {
      const markdownContent = '# Bookmarks Bar\n\n- [Google](https://google.com)';
      const defaultFileName = 'test-bookmarks.md';
      
      const result = await exportToLocalFile(markdownContent, defaultFileName);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.error, undefined);
      
      // Verify showSaveFilePicker was called with correct options
      assert.strictEqual(globalThis.window.showSaveFilePicker.mock.callCount(), 1);
      const [options] = globalThis.window.showSaveFilePicker.mock.calls[0].arguments;
      assert.strictEqual(options.suggestedName, defaultFileName);
      assert.deepStrictEqual(options.types, [
        {
          description: 'Markdown Files',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.txt']
          }
        }
      ]);
      
      // Verify writable was created and content written
      assert.strictEqual(mockFileHandle.createWritable.mock.callCount(), 1);
      assert.strictEqual(mockWritable.write.mock.callCount(), 1);
      assert.strictEqual(mockWritable.write.mock.calls[0].arguments[0], markdownContent);
      assert.strictEqual(mockWritable.close.mock.callCount(), 1);
    });

    it('returns error when File System Access API is not available', async () => {
      delete globalThis.window.showSaveFilePicker;
      
      const result = await exportToLocalFile('test content');
      
      assert.strictEqual(result.success, false);
      assert(result.error.includes('File System Access API not supported'));
    });

    it('handles user cancellation gracefully', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      globalThis.window.showSaveFilePicker = mock.fn(() => Promise.reject(abortError));
      
      const result = await exportToLocalFile('test content');
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'File save cancelled');
    });

    it('handles other errors gracefully', async () => {
      const testError = new Error('Disk full');
      globalThis.window.showSaveFilePicker = mock.fn(() => Promise.reject(testError));
      
      const result = await exportToLocalFile('test content');
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Disk full');
    });
  });

  describe('importFromLocalFile()', () => {
    let mockFileHandle;
    let mockFile;

    beforeEach(() => {
      mockFile = {
        text: mock.fn(() => Promise.resolve('# Bookmarks Bar\n\n- [Google](https://google.com)'))
      };
      
      mockFileHandle = {
        getFile: mock.fn(() => Promise.resolve(mockFile))
      };
      
      globalThis.window = {
        showOpenFilePicker: mock.fn(() => Promise.resolve([mockFileHandle]))
      };
    });

    afterEach(() => {
      delete globalThis.window;
    });

    it('successfully imports content from local file', async () => {
      const result = await importFromLocalFile();
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content, '# Bookmarks Bar\n\n- [Google](https://google.com)');
      assert.strictEqual(result.error, undefined);
      
      // Verify showOpenFilePicker was called with correct options
      assert.strictEqual(globalThis.window.showOpenFilePicker.mock.callCount(), 1);
      const [options] = globalThis.window.showOpenFilePicker.mock.calls[0].arguments;
      assert.strictEqual(options.multiple, false);
      assert.deepStrictEqual(options.types, [
        {
          description: 'Markdown Files',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.txt']
          }
        }
      ]);
      
      // Verify file was read
      assert.strictEqual(mockFileHandle.getFile.mock.callCount(), 1);
      assert.strictEqual(mockFile.text.mock.callCount(), 1);
    });

    it('returns error when File System Access API is not available', async () => {
      delete globalThis.window.showOpenFilePicker;
      
      const result = await importFromLocalFile();
      
      assert.strictEqual(result.success, false);
      assert(result.error.includes('File System Access API not supported'));
    });

    it('handles user cancellation gracefully', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      globalThis.window.showOpenFilePicker = mock.fn(() => Promise.reject(abortError));
      
      const result = await importFromLocalFile();
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'File selection cancelled');
    });

    it('handles other errors gracefully', async () => {
      const testError = new Error('Permission denied');
      globalThis.window.showOpenFilePicker = mock.fn(() => Promise.reject(testError));
      
      const result = await importFromLocalFile();
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Permission denied');
    });
  });
});