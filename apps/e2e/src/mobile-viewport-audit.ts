import type { Page } from '@playwright/test';

export interface ViewportAuditMetric {
  selector: string;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface MobileViewportAudit {
  viewport: { width: number; height: number };
  document: ViewportAuditMetric;
  localOverflowOwners: ViewportAuditMetric[];
  missingRequiredControls: Array<{ selector: string }>;
  clippedRequiredControls: Array<{ selector: string; left: number; right: number; top: number; bottom: number }>;
  tooSmallTargets: Array<{ selector: string; width: number; height: number }>;
}

/** Intentional local horizontal scrolling remains a valid ERP affordance. The
 * audit records these owners separately so a table/kanban rail cannot mask
 * accidental page or shell overflow. */
export const INTENTIONAL_LOCAL_OVERFLOW_SELECTORS = [
  '.console-list',
  '.console-kanban',
  '.console-rail',
  '.fc-scroller',
] as const;

/** Collects geometry only. Phase 1 uses this to preserve the pre-fix failure
 * evidence; Phase 5 turns the same report into zero-violation assertions. */
export async function collectMobileViewportAudit(
  page: Page,
  options: { requiredControls?: readonly string[] } = {},
): Promise<MobileViewportAudit> {
  return page.evaluate(
    ({ intentionalSelectors, requiredControls }) => {
      const root = document.documentElement;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const metrics = (selector: string) =>
        [...document.querySelectorAll(selector)].map((element) => ({
          selector,
          scrollWidth: (element as HTMLElement).scrollWidth,
          clientWidth: (element as HTMLElement).clientWidth,
          scrollHeight: (element as HTMLElement).scrollHeight,
          clientHeight: (element as HTMLElement).clientHeight,
        }));
      const localOverflowOwners = intentionalSelectors.flatMap(metrics);
      const missingRequiredControls = requiredControls.flatMap((selector) =>
        document.querySelector(selector) ? [] : [{ selector }],
      );
      const clippedRequiredControls = requiredControls.flatMap((selector) =>
        [...document.querySelectorAll(selector)].flatMap((element) => {
          const rect = element.getBoundingClientRect();
          const clipped = rect.left < 0 || rect.right > viewport.width || rect.top < 0 || rect.bottom > viewport.height;
          return clipped
            ? [{ selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }]
            : [];
        }),
      );
      const tooSmallTargets = [...document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"]',
      )].flatMap((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0 || rect.height === 0) return [];
        return rect.width < 44 || rect.height < 44
          ? [{ selector: element.matches('[aria-label]') ? `[aria-label="${element.getAttribute('aria-label')}"]` : element.tagName.toLowerCase(), width: rect.width, height: rect.height }]
          : [];
      });

      return {
        viewport,
        document: {
          selector: 'document.documentElement',
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
        },
        localOverflowOwners,
        missingRequiredControls,
        clippedRequiredControls,
        tooSmallTargets,
      };
    },
    {
      intentionalSelectors: [...INTENTIONAL_LOCAL_OVERFLOW_SELECTORS],
      requiredControls: [...(options.requiredControls ?? [])],
    },
  );
}
