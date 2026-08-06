const BENEFITS = [
  {
    title: "Instant extraction",
    description: "AI reads your invoice and extracts every field in seconds, not minutes.",
  },
  {
    title: "No manual entry",
    description: "Stop typing invoice data by hand. Upload a PDF and you're done.",
  },
  {
    title: "Export anytime",
    description:
      "Filter by month or company, then export to CSV in one click — ready for your spreadsheet or accounting software.",
  },
  {
    title: "Confidence scoring built in",
    description:
      "Every extraction includes a confidence score, so you always know what's worth double-checking.",
  },
];

export default function Benefits() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{benefit.title}</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{benefit.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
