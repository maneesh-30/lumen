import Link from "next/link";

export default function Landing() {
  return (
    <main className="bg-background text-foreground">
      {/* ===== HERO (dark, cinematic) ===== */}
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#14110d] text-[#f5f1e8]">
        {/* dotted grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        {/* warm radial glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/3 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(201,100,66,0.35) 0%, rgba(201,100,66,0.10) 30%, transparent 62%)",
            filter: "blur(20px)",
          }}
        />

        {/* nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 text-sm">
          <span className="font-medium tracking-[0.3em]">LUMEN</span>
          <div className="flex items-center gap-6 text-[#a8a196]">
            <a href="#what" className="hidden transition-colors hover:text-[#f5f1e8] sm:inline">
              What it does
            </a>
            <a href="#how" className="hidden transition-colors hover:text-[#f5f1e8] sm:inline">
              How it works
            </a>
            <Link href="/call" className="transition-colors hover:text-[#f5f1e8]">
              Live call
            </Link>
          </div>
        </nav>

        {/* hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[#c9a08c]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e07a57]" />
            Grounded · Cited · Verified
          </p>
          <h1 className="font-serif text-5xl font-light leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            The engineer who never
            <br />
            has to join the call.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#b8b0a4] sm:text-lg">
            Lumen sits in your customer calls, hears the question, and answers from your real
            code, docs and tickets — with a citation for every claim, independently verified,
            and an honest &quot;I don&apos;t have that&quot; when there&apos;s no evidence.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/ask"
              className="rounded-full bg-[#e07a57] px-8 py-3 text-sm font-medium text-[#14110d] transition-colors hover:bg-[#eb8a68]"
            >
              Get started →
            </Link>
            <Link
              href="/call"
              className="rounded-full border border-white/20 px-8 py-3 text-sm font-medium text-[#f5f1e8] transition-colors hover:border-white/50"
            >
              Watch a live call
            </Link>
          </div>
        </div>

        <div className="relative z-10 pb-8 text-center text-[10px] uppercase tracking-[0.35em] text-[#6f685e]">
          Scroll to explore
        </div>
      </section>

      {/* ===== WHAT IT DOES (warm) ===== */}
      <section id="what" className="mx-auto max-w-6xl px-6 py-24">
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">What Lumen does</p>
        <h2 className="mb-3 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Your product knowledge, on every call.
        </h2>
        <p className="mb-12 max-w-2xl text-muted">
          The people who can answer the hard technical questions are your busiest engineers.
          Lumen answers those questions for them — grounded in the sources your company already
          maintains.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {f.icon}
              </div>
              <h3 className="mb-1 font-medium">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS (warm) ===== */}
      <section id="how" className="border-t border-border bg-surface-2/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">How it works</p>
          <h2 className="mb-12 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Ask out loud. Get a cited answer in seconds.
          </h2>
          <ol className="grid gap-8 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <div className="mb-3 font-serif text-3xl text-accent">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="mb-1 font-medium">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Stop pulling engineers into calls.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Try Lumen on a real codebase — ask a question, see the answer with its sources.
        </p>
        <Link
          href="/ask"
          className="mt-8 inline-block rounded-full bg-accent px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#b0512f]"
        >
          Get started →
        </Link>
        <p className="mt-16 text-xs text-muted">Lumen · built for HackWave 3.0</p>
      </section>
    </main>
  );
}

const FEATURES = [
  {
    title: "Joins the call",
    body: "Runs on real WebRTC — anyone on the call can ask a question out loud and get an answer, no engineer pulled in.",
    icon: "◎",
  },
  {
    title: "Answers from your sources",
    body: "Searches your actual code, docs, tickets and Slack at once — not a generic help centre.",
    icon: "⌕",
  },
  {
    title: "A citation for every claim",
    body: "Every answer shows the exact file and line it came from, so your team can trust it before relaying it.",
    icon: "❝",
  },
  {
    title: "Independently verified",
    body: "A second, separate model re-checks every claim against the evidence — no model grading itself.",
    icon: "✓",
  },
  {
    title: "Refuses to guess",
    body: "No evidence means “I don’t have that”, never an invented answer. Safe to face a customer.",
    icon: "⦸",
  },
  {
    title: "Speaks your language",
    body: "Hears and answers in the caller’s language — English and Indian languages — while identifiers stay exact.",
    icon: "🗣",
  },
];

const STEPS = [
  { title: "Ask", body: "Someone on the call asks a question out loud." },
  { title: "Retrieve", body: "Lumen searches the indexed code and docs by meaning." },
  { title: "Verify", body: "A second model confirms every claim is backed by a real source." },
  { title: "Answer", body: "It speaks the answer, sources shown to the operator." },
];
