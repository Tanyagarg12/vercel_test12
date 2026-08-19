import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { getHeaderContext } from "@/lib/api/resources";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Asset Intelligence Platform",
  description: "Operations Dashboard",
};

/** Set to false to hide the nav and run the dashboard as a single screen. */
const SHOW_SIDEBAR = true;

/**
 * `data-theme="light"` pins the light palette. Without it the stylesheet
 * follows the operating system, so a machine set to dark mode renders the dark
 * theme — and the reference design for this dashboard is light-only. Delete the
 * attribute to follow the OS again, or set it to "dark" to pin dark.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Live alert count — cached per render, so the header reuses this fetch.
  const { alertCount } = SHOW_SIDEBAR
    ? await getHeaderContext()
    : { alertCount: 0 };

  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-screen">
        {SHOW_SIDEBAR && <Sidebar alertCount={alertCount} />}
        {/* Footer sits inside the scroll container, after the page content, so
            it scrolls away with the page instead of staying pinned on screen. */}
        <main className="flex-1 overflow-y-auto bg-[var(--surface-0)]">
          {children}
          <footer className="border-t border-[var(--border-hairline)] bg-[var(--surface-1)] px-5 py-1.5 text-left text-[11px] text-text-muted">
            Powered by Circumcircle Pvt Limited
          </footer>
        </main>
        <CopilotWidget />
      </body>
    </html>
  );
}
