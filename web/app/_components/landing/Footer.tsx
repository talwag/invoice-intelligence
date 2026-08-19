export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        מוכנים להפסיק להזין נתוני חשבוניות ידנית?
      </h2>
      {/* TODO: replace with the real demo Worker's URL once it's deployed
          (Task 6, Step 6 of docs/superpowers/plans/2026-08-19-demo.md) —
          this placeholder cannot be the real value until that Worker
          exists and its URL is known. */}
      <a
        href="https://your-demo-worker.your-demo-account-subdomain.workers.dev/demo"
        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        נסו את הדמו
      </a>
      <div className="mx-auto mt-10 max-w-xl rounded-xl border border-blue-200 bg-blue-50 px-6 py-5 text-base font-medium text-zinc-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-zinc-200">
        מעוניינים להטמיע מערכת כזו, או מערכת בהתאמה, בעסק שלכם? נשמח לשמוע מכם{" "}
        <a
          href="https://wa.me/972584431931"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          בוואטסאפ
        </a>
        ,{" "}
        <a
          href="mailto:raz@tovtech.org"
          className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          במייל
        </a>{" "}
        או באתר{" "}
        <a
          href="https://tovtech.org"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          tovtech.org
        </a>
      </div>
      <p className="mt-6 text-sm text-zinc-400">Invoice Intelligence</p>
    </footer>
  );
}
