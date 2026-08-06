# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static English-language marketing landing page as the new root (`/`), moving the existing dashboard to `/app` unchanged.

**Architecture:** Move the four existing dashboard files into `web/app/app/` verbatim (a pure relocate, zero content change) so the dashboard becomes route `/app`. Build the new landing page as five small, static section components under `web/app/_components/landing/`, composed by a new `web/app/page.tsx`.

**Tech Stack:** Next.js 16 App Router, React Server Components (no `"use client"` needed anywhere in this plan — everything is static), Tailwind CSS v4, TypeScript.

## Global Constraints

- No new npm dependencies (spec: hand-coded Tailwind, no UI kit).
- English copy throughout — no hardcoded Hebrew (matches the rest of this app's UI, per the earlier hardcoded-text-to-English fix).
- Blue accent color (`blue-600`/`blue-700` for interactive elements), otherwise the existing zinc neutral palette — same base palette as the dashboard, not an unrelated new color scheme.
- The illustrative sample-extraction mockup uses placeholder data, not a real screenshot (spec decision).
- No GitHub link in the footer yet — the repo is still private; omit it entirely rather than link to something that would 404 for visitors.
- No automated tests for the landing page itself (static content, no logic) — verify by type-check + manual dev-server check. The dashboard move (Task 1) has no automated test either, for the same reason (no content changed, just relocated) — verify by confirming the existing Vitest suite still passes (proves the move didn't touch anything `web/lib/` depends on) plus a manual check that `/app` still renders.

---

### Task 1: Move the dashboard to `/app`

**Files:**
- Move: `web/app/page.tsx` → `web/app/app/page.tsx`
- Move: `web/app/DashboardClient.tsx` → `web/app/app/DashboardClient.tsx`
- Move: `web/app/DocumentsTab.tsx` → `web/app/app/DocumentsTab.tsx`
- Move: `web/app/SummaryTab.tsx` → `web/app/app/SummaryTab.tsx`

**Interfaces:**
- Produces: the dashboard, now served at route `/app` instead of `/`, with zero behavior change. Task 2's landing page links to `/app`, not `/`.

This is a pure relocate — none of these four files' *content* changes. Their relative imports (`DashboardClient.tsx` imports `./DocumentsTab` and `./SummaryTab`; `page.tsx` imports `./DashboardClient`) stay valid because all four files move together into the same new folder. Use `git mv` so git tracks this as a rename, not a delete+create.

- [ ] **Step 1: Move the four files**

```bash
cd web
mkdir -p app/app
git mv app/page.tsx app/app/page.tsx
git mv app/DashboardClient.tsx app/app/DashboardClient.tsx
git mv app/DocumentsTab.tsx app/app/DocumentsTab.tsx
git mv app/SummaryTab.tsx app/app/SummaryTab.tsx
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If you see an import resolution error, check that all four files actually landed in `app/app/` — a partial move would break the relative imports between them.)

- [ ] **Step 3: Run the existing test suite**

Run: `npx vitest run`
Expected: all existing tests still pass (43 or more, depending on what's landed by the time you run this) — this move touches no file under `web/lib/`, so this is a smoke check that nothing else broke, not a test of the move itself.

- [ ] **Step 4: Manual check that `/app` still works**

```bash
npm run dev
```

Note the port it prints (3000, or the next free port if 3000 is taken by something else). In another terminal:

```bash
curl -s http://localhost:<port>/app -o /tmp/check-app.html
grep -o "<title>.*</title>" /tmp/check-app.html
grep -c "Documents<\|Summary<" /tmp/check-app.html
```

Expected: title is still `Invoice Intelligence`, and both tab labels (`Documents`, `Summary`) appear in the server-rendered HTML — confirming the dashboard still renders correctly at its new location. Also confirm `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/` returns something other than a working dashboard page right now (it will 404 or show a default Next.js page until Task 2 replaces it — that's expected at this point, not a bug). Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move dashboard to /app, making room for the landing page

Pure relocate, zero content change — DashboardClient.tsx,
DocumentsTab.tsx, SummaryTab.tsx, and page.tsx all move into a new
app/app/ folder together, so their relative imports stay valid.
The root (/) is now free for the landing page (next task)."
git push -u origin <branch-name>
```

(Replace `<branch-name>` with whatever branch/worktree this plan is executing on.)

---

### Task 2: Build the landing page

**Files:**
- Create: `web/app/_components/landing/Hero.tsx`
- Create: `web/app/_components/landing/Benefits.tsx`
- Create: `web/app/_components/landing/HowItWorks.tsx`
- Create: `web/app/_components/landing/SampleExtraction.tsx`
- Create: `web/app/_components/landing/Footer.tsx`
- Create: `web/app/page.tsx` (the root is empty after Task 1 moved the old one away)

**Interfaces:**
- Consumes: nothing from earlier tasks — this is fully independent static content. Links to `/app`, which Task 1 already made real.
- Produces: the landing page at `/`. No exports any other task needs.

Each section component takes no props — all content is static, matching the approved copy in the spec (`docs/superpowers/specs/2026-08-06-landing-page-design.md`). None of them need `"use client"` — there's no state, no event handlers, nothing interactive beyond plain `<a>` links.

- [ ] **Step 1: Create the Hero section**

Create `web/app/_components/landing/Hero.tsx`:

```tsx
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
```

- [ ] **Step 2: Create the Benefits section**

Create `web/app/_components/landing/Benefits.tsx`:

```tsx
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
```

- [ ] **Step 3: Create the How It Works section**

Create `web/app/_components/landing/HowItWorks.tsx`:

```tsx
const STEPS = [
  { title: "Upload", description: "Drop in any invoice PDF." },
  {
    title: "Extract",
    description: "AI reads the document and pulls out vendor, items, VAT, and totals.",
  },
  {
    title: "Review",
    description:
      "See the structured result instantly, track monthly and cumulative totals, and export whenever you need to.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          How it works
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
```

(The `1`/`2`/`3` markers here are justified, not decorative — Upload → Extract → Review is a real ordered process, not an arbitrary list.)

- [ ] **Step 4: Create the Sample Extraction section**

Create `web/app/_components/landing/SampleExtraction.tsx`:

```tsx
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
```

- [ ] **Step 5: Create the Footer section**

This covers both the spec's "Final CTA" and "Footer" page-structure sections in one component (the spec's own Architecture section lists 5 components total, folding these two together) — no GitHub link yet, per Global Constraints.

Create `web/app/_components/landing/Footer.tsx`:

```tsx
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
```

- [ ] **Step 6: Create the new root page composing all five sections**

Create `web/app/page.tsx`:

```tsx
import Hero from "./_components/landing/Hero";
import Benefits from "./_components/landing/Benefits";
import HowItWorks from "./_components/landing/HowItWorks";
import SampleExtraction from "./_components/landing/SampleExtraction";
import Footer from "./_components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-full bg-white dark:bg-black">
      <Hero />
      <Benefits />
      <HowItWorks />
      <SampleExtraction />
      <Footer />
    </main>
  );
}
```

Note this file has no `export const dynamic = "force-dynamic"` — unlike the old `page.tsx` (now at `app/app/page.tsx`), this page fetches nothing and has no reason to opt out of static rendering; Next.js should be able to prerender it as a static route.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual check — visit the actual page**

```bash
npm run dev
```

Note the port. In another terminal:

```bash
curl -s http://localhost:<port>/ -o /tmp/check-landing.html
grep -o "<title>.*</title>" /tmp/check-landing.html
grep -o "Turn invoice PDFs into structured data in seconds\|Open the App\|Instant extraction\|Export anytime\|How it works\|See it in action\|Ready to stop entering invoice data by hand" /tmp/check-landing.html
```

Expected: the title is still `Invoice Intelligence`, and every one of those content fragments appears at least once — confirming all five sections rendered. Then open `http://localhost:<port>/` in an actual browser and visually confirm: the hero has the blue "Open the App" button, the four benefit cards render in a row (or stack on a narrow window), the three numbered steps show under "How it works," the sample-extraction mockup shows the document icon → arrow → data card, and clicking "Open the App" (either button) navigates to `/app` and shows the real dashboard. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 9: Check README.md / CLAUDE.md for staleness**

`CLAUDE.md`'s "Project Structure" section doesn't currently mention a landing page at all (it predates this feature), and its four bullets for the dashboard files still say `/web/app/`, which is now wrong (they moved to `/web/app/app/` in Task 1).

In `CLAUDE.md`, find this block (currently lines 32-39):

```
- `/web/app/page.tsx` — Server Component: fetches documents directly via Supabase,
  server-side, no API key involved
- `/web/app/DashboardClient.tsx` — owns tab/filter/sort state and the upload flow;
  composes `DocumentsTab`/`SummaryTab` and renders the row detail side panel
- `/web/app/DocumentsTab.tsx` — Documents tab UI: filters, sortable table, CSV export
  button
- `/web/app/SummaryTab.tsx` — Summary tab UI: cumulative total, monthly totals, company
  breakdown
```

Replace it with:

```
- `/web/app/page.tsx` — the marketing landing page (static, no data fetching);
  links to `/app` for the actual dashboard
- `/web/app/_components/landing/` — Hero, Benefits, HowItWorks,
  SampleExtraction, Footer — the landing page's section components
- `/web/app/app/page.tsx` — Server Component: fetches documents directly via
  Supabase, server-side, no API key involved (moved from `/web/app/page.tsx`
  to make room for the landing page above)
- `/web/app/app/DashboardClient.tsx` — owns tab/filter/sort state and the
  upload flow; composes `DocumentsTab`/`SummaryTab` and renders the row
  detail side panel
- `/web/app/app/DocumentsTab.tsx` — Documents tab UI: filters, sortable
  table, CSV export button
- `/web/app/app/SummaryTab.tsx` — Summary tab UI: cumulative total, monthly
  totals, company breakdown
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add the landing page

New root (/) is a static marketing page — hero, benefits, how it
works, a sample-extraction mockup, and a closing CTA — linking to
/app for the real dashboard (moved there in the previous commit).
No new dependencies, no client-side JS needed anywhere on this
page. Updated CLAUDE.md's Project Structure section for both the
new landing page files and the dashboard's new /app/app/ paths."
git push origin <branch-name>
```

(Replace `<branch-name>` with whatever branch/worktree this plan is executing on.)

---

### Task 3: Deploy

**Files:** none (deploy only)

**This task does not run in a worktree, and not through the subagent task
loop.** It runs from `master`, after this branch has passed final review
and been merged (`superpowers:finishing-a-development-branch`) — same
sequencing as the admin-dashboard plan's deploy task, for the same reason:
deploying from an unmerged branch would put unreviewed code live before
the merge decision is even made.

- [ ] **Step 1: Ask before deploying**

Confirm with the user before running a production deploy (it touches live infrastructure).

- [ ] **Step 2: Clean build caches and deploy**

```bash
cd web
rm -rf .next .open-next
npm run cf:deploy
```

- [ ] **Step 3: Verify live**

```bash
curl -sk https://your-deployment.workers.dev/ -o /tmp/verify-root.html
grep -o "Turn invoice PDFs into structured data in seconds" /tmp/verify-root.html

curl -sk https://your-deployment.workers.dev/app -o /tmp/verify-app.html
grep -o "Documents<\|Summary<" /tmp/verify-app.html
```

Expected: the landing headline appears at `/`, and both tab labels appear at `/app` — confirming the split actually deployed correctly, not just that the build succeeded.
