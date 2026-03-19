import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TutorialStep {
  titleEn: string;
  titleCn: string;
  descEn: string;
  descCn: string;
  findTarget: () => HTMLElement | null;
}

type Position = 'top' | 'bottom' | 'left' | 'right';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ccui-tour-completed';
const PAD = 8;
const GAP = 12;
const ARROW = 8;
const RADIUS = 8;
const TOOLTIP_W = 370;

// ---------------------------------------------------------------------------
// Finders — safe, never throw
// ---------------------------------------------------------------------------

function findByText<T extends Element>(selector: string, text: string): T | null {
  try {
    for (const el of document.querySelectorAll<T>(selector)) {
      if (el.textContent?.includes(text)) return el;
    }
  } catch { /* */ }
  return null;
}

function findSessionBlock(name: string): HTMLElement | null {
  try {
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === name) {
        let node = el.parentElement;
        while (node) {
          if (node.classList.contains('rounded-lg') && node.classList.contains('border')) return node;
          node = node.parentElement;
        }
      }
    }
  } catch { /* */ }
  return null;
}

function findFirstSessionBlock(): HTMLElement | null {
  try {
    for (const el of document.querySelectorAll('div.rounded-lg.border')) {
      if (el.querySelector('span.font-medium')) return el as HTMLElement;
    }
  } catch { /* */ }
  return null;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const STEPS: TutorialStep[] = [
  {
    titleEn: 'Welcome',
    titleCn: '欢迎',
    descEn: 'Welcome to CCUI — a project manager for Claude Code. Run multiple Claude sessions in parallel, each on its own branch, without conflicts.',
    descCn: '欢迎使用 CCUI —— 专为 Claude Code 打造的可视化项目管理工具。你可以同时启动多个 Claude 会话，让它们各自在独立的代码分支上并行工作，彼此互不影响。',
    findTarget: () => {
      // Find the "Sessions" h1 and highlight the whole header bar
      const h1 = findByText<HTMLElement>('h1', 'Sessions');
      if (h1) {
        // Walk up to the header bar (border-b container)
        let node = h1.parentElement;
        while (node) {
          if (node.classList.contains('border-b')) return node;
          node = node.parentElement;
        }
        return h1;
      }
      return null;
    },
  },
  {
    titleEn: 'HEAD Session',
    titleCn: 'HEAD 会话',
    descEn: "This is the HEAD session — it always tracks your main branch. Use it for quick tasks that don't need isolation.",
    descCn: '这是 HEAD 会话 —— 它始终对应你的主分支。可以用来执行不需要隔离环境的快速任务，比如查看代码或做简单修改。',
    findTarget: () => findSessionBlock('HEAD') ?? findFirstSessionBlock(),
  },
  {
    titleEn: 'New Session',
    titleCn: '新建会话',
    descEn: 'Click here to create a new session. Each session spawns an independent Claude worker with its own terminal.',
    descCn: '点击这里新建一个会话。每个会话会启动一个独立的 Claude 工作实例，配有专属终端，让你可以同时处理多项任务。',
    findTarget: () => findByText<HTMLButtonElement>('button', 'New Session'),
  },
  {
    titleEn: 'Fork vs Attach',
    titleCn: 'Fork 与 Attach',
    descEn: 'Fork creates a new branch + worktree — Claude works in complete isolation. When done, merge changes back. Attach connects to an existing branch to continue work in progress.',
    descCn: 'Fork 模式会创建一个全新的分支和独立工作目录，Claude 在隔离环境中自由编码，完成后可以将改动合并回主分支。Attach 模式则直接连接到已有分支，适合接续之前未完成的工作。',
    findTarget: () => {
      // Open the new session form if not already open
      const form = document.querySelector('button[title="Work directly on the selected branch"]');
      if (!form) {
        const btn = findByText<HTMLButtonElement>('button', 'New Session');
        if (btn) btn.click();
        // Return null this tick — measure() will re-run after the form renders
        return null;
      }
      // Highlight the Mode toggle (parent container of Attach/Fork buttons)
      return form.closest('div.flex.bg-cc-bg-surface') as HTMLElement
        ?? form.parentElement as HTMLElement;
    },
  },
  {
    titleEn: 'Session Card',
    titleCn: '会话卡片',
    descEn: "Click a session to expand it. You'll see a live terminal where Claude is working. Use the toggle to switch between terminal view and message history.",
    descCn: '点击会话卡片即可展开，查看 Claude 正在工作的实时终端。你还可以在终端视图和消息历史之间自由切换。',
    findTarget: () => findFirstSessionBlock(),
  },
  {
    titleEn: 'Focus Mode',
    titleCn: '专注模式',
    descEn: 'Enter focus mode to work with one session full-screen. Press Esc or Cmd+1~9 to switch between sessions quickly.',
    descCn: '进入专注模式后，当前会话将全屏显示，方便你集中精力处理任务。按 Esc 退出专注模式，也可以用 Cmd+1~9 在不同会话之间快速跳转。',
    findTarget: () =>
      (document.querySelector('button[title="Focus this session"]') as HTMLElement) ?? findFirstSessionBlock(),
  },
  {
    titleEn: 'Session Lifecycle',
    titleCn: '会话生命周期',
    descEn: 'Terminate ends a session — you can merge the branch back or discard it. After termination, Resume brings it back, or Delete removes it permanently.',
    descCn: '点击 Terminate 可以结束会话 —— 你可以选择将分支改动合并回主分支，或直接丢弃。会话终止后，可以通过 Resume 恢复，或通过 Delete 彻底删除。',
    findTarget: () => {
      const btn = document.querySelector('button[title="Stop (pause session)"]')
        ?? document.querySelector('button[title="Terminate session"]')
        ?? document.querySelector('button[title="Resume session"]');
      return (btn?.parentElement as HTMLElement) ?? findFirstSessionBlock();
    },
  },
  {
    titleEn: 'Sidebar Navigation',
    titleCn: '侧边栏导航',
    descEn: 'Navigate between Sessions, Files (browse worktree diffs), Usage (track costs per session), and Agents (configure custom AI workflows).',
    descCn: '通过侧边栏切换不同功能页面：Sessions 管理所有会话，Files 浏览各分支的代码变更和差异，Usage 追踪每个会话的 token 消耗和费用，Agents 配置自定义的 AI 工作流。',
    findTarget: () => document.querySelector('nav') as HTMLElement | null,
  },
  {
    titleEn: "You're All Set!",
    titleCn: '准备就绪！',
    descEn: "You're all set! Create your first session to get started. You can replay this tutorial anytime from the sidebar.",
    descCn: '一切就绪！现在就创建你的第一个会话，开始体验多 Claude 并行工作的高效流程吧。你可以随时从侧边栏重新打开本教程。',
    findTarget: () => findByText<HTMLButtonElement>('button', 'Tutorial'),
  },
];

// ---------------------------------------------------------------------------
// SVG path helper
// ---------------------------------------------------------------------------

function overlayPath(vw: number, vh: number, rect: DOMRect | null): string {
  const outer = `M0,0 H${vw} V${vh} H0 Z`;
  if (!rect) return outer;
  const x = rect.left - PAD, y = rect.top - PAD;
  const w = rect.width + PAD * 2, h = rect.height + PAD * 2;
  const r = Math.min(RADIUS, w / 2, h / 2);
  return `${outer} M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
}

// ---------------------------------------------------------------------------
// Tooltip positioning
// ---------------------------------------------------------------------------

function pickPosition(rect: DOMRect | null, th: number): Position {
  if (!rect) return 'bottom';
  const below = window.innerHeight - rect.bottom - PAD;
  const above = rect.top - PAD;
  if (below >= th + GAP) return 'bottom';
  if (above >= th + GAP) return 'top';
  if (window.innerWidth - rect.right - PAD >= TOOLTIP_W + GAP) return 'right';
  return 'left';
}

function tooltipXY(pos: Position, rect: DOMRect | null, th: number): { left: number; top: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!rect) return { left: vw / 2 - TOOLTIP_W / 2, top: vh / 2 - th / 2 };
  let left = 0, top = 0;
  const padRect = { left: rect.left - PAD, top: rect.top - PAD, right: rect.right + PAD, bottom: rect.bottom + PAD, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  switch (pos) {
    case 'bottom': left = padRect.cx - TOOLTIP_W / 2; top = padRect.bottom + GAP; break;
    case 'top':    left = padRect.cx - TOOLTIP_W / 2; top = padRect.top - GAP - th; break;
    case 'right':  left = padRect.right + GAP; top = padRect.cy - th / 2; break;
    case 'left':   left = padRect.left - GAP - TOOLTIP_W; top = padRect.cy - th / 2; break;
  }
  return { left: Math.max(8, Math.min(left, vw - TOOLTIP_W - 8)), top: Math.max(8, Math.min(top, vh - th - 8)) };
}

function arrowCSS(pos: Position): React.CSSProperties {
  const s = ARROW;
  const base: React.CSSProperties = { position: 'absolute', width: 0, height: 0, borderStyle: 'solid' };
  switch (pos) {
    case 'bottom': return { ...base, top: -s, left: '50%', transform: 'translateX(-50%)', borderWidth: `0 ${s}px ${s}px`, borderColor: `transparent transparent var(--cc-bg-surface)` };
    case 'top':    return { ...base, bottom: -s, left: '50%', transform: 'translateX(-50%)', borderWidth: `${s}px ${s}px 0`, borderColor: `var(--cc-bg-surface) transparent transparent` };
    case 'right':  return { ...base, left: -s, top: '50%', transform: 'translateY(-50%)', borderWidth: `${s}px ${s}px ${s}px 0`, borderColor: `transparent var(--cc-bg-surface) transparent transparent` };
    case 'left':   return { ...base, right: -s, top: '50%', transform: 'translateY(-50%)', borderWidth: `${s}px 0 ${s}px ${s}px`, borderColor: `transparent transparent transparent var(--cc-bg-surface)` };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let triggerOpen: (() => void) | null = null;
export function startTutorial() { triggerOpen?.(); }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TutorialOverlay() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const liftedRef = useRef<{ el: HTMLElement; pos: string; z: string } | null>(null);

  // Auto-start on first visit (skip if project init dialog is showing)
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Check if init dialog is open — if so, Chat.tsx will trigger us after init
    const t = setTimeout(() => {
      const initDialog = document.querySelector('.fixed.inset-0.z-50');
      if (!initDialog) setActive(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // External trigger
  useEffect(() => {
    triggerOpen = () => { setStep(0); setActive(true); };
    return () => { triggerOpen = null; };
  }, []);

  const restoreLift = useCallback(() => {
    if (liftedRef.current) {
      const { el, pos, z } = liftedRef.current;
      el.style.position = pos;
      el.style.zIndex = z;
      liftedRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    restoreLift();
    setActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, [restoreLift]);

  // Measure current step target
  const measure = useCallback(() => {
    if (!active) return;
    const def = STEPS[step];
    if (!def) return;

    restoreLift();

    let el: HTMLElement | null = null;
    try { el = def.findTarget(); } catch { /* finder failed */ }

    console.log(`[tutorial] step ${step} "${def.titleEn}" → target:`, el?.tagName ?? 'null');

    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      liftedRef.current = { el, pos: el.style.position, z: el.style.zIndex };
      el.style.position = 'relative';
      el.style.zIndex = '10001';
    } else {
      setRect(null);
    }
  }, [active, step, restoreLift]);

  useEffect(() => {
    measure();
    // Retry shortly after — handles cases where findTarget triggers a DOM change (e.g. opening a form)
    const retry = setTimeout(measure, 300);
    const h = () => measure();
    window.addEventListener('resize', h);
    window.addEventListener('scroll', h, true);
    return () => { clearTimeout(retry); window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
  }, [measure]);

  // Keyboard
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); goPrev(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener('keydown', h, true); // capture phase to beat Chat.tsx handlers
    return () => window.removeEventListener('keydown', h, true);
  });

  const goNext = () => setStep((s) => s < STEPS.length - 1 ? s + 1 : (close(), s));
  const goPrev = () => setStep((s) => s > 0 ? s - 1 : s);

  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cur = STEPS[step];
  const hasTarget = !!rect;
  const tooltipH = tooltipRef.current?.offsetHeight ?? 220;
  const pos = pickPosition(rect, tooltipH);
  const xy = tooltipXY(pos, rect, tooltipH);

  return createPortal(
    <>
      {/* Overlay */}
      <svg
        style={{ position: 'fixed', inset: 0, zIndex: 10000, width: '100vw', height: '100vh', pointerEvents: 'none' }}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <path
          d={overlayPath(vw, vh, rect)}
          fillRule="evenodd"
          fill="rgba(0,0,0,0.55)"
          style={{ pointerEvents: 'auto', cursor: 'default' }}
          onClick={(e) => { e.stopPropagation(); close(); }}
        />
      </svg>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          zIndex: 10001,
          left: xy.left,
          top: xy.top,
          width: TOOLTIP_W,
          maxWidth: 'calc(100vw - 16px)',
          transition: 'left 0.3s ease, top 0.3s ease',
        }}
        className="bg-cc-bg-surface border border-cc-border rounded-xl shadow-2xl"
      >
        {hasTarget && <div style={arrowCSS(pos)} />}

        <div className="p-5">
          <h2 className="text-sm font-bold text-cc-text mb-1">{cur.titleEn}</h2>
          <h3 className="text-xs font-medium text-cc-text-secondary mb-3">{cur.titleCn}</h3>
          <p className="text-sm text-cc-text-secondary leading-relaxed mb-1">{cur.descEn}</p>
          <p className="text-xs text-cc-text-muted leading-relaxed mb-4">{cur.descCn}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-cc-text-muted tabular-nums">{step + 1} / {STEPS.length}</span>
            <div className="flex items-center gap-2">
              <button onClick={close} className="px-3 py-1.5 text-xs text-cc-text-muted hover:text-cc-text-secondary transition-colors rounded">
                Skip
              </button>
              {step > 0 && (
                <button onClick={goPrev} className="px-3 py-1.5 text-xs text-cc-text-secondary hover:text-cc-text bg-cc-bg-overlay rounded-lg transition-colors">
                  Previous
                </button>
              )}
              <button onClick={goNext} className="px-4 py-1.5 text-xs font-medium bg-cc-accent hover:bg-cc-accent-hover rounded-lg transition-colors">
                {step < STEPS.length - 1 ? 'Next' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
