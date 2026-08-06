export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Ready to stop entering invoice data by hand?
      </p>
      <a
        href="/app"
        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Open the App
      </a>
      <p className="mt-10 text-sm text-zinc-400">Invoice Intelligence</p>
    </footer>
  );
}
