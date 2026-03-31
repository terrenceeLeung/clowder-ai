/**
 * F056 / F113-E: Project setup scene illustrations.
 * Art direction: Siamese/烁烁. Implementation: Ragdoll/宪宪.
 * Style: Scene-based narrative — cat + environment, not isolated heads.
 * 80x80 viewBox for scene detail. Uses currentColor for theming.
 */

interface IconProps {
  className?: string;
}

/**
 * Idle: Cat peeking out of a half-open cardboard box, curious eyes,
 * question mark bubble. Scattered blocks nearby = unorganized project.
 * "这个新家需要我做些什么吗？"
 */
export function SetupCatIcon({ className = 'w-20 h-20' }: IconProps) {
  return (
    <svg viewBox="0 0 80 80" fill="currentColor" className={className} aria-hidden="true">
      <title>项目初始化</title>

      {/* ── Scene: ground shadow ── */}
      <ellipse cx="40" cy="72" rx="30" ry="4" opacity="0.06" />

      {/* ── Cardboard box (half-open) ── */}
      {/* Box body */}
      <rect x="18" y="42" width="36" height="28" rx="3" opacity="0.12" />
      <rect x="18" y="42" width="36" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Box tape line */}
      <line x1="36" y1="42" x2="36" y2="70" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      {/* Left flap (open, tilted back) */}
      <path d="M18 42l-4-6h20l2 6" opacity="0.08" />
      <path d="M18 42l-4-6h20l2 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Right flap (open, tilted forward slightly) */}
      <path d="M54 42l3-4H40l-4 4" opacity="0.06" />
      <path d="M54 42l3-4H40l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />

      {/* ── Cat peeking out ── */}
      {/* Cat body inside box (visible above box rim) */}
      <ellipse cx="36" cy="42" rx="12" ry="8" opacity="0.08" />

      {/* Cat head */}
      <circle cx="36" cy="32" r="12" opacity="0.1" />
      <circle cx="36" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="2" />

      {/* Round ears */}
      <circle cx="26" cy="21" r="5" opacity="0.18" />
      <circle cx="46" cy="21" r="5" opacity="0.18" />
      <circle cx="26" cy="21" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="46" cy="21" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Inner ears */}
      <circle cx="26" cy="20" r="2.5" opacity="0.1" />
      <circle cx="46" cy="20" r="2.5" opacity="0.1" />

      {/* Big curious eyes */}
      <circle cx="31" cy="31" r="3" />
      <circle cx="41" cy="31" r="3" />
      {/* Eye highlights (sparkle) */}
      <circle cx="32.2" cy="29.8" r="1" fill="white" />
      <circle cx="42.2" cy="29.8" r="1" fill="white" />
      <circle cx="30" cy="32" r="0.5" fill="white" />
      <circle cx="40" cy="32" r="0.5" fill="white" />

      {/* Nose */}
      <ellipse cx="36" cy="35.5" rx="1.2" ry="0.8" opacity="0.45" />
      {/* Mouth */}
      <path
        d="M33.5 37.5s1.2 1.5 2.5 1.5 2.5-1.5 2.5-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Whiskers */}
      <line x1="22" y1="34" x2="28" y2="34.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="22" y1="37" x2="28" y2="36.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="50" y1="34" x2="44" y2="34.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="50" y1="37" x2="44" y2="36.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />

      {/* Paws on box rim */}
      <ellipse cx="29" cy="43" rx="3.5" ry="2" opacity="0.12" />
      <ellipse cx="43" cy="43" rx="3.5" ry="2" opacity="0.12" />
      <path d="M26.5 42.5c0-1 1.2-1.8 2.5-1.8s2.5.8 2.5 1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M40.5 42.5c0-1 1.2-1.8 2.5-1.8s2.5.8 2.5 1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />

      {/* ── Question mark bubble ── */}
      <circle cx="60" cy="18" r="8" opacity="0.08" />
      <circle cx="60" cy="18" r="8" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      {/* Bubble tail */}
      <path d="M54 23l-2 4 5-2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      {/* Question mark */}
      <text x="60" y="22" textAnchor="middle" fontSize="11" fontWeight="bold" opacity="0.5" fill="currentColor">
        ?
      </text>

      {/* ── Scattered blocks (unorganized files) ── */}
      <rect x="60" y="58" width="8" height="8" rx="1.5" opacity="0.1" transform="rotate(12 64 62)" />
      <rect
        x="60"
        y="58"
        width="8"
        height="8"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
        transform="rotate(12 64 62)"
      />
      <rect x="66" y="62" width="6" height="6" rx="1" opacity="0.07" transform="rotate(-8 69 65)" />
      <rect
        x="66"
        y="62"
        width="6"
        height="6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.15"
        transform="rotate(-8 69 65)"
      />
      {/* Small dot (like a screw/detail) */}
      <circle cx="10" cy="62" r="2" opacity="0.06" />
    </svg>
  );
}

