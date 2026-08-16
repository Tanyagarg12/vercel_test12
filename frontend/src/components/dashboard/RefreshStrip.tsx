"use client";

import { useEffect, useState } from "react";

const REFRESH_SECONDS = 30;

/**
 * "Last Updated" clock. Read during render and re-read on each interval tick;
 * `suppressHydrationWarning` covers the expected difference between the
 * server-rendered and client-rendered time.
 */
export function LastUpdated() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-[12px] text-text-muted">
      Last Updated:{" "}
      <span className="font-medium text-text-secondary" suppressHydrationWarning>
        {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
    </span>
  );
}
