const folderDisplay = document.getElementById('folderDisplay');
const chooseFolderBtn = document.getElementById('chooseFolderBtn');
const folderPicker = document.getElementById('folderPicker');
const folderList = document.getElementById('folderList');
const closePickerBtn = document.getElementById('closePickerBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const exportLocalBtn = document.getElementById('exportLocalBtn');
const importLocalBtn = document.getElementById('importLocalBtn');
const statusMessage = document.getElementById('statusMessage');
const spinnerOverlay = document.getElementById('spinnerOverlay');
const spinnerText = document.getElementById('spinnerText');

let currentSettings = null;

function showSpinner(text = 'Processing...') {
  spinnerText.textContent = text;
  spinnerOverlay.hidden = false;
}

function hideSpinner() {
  spinnerOverlay.hidden = true;
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
}

function disableButtons() {
  chooseFolderBtn.disabled = true;
  exportBtn.disabled = true;
  importBtn.disabled = true;
  exportLocalBtn.disabled = true;
  importLocalBtn.disabled = true;
}

function enableButtons() {
  chooseFolderBtn.disabled = false;
  exportBtn.disabled = false;
  importBtn.disabled = false;
  exportLocalBtn.disabled = false;
  importLocalBtn.disabled = false;
}

function updateFolderDisplay(settings) {
  if (settings && settings.driveFolderName) {
    folderDisplay.textContent = settings.driveFolderName;
    folderDisplay.classList.remove('not-configured');
  } else {
    folderDisplay.textContent = 'Not configured';
    folderDisplay.classList.add('not-configured');
  }
}

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response && response.settings) {
      currentSettings = response.settings;
      updateFolderDisplay(currentSettings);
    }
  } catch (error) {
    showStatus('Failed to load settings', true);
  }
}

async function loadFolders() {
  folderList.innerHTML = '<div class="folder-loading">Loading folders...</div>';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'listFolders' });
    
    if (response && response.success && response.folders) {
      if (response.folders.length === 0) {
        folderList.innerHTML = '<div class="folder-empty">No folders found</div>';
        return;
      }
      
      folderList.innerHTML = '';
      response.folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.dataset.id = folder.id;
        item.dataset.name = folder.name;
        item.textContent = folder.name;
        item.addEventListener('click', () => selectFolder(folder.id, folder.name));
        folderList.appendChild(item);
      });
    } else {
      const errorMsg = response?.error || 'Failed to load folders';
      folderList.innerHTML = `<div class="folder-error">${errorMsg}</div>`;
    }
  } catch (error) {
    folderList.innerHTML = '<div class="folder-error">Failed to load folders</div>';
  }
}

async function selectFolder(folderId, folderName) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveSettings',
      folderId: folderId,
      folderName: folderName
    });
    
    if (response && response.success) {
      currentSettings = {
        driveFolderId: folderId,
        driveFolderName: folderName
      };
      updateFolderDisplay(currentSettings);
      hideFolderPicker();
      showStatus(`Folder set to "${folderName}"`);
      setTimeout(hideStatus, 2000);
    } else {
      showStatus(response?.error || 'Failed to save folder', true);
    }
  } catch (error) {
    showStatus('Failed to save folder selection', true);
  }
}

function showFolderPicker() {
  folderPicker.hidden = false;
  loadFolders();
}

function hideFolderPicker() {
  folderPicker.hidden = true;
}

async function handleExport() {
  if (!currentSettings || !currentSettings.driveFolderId) {
    showStatus('Please choose a Drive folder first', true);
    return;
  }
  
  hideStatus();
  showSpinner('Exporting bookmarks to Drive...');
  disableButtons();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'export' });
    
    hideSpinner();
    enableButtons();
    
    if (response && response.success) {
      showStatus('Bookmarks exported successfully to Drive');
    } else {
      showStatus(response?.error || 'Export failed', true);
    }
  } catch (error) {
    hideSpinner();
    enableButtons();
    showStatus('Export failed: ' + error.message, true);
  }
}

async function handleExportLocal() {
  hideStatus();
  showSpinner('Exporting bookmarks to local file...');
  disableButtons();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'exportLocal' });
    
    hideSpinner();
    enableButtons();
    
    if (response && response.success) {
      showStatus('Bookmarks exported successfully to local file');
    } else {
      showStatus(response?.error || 'Export failed: ' + (response?.error || 'Unknown error'), true);
    }
  } catch (error) {
    hideSpinner();
    enableButtons();
    showStatus('Export failed: ' + error.message, true);
  }
}

async function handleImportLocal() {
  const confirmed = confirm('This will replace all your Chrome bookmarks with the content from the local file. Continue?');
  if (!confirmed) return;
  
  hideStatus();
  showSpinner('Importing bookmarks from local file...');
  disableButtons();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'importLocal' });
    
    hideSpinner();
    enableButtons();
    
    if (response && response.success) {
      showStatus('Bookmarks imported successfully from local file');
    } else {
      showStatus(response?.error || 'Import failed', true);
    }
  } catch (error) {
    hideSpinner();
    enableButtons();
    showStatus('Import failed: ' + error.message, true);
  }
}

async function handleImport() {
  if (!currentSettings || !currentSettings.driveFolderId) {
    showStatus('Please choose a Drive folder first', true);
    return;
  }
  
  const confirmed = confirm('This will replace all your Chrome bookmarks with the content from Drive. Continue?');
  if (!confirmed) return;
  
  hideStatus();
  showSpinner('Importing bookmarks...');
  disableButtons();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'import' });
    
    hideSpinner();
    enableButtons();
    
    if (response && response.success) {
      const count = response.count || 0;
      showStatus(`Imported ${count} bookmark${count !== 1 ? 's' : ''} successfully`);
    } else {
      showStatus(response?.error || 'Import failed', true);
    }
  } catch (error) {
    hideSpinner();
    enableButtons();
    showStatus('Import failed: ' + error.message, true);
  }
}

chooseFolderBtn.addEventListener('click', showFolderPicker);
closePickerBtn.addEventListener('click', hideFolderPicker);
exportBtn.addEventListener('click', handleExport);
importBtn.addEventListener('click', handleImport);
exportLocalBtn.addEventListener('click', handleExportLocal);
importLocalBtn.addEventListener('click', handleImportLocal);

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  
  // Check if local file access is supported
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkLocalFileSupport' });
    if (response && response.success && !response.supported) {
      exportLocalBtn.disabled = true;
      importLocalBtn.disabled = true;
      exportLocalBtn.title = 'Local file access not supported in this browser';
      importLocalBtn.title = 'Local file access not supported in this browser';
    }
  } catch (error) {
    // Silently fail - buttons will still work if API is available
  }
});
