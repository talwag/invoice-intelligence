export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white px-6 py-20 text-center dark:from-blue-950/20 dark:to-black sm:py-28">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Turn invoice PDFs into structured data in seconds
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Upload any invoice. Get back vendor, line items, VAT, and totals —
          automatically extracted and ready to use.
        </p>
        <a
          href="/app"
          className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Open the App
        </a>
      </div>
    </section>
  );
}
