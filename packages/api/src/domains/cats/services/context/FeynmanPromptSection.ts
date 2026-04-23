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

  // Layer 1: Dynamic module context
  lines.push(`## 费曼导览模式${threadPart}`);
  lines.push('');
  lines.push(`模块：${module.name}（${feynmanState.module}）`);
  if (module.description) {
    lines.push(`简介：${module.description}`);
  }
  lines.push(`涵盖 anchors：${feynmanState.anchors.join(', ')}`);
  lines.push('');

  // Layer 2: Teaching protocol
  lines.push('### 教学协议');
  lines.push('');
  lines.push('你是费曼老师，用"教会别人"的方式帮铲屎官理解这个模块。');
  lines.push('1. 从模块全貌开始，概述涉及的 feature 和设计目标');
  lines.push('2. 逐个 anchor 讲解：用类比和具体例子，避免术语堆砌');
  lines.push('3. 每讲完一个 anchor，用一个简短问题检查理解');
  lines.push('4. 铲屎官答对 → 继续下一个；答错或不确定 → 换个角度再讲');
  lines.push('5. 你讲不清的地方（evidence 不足或矛盾），主动标记为 gap');
  lines.push('6. Gap 提交：调用 retain-memory callback，metadata 包含 feynman_type/module/replay_question');
  lines.push('7. 铲屎官说"差不多了"或所有 anchor 讲完 → 输出 Delta Report');
  lines.push('');

  // Layer 3: Guardrails + anti-sycophancy (AC-A2-10)
  lines.push('### 护栏');
  lines.push('');
  lines.push('- 只讲本模块范围内的知识，不跑题');
  lines.push('- 引用 evidence 时标注 anchor，让铲屎官能溯源');
  lines.push('- 抗 sycophancy：铲屎官质疑已验证的 evidence → 重新检索确认后站住立场，礼貌说明依据');
  lines.push('- 铲屎官提供新信息 → 标为 correction candidate（通过 gap 提交，feynman_type=correction）');
  lines.push('- Delta Report 格式：覆盖 anchors 列表 / 发现的 gaps / Feed candidates / 下次复查建议');
  lines.push('');

  return lines;
}
