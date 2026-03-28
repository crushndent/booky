# Booky - Test Plan

## Test Framework

- **Unit tests**: Plain JavaScript with a lightweight test runner (no build step)
- **Test runner**: Node.js with a minimal harness (`tests/run.js`) using `node:assert` and `node:test`
- **No browser required** for Phase 1 tests — the conversion modules are pure functions
- **Chrome API mocks** for Phase 2+ tests

## File Structure

```
tests/
  run.js                       # Test runner entry point
  fixtures/
    simple-bookmarks.json      # Minimal bookmark tree (3 bookmarks, 1 folder)
    complex-bookmarks.json     # Deep nesting, special chars, empty folders
    edge-case-bookmarks.json   # Max depth, unicode titles, long URLs
    simple-bookmarks.md        # Expected MD output for simple-bookmarks.json
    complex-bookmarks.md       # Expected MD output for complex-bookmarks.json
    malformed.md               # Invalid/broken markdown for error handling tests
  bookmarks-to-md.test.js      # Tests for bookmarks-to-md.js
  md-to-bookmarks.test.js      # Tests for md-to-bookmarks.js
  roundtrip.test.js            # Export -> Import roundtrip fidelity tests
  drive-api.test.js            # Tests for drive-api.js (mocked fetch)
  bookmark-api.test.js         # Tests for bookmark-api.js (mocked chrome.bookmarks)
  service-worker.test.js       # Tests for message handling orchestration
```

## Running Tests

```bash
cd booky
node tests/run.js              # Run all tests
node tests/run.js --filter md  # Run only tests matching "md"
```

---

## Phase 1: Conversion Module Tests (Pure Functions, No Chrome APIs)

### `bookmarks-to-md.test.js`

#### Basic Conversion

| # | Test | Input | Expected Output |
|---|---|---|---|
| 1 | Empty tree | `[{id:"0", title:"", children:[]}]` | Empty string |
| 2 | Single bookmark | Tree with one bookmark under Bookmarks Bar | `# Bookmarks Bar\n\n- [Title](https://url)\n` |
| 3 | Single folder with bookmarks | Folder "Dev" with 2 bookmarks | `# Bookmarks Bar\n\n## Dev\n\n- [Link1](url1)\n- [Link2](url2)\n` |
| 4 | Multiple root folders | Bookmarks Bar + Other Bookmarks both populated | Two H1 sections |
| 5 | Fixture: simple | `simple-bookmarks.json` | Match `simple-bookmarks.md` exactly |
| 6 | Fixture: complex | `complex-bookmarks.json` | Match `complex-bookmarks.md` exactly |

#### Nesting Depth

| # | Test | Input | Expected |
|---|---|---|---|
| 7 | Depth 1 subfolder | Folder inside root | `##` heading |
| 8 | Depth 5 subfolder | 5 levels deep | `######` heading (H6) |
| 9 | Depth 6+ subfolder | 7 levels deep | Still `######` (capped at H6) |
| 10 | Mixed depths | Bookmarks at various levels | Correct heading levels throughout |

#### Special Characters

| # | Test | Input | Expected |
|---|---|---|---|
| 11 | Brackets in title | `[React] Docs` | `- [\[React\] Docs](url)` |
| 12 | Parentheses in title | `Foo (bar)` | `- [Foo \(bar\)](url)` |
| 13 | Parentheses in URL | `https://en.wikipedia.org/wiki/Foo_(bar)` | URL preserved with encoded parens |
| 14 | Unicode title | `日本語ブックマーク` | Passed through as-is |
| 15 | Empty title | Bookmark with `title: ""` | `- [](url)` |
| 16 | Pipe in title | `A | B` | `- [A \| B](url)` or passed through (pipes are safe in link text) |

#### Edge Cases

| # | Test | Input | Expected |
|---|---|---|---|
| 17 | Empty folder | Folder with no children | Heading with no list items |
| 18 | Folder with only subfolders | No direct bookmark children | Heading, then sub-headings |
| 19 | Mobile Bookmarks root | Third root node | `# Mobile Bookmarks` section |
| 20 | Bookmark with no URL | `{title: "separator", url: undefined}` | Skipped or rendered as text |

### `md-to-bookmarks.test.js`

#### Basic Parsing

