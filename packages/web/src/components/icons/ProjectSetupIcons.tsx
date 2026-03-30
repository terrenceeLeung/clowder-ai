/**
 * F056 / F113-E: Project setup cat illustrations.
 * Used in ProjectSetupCard for idle/processing/done states.
 * Style: filled-rounded with opacity layers (KD-9 compliant).
 */

interface IconProps {
  className?: string;
}

/**
 * Cat peeking over a cardboard box — "your project needs setting up".
 * The box represents the empty project; cat ears and curious eyes peek over.
 */
export function SetupCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>项目初始化</title>
      {/* Cardboard box */}
      <rect x="8" y="24" width="32" height="18" rx="3" opacity="0.12" />
      <rect x="8" y="24" width="32" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Box flaps */}
      <path d="M8 24l4-4h8l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M40 24l-4-4h-8l-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Cat ears peeking */}
      <path d="M16 24l-3-8 5 5z" opacity="0.25" />
      <path d="M32 24l3-8-5 5z" opacity="0.25" />
      <path d="M16 24l-3-8 5 5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 24l3-8-5 5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Cat inner ear */}
      <path d="M15.5 22l-1.5-4 2.5 2.5z" opacity="0.15" />
      <path d="M32.5 22l1.5-4-2.5 2.5z" opacity="0.15" />
      {/* Cat eyes — curious, peeking just above box top */}
      <circle cx="20" cy="26" r="1.8" />
      <circle cx="28" cy="26" r="1.8" />
      {/* Eye highlights */}
      <circle cx="20.6" cy="25.4" r="0.5" fill="white" />
      <circle cx="28.6" cy="25.4" r="0.5" fill="white" />
      {/* Paws resting on box edge */}
      <ellipse cx="18" cy="29" rx="3" ry="1.8" opacity="0.18" />
      <ellipse cx="30" cy="29" rx="3" ry="1.8" opacity="0.18" />
      <path d="M16 28.5c0-1 1-1.8 2-1.8s2 .8 2 1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M28 28.5c0-1 1-1.8 2-1.8s2 .8 2 1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {/* Paw pads (tiny) */}
      <circle cx="17" cy="29" r="0.5" opacity="0.3" />
      <circle cx="19" cy="29" r="0.5" opacity="0.3" />
      <circle cx="29" cy="29" r="0.5" opacity="0.3" />
      <circle cx="31" cy="29" r="0.5" opacity="0.3" />
    </svg>
  );
}

/**
 * Cat busily working with sparkles — processing/building state.
 * Cat face with closed "focused" eyes and sparkle effects around.
 */
export function WorkingCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>正在初始化</title>
      {/* Cat body (sitting, round) */}
      <ellipse cx="24" cy="32" rx="12" ry="10" opacity="0.1" />
      {/* Cat head */}
      <circle cx="24" cy="22" r="10" opacity="0.12" />
      <circle cx="24" cy="22" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Cat ears */}
      <path d="M15.5 17l-2-8 6 5z" opacity="0.2" />
      <path d="M32.5 17l2-8-6 5z" opacity="0.2" />
      <path d="M15.5 17l-2-8 6 5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32.5 17l2-8-6 5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Inner ears */}
      <path d="M15.8 16l-1-4.5 3 2.8z" opacity="0.12" />
      <path d="M32.2 16l1-4.5-3 2.8z" opacity="0.12" />
      {/* Focused eyes (happy squint — arc lines) */}
      <path d="M19 22c.8-1.2 2-1.8 2-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27 22c.8-1.2 2-1.8 2-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Nose + mouth */}
      <path d="M24 24.5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M22 26.5s1 1 2 1 2-1 2-1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* Whiskers */}
      <line x1="15" y1="23" x2="18" y2="23.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="15" y1="25" x2="18" y2="24.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="33" y1="23" x2="30" y2="23.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="33" y1="25" x2="30" y2="24.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      {/* Sparkles — building in progress */}
      <path
        d="M6 10l1.5 3 1.5-3-3 1.5 3 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M40 8l1 2 1-2-2 1 2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M38 28l1.2 2.4 1.2-2.4-2.4 1.2 2.4 1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M5 30l1 2 1-2-2 1 2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Wrench in paw */}
      <path d="M28 32l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="35" cy="39" r="2.5" opacity="0.15" />
      <circle cx="35" cy="39" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

