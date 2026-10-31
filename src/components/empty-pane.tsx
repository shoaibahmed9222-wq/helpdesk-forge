export function EmptyPane({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </section>
  );
}
