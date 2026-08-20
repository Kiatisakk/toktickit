import { AppShell } from "../components/AppShell";
import type { Crumb } from "../components/Breadcrumb";
import { StateBlock } from "../components/StateBlock";

interface PlaceholderProps {
  title: string;
  breadcrumbs: Crumb[];
  /** GitHub Issue that delivers this screen. */
  issue: number;
  description: string;
}

/**
 * Stands in for a screen a later Issue delivers.
 *
 * The foundation Issue owns the routes, the shell and the shared components;
 * the screens themselves are built one Issue at a time against their own
 * acceptance criteria. Wiring the routes up now means each of those Issues adds
 * a screen rather than also having to touch routing, and it makes the route
 * table reviewable on its own.
 */
export const Placeholder = ({
  title,
  breadcrumbs,
  issue,
  description,
}: PlaceholderProps) => (
  <AppShell breadcrumbs={breadcrumbs}>
    <h1 className="tkt-page-title">{title}</h1>
    <StateBlock
      description={`${description} Delivered by Issue #${issue}.`}
      kind="empty"
      title="Not built yet"
    />
  </AppShell>
);
