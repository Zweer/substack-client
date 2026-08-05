import { describe, expect, it } from 'vitest';

import { markdownToProseMirror } from '../lib/transform/markdown.js';

describe('markdownToProseMirror', () => {
  it('should return a doc node', () => {
    const doc = markdownToProseMirror('Hello');
    expect(doc.type).toBe('doc');
    expect(doc.content).toBeDefined();
  });

  it('should convert a paragraph', () => {
    const doc = markdownToProseMirror('Hello world');
    expect(doc.content![0].type).toBe('paragraph');
    expect(doc.content![0].content![0].text).toBe('Hello world');
  });

  it('should convert headings', () => {
    const doc = markdownToProseMirror('# H1\n\n## H2\n\n### H3');
    expect(doc.content![0].type).toBe('heading');
    expect(doc.content![0].attrs!.level).toBe(1);
    expect(doc.content![0].content![0].text).toBe('H1');

    expect(doc.content![1].attrs!.level).toBe(2);
    expect(doc.content![2].attrs!.level).toBe(3);
  });

  it('should convert bold text', () => {
    const doc = markdownToProseMirror('This is **bold** text');
    const content = doc.content![0].content!;

    expect(content[0].text).toBe('This is ');
    expect(content[1].text).toBe('bold');
    expect(content[1].marks).toEqual([{ type: 'strong' }]);
    expect(content[2].text).toBe(' text');
  });

  it('should convert italic text', () => {
    const doc = markdownToProseMirror('This is *italic* text');
    const content = doc.content![0].content!;

    expect(content[1].text).toBe('italic');
    expect(content[1].marks).toEqual([{ type: 'em' }]);
  });

  it('should convert links', () => {
    const doc = markdownToProseMirror('Click [here](https://example.com) now');
    const content = doc.content![0].content!;

    expect(content[1].text).toBe('here');
    expect(content[1].marks).toEqual([{ type: 'link', attrs: { href: 'https://example.com' } }]);
  });

  it('should convert bold+italic (nested marks)', () => {
    const doc = markdownToProseMirror('***bold italic***');
    const content = doc.content![0].content!;

    // bold+italic text should have both marks
    const marks = content[0].marks!;
    const markTypes = marks.map((m) => m.type).sort();
    expect(markTypes).toContain('strong');
    expect(markTypes).toContain('em');
  });

  it('should convert bullet lists', () => {
    const doc = markdownToProseMirror('- One\n- Two\n- Three');

    expect(doc.content![0].type).toBe('bullet_list');
    expect(doc.content![0].content).toHaveLength(3);
    expect(doc.content![0].content![0].type).toBe('list_item');
  });

  it('should convert ordered lists', () => {
    const doc = markdownToProseMirror('1. First\n2. Second');

    expect(doc.content![0].type).toBe('ordered_list');
    expect(doc.content![0].attrs!.start).toBe(1);
    expect(doc.content![0].content).toHaveLength(2);
  });

  it('should convert blockquotes', () => {
    const doc = markdownToProseMirror('> A wise quote');

    expect(doc.content![0].type).toBe('blockquote');
    expect(doc.content![0].content![0].type).toBe('paragraph');
    expect(doc.content![0].content![0].content![0].text).toBe('A wise quote');
  });

  it('should convert horizontal rules', () => {
    const doc = markdownToProseMirror('Above\n\n---\n\nBelow');

    expect(doc.content![1].type).toBe('horizontal_rule');
  });

  it('should convert images to captionedImage', () => {
    const doc = markdownToProseMirror('![Alt text](https://img.com/photo.jpg)');

    expect(doc.content![0].type).toBe('captionedImage');
    expect(doc.content![0].attrs!.src).toBe('https://img.com/photo.jpg');
    expect(doc.content![0].attrs!.alt).toBe('Alt text');
  });

  it('should convert inline code', () => {
    const doc = markdownToProseMirror('Use `const x = 1` here');
    const content = doc.content![0].content!;

    const codeNode = content.find((n) => n.marks?.some((m) => m.type === 'code'));
    expect(codeNode).toBeDefined();
    expect(codeNode!.text).toBe('const x = 1');
  });

  it('should handle complex document', () => {
    const markdown = `# Chapter 1

A paragraph with **bold** and *italic*.

- Bullet one
- Bullet two

> A blockquote

---

End.`;

    const doc = markdownToProseMirror(markdown);

    expect(doc.content![0].type).toBe('heading');
    expect(doc.content![1].type).toBe('paragraph');
    expect(doc.content![2].type).toBe('bullet_list');
    expect(doc.content![3].type).toBe('blockquote');
    expect(doc.content![4].type).toBe('horizontal_rule');
    expect(doc.content![5].type).toBe('paragraph');
  });
});
