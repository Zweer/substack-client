import { Lexer, type Token, type Tokens } from 'marked';

import type { ProseMirrorMark, ProseMirrorNode } from '../nodes.js';

/**
 * Convert Markdown text to a Substack-compatible ProseMirror JSON document.
 *
 * Supports: headings, paragraphs, bold, italic, links, bullet lists, ordered lists,
 * blockquotes, horizontal rules, images, and inline code.
 *
 * @param markdown - Markdown source text
 * @returns ProseMirror document object (NOT stringified — call JSON.stringify() for draft_body)
 *
 * @example
 * ```typescript
 * import { markdownToProseMirror } from '@zweer/substack-client/transform';
 *
 * const doc = markdownToProseMirror('# Hello\n\nA paragraph with **bold**.');
 * const draftBody = JSON.stringify(doc);
 * ```
 */
export function markdownToProseMirror(markdown: string): ProseMirrorNode {
  const lexer = new Lexer();
  const tokens = lexer.lex(markdown);

  return {
    type: 'doc',
    content: convertTokens(tokens),
  };
}

function convertTokens(tokens: Token[]): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];

  for (const token of tokens) {
    const node = convertToken(token);
    if (node) {
      if (Array.isArray(node)) {
        nodes.push(...node);
      } else {
        nodes.push(node);
      }
    }
  }

  return nodes;
}

function convertToken(token: Token): ProseMirrorNode | ProseMirrorNode[] | null {
  switch (token.type) {
    case 'heading':
      return convertHeading(token as Tokens.Heading);
    case 'paragraph':
      return convertParagraph(token as Tokens.Paragraph);
    case 'blockquote':
      return convertBlockquote(token as Tokens.Blockquote);
    case 'list':
      return convertList(token as Tokens.List);
    case 'hr':
      return { type: 'horizontal_rule' };
    case 'image':
      return convertImage(token as Tokens.Image);
    case 'space':
      return null;
    default:
      return null;
  }
}

function convertHeading(token: Tokens.Heading): ProseMirrorNode {
  return {
    type: 'heading',
    attrs: { level: token.depth, textAlign: null },
    content: convertInlineTokens(token.tokens ?? []),
  };
}

function convertParagraph(token: Tokens.Paragraph): ProseMirrorNode | ProseMirrorNode[] {
  const tokens = token.tokens ?? [];

  // If paragraph contains only a single image, promote it to a block-level captionedImage
  if (tokens.length === 1 && tokens[0].type === 'image') {
    return convertImage(tokens[0] as Tokens.Image);
  }

  // If paragraph contains multiple images (possibly with text), extract images as separate blocks
  const hasImage = tokens.some((t) => t.type === 'image');
  if (hasImage && tokens.every((t) => t.type === 'image')) {
    return tokens.map((t) => convertImage(t as Tokens.Image));
  }

  const content = convertInlineTokens(tokens);

  return {
    type: 'paragraph',
    attrs: { textAlign: null },
    content: content.length > 0 ? content : undefined,
  };
}

function convertBlockquote(token: Tokens.Blockquote): ProseMirrorNode {
  return {
    type: 'blockquote',
    content: convertTokens(token.tokens ?? []),
  };
}

function convertList(token: Tokens.List): ProseMirrorNode {
  const items = (token.items ?? []).map(convertListItem);

  if (token.ordered) {
    return {
      type: 'ordered_list',
      attrs: { start: token.start || 1 },
      content: items,
    };
  }

  return {
    type: 'bullet_list',
    content: items,
  };
}

function convertListItem(token: Tokens.ListItem): ProseMirrorNode {
  // List items contain block-level content (paragraphs, sub-lists, etc.)
  const content: ProseMirrorNode[] = [];

  for (const child of token.tokens ?? []) {
    if (child.type === 'text') {
      // Inline text inside list item — wrap in paragraph
      const textToken = child as Tokens.Text;
      const inlineContent = convertInlineTokens(textToken.tokens ?? []);
      if (inlineContent.length > 0) {
        content.push({
          type: 'paragraph',
          attrs: { textAlign: null },
          content: inlineContent,
        });
      }
    } else if (child.type === 'list') {
      content.push(convertList(child as Tokens.List));
    } else {
      const node = convertToken(child);
      if (node) {
        if (Array.isArray(node)) {
          content.push(...node);
        } else {
          content.push(node);
        }
      }
    }
  }

  return {
    type: 'list_item',
    content: content.length > 0 ? content : [{ type: 'paragraph', attrs: { textAlign: null } }],
  };
}

function convertImage(token: Tokens.Image): ProseMirrorNode {
  return {
    type: 'captionedImage',
    attrs: {
      src: token.href,
      title: token.title ?? '',
      fullscreen: false,
      imageSize: 'normal',
      height: null,
      width: null,
      resizeWidth: null,
      bytes: null,
      alt: token.text ?? '',
      caption: token.text ?? '',
      href: null,
      belowTheFold: false,
      topImage: false,
      internalRedirect: null,
      isEditorRecent: false,
    },
  };
}

// --- Inline token conversion ---

function convertInlineTokens(tokens: Token[]): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];

  for (const token of tokens) {
    const inlineNodes = convertInlineToken(token);
    if (inlineNodes) {
      if (Array.isArray(inlineNodes)) {
        nodes.push(...inlineNodes);
      } else {
        nodes.push(inlineNodes);
      }
    }
  }

  return nodes;
}

function convertInlineToken(token: Token): ProseMirrorNode | ProseMirrorNode[] | null {
  switch (token.type) {
    case 'text':
      return makeText((token as Tokens.Text).text);
    case 'strong':
      return convertStrong(token as Tokens.Strong);
    case 'em':
      return convertEm(token as Tokens.Em);
    case 'link':
      return convertLink(token as Tokens.Link);
    case 'codespan':
      return convertCode(token as Tokens.Codespan);
    case 'image':
      // Inline images become captionedImage at block level — wrap for inline context
      return makeText(`[${(token as Tokens.Image).text}]`);
    case 'br':
      return { type: 'hardBreak' };
    case 'escape':
      return makeText((token as Tokens.Escape).text);
    default:
      // Unknown inline token — try to extract raw text
      if ('text' in token && typeof token.text === 'string') {
        return makeText(token.text);
      }
      return null;
  }
}

function convertStrong(token: Tokens.Strong): ProseMirrorNode[] {
  return applyMark({ type: 'strong' }, token.tokens ?? []);
}

function convertEm(token: Tokens.Em): ProseMirrorNode[] {
  return applyMark({ type: 'em' }, token.tokens ?? []);
}

function convertLink(token: Tokens.Link): ProseMirrorNode[] {
  const mark: ProseMirrorMark = { type: 'link', attrs: { href: token.href } };
  return applyMark(mark, token.tokens ?? []);
}

function convertCode(token: Tokens.Codespan): ProseMirrorNode {
  return {
    type: 'text',
    text: token.text,
    marks: [{ type: 'code' }],
  };
}

/**
 * Apply a mark to all inline nodes in the given tokens.
 * Handles nested marks (e.g., bold+italic).
 */
function applyMark(mark: ProseMirrorMark, tokens: Token[]): ProseMirrorNode[] {
  const inlineNodes = convertInlineTokens(tokens);

  return inlineNodes.map((node) => ({
    ...node,
    marks: [...(node.marks ?? []), mark],
  }));
}

function makeText(content: string): ProseMirrorNode | null {
  if (!content) return null;
  return { type: 'text', text: content };
}