/**
 * Processing: Cat wearing a tiny hard hat, stacking geometric blocks.
 * Sparkle/motion lines in background = "building your project".
 * "我正在帮你搭建新家，稍等片刻！"
 */
export function WorkingCatIcon({ className = 'w-20 h-20' }: IconProps) {
  return (
    <svg viewBox="0 0 80 80" fill="currentColor" className={className} aria-hidden="true">
      <title>正在初始化</title>

      {/* ── Ground shadow ── */}
      <ellipse cx="40" cy="72" rx="28" ry="4" opacity="0.06" />

      {/* ── Stacked blocks (files being organized) ── */}
      <rect x="44" y="50" width="14" height="10" rx="2" opacity="0.1" />
      <rect x="44" y="50" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="47" y="40" width="14" height="10" rx="2" opacity="0.08" />
      <rect x="47" y="40" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Block being placed (floating) */}
      <rect x="50" y="30" width="10" height="8" rx="1.5" opacity="0.06" />
      <rect
        x="50"
        y="30"
        width="10"
        height="8"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="3 2"
        opacity="0.4"
      />

      {/* ── Cat (side view, reaching up to place block) ── */}
      {/* Cat body */}
      <ellipse cx="30" cy="56" rx="14" ry="10" opacity="0.08" />

      {/* Cat head */}
      <circle cx="30" cy="38" r="12" opacity="0.1" />
      <circle cx="30" cy="38" r="12" fill="none" stroke="currentColor" strokeWidth="2" />

      {/* Hard hat */}
      <path d="M20 32h20v-2a10 10 0 00-20 0v2z" opacity="0.2" />
      <path d="M20 32h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M22 32v-2a8 8 0 0116 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Hat brim */}
      <rect x="18" y="31" width="24" height="2.5" rx="1" opacity="0.15" />

      {/* Round ears (poking out from hat sides) */}
      <circle cx="15" cy="31" r="4.5" opacity="0.18" />
      <circle cx="45" cy="31" r="4.5" opacity="0.18" />
      <circle cx="15" cy="31" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="45" cy="31" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />

      {/* Focused eyes (^_^ squint) */}
      <path d="M24 38c1.5-2.5 4-2.5 5.5 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 38c1.5-2.5 4-2.5 5.5 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />

      {/* Nose */}
      <ellipse cx="30" cy="42" rx="1.2" ry="0.8" opacity="0.4" />
      {/* Determined mouth */}
      <path d="M27 44s1.5 2 3 2 3-2 3-2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

      {/* Raised paw (reaching toward floating block) */}
      <path
        d="M40 44c3-4 6-8 9-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Paw at end */}
      <circle cx="49" cy="34" r="2.5" opacity="0.15" />

      {/* ── Motion sparkles ── */}
      <path
        d="M66 16l1.5 3 1.5-3-3 1.5 3 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M10 20l1 2 1-2-2 1 2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M70 50l1 2 1-2-2 1 2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
      {/* Motion lines near floating block */}
      <line x1="48" y1="32" x2="45" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.2" strokeLinecap="round" />
      <line
        x1="48"
        y1="35"
        x2="45"
        y2="34"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Done: Cat sitting proudly on top of neatly stacked blocks.
 * Tail curled up, ^_^ smile, small tool beside. Celebratory sparkle.
 * "新家安顿好了，快来开工吧！"
 */
export function DoneCatIcon({ className = 'w-20 h-20' }: IconProps) {
  return (
    <svg viewBox="0 0 80 80" fill="currentColor" className={className} aria-hidden="true">
      <title>初始化完成</title>

      {/* ── Ground shadow ── */}
      <ellipse cx="40" cy="72" rx="28" ry="4" opacity="0.06" />

      {/* ── Neatly stacked blocks (organized project) ── */}
      <rect x="20" y="54" width="40" height="12" rx="2.5" opacity="0.1" />
      <rect x="20" y="54" width="40" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="24" y="44" width="32" height="10" rx="2" opacity="0.08" />
      <rect x="24" y="44" width="32" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Checkmark on front block */}
      <path
        d="M35 59l2.5 2.5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />

      {/* ── Cat sitting on top ── */}
      {/* Cat body */}
      <ellipse cx="40" cy="42" rx="10" ry="6" opacity="0.08" />

      {/* Cat head */}
      <circle cx="40" cy="28" r="12" opacity="0.1" />
      <circle cx="40" cy="28" r="12" fill="none" stroke="currentColor" strokeWidth="2" />

      {/* Round ears */}
      <circle cx="30" cy="17" r="5" opacity="0.18" />
      <circle cx="50" cy="17" r="5" opacity="0.18" />
      <circle cx="30" cy="17" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="50" cy="17" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Inner ears */}
      <circle cx="30" cy="16" r="2.5" opacity="0.1" />
      <circle cx="50" cy="16" r="2.5" opacity="0.1" />

      {/* Proud ^_^ eyes */}
      <path d="M34 27c1.5-2.5 4-2.5 5.5 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M42 27c1.5-2.5 4-2.5 5.5 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />

      {/* Nose */}
      <ellipse cx="40" cy="32" rx="1.2" ry="0.8" opacity="0.4" />
      {/* Big proud smile */}
      <path d="M36 34s2 3 4 3 4-3 4-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Blush */}
      <circle cx="30" cy="30" r="2.5" opacity="0.1" />
      <circle cx="50" cy="30" r="2.5" opacity="0.1" />

      {/* Whiskers */}
      <line x1="26" y1="30" x2="32" y2="30.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="26" y1="33" x2="32" y2="32.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="54" y1="30" x2="48" y2="30.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <line x1="54" y1="33" x2="48" y2="32.5" stroke="currentColor" strokeWidth="1" opacity="0.25" />

      {/* Curled tail */}
      <path
        d="M52 40c4-1 7-4 6-8s-4-2-5 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Small wrench beside cat */}
      <path d="M14 52l4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.25" />
      <circle cx="12.5" cy="50.5" r="2" opacity="0.08" />

      {/* ── Celebration sparkles ── */}
      <path
        d="M8 14l2 4 2-4-4 2 4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M68 10l1.5 3 1.5-3-3 1.5 3 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M66 40l1 2 1-2-2 1 2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
}

