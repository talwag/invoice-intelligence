export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        מוכנים להפסיק להזין נתוני חשבוניות ידנית?
      </h2>
      <a
        href="/app"
        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        פתח את האפליקציה
      </a>
      <p className="mt-10 text-sm text-zinc-400">Invoice Intelligence</p>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        מעוניינים להטמיע מערכת כזו, או מערכת בהתאמה, בעסק שלכם? נשמח לשמוע מכם
        —{" "}
        <a
          href="https://wa.me/972584431931"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          בוואטסאפ
        </a>
        ,{" "}
        <a
          href="mailto:raz@tovtech.org"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          במייל
        </a>{" "}
        או באתר{" "}
        <a
          href="https://tovtech.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          tovtech.org
        </a>
      </p>
    </footer>
  );
}
