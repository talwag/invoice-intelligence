export default function SampleExtraction() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">See it in action</h2>
        <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div className="flex h-24 w-20 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-3xl">📄</span>
            <span className="mt-1 text-xs">invoice.pdf</span>
          </div>
          <span className="text-2xl text-blue-500">→</span>
          <div className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Vendor</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">Acme Supplies Ltd.</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-zinc-500">Invoice #</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">INV-2024-0192</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-zinc-500">Total</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">$1,240.00</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-zinc-500">Confidence</span>
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                95%
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
