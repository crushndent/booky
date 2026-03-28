/**
 * Parses a Markdown string to bookmark tree structure
 * @param {string} mdString - Markdown string
 * @returns {Array} Array of objects matching structure for chrome.bookmarks.create()
 *   Each object: { title, url?, children? }
 *   - url present = bookmark
 *   - children present = folder
 */
export function markdownToBookmarkTree(mdString) {
  if (!mdString || typeof mdString !== 'string') {
    return [];
  }

  const lines = mdString.split('\n');
  const roots = [];
  const headingStack = [];

  function unescapeTitle(title) {
    if (!title) return '';
    return title.replace(/\\([\[\]\(\)])/g, '$1');
  }

  function getCurrentParent(level) {
    while (headingStack.length > 0) {
      const top = headingStack[headingStack.length - 1];
      if (top.level < level) {
        return top;
      }
      headingStack.pop();
    }
    return null;
  }

  /**
   * Extracts URL from markdown link syntax, handling parentheses in URLs
   * Format: [title](url) where url may contain parentheses
   * @param {string} line - The line to parse
   * @returns {object|null} - {title, url} or null if not a valid bookmark line
   */
  function parseBookmarkLine(line) {
    // Match the start of a bookmark: - [title](
    const startMatch = line.match(/^-\s+\[((?:[^\]\\]|\\.)*)\]\(/);
    if (!startMatch) return null;
    
    const title = startMatch[1];
    const urlStart = startMatch[0].length;
    const remaining = line.slice(urlStart);
    
    // Find the closing ) for the URL
    // URLs can contain parentheses, so we need to find the ) that matches the opening (
    // We look for the first ) that is followed by whitespace, end of string, or non-URL chars
    let depth = 1;
    let urlEnd = -1;
    
    for (let i = 0; i < remaining.length; i++) {
      const char = remaining[i];
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          // Found the closing paren - check if this is likely the end of the URL
          // It's the end if followed by space, end of string, or non-URL character
          const nextChar = remaining[i + 1];
          if (!nextChar || nextChar === ' ' || nextChar === '\t') {
            urlEnd = i;
            break;
          }
        }
      }
    }
    
    if (urlEnd === -1) return null;
    
    const url = remaining.slice(0, urlEnd);
    return { title, url };
  }

  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    const headingMatch = trimmedLine.match(headingRegex);
    if (headingMatch) {
      const hashes = headingMatch[1];
      const title = headingMatch[2];
      const level = hashes.length;
      const unescapedTitle = unescapeTitle(title);

      const folder = {
        title: unescapedTitle,
        children: []
      };

      if (level === 1) {
        roots.push(folder);
        headingStack.length = 0;
        headingStack.push({ level, folder });
      } else {
        const parent = getCurrentParent(level);
        if (parent) {
          parent.folder.children.push(folder);
        } else {
          roots.push(folder);
        }
        headingStack.push({ level, folder });
      }
      continue;
    }

    const bookmarkData = parseBookmarkLine(trimmedLine);
    if (bookmarkData) {
      const unescapedTitle = unescapeTitle(bookmarkData.title);

      const bookmark = {
        title: unescapedTitle,
        url: bookmarkData.url
      };

      if (headingStack.length > 0) {
        const parent = getCurrentParent(Infinity);
        if (parent) {
          parent.folder.children.push(bookmark);
        }
      } else {
        const defaultFolder = {
          title: 'Imported Bookmarks',
          children: [bookmark]
        };
        roots.push(defaultFolder);
        headingStack.push({ level: 1, folder: defaultFolder });
      }
    }
  }

  return roots;
}
