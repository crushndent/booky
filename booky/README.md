# Booky - Chrome Bookmarks ↔ Markdown on Google Drive

A Chrome extension that syncs bookmarks bidirectionally between Chrome and a Markdown file stored on Google Drive.

## Features

- **Export**: Read all Chrome bookmarks, convert to Markdown, save to Google Drive
- **Import**: Read a Markdown bookmarks file from Google Drive, parse it, and replace all Chrome bookmarks
- **Minimal UI**: Popup with Export/Import buttons and a folder picker
- **Secure**: Uses `drive.file` scope - only accesses files the extension creates

## Prerequisites

- Node.js v18+ (for running tests)
- Chrome browser
- Google Cloud project with Drive API enabled

## Project Structure

```
booky/
├── manifest.json          # Manifest V3 extension config
├── background/
│   └── service-worker.js  # OAuth2, Drive API, bookmark operations
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Styling
│   └── popup.js           # UI logic
├── lib/
│   ├── bookmarks-to-md.js # Convert bookmark tree → Markdown
│   ├── md-to-bookmarks.js # Parse Markdown → bookmark tree
│   ├── drive-api.js       # Google Drive API wrapper
│   └── bookmark-api.js    # Chrome bookmarks API wrapper
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── tests/
    ├── run.js             # Test runner
    ├── fixtures/          # Test data files
    └── *.test.js          # Test suites
```

## Testing

### Run All Tests

```bash
cd booky
node tests/run.js
```

### Run Specific Tests

```bash
# Run only tests matching "md"
node tests/run.js --filter md

# Run only roundtrip tests
node tests/run.js --filter roundtrip

# Run only drive-api tests
node tests/run.js --filter drive
```

### Test Coverage

The test suite includes:

- **Phase 1**: Conversion module tests (pure functions, no Chrome APIs)
  - `bookmarks-to-md.test.js` - 20 tests for export conversion
  - `md-to-bookmarks.test.js` - 19 tests for import parsing
  - `roundtrip.test.js` - 7 tests for export→import fidelity

- **Phase 2**: API wrapper tests (mocked Chrome/Fetch APIs)
  - `drive-api.test.js` - 10 tests for Google Drive operations
  - `bookmark-api.test.js` - 7 tests for Chrome bookmark operations

- **Phase 3**: Service worker tests (mocked everything)
  - `service-worker.test.js` - 10 tests for message handling

### Expected Output

```
# tests 73
# pass 73
# fail 0
```

## Deployment

### 1. Configure Google Cloud Project

Before the extension can work, you need to set up a Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Select "Chrome Extension" as the application type
   - Enter your extension's ID (see step 2 below)
   - Click "Create"
5. Copy the **Client ID** generated

### 2. Update manifest.json

Edit `manifest.json` and replace `YOUR_CLIENT_ID` with your actual Google Cloud Client ID:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

### 3. Load Extension in Chrome (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `booky/` directory
5. Note the **Extension ID** shown under the extension name

### 4. Update OAuth Client with Extension ID

1. Return to Google Cloud Console → "Credentials"
2. Edit your OAuth 2.0 client ID
3. Add your extension ID to the "Application ID" field
4. Save

### 5. Test the Extension

1. Click the Booky icon in Chrome's toolbar
2. Click **Choose Folder** to select a Google Drive folder
3. Sign in with your Google account when prompted
4. Select a folder from your Drive
5. Click **Export to Drive** to save your bookmarks
6. Verify the `chrome-bookmarks.md` file appears in your Drive

### Production Deployment (Chrome Web Store)

1. Create a ZIP file of the extension:
   ```bash
   cd booky
   zip -r ../booky-extension.zip . -x "tests/*" -x "*.test.js" -x "fixtures/*"
   ```

2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
3. Pay the one-time $5 developer fee (if not already done)
4. Click "Add new item"
5. Upload the ZIP file
6. Fill in the required store listing information:
   - Name: Booky
   - Short description: Sync Chrome bookmarks to/from Markdown on Google Drive
   - Detailed description: (use the Features section above)
   - Category: Productivity
   - Screenshots: Capture the popup UI
7. Submit for review

## Git Workflow

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd booky

# Verify you're on the correct branch
git branch
```

### Making Changes

```bash
# Check current status
git status

# View staged and unstaged changes
git diff
git diff --staged

# Stage your changes
git add .

# Or stage specific files
git add lib/bookmarks-to-md.js
```

### Committing Changes

```bash
# Create a commit with a descriptive message
git commit -m "Add support for nested folders in bookmark export"

# View recent commits
git log --oneline -5
```

### Pushing to Remote

```bash
# Push to the remote repository
git push origin main

# If pushing a new branch for the first time
git push -u origin feature/my-new-feature
```

### Branch Workflow

```bash
# Create a new feature branch
git checkout -b feature/export-improvements

# Make changes and commit
git add .
git commit -m "Improve export performance for large bookmark collections"

# Push the branch
git push -u origin feature/export-improvements

# Create a pull request (if using GitHub/GitLab)
# Then merge after review

# Switch back to main and pull latest
git checkout main
git pull origin main
```

### Useful Commands

```bash
# View commit history with graph
git log --oneline --graph -10

# Undo uncommitted changes
git checkout -- <file>

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Stash changes temporarily
git stash
git stash pop
```

## Markdown Format

The bookmark tree maps to Markdown as follows:

```markdown
# Bookmarks Bar

- [Google](https://www.google.com)
- [GitHub](https://github.com)

## Development

- [MDN Web Docs](https://developer.mozilla.org)

# Other Bookmarks

- [Wikipedia](https://en.wikipedia.org)
```

### Conversion Rules

| Chrome Bookmark Tree | Markdown |
|---------------------|----------|
| Root "Bookmarks Bar" | `# Bookmarks Bar` |
| Root "Other Bookmarks" | `# Other Bookmarks` |
| Folder at depth N | Heading level N+1 |
| Bookmark | `- [title](url)` |
| Depth > 5 | Capped at `######` (H6) |

## Troubleshooting

### "Please sign in to Chrome with a Google account"
- Ensure you're signed into Chrome with a Google account
- Go to Chrome Settings → "You and Google" → Sign in

### "Please choose a Drive folder first"
- Click "Choose Folder" and select a folder before exporting/importing

### "No bookmarks file found in [folder name]"
- The selected folder doesn't contain `chrome-bookmarks.md`
- Export your bookmarks first to create the file

### OAuth errors
- Verify your Google Cloud Client ID is correct in `manifest.json`
- Ensure the extension ID matches what's configured in Google Cloud Console
- Check that Drive API is enabled in your Google Cloud project

### Tests failing
- Ensure you're using Node.js v18+
- Run `node tests/run.js` from the `booky/` directory
- Check for any error messages in the test output

## License

MIT License