/**
 * Cat with folder — directory/workspace metaphor.
 */
export function FolderCatIcon({ className = 'w-16 h-16' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} aria-hidden="true">
      <title>选择目录</title>
      {/* Folder */}
      <path d="M8 28h18l3-5h23a3 3 0 013 3v24a3 3 0 01-3 3H8a3 3 0 01-3-3V31a3 3 0 013-3z" opacity="0.1" />
      <path
        d="M8 28h18l3-5h23a3 3 0 013 3v24a3 3 0 01-3 3H8a3 3 0 01-3-3V31a3 3 0 013-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Round ears peeking above folder */}
      <circle cx="22" cy="22" r="5" opacity="0.18" />
      <circle cx="42" cy="22" r="5" opacity="0.18" />
      <circle cx="22" cy="22" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="42" cy="22" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Cat eyes inside folder */}
      <circle cx="28" cy="38" r="2.5" />
      <circle cx="36" cy="38" r="2.5" />
      <circle cx="29" cy="37" r="0.8" fill="white" />
      <circle cx="37" cy="37" r="0.8" fill="white" />
      {/* Nose + mouth */}
      <ellipse cx="32" cy="42" rx="1" ry="0.7" opacity="0.4" />
      <path
        d="M30 44s1 1.2 2 1.2 2-1.2 2-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Paw */}
      <path d="M19 42c0-1 1.5-2 3-2s3 1 3 2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
