import { describe, expect, it } from 'vitest';

import {
  blockquote,
  bold,
  bulletList,
  button,
  captionedImage,
  divider,
  heading,
  italic,
  link,
  listItem,
  orderedList,
  paragraph,
  paywall,
  text,
} from '../lib/nodes.js';

describe('ProseMirror node helpers', () => {
  it('paywall — creates a paywall node', () => {
    expect(paywall()).toEqual({ type: 'paywall' });
  });

  it('divider — creates a horizontal_rule node', () => {
    expect(divider()).toEqual({ type: 'horizontal_rule' });
  });

  it('paragraph — creates empty paragraph when no text', () => {
    const node = paragraph();
    expect(node.type).toBe('paragraph');
    expect(node.attrs).toEqual({ textAlign: null });
    expect(node.content).toBeUndefined();
  });

  it('paragraph — creates paragraph with text content', () => {
    const node = paragraph('Hello world');
    expect(node.type).toBe('paragraph');
    expect(node.content).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  it('paragraph — accepts ProseMirrorNode[] content', () => {
    const node = paragraph([text('Hello '), text('bold', [bold()])]);
    expect(node.content).toHaveLength(2);
    expect(node.content![1].marks).toEqual([{ type: 'strong' }]);
  });

  it('heading — creates heading with level', () => {
    const node = heading('Title', 1);
    expect(node.type).toBe('heading');
    expect(node.attrs).toEqual({ level: 1, textAlign: null });
    expect(node.content).toEqual([{ type: 'text', text: 'Title' }]);
  });

  it('heading — defaults to level 2', () => {
    const node = heading('Subtitle');
    expect(node.attrs?.level).toBe(2);
  });

  it('blockquote — creates blockquote wrapping paragraphs', () => {
    const node = blockquote('A quote');
    expect(node.type).toBe('blockquote');
    expect(node.content).toHaveLength(1);
    expect(node.content![0].type).toBe('paragraph');
  });

  it('bulletList — creates bullet_list with list_items', () => {
    const node = bulletList(['One', 'Two']);
    expect(node.type).toBe('bullet_list');
    expect(node.content).toHaveLength(2);
    expect(node.content![0].type).toBe('list_item');
    expect(node.content![0].content![0].type).toBe('paragraph');
  });

  it('orderedList — creates ordered_list with start attr', () => {
    const node = orderedList(['First', 'Second'], 3);
    expect(node.type).toBe('ordered_list');
    expect(node.attrs).toEqual({ start: 3 });
    expect(node.content).toHaveLength(2);
  });

  it('listItem — creates list_item from string', () => {
    const node = listItem('Item text');
    expect(node.type).toBe('list_item');
    expect(node.content![0].type).toBe('paragraph');
  });

  it('button — creates CTA button node', () => {
    const node = button('Subscribe', 'https://example.com');
    expect(node.type).toBe('button');
    expect(node.attrs).toEqual({
      url: 'https://example.com',
      text: 'Subscribe',
      action: null,
      class: null,
    });
  });

  it('captionedImage — creates image node with attrs', () => {
    const node = captionedImage('https://cdn.example.com/img.jpg', {
      alt: 'A photo',
      caption: 'My caption',
    });
    expect(node.type).toBe('captionedImage');
    expect(node.attrs!.src).toBe('https://cdn.example.com/img.jpg');
    expect(node.attrs!.alt).toBe('A photo');
    expect(node.attrs!.caption).toBe('My caption');
    expect(node.attrs!.belowTheFold).toBe(false);
    expect(node.attrs!.imageSize).toBe('normal');
  });

  it('text — creates text node with marks', () => {
    const node = text('click here', [bold(), link('https://example.com')]);
    expect(node.type).toBe('text');
    expect(node.text).toBe('click here');
    expect(node.marks).toHaveLength(2);
    expect(node.marks![0].type).toBe('strong');
    expect(node.marks![1].type).toBe('link');
    expect(node.marks![1].attrs).toEqual({ href: 'https://example.com' });
  });

  it('italic — creates em mark', () => {
    expect(italic()).toEqual({ type: 'em' });
  });
});
