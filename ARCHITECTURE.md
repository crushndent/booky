# Booky - Chrome Bookmarks <-> Markdown on Google Drive

## Overview

A Chrome extension that syncs bookmarks bidirectionally between Chrome and a Markdown file stored on Google Drive. Two core operations:

1. **Export**: Read all Chrome bookmarks, convert to Markdown, save to a user-specified Google Drive folder
2. **Import**: Read a Markdown bookmarks file from Google Drive, parse it, and replace all Chrome bookmarks

## Core Principles

- Minimal UI: popup with two buttons (Export / Import) and a folder picker
- No background service worker running continuously — only activate on user action
- Use Chrome's `chrome.bookmarks` API (full tree read/write)
- Use Google Drive API v3 via OAuth2 (the signed-in Chrome profile's Google account)
- The Markdown format is the single source of truth for structure — folders become headings, bookmarks become links

## Architecture

```
booky/
  manifest.json          # Manifest V3 extension config
  popup/
    popup.html           # Extension popup UI
    popup.css            # Popup styling
    popup.js             # Popup logic: button handlers, folder picker, status display
  background/
    service-worker.js    # Handles OAuth2 token, Drive API calls, bookmark read/write
  lib/
    bookmarks-to-md.js   # Convert Chrome bookmark tree -> Markdown string
    md-to-bookmarks.js   # Parse Markdown string -> bookmark tree structure
    drive-api.js          # Google Drive API wrapper (list folders, read file, write file)
    bookmark-api.js       # Chrome bookmarks API wrapper (get tree, clear all, create tree)
  icons/
    icon16.png
    icon48.png
    icon128.png
```

## Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Booky",
  "version": "1.0.0",
  "description": "Sync Chrome bookmarks to/from Markdown on Google Drive",
  "permissions": [
    "bookmarks",
    "identity",
    "storage"
  ],
  "oauth2": {
    "client_id": "<GOOGLE_CLOUD_CLIENT_ID>.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file"
    ]
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Key Manifest Notes

- **`identity` permission**: Required for `chrome.identity.getAuthToken()` which gives an OAuth2 token for the signed-in Chrome profile's Google account.
- **`drive.file` scope**: Only allows access to files the extension creates or the user explicitly opens. This is the narrowest Drive scope — no access to the user's entire Drive.
- **`storage` permission**: Stores the user's chosen Drive folder ID and the bookmarks filename.

## Markdown Format

The bookmark tree maps to Markdown headings and links:

```markdown
# Bookmarks Bar

- [Google](https://www.google.com)
- [GitHub](https://github.com)

## Development

- [MDN Web Docs](https://developer.mozilla.org)
- [Stack Overflow](https://stackoverflow.com)

### JavaScript

- [Node.js](https://nodejs.org)

# Other Bookmarks

- [Wikipedia](https://en.wikipedia.org)
```

### Conversion Rules

| Chrome Bookmark Tree | Markdown |
|---|---|
| Root node "Bookmarks Bar" | `# Bookmarks Bar` |
| Root node "Other Bookmarks" | `# Other Bookmarks` |
| Folder at depth N (relative to root) | Heading level N+1 (`##`, `###`, etc.) |
| Bookmark (url + title) | `- [title](url)` |
| Folder depth > 5 | Cap at `######` (H6), deeper folders stay at H6 |

### Edge Cases

- Bookmark titles containing `[`, `]`, `(`, `)` must be escaped: `\[`, `\]`, `\(`, `\)`
- Empty folders produce a heading with no list items beneath
- The "Mobile Bookmarks" root folder is exported but clearly labeled
- Markdown file is always named `chrome-bookmarks.md` (configurable via settings)

## Module Specifications

### `lib/bookmarks-to-md.js`

**Function**: `bookmarkTreeToMarkdown(nodes) -> string`

- Input: Array of `BookmarkTreeNode` from `chrome.bookmarks.getTree()`
- Output: UTF-8 Markdown string
- Recursively walk the tree; folders become headings, URLs become list items
- Top-level Chrome roots ("Bookmarks Bar", "Other bookmarks", "Mobile bookmarks") become H1
- Skip the synthetic root node (id "0") — iterate its children directly

### `lib/md-to-bookmarks.js`

**Function**: `markdownToBookmarkTree(mdString) -> Array<BookmarkNode>`

- Input: Markdown string
- Output: Array of objects matching the structure needed by `chrome.bookmarks.create()`
- Parse headings to reconstruct folder hierarchy (H1 = root folder, H2 = subfolder, etc.)
- Parse `- [title](url)` lines as bookmarks
- Return structure: `{ title, url?, children? }` — url present = bookmark, children present = folder

### `lib/drive-api.js`

**Functions**:

| Function | Purpose |
|---|---|
| `getAuthToken()` | Call `chrome.identity.getAuthToken({interactive: true})`, return token |
| `listFolders(token)` | GET Drive API v3 `files?q=mimeType='application/vnd.google-apps.folder'` — for folder picker |
| `findFile(token, folderId, filename)` | Search for existing bookmarks file in target folder |
| `readFile(token, fileId)` | GET file content as text |
| `writeFile(token, folderId, filename, content, existingFileId?)` | Create or update (PATCH) the markdown file |

All functions take the OAuth token as first argument. Use `fetch()` against `https://www.googleapis.com/drive/v3/files` and `https://www.googleapis.com/upload/drive/v3/files`.

### `lib/bookmark-api.js`

**Functions**:

| Function | Purpose |
|---|---|
| `getFullTree()` | `chrome.bookmarks.getTree()` — returns entire bookmark tree |
| `clearAllBookmarks()` | Remove all children from each root folder (Bookmarks Bar, Other Bookmarks). Does NOT delete root folders (Chrome won't allow it). |
| `createTree(parentId, nodes)` | Recursively create folders and bookmarks from parsed tree. Uses `chrome.bookmarks.create()`. |
| `replaceAllBookmarks(tree)` | Calls `clearAllBookmarks()` then `createTree()` for each root |

### `background/service-worker.js`

Listens for messages from popup:

| Message | Action |
|---|---|
| `{ action: "export" }` | Get tree -> convert to MD -> write to Drive |
| `{ action: "import" }` | Read MD from Drive -> parse -> replace bookmarks |
| `{ action: "listFolders" }` | Return Drive folder list for picker |
| `{ action: "getSettings" }` | Return saved folder ID and filename from `chrome.storage.sync` |
| `{ action: "saveSettings", folderId, filename }` | Save to `chrome.storage.sync` |

Communication via `chrome.runtime.sendMessage()` / `chrome.runtime.onMessage`.

### `popup/popup.js`

UI flow:

1. On open: load settings (saved folder ID, filename) from service worker
2. Show current target folder name (or "Not configured")
3. **Choose Folder** button: fetch folder list, show simple dropdown/list, save selection
4. **Export to Drive** button: send export message, show spinner, show success/error
5. **Import from Drive** button: send import message, show confirmation dialog ("This will replace all bookmarks. Continue?"), show spinner, show success/error

## Data Flow

### Export Flow

```
User clicks "Export"
  -> popup.js sends { action: "export" } to service worker
  -> service-worker.js:
       1. getAuthToken()
       2. chrome.bookmarks.getTree()
       3. bookmarkTreeToMarkdown(tree)
       4. Load folderId from chrome.storage.sync
       5. findFile(token, folderId, filename)
       6. writeFile(token, folderId, filename, markdown, existingFileId?)
       7. Return { success: true } to popup
  -> popup.js shows "Exported successfully"
```

### Import Flow

```
User clicks "Import" -> confirms overwrite dialog
  -> popup.js sends { action: "import" } to service worker
  -> service-worker.js:
       1. getAuthToken()
       2. Load folderId from chrome.storage.sync
       3. findFile(token, folderId, filename)
       4. readFile(token, fileId)
       5. markdownToBookmarkTree(markdown)
       6. clearAllBookmarks()
       7. createTree() for each root
       8. Return { success: true, count } to popup
  -> popup.js shows "Imported N bookmarks"
```

## Settings Stored in `chrome.storage.sync`

| Key | Type | Default | Description |
|---|---|---|---|
| `driveFolderId` | string | `null` | Google Drive folder ID for bookmarks file |
| `driveFolderName` | string | `null` | Display name of chosen folder |
| `bookmarksFilename` | string | `"chrome-bookmarks.md"` | Name of the markdown file on Drive |

## Google Cloud Setup (Prerequisites)

Before the extension works, a Google Cloud project must be configured:

1. Create project in Google Cloud Console
2. Enable Google Drive API
3. Create OAuth 2.0 Client ID (type: Chrome Extension)
4. Set the extension's ID in the OAuth client config
5. Put the client ID in `manifest.json` under `oauth2.client_id`

## Error Handling

- **No auth token**: Show "Please sign in to Chrome with a Google account"
- **No folder configured**: Show "Please choose a Drive folder first"
- **File not found on import**: Show "No bookmarks file found in [folder name]"
- **Drive API errors**: Show the error message from the API response
- **Bookmark creation failures**: Log individual failures, continue with remaining bookmarks, report count at end

## Security Considerations

- Use `drive.file` scope (not `drive`) — extension can only access files it created
- Never store OAuth tokens — always request via `chrome.identity.getAuthToken()`
- Sanitize bookmark titles/URLs when parsing markdown to prevent injection
- The import confirmation dialog prevents accidental overwrites

## Implementation Order

1. **Phase 1**: `manifest.json` + `bookmarks-to-md.js` + `md-to-bookmarks.js` (pure functions, testable without Chrome APIs)
2. **Phase 2**: `drive-api.js` + `bookmark-api.js` (API wrappers)
3. **Phase 3**: `service-worker.js` (orchestration)
4. **Phase 4**: `popup/` (UI)
5. **Phase 5**: Integration testing, icons, polish
