/**
 * ProseMirror node helpers for building Substack post bodies.
 *
 * These create the JSON nodes that go inside a ProseMirror document's `content` array.
 * Use `JSON.stringify({ type: 'doc', content: [...] })` to create the `draft_body` value.
 *
 * @example
 * ```typescript
 * import { paragraph, paywall, divider, heading, blockquote } from '@zweer/substack-client';
 *
 * const body = JSON.stringify({
 *   type: 'doc',
 *   content: [
 *     heading('Chapter 1', 1),
 *     paragraph('Free preview text for everyone.'),
 *     paywall(),
 *     paragraph('This is only for paid subscribers.'),
 *     blockquote('A memorable quote.'),
 *     divider(),
 *   ],
 * });
 * ```
 */

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

// --- Text with marks ---

/**
 * Creates a text node with optional inline marks (bold, italic, link, etc.).
 */
export function text(content: string, marks?: ProseMirrorMark[]): ProseMirrorNode {
  const node: ProseMirrorNode = { type: 'text', text: content };
  if (marks && marks.length > 0) {
    node.marks = marks;
  }
  return node;
}

/**
 * Creates a bold (strong) mark.
 */
export function bold(): ProseMirrorMark {
  return { type: 'strong' };
}

/**
 * Creates an italic (em) mark.
 */
export function italic(): ProseMirrorMark {
  return { type: 'em' };
}

/**
 * Creates a link mark.
 */
export function link(href: string): ProseMirrorMark {
  return { type: 'link', attrs: { href } };
}

// --- Block nodes ---

/**
 * Creates a paywall node. Content before this node is the free preview;
 * content after is only visible to paid subscribers.
 */
export function paywall(): ProseMirrorNode {
  return { type: 'paywall' };
}

/**
 * Creates a horizontal rule (divider) node.
 */
export function divider(): ProseMirrorNode {
  return { type: 'horizontal_rule' };
}

/**
 * Creates a paragraph node with optional text content.
 * For rich content (marks), pass ProseMirrorNode[] as content.
 */
export function paragraph(content?: string | ProseMirrorNode[]): ProseMirrorNode {
  if (!content) {
    return { type: 'paragraph', attrs: { textAlign: null } };
  }

  if (typeof content === 'string') {
    return {
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ type: 'text', text: content }],
    };
  }

  return {
    type: 'paragraph',
    attrs: { textAlign: null },
    content,
  };
}

/**
 * Creates a heading node.
 */
export function heading(
  content: string | ProseMirrorNode[],
  level: 1 | 2 | 3 | 4 | 5 | 6 = 2,
): ProseMirrorNode {
  const nodeContent =
    typeof content === 'string' ? [{ type: 'text', text: content } as ProseMirrorNode] : content;

  return {
    type: 'heading',
    attrs: { level, textAlign: null },
    content: nodeContent,
  };
}

/**
 * Creates a blockquote node.
 * Content should be paragraph nodes (or other block nodes).
 */
export function blockquote(content: string | ProseMirrorNode[]): ProseMirrorNode {
  const children = typeof content === 'string' ? [paragraph(content)] : content;

  return {
    type: 'blockquote',
    content: children,
  };
}

/**
 * Creates a bullet (unordered) list.
 * Note: Substack uses snake_case `bullet_list` (not camelCase).
 */
export function bulletList(items: Array<string | ProseMirrorNode[]>): ProseMirrorNode {
  return {
    type: 'bullet_list',
    content: items.map(listItem),
  };
}

/**
 * Creates an ordered (numbered) list.
 */
export function orderedList(items: Array<string | ProseMirrorNode[]>, start = 1): ProseMirrorNode {
  return {
    type: 'ordered_list',
    attrs: { start },
    content: items.map(listItem),
  };
}

/**
 * Creates a list_item node.
 */
export function listItem(content: string | ProseMirrorNode[]): ProseMirrorNode {
  const children = typeof content === 'string' ? [paragraph(content)] : content;

  return {
    type: 'list_item',
    content: children,
  };
}

/**
 * Creates a CTA button node.
 */
export function button(buttonText: string, url: string): ProseMirrorNode {
  return {
    type: 'button',
    attrs: {
      url,
      text: buttonText,
      action: null,
      class: null,
    },
  };
}

export interface CaptionedImageAttrs {
  alt?: string;
  title?: string;
  caption?: string;
  fullscreen?: boolean;
  imageSize?: 'normal' | 'small' | 'full';
  height?: number;
  width?: number;
  href?: string;
}

/**
 * Creates a captionedImage node from a Substack CDN URL.
 * Use `client.uploadImage()` first to get the URL.
 *
 * Note: Substack uses camelCase `captionedImage` (not snake_case).
 */
export function captionedImage(src: string, attrs?: CaptionedImageAttrs): ProseMirrorNode {
  return {
    type: 'captionedImage',
    attrs: {
      src,
      title: attrs?.title ?? '',
      fullscreen: attrs?.fullscreen ?? false,
      imageSize: attrs?.imageSize ?? 'normal',
      height: attrs?.height ?? null,
      width: attrs?.width ?? null,
      resizeWidth: null,
      bytes: null,
      alt: attrs?.alt ?? '',
      caption: attrs?.caption ?? '',
      href: attrs?.href ?? null,
      belowTheFold: false,
      topImage: false,
      internalRedirect: null,
      isEditorRecent: true,
    },
  };
}