/**
 * Happy cat sitting on completed box — setup done!
 * Cat with open smile, checkmark on the box, tail curled.
 */
export function DoneCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>初始化完成</title>
      {/* Completed box */}
      <rect x="10" y="30" width="28" height="14" rx="3" opacity="0.1" />
      <rect x="10" y="30" width="28" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Checkmark on box */}
      <path
        d="M20 37l3 3 5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      {/* Cat sitting on box */}
      {/* Cat body */}
      <ellipse cx="24" cy="28" rx="8" ry="5" opacity="0.12" />
      {/* Cat head */}
      <circle cx="24" cy="18" r="9" opacity="0.1" />
      <circle cx="24" cy="18" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Cat ears */}
      <path d="M16 14l-2.5-7 5.5 4.5z" opacity="0.2" />
      <path d="M32 14l2.5-7-5.5 4.5z" opacity="0.2" />
      <path d="M16 14l-2.5-7 5.5 4.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 14l2.5-7-5.5 4.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Inner ears */}
      <path d="M16.3 13.5l-1.2-3.8 2.7 2.2z" opacity="0.12" />
      <path d="M31.7 13.5l1.2-3.8-2.7 2.2z" opacity="0.12" />
      {/* Happy eyes (^_^) */}
      <path d="M19 17c1-1.5 2.5-1.5 3.5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M25.5 17c1-1.5 2.5-1.5 3.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Nose */}
      <ellipse cx="24" cy="20" rx="1" ry="0.7" opacity="0.4" />
      {/* Happy mouth (wide smile) */}
      <path
        d="M20 22s2 2.5 4 2.5 4-2.5 4-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Whiskers */}
      <line x1="14" y1="19" x2="17.5" y2="19.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="14" y1="21" x2="17.5" y2="20.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="34" y1="19" x2="30.5" y2="19.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="34" y1="21" x2="30.5" y2="20.5" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      {/* Curled tail */}
      <path
        d="M36 28c3-1 5-3 4-6s-3-2-4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Paws dangling over box edge */}
      <ellipse cx="20" cy="31" rx="2.5" ry="1.5" opacity="0.15" />
      <ellipse cx="28" cy="31" rx="2.5" ry="1.5" opacity="0.15" />
      <path d="M18.5 30.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M26.5 30.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * Cat with folder — directory/workspace metaphor.
 * Used in DirectoryBrowser empty states or folder-related UI.
 */
export function FolderCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>选择目录</title>
      {/* Folder */}
      <path d="M6 16h14l3-4h19a2 2 0 012 2v22a2 2 0 01-2 2H6a2 2 0 01-2-2V18a2 2 0 012-2z" opacity="0.1" />
      <path
        d="M6 16h14l3-4h19a2 2 0 012 2v22a2 2 0 01-2 2H6a2 2 0 01-2-2V18a2 2 0 012-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Cat inside folder, peeking out */}
      {/* Cat ears above folder top edge */}
      <path d="M18 16l-2.5-6 4.5 4z" opacity="0.25" />
      <path d="M30 16l2.5-6-4.5 4z" opacity="0.25" />
      <path d="M18 16l-2.5-6 4.5 4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M30 16l2.5-6-4.5 4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      {/* Cat face inside folder */}
      <circle cx="21" cy="24" r="1.8" />
      <circle cx="27" cy="24" r="1.8" />
      <circle cx="21.5" cy="23.4" r="0.5" fill="white" />
      <circle cx="27.5" cy="23.4" r="0.5" fill="white" />
      {/* Nose */}
      <ellipse cx="24" cy="26.5" rx="1" ry="0.7" opacity="0.35" />
      {/* Mouth */}
      <path
        d="M22 28s1 1.2 2 1.2 2-1.2 2-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Paw on folder edge */}
      <ellipse cx="15" cy="27" rx="3" ry="2" opacity="0.15" />
      <path d="M13 26.5c0-1 1-1.5 2-1.5s2 .5 2 1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      {/* Paw pad dots */}
      <circle cx="14" cy="27" r="0.4" opacity="0.3" />
      <circle cx="16" cy="27" r="0.4" opacity="0.3" />
    </svg>
  );
}
