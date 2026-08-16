import { Topbar } from "./Topbar";
import { getHeaderContext } from "@/lib/api/resources";

/**
 * Wraps a page with the shared header. Locations, alerts and the data
 * timestamp all come from the live service, so every page's header reflects the
 * same source as its content.
 */
export async function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const header = await getHeaderContext();

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        title={title}
        subtitle={subtitle}
        alertCount={header.alertCount}
        alerts={header.alerts}
        locations={header.locations}
        dataAsOf={header.dataAsOf}
      />
      {/* pb-4 is the only bottom gap; the floating copilot button clears the
          last row because panels end short of the viewport edge. */}
      <div className="flex-1 px-5 pb-4 pt-4">{children}</div>
    </div>
  );
}
