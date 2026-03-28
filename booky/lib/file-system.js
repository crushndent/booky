/**
 * Local file system operations using the File System Access API
 */

/**
 * Export bookmarks to a local file
 * @param {string} markdownContent - The markdown content to save
 * @param {string} defaultFileName - Default filename to suggest
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportToLocalFile(markdownContent, defaultFileName = 'chrome-bookmarks.md') {
  try {
    // Check if File System Access API is available
    if (typeof window === 'undefined' || !('showSaveFilePicker' in window)) {
      return {
        success: false,
        error: 'File System Access API not supported in this browser. Try using Chrome 86 or later.'
      };
    }

    // Show file picker
    const options = {
      suggestedName: defaultFileName,
      types: [
        {
          description: 'Markdown Files',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.txt']
          }
        }
      ]
    };

    const fileHandle = await window.showSaveFilePicker(options);
    
    // Create a writable stream
    const writable = await fileHandle.createWritable();
    
    // Write the content
    await writable.write(markdownContent);
    await writable.close();
    
    return { success: true };
  } catch (error) {
    // User cancelled the file picker
    if (error.name === 'AbortError') {
      return { success: false, error: 'File save cancelled' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to save file'
    };
  }
}

/**
 * Import bookmarks from a local file
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function importFromLocalFile() {
  try {
    // Check if File System Access API is available
    if (typeof window === 'undefined' || !('showOpenFilePicker' in window)) {
      return {
        success: false,
        error: 'File System Access API not supported in this browser. Try using Chrome 86 or later.'
      };
    }

    // Show file picker
    const options = {
      types: [
        {
          description: 'Markdown Files',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.txt']
          }
        }
      ],
      multiple: false
    };

    const [fileHandle] = await window.showOpenFilePicker(options);
    const file = await fileHandle.getFile();
    
    // Read the file content
    const content = await file.text();
    
    return { success: true, content };
  } catch (error) {
    // User cancelled the file picker
    if (error.name === 'AbortError') {
      return { success: false, error: 'File selection cancelled' };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to read file'
    };
  }
}

/**
 * Check if local file operations are supported in the current context
 * @returns {boolean}
 */
export function isLocalFileAccessSupported() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}