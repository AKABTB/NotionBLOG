// Shared rule for spotting Mermaid diagrams coming out of Notion.
//
// Notion's code block has no "mermaid" language option in its UI, so a block is
// treated as a Mermaid diagram when any of these hold:
//  (a) its language is the API-only value "mermaid",
//  (b) its caption is exactly "mermaid" (the explicit, opt-in path), or
//  (c) it's plain text whose first line begins with a known Mermaid keyword.
//
// Kept side-effect-free so the server enricher (lib/notion-render) and the
// client renderer (components/NotionBlock) stay in perfect agreement on what
// counts as a diagram.

const KEYWORDS =
  'graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|' +
  'gantt|pie|journey|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|' +
  'mindmap|timeline|requirementDiagram|sankey|block-beta|architecture-beta|' +
  'quadrantChart|xychart-beta';

const RE = new RegExp(`^\\s*(?:${KEYWORDS})\\b`, 'i');

export function isMermaid(
  lang: string | undefined,
  caption: string,
  raw: string,
): boolean {
  if (lang && lang.toLowerCase() === 'mermaid') return true;
  if (caption.trim().toLowerCase() === 'mermaid') return true;
  // Only auto-detect on language-free / plain-text blocks, so real code that
  // happens to begin with e.g. "flowchart" as an identifier isn't swallowed.
  if ((!lang || lang === 'plain text') && RE.test(raw)) return true;
  return false;
}
