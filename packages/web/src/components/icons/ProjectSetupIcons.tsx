/**
 * F056 / F113-E: Project setup cat illustrations.
 * Used in ProjectSetupCard for idle/processing/done states.
 * Style: chibi cat — big round head, large eyes, minimal detail.
 * Optimized for 48px render size. Uses currentColor for theming.
 */

interface IconProps {
  className?: string;
}

/**
 * Curious cat face with big eyes — "your project needs setting up".
 * Chibi style: oversized head, big sparkly eyes, tiny triangle ears.
 */
export function SetupCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>项目初始化</title>
      {/* Head */}
      <circle cx="24" cy="26" r="16" opacity="0.1" />
      <circle cx="24" cy="26" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Ears */}
      <path d="M10 18l-2-12 10 8z" opacity="0.2" />
      <path d="M38 18l2-12-10 8z" opacity="0.2" />
      <path d="M10 18l-2-12 10 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M38 18l2-12-10 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {/* Inner ears */}
      <path d="M11 17l-1-7 6 5z" opacity="0.1" />
      <path d="M37 17l1-7-6 5z" opacity="0.1" />
      {/* Big eyes */}
      <circle cx="18" cy="25" r="3.5" />
      <circle cx="30" cy="25" r="3.5" />
      {/* Eye highlights */}
      <circle cx="19.5" cy="23.5" r="1.2" fill="white" />
      <circle cx="31.5" cy="23.5" r="1.2" fill="white" />
      <circle cx="17" cy="26" r="0.6" fill="white" />
      <circle cx="29" cy="26" r="0.6" fill="white" />
      {/* Nose */}
      <ellipse cx="24" cy="30" rx="1.5" ry="1" opacity="0.5" />
      {/* Mouth */}
      <path d="M21 32s1.5 2 3 2 3-2 3-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Whiskers */}
      <line x1="8" y1="28" x2="14" y2="29" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="8" y1="32" x2="14" y2="31" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="40" y1="28" x2="34" y2="29" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="40" y1="32" x2="34" y2="31" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
    </svg>
  );
}

/**
 * Cat with closed happy eyes — working/processing.
 * Squinty ^_^ expression + sparkle = busy and content.
 */
export function WorkingCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>正在初始化</title>
      {/* Head */}
      <circle cx="24" cy="26" r="16" opacity="0.1" />
      <circle cx="24" cy="26" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Ears */}
      <path d="M10 18l-2-12 10 8z" opacity="0.2" />
      <path d="M38 18l2-12-10 8z" opacity="0.2" />
      <path d="M10 18l-2-12 10 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M38 18l2-12-10 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {/* Inner ears */}
      <path d="M11 17l-1-7 6 5z" opacity="0.1" />
      <path d="M37 17l1-7-6 5z" opacity="0.1" />
      {/* Happy squint eyes ^_^ */}
      <path d="M14 24c2-3 5-3 7 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M27 24c2-3 5-3 7 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* Nose */}
      <ellipse cx="24" cy="30" rx="1.5" ry="1" opacity="0.5" />
      {/* Happy mouth */}
      <path d="M20 32s2 3 4 3 4-3 4-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Sparkles */}
      <path
        d="M4 8l2 4 2-4-4 2 4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M40 10l1.5 3 1.5-3-3 1.5 3 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M42 34l1 2 1-2-2 1 2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * Cat with star eyes and big grin — setup complete!
 * Celebration expression: starry eyes + wide smile.
 */
export function DoneCatIcon({ className = 'w-12 h-12' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <title>初始化完成</title>
      {/* Head */}
      <circle cx="24" cy="26" r="16" opacity="0.1" />
      <circle cx="24" cy="26" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Ears */}
      <path d="M10 18l-2-12 10 8z" opacity="0.2" />
      <path d="M38 18l2-12-10 8z" opacity="0.2" />
      <path d="M10 18l-2-12 10 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M38 18l2-12-10 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {/* Inner ears */}
      <path d="M11 17l-1-7 6 5z" opacity="0.1" />
      <path d="M37 17l1-7-6 5z" opacity="0.1" />
      {/* Star eyes */}
      <path d="M18 25l1.2 2.4 2.6.4-1.9 1.8.5 2.6L18 31l-2.3 1.2.5-2.6-1.9-1.8 2.6-.4z" opacity="0.7" />
      <path d="M30 25l1.2 2.4 2.6.4-1.9 1.8.5 2.6L30 31l-2.3 1.2.5-2.6-1.9-1.8 2.6-.4z" opacity="0.7" />
      {/* Nose */}
      <ellipse cx="24" cy="33" rx="1.5" ry="1" opacity="0.5" />
      {/* Big happy grin */}
      <path d="M18 35s3 4 6 4 6-4 6-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Blush */}
      <circle cx="13" cy="30" r="2.5" opacity="0.12" />
      <circle cx="35" cy="30" r="2.5" opacity="0.12" />
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
      {/* Cat head */}
      <circle cx="24" cy="20" r="13" opacity="0.1" />
      <circle cx="24" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Ears */}
      <path d="M13 13l-2-10 8 7z" opacity="0.2" />
      <path d="M35 13l2-10-8 7z" opacity="0.2" />
      <path d="M13 13l-2-10 8 7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M35 13l2-10-8 7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Eyes */}
      <circle cx="19" cy="19" r="2.5" />
      <circle cx="29" cy="19" r="2.5" />
      <circle cx="20" cy="18" r="0.8" fill="white" />
      <circle cx="30" cy="18" r="0.8" fill="white" />
      {/* Nose + mouth */}
      <ellipse cx="24" cy="23" rx="1.2" ry="0.8" opacity="0.4" />
      <path
        d="M22 25s1 1.5 2 1.5 2-1.5 2-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Folder below cat */}
      <path d="M6 34h12l2-3h16a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" opacity="0.15" />
      <path
        d="M6 34h12l2-3h16a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
