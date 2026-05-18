import type { RichBlock } from '@cat-cafe/shared';

const TONE_TO_COLOR: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  danger: 'red',
};

interface LarkCardElement {
  tag: string;
  [key: string]: unknown;
}

export interface LarkCard {
  header: { title: { content: string; tag: string }; template: string };
  elements: LarkCardElement[];
}

function blockToElements(block: RichBlock): LarkCardElement[] {
  switch (block.kind) {
    case 'card': {
      const els: LarkCardElement[] = [];
      if (block.bodyMarkdown) {
        els.push({ tag: 'markdown', content: block.bodyMarkdown });
      }
      if (block.fields?.length) {
        els.push({
          tag: 'markdown',
          content: block.fields.map((f) => `**${f.label}**: ${f.value}`).join('\n'),
        });
      }
      return els;
    }
    case 'checklist': {
      const text = block.items.map((i) => `${i.checked ? '✅' : '☐'} ${i.text}`).join('\n');
      return [{ tag: 'markdown', content: block.title ? `**${block.title}**\n${text}` : text }];
    }
    case 'diff':
      return [
        { tag: 'markdown', content: `**${block.filePath}**` },
        { tag: 'markdown', content: `\`\`\`${block.languageHint || ''}\n${block.diff}\n\`\`\`` },
      ];
    case 'audio':
      return [{ tag: 'markdown', content: block.text ? `🔊 ${block.text}` : '🔊 [Audio]' }];
    case 'media_gallery': {
      const text = block.items.map((i) => `[${i.caption || i.alt || 'image'}](${i.url})`).join('\n');
      return [{ tag: 'markdown', content: block.title ? `**${block.title}**\n${text}` : text }];
    }
    default:
      return [{ tag: 'markdown', content: `[${(block as RichBlock).kind}]` }];
  }
}

export function formatFeishuCard(blocks: RichBlock[], catDisplayName: string, textContent?: string): LarkCard {
  const firstCard = blocks.find((b) => b.kind === 'card');
  const title =
    firstCard && firstCard.kind === 'card' ? `【${catDisplayName}🐱】${firstCard.title}` : `【${catDisplayName}🐱】`;
  const tone = (firstCard?.kind === 'card' && firstCard.tone) || 'info';
  const template = TONE_TO_COLOR[tone] || 'blue';

  const elements: LarkCardElement[] = [];
  if (textContent) {
    elements.push({ tag: 'markdown', content: textContent });
  }
  for (const block of blocks) {
    elements.push(...blockToElements(block));
  }

  return { header: { title: { content: title, tag: 'plain_text' }, template }, elements };
}

// ── Feishu card action buttons for connector commands ──

interface CommandButton {
  readonly label: string;
  readonly cmd: string;
  readonly args?: string;
}

const QUICK_COMMAND_BUTTONS: readonly CommandButton[] = [
  { label: '➕ 新建', cmd: '/new' },
  { label: '📋 选择会话', cmd: '/threads' },
  { label: '📜 历史', cmd: '/history' },
  { label: '❓ 帮助', cmd: '/commands' },
];

export function buildCommandActionButtons(): LarkCardElement {
  return {
    tag: 'action',
    actions: QUICK_COMMAND_BUTTONS.map((btn) => ({
      tag: 'button',
      text: { tag: 'plain_text', content: btn.label },
      type: 'default',
      size: 'small',
      value: { cmd: btn.cmd, ...(btn.args ? { args: btn.args } : {}) },
    })),
  };
}

export function appendCommandButtons(elements: LarkCardElement[]): LarkCardElement[] {
  return [...elements, { tag: 'hr' }, buildCommandActionButtons()];
}

export function buildThreadPickerCard(
  threads: Array<{ index: number; title: string; id: string; badge?: string }>,
): LarkCardElement[] {
  const elements: LarkCardElement[] = [{ tag: 'markdown', content: '📋 **选择要切换的会话：**' }];
  const actions = threads.slice(0, 5).map((t) => ({
    tag: 'button' as const,
    text: { tag: 'plain_text' as const, content: `${t.index}. ${t.title}${t.badge ? ` [${t.badge}]` : ''}` },
    type: 'default' as const,
    size: 'small' as const,
    value: { cmd: '/use', args: String(t.index) },
  }));
  elements.push({ tag: 'action', actions });
  return elements;
}

export function buildHistoryPickerCard(): LarkCardElement[] {
  const options = [1, 3, 5];
  const actions = options.map((n) => ({
    tag: 'button' as const,
    text: { tag: 'plain_text' as const, content: `最近 ${n} 轮` },
    type: 'default' as const,
    size: 'small' as const,
    value: { cmd: '/history', args: String(n) },
  }));
  return [
    { tag: 'markdown', content: '📜 **查看几轮对话？**' },
    { tag: 'action', actions },
  ];
}
