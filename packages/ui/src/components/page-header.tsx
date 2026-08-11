import { Stack, HStack } from '@astryxdesign/core/Stack';
import { Breadcrumbs, BreadcrumbItem } from '@astryxdesign/core/Breadcrumbs';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { createContext, useContext, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export interface Breadcrumb {
  label: string;
  /** SPA path — parent crumbs are clickable when set (not the current page). */
  href?: string;
}

export interface PageHeaderProps {
  /**
   * Page title. Omit when an EntityHeader below owns the identity (single h1).
   * Breadcrumbs-only chrome is valid for DetailPage.
   */
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
}

export type BreadcrumbHrefResolver = (breadcrumb: Breadcrumb) => string | undefined;

const BreadcrumbHrefContext = createContext<BreadcrumbHrefResolver | undefined>(undefined);

/**
 * Lets an application provide route-aware defaults for breadcrumb labels.
 * An explicitly declared breadcrumb href always takes precedence.
 */
export function BreadcrumbHrefProvider({
  children,
  resolveHref,
}: {
  children: ReactNode;
  resolveHref: BreadcrumbHrefResolver;
}) {
  return (
    <BreadcrumbHrefContext.Provider value={resolveHref}>
      {children}
    </BreadcrumbHrefContext.Provider>
  );
}

/**
 * Page chrome: sticky soft header + linked breadcrumbs.
 * Parent crumbs with `href` use react-router (client nav), never full reload.
 */
export function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  const resolveBreadcrumbHref = useContext(BreadcrumbHrefContext);
  const showTitleBlock = Boolean(title) || Boolean(subtitle);
  const showMainRow = showTitleBlock || Boolean(actions);

  return (
    <div className="console-page-header">
      <Stack gap={0.5}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="console-bc" aria-label="Đường dẫn">
            <Breadcrumbs>
              {breadcrumbs.map((bc, i) => {
                const isLast = i === breadcrumbs.length - 1;
                const href = bc.href ?? resolveBreadcrumbHref?.(bc);
                const clickable = Boolean(href && !isLast);
                return (
                  <BreadcrumbItem key={`${bc.label}-${i}`} isCurrent={isLast}>
                    {clickable ? (
                      <RouterLink to={href!} className="console-bc-link">
                        {bc.label}
                      </RouterLink>
                    ) : (
                      <span className={isLast ? 'console-bc-current' : 'console-bc-plain'}>{bc.label}</span>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </Breadcrumbs>
          </nav>
        )}
        {showMainRow ? (
          <HStack justify="between" align="end">
            {showTitleBlock ? (
              <Stack gap={0}>
                {title ? (
                  <Heading level={4} color="primary">
                    {title}
                  </Heading>
                ) : null}
                {subtitle ? (
                  <Text type="supporting" size="sm">
                    {subtitle}
                  </Text>
                ) : null}
              </Stack>
            ) : (
              <span />
            )}
            {actions ? <HStack gap={1}>{actions}</HStack> : null}
          </HStack>
        ) : null}
      </Stack>
    </div>
  );
}
