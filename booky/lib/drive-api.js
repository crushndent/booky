const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Gets OAuth2 auth token using chrome.identity
 * @returns {Promise<string>} Auth token
 */
export async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!token) {
        reject(new Error('Failed to obtain auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Lists folders in Google Drive
 * @param {string} token - OAuth token
 * @returns {Promise<Array<{id: string, name: string}>>} Array of folders
 */
export async function listFolders(token) {
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

/**
 * Finds a file by name in a folder
 * @param {string} token - OAuth token
 * @param {string} folderId - Parent folder ID
 * @param {string} filename - File name to search for
 * @returns {Promise<string|null>} File ID or null if not found
 */
export async function findFile(token, folderId, filename) {
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

/**
 * Reads file content from Drive
 * @param {string} token - OAuth token
 * @param {string} fileId - File ID
 * @returns {Promise<string>} File content as text
 */
export async function readFile(token, fileId) {
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

/**
 * Writes content to Drive (create or update)
 * @param {string} token - OAuth token
 * @param {string} folderId - Parent folder ID
 * @param {string} filename - File name
 * @param {string} content - File content
 * @param {string} [existingFileId] - Existing file ID for update
 * @returns {Promise<string>} File ID
 */
export async function writeFile(token, folderId, filename, content, existingFileId) {
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
