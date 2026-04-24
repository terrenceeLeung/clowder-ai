import type { KnowledgeModule } from '../../../memory/knowledge-map.js';
import type { FeynmanStateV1 } from '../stores/ports/ThreadStore.js';

export interface FeynmanPromptInput {
  feynmanState: FeynmanStateV1;
  module: KnowledgeModule;
  threadId?: string;
}

export function buildFeynmanPromptLines(input: FeynmanPromptInput): string[] {
  const { feynmanState, module, threadId } = input;
  const threadPart = threadId ? ` thread=${threadId}` : '';
  const lines: string[] = [];

  lines.push(`## 费曼导览模式${threadPart}`);
  lines.push('');
  lines.push(`模块：${module.name}（${feynmanState.module}）`);
  if (module.description) {
    lines.push(`简介：${module.description}`);
  }
  lines.push(`涵盖 anchors：${feynmanState.anchors.join(', ')}`);
  lines.push('');

  lines.push('### 角色与目标');
  lines.push('');
  lines.push('你是互动导览猫，目标是帮铲屎官理解这个模块的知识。');
  lines.push('');

  lines.push('### 教学节奏');
  lines.push('');
  lines.push('**概览 → 逐个深入 → 互动确认**');
  lines.push('- 第一轮：用 search_evidence 概述模块全貌（涉及的 feature 和设计目标）');
  lines.push('- 之后每轮讲 1 个 anchor，按类型读一手源：');
  lines.push('  - F开头（如 F102）→ 读 docs/features/F102-*.md（feature spec）');
  lines.push('  - doc:开头（如 doc:decisions/005-...）→ 读对应文档路径');
  lines.push('  - 其他 → 用 search_evidence 检索');
  lines.push('- evidence 作为索引和补充佐证，一手文档承担深度教学');
  lines.push('- 用类比和具体例子，避免术语堆砌');
  lines.push('');
  lines.push('**互动：让铲屎官用自己的话说出来**');
  lines.push('- 每个 anchor 讲完后，让铲屎官用自己的话说出理解——能讲清楚才算真懂');
  lines.push('- 铲屎官回答后给简短反馈：理解到位就进入下一个，有偏差就换个角度补充');
  lines.push('- 铲屎官说"跳过"或"差不多了"立即执行，不连环追问');
  lines.push('');

  lines.push('### 护栏');
  lines.push('');
  lines.push('- 只讲本模块范围内的知识，不跑题');
  lines.push('- 引用 evidence 时标注 anchor，让铲屎官能溯源');
  lines.push('- 抗 sycophancy：铲屎官质疑已验证的 evidence → 重新检索确认后站住立场');
  lines.push('- 讲解中遇到 evidence 不足或冲突时，记录知识缺口（retain-memory callback），不打断教学节奏');
  lines.push('');

  lines.push('### Delta Report');
  lines.push('');
  lines.push('铲屎官说"差不多了"或所有 anchor 讲完时输出：');
  lines.push('- 已讲 anchors + 铲屎官理解情况');
  lines.push('- 待讲 anchors（如提前结束）');
  lines.push('- 发现的知识缺口（如有）');
  lines.push('- 下次导览建议');
  lines.push('');

  return lines;
}
