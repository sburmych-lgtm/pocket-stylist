import { Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Outlet />
    </div>
  );
}
