import { useQuery } from "@tanstack/react-query";

async function fetchStatus(): Promise<Record<string, unknown>> {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json() as Promise<Record<string, unknown>>;
}

export function HomePage() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Pocket Stylist</h1>
      <p className="text-lg text-neutral-500">
        AI-powered wardrobe assistant
      </p>

      {isLoading ? (
        <div className="animate-pulse text-neutral-400">Loading...</div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            System Status
          </h2>
          <ul className="space-y-2 text-sm">
            {status &&
              Object.entries(status).map(([key, value]) => (
                <li key={key} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${value === true ? "bg-green-500" : value === false ? "bg-red-400" : "bg-blue-400"}`}
                  />
                  <span className="font-medium text-neutral-700">{key}</span>
                  <span className="text-neutral-400">
                    {String(value)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
