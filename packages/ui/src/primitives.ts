// Astryx primitive re-export barrel — the "single door" (một cửa) for apps.
//
// Apps (admin/lms) are lint-forbidden from importing @astryxdesign/core or
// the legacy UI lib directly (see the app-scoped no-restricted-imports rule); every
// primitive they need is re-exported here and surfaced through @cmc/ui's main
// entry. This is a thin namespace facade — NOT a legacy-compat shim: the
// re-exported components keep their real Astryx prop APIs. Callers use Astryx
// props (e.g. `gap={2}` numeric spacing, `variant="primary"`). Add exports
// here as pages reveal need; the barrel is intentionally additive.
//
// Composite @cmc/ui components (StatusBadge, DataTable, …) live in ./components
// and are exported from ./index.ts alongside this barrel.

export { Text, Heading } from '@astryxdesign/core/Text';
export { Stack, HStack, VStack, StackItem } from '@astryxdesign/core/Stack';
export { Button } from '@astryxdesign/core/Button';
export { IconButton } from '@astryxdesign/core/IconButton';
export { Badge } from '@astryxdesign/core/Badge';
export { TextInput } from '@astryxdesign/core/TextInput';
export { TextArea } from '@astryxdesign/core/TextArea';
export { Selector, SelectorOption } from '@astryxdesign/core/Selector';
export { MultiSelector } from '@astryxdesign/core/MultiSelector';
export { NumberInput } from '@astryxdesign/core/NumberInput';
export { Skeleton } from '@astryxdesign/core/Skeleton';
export { Spinner } from '@astryxdesign/core/Spinner';
export { ProgressBar } from '@astryxdesign/core/ProgressBar';
export { Divider } from '@astryxdesign/core/Divider';
export { Grid, GridSpan } from '@astryxdesign/core/Grid';
export { Banner } from '@astryxdesign/core/Banner';
export { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
export { AlertDialog } from '@astryxdesign/core/AlertDialog';
export { Card } from '@astryxdesign/core/Card';
export { AppShell } from '@astryxdesign/core/AppShell';
export { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
export {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
  SideNavCollapseButton,
} from '@astryxdesign/core/SideNav';
export { Breadcrumbs, BreadcrumbItem } from '@astryxdesign/core/Breadcrumbs';
export { Tab, TabList, TabMenu } from '@astryxdesign/core/TabList';
