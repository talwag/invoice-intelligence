const BENEFITS = [
  {
    title: "חילוץ מיידי",
    description: "בינה מלאכותית קוראת את החשבונית ומחלצת כל שדה תוך שניות, לא דקות.",
  },
  {
    title: "ללא הזנה ידנית",
    description: "הפסק להקליד נתוני חשבוניות ידנית. העלה PDF וזהו.",
  },
  {
    title: "ייצוא בכל עת",
    description:
      "סנן לפי חודש או חברה, ואז ייצא ל-CSV בלחיצה אחת — מוכן לגיליון האלקטרוני או לתוכנת הנהלת החשבונות שלך.",
  },
  {
    title: "דירוג ביטחון מובנה",
    description: "כל חילוץ כולל ציון ביטחון, כך שתמיד תדע מה כדאי לבדוק שוב.",
  },
];

export default function Benefits() {
  return (
    <section className="px-6 py-16">
      <h2 className="sr-only">יתרונות</h2>
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