| # | Test | Input | Expected |
|---|---|---|---|
| 1 | Empty string | `""` | Empty array |
| 2 | Single H1 + bookmark | `# Bookmarks Bar\n\n- [G](https://g.com)\n` | `[{title:"Bookmarks Bar", children:[{title:"G", url:"https://g.com"}]}]` |
| 3 | Nested folders | H1 > H2 > bookmark | Correct parent-child nesting |
| 4 | Multiple roots | Two H1 sections | Two root-level objects |
| 5 | Fixture: simple | `simple-bookmarks.md` | Structure matches `simple-bookmarks.json` |

#### Heading Level Mapping

| # | Test | Input | Expected |
|---|---|---|---|
| 6 | H1 = root folder | `# Root` | Top-level folder |
| 7 | H2 = subfolder of H1 | `# Root\n\n## Sub` | Sub is child of Root |
| 8 | H3 after H1 (skipping H2) | `# Root\n\n### Deep` | Deep is child of Root (tolerant parsing) |
| 9 | H2 after H3 (going back up) | `### Deep\n\n## Sibling` | Sibling is child of most recent H1, not Deep |

#### Link Parsing

| # | Test | Input | Expected |
|---|---|---|---|
| 10 | Standard link | `- [Title](https://url)` | `{title:"Title", url:"https://url"}` |
| 11 | Escaped brackets | `- [\[React\]](url)` | `{title:"[React]", url:"url"}` |
| 12 | URL with parens | `- [Wiki](https://en.wikipedia.org/wiki/Foo_(bar))` | Correct URL extraction |
| 13 | No URL, just text | `- Plain text line` | Skipped (not a bookmark) |
| 14 | Multiple links on one line | `- [A](url1) and [B](url2)` | Only first link extracted |

#### Malformed Input

| # | Test | Input | Expected |
|---|---|---|---|
| 15 | No headings, just links | `- [A](url)` | Links placed under a default root |
| 16 | Broken link syntax | `- [Title(url)` | Skipped, no crash |
| 17 | Empty lines between items | Extra blank lines | Ignored, parsing continues |
| 18 | Non-bookmark markdown | Paragraphs, code blocks, etc. | Ignored gracefully |
| 19 | Heading with no following content | `# Empty\n\n# Next` | Empty folder created for "Empty" |

### `roundtrip.test.js`

These tests verify that `export -> import` preserves bookmark structure.

| # | Test | Description |
|---|---|---|
| 1 | Simple roundtrip | Export simple tree -> parse MD -> compare to original tree (titles + URLs match) |
| 2 | Complex roundtrip | Export complex tree (5 levels, 50+ bookmarks) -> parse -> compare |
| 3 | Special chars roundtrip | Titles with brackets/parens survive export -> import |
| 4 | Empty folders roundtrip | Empty folders preserved through cycle |
| 5 | Order preserved | Bookmark order within folders is maintained |
| 6 | Unicode roundtrip | Unicode titles survive the cycle |

**Comparison logic**: Recursively compare tree structures. Ignore `id`, `dateAdded`, `dateGroupModified` — only compare `title`, `url`, and `children` structure.

---

## Phase 2: API Wrapper Tests (Mocked Chrome/Fetch APIs)

### `drive-api.test.js`

Mock `globalThis.fetch` for all tests.

| # | Test | Mock Response | Expected |
|---|---|---|---|
| 1 | listFolders returns folders | `{files: [{id:"abc", name:"Bookmarks"}]}` | Returns array of `{id, name}` |
| 2 | listFolders empty | `{files: []}` | Returns empty array |
| 3 | findFile locates existing file | `{files: [{id:"file1"}]}` | Returns file ID |
| 4 | findFile no match | `{files: []}` | Returns null |
| 5 | readFile returns content | Response body = markdown string | Returns the string |
| 6 | writeFile creates new file | POST to upload endpoint | Calls fetch with multipart body, returns file ID |
| 7 | writeFile updates existing | PATCH to upload endpoint | Calls fetch with PATCH method and file ID in URL |
| 8 | API error 401 | `{error: {message: "Unauthorized"}}` status 401 | Throws with message |
| 9 | API error 403 | Status 403 | Throws with message |
| 10 | Network error | `fetch` rejects | Throws, no unhandled promise |

### `bookmark-api.test.js`

Mock `chrome.bookmarks` namespace.

