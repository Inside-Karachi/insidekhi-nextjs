import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ breaks: true, gfm: true });

/**
 * Deliberately not isomorphic-dompurify/jsdom: recent jsdom (and its
 * html-encoding-sniffer/whatwg-url dependencies) require() the ESM-only
 * @exodus/bytes package, which crashes with ERR_REQUIRE_ESM specifically
 * under Vercel's serverless bundling (reproduced in production, never
 * locally). sanitize-html has no jsdom/DOM-emulation dependency at all, so
 * it sidesteps the issue entirely rather than chasing individual @exodus/bytes
 * require() sites across jsdom's own source.
 */
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
  },
};

/**
 * Render writer-authored Markdown to sanitized HTML for display.
 * Content is admin-moderated before publish, but sanitizing keeps a stored-XSS
 * mistake from an approved writer account from becoming a real vulnerability.
 */
export function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false }) as string;
  return sanitizeHtml(html, sanitizeOptions);
}
