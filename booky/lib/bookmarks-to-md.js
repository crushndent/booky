/**
 * Converts a Chrome bookmark tree to Markdown format
 * @param {Array} nodes - Array of BookmarkTreeNode from chrome.bookmarks.getTree()
 * @returns {string} UTF-8 Markdown string
 */
export function bookmarkTreeToMarkdown(nodes) {
  if (!nodes || !Array.isArray(nodes)) {
    return '';
  }

  let markdown = '';

  function escapeTitle(title) {
    if (!title) return '';
    return title.replace(/[\[\]\(\)]/g, (match) => {
      return '\\' + match;
    });
  }

  function processNode(node, depth) {
    if (!node) return;

    const isRootNode = node.id === '0';
    
    if (isRootNode) {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          processNode(child, 0);
        }
      }
      return;
    }

    const isFolder = !node.url && (node.children || node.dateAdded !== undefined);
    
    if (isFolder) {
      const headingLevel = Math.min(depth + 1, 6);
      const headingPrefix = '#'.repeat(headingLevel);
      const escapedTitle = escapeTitle(node.title || 'Untitled');
      
      if (markdown.length > 0) {
        markdown += '\n';
      }
      markdown += `${headingPrefix} ${escapedTitle}\n`;
      
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          processNode(child, depth + 1);
        }
      }
    } else if (node.url) {
      const escapedTitle = escapeTitle(node.title || 'Untitled');
      markdown += `- [${escapedTitle}](${node.url})\n`;
    }
  }

  for (const node of nodes) {
    processNode(node, 0);
  }

  return markdown;
}
