export default function VerifyPage() {
  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-line bg-card px-8 py-10">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Helpdesk Forge
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Check the server console
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your sign-in link was printed next to the process running the app.
          Open it in this browser to continue.
        </p>
      </div>
    </main>
  );
}
