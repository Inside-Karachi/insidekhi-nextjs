import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ breaks: true, gfm: true });

/**
 * Render writer-authored Markdown to sanitized HTML for display.
 * Content is admin-moderated before publish, but sanitizing keeps a stored-XSS
 * mistake from an approved writer account from becoming a real vulnerability.
 */
export function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