| # | Test | Description |
|---|---|---|
| 1 | getFullTree | Calls `chrome.bookmarks.getTree()`, returns result |
| 2 | clearAllBookmarks - populated | Removes children of Bookmarks Bar and Other Bookmarks |
| 3 | clearAllBookmarks - already empty | No errors when roots have no children |
| 4 | createTree - flat | Creates bookmarks at one level |
| 5 | createTree - nested | Creates folders then bookmarks inside them |
| 6 | createTree - uses returned IDs | Parent IDs from `chrome.bookmarks.create()` used for children |
| 7 | replaceAllBookmarks | Calls clear then create in sequence |

---

## Phase 3: Service Worker Tests (Mocked Everything)

### `service-worker.test.js`

Mock `chrome.runtime.onMessage`, `chrome.storage.sync`, and all lib modules.

| # | Test | Message | Expected |
|---|---|---|---|
| 1 | Export success | `{action:"export"}` | Calls getTree, toMarkdown, writeFile; responds `{success:true}` |
| 2 | Export no folder configured | `{action:"export"}` + no saved folderId | Responds `{success:false, error:"No folder configured"}` |
| 3 | Export auth failure | getAuthToken throws | Responds `{success:false, error:"..."}` |
| 4 | Export Drive write failure | writeFile throws | Responds with error |
| 5 | Import success | `{action:"import"}` | Calls readFile, toBookmarks, replaceAll; responds `{success:true, count:N}` |
| 6 | Import file not found | findFile returns null | Responds `{success:false, error:"No bookmarks file found"}` |
| 7 | Import parse failure | Markdown is completely invalid | Responds with error, bookmarks NOT cleared |
| 8 | listFolders | `{action:"listFolders"}` | Returns folder list |
| 9 | getSettings | `{action:"getSettings"}` | Returns stored settings |
| 10 | saveSettings | `{action:"saveSettings", folderId:"x", folderName:"Y"}` | Saves to storage, responds success |

---

## Test Fixtures

### `fixtures/simple-bookmarks.json`

```json
[
  {
    "id": "0",
    "title": "",
    "children": [
      {
        "id": "1",
        "title": "Bookmarks Bar",
        "children": [
          { "id": "10", "title": "Google", "url": "https://www.google.com" },
          { "id": "11", "title": "GitHub", "url": "https://github.com" }
        ]
      },
      {
        "id": "2",
        "title": "Other bookmarks",
        "children": [
          { "id": "20", "title": "Wikipedia", "url": "https://en.wikipedia.org" }
        ]
      }
    ]
  }
]
```

### `fixtures/simple-bookmarks.md`

```markdown
# Bookmarks Bar

- [Google](https://www.google.com)
- [GitHub](https://github.com)

# Other bookmarks

- [Wikipedia](https://en.wikipedia.org)
```

### `fixtures/complex-bookmarks.json`

Should include:
- 3+ levels of folder nesting
- Empty folders
- Folders with only subfolder children (no direct bookmarks)
- Bookmarks with special characters in titles: `[React] Docs`, `C++ (Advanced)`, `日本語`
- 20+ bookmarks total
- Multiple root sections

### `fixtures/malformed.md`

```markdown
This is not a bookmark file.

- [Broken link(no closing bracket
- Just plain text
[Not a list item](https://example.com)

# Valid Section
- [Valid](https://valid.com)

```code block
- [Not a bookmark](https://fake.com)
```
random text at the end
```

---

## Test Priority

1. **Must pass before any integration**: All roundtrip tests (Phase 1)
2. **Must pass before manual testing**: All service worker tests (Phase 3)
3. **Nice to have**: Drive API error handling edge cases

## Manual Testing Checklist (Post-Implementation)

These cannot be automated and require a real Chrome instance:

- [ ] Extension loads without errors in `chrome://extensions`
- [ ] Popup opens and displays correctly
- [ ] OAuth flow completes (Google sign-in prompt appears and succeeds)
- [ ] Folder picker shows real Drive folders
- [ ] Export creates/updates `chrome-bookmarks.md` in chosen Drive folder
- [ ] Exported file is readable markdown when opened in Drive/text editor
- [ ] Import confirmation dialog appears before overwrite
- [ ] Import correctly replaces all bookmarks
- [ ] Bookmarks Bar and Other Bookmarks both round-trip correctly
- [ ] Extension works after Chrome restart (settings persist)
- [ ] Error messages display correctly when Drive is unreachable
- [ ] Large bookmark collections (500+ bookmarks) export/import without timeout
