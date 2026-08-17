const STEPS = [
  { title: "העלאה", description: "גרור לכאן כל חשבונית PDF." },
  {
    title: "חילוץ",
    description: 'בינה מלאכותית קוראת את המסמך ומחלצת ספק, פריטים, מע"מ וסכומים.',
  },
  {
    title: "בדיקה",
    description:
      "צפה בתוצאה המובנית באופן מיידי, עקוב אחר סכומים חודשיים ומצטברים, וייצא מתי שתרצה.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          איך זה עובד
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {i + 1}
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-50">{step.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
