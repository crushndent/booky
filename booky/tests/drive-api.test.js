import { test } from 'node:test';
import assert from 'node:assert';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

async function listFolders(token) {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
  const url = `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)&pageSize=1000`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list folders: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

async function findFile(token, folderId, filename) {
  const escapedFilename = filename.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = encodeURIComponent(`name='${escapedFilename}' and '${folderId}' in parents and trashed=false`);
  const url = `${DRIVE_API_BASE}/files?q=${query}&fields=files(id)`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to find file: ${error}`);
  }

  const data = await response.json();
  
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  return null;
}

async function readFile(token, fileId) {
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read file: ${error}`);
  }

  return response.text();
}

async function writeFile(token, folderId, filename, content, existingFileId) {
  if (existingFileId) {
    const url = `${DRIVE_UPLOAD_BASE}/${existingFileId}?uploadType=media`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/markdown'
      },
      body: content
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update file: ${error}`);
    }

    const data = await response.json();
    return data.id;
  } else {
    const metadata = {
      name: filename,
      parents: [folderId],
      mimeType: 'text/markdown'
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([content], { type: 'text/markdown' }));

    const url = `${DRIVE_UPLOAD_BASE}?uploadType=multipart`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create file: ${error}`);
    }

    const data = await response.json();
    return data.id;
  }
}

test('listFolders returns folders', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({
        files: [
          { id: 'folder1', name: 'My Folder' },
          { id: 'folder2', name: 'Another Folder' }
        ]
      })
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const folders = await listFolders('test-token');
  
  assert.equal(folders.length, 2);
  assert.equal(folders[0].id, 'folder1');
  assert.equal(folders[0].name, 'My Folder');
  assert.equal(folders[1].id, 'folder2');
  assert.equal(folders[1].name, 'Another Folder');
});

test('listFolders empty', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({ files: [] })
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const folders = await listFolders('test-token');
  
  assert.deepEqual(folders, []);
});

test('findFile locates existing file', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({
        files: [{ id: 'file123' }]
      })
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const fileId = await findFile('test-token', 'folder123', 'bookmarks.md');
  
  assert.equal(fileId, 'file123');
});

test('findFile no match', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({ files: [] })
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const fileId = await findFile('test-token', 'folder123', 'nonexistent.md');
  
  assert.equal(fileId, null);
});

test('readFile returns content', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: true,
      text: async () => '# Bookmarks\n- [Link](https://example.com)'
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const content = await readFile('test-token', 'file123');
  
  assert.equal(content, '# Bookmarks\n- [Link](https://example.com)');
});

test('writeFile creates new file', async () => {
  let capturedUrl = null;
  let capturedMethod = null;
  let capturedBody = null;
  
  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedMethod = options.method;
    capturedBody = options.body;
    return {
      ok: true,
      json: async () => ({ id: 'newFile123' })
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const fileId = await writeFile('test-token', 'folder123', 'bookmarks.md', '# Content');
  
  assert.equal(fileId, 'newFile123');
  assert.ok(capturedUrl.includes('uploadType=multipart'));
  assert.equal(capturedMethod, 'POST');
  assert.ok(capturedBody instanceof FormData);
});

test('writeFile updates existing', async () => {
  let capturedUrl = null;
  let capturedMethod = null;
  
  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedMethod = options.method;
    return {
      ok: true,
      json: async () => ({ id: 'existingFile123' })
    };
  };
  
  globalThis.fetch = mockFetch;
  
  const fileId = await writeFile('test-token', 'folder123', 'bookmarks.md', '# Updated', 'existingFile123');
  
  assert.equal(fileId, 'existingFile123');
  assert.ok(capturedUrl.includes('existingFile123'));
  assert.equal(capturedMethod, 'PATCH');
});

test('API error 401', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: false,
      status: 401,
      text: async () => '{"error": {"message": "Unauthorized"}}'
    };
  };
  
  globalThis.fetch = mockFetch;
  
  await assert.rejects(
    async () => await listFolders('invalid-token'),
    /Failed to list folders/
  );
});

test('API error 403', async () => {
  const mockFetch = async (url, options) => {
    return {
      ok: false,
      status: 403,
      text: async () => '{"error": {"message": "Permission denied"}}'
    };
  };
  
  globalThis.fetch = mockFetch;
  
  await assert.rejects(
    async () => await readFile('forbidden-token', 'file123'),
    /Failed to read file/
  );
});

test('Network error', async () => {
  const mockFetch = async (url, options) => {
    throw new Error('Network error');
  };
  
  globalThis.fetch = mockFetch;
  
  await assert.rejects(
    async () => await listFolders('test-token'),
    /Network error/
  );
});
