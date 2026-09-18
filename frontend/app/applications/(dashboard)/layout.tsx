import { ApplicationsSidebar } from "@/components/applications-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <ApplicationsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
