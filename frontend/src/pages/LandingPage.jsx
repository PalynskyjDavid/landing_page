
function Card({ children, className = "" }) {
    return (
        <div
            className={
                "rounded-[var(--radius)] border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--card-fg))] shadow-sm " +
                className
            }
        >
            {children}
        </div>
    );
}

export default function LandingPage() {
    return (
        <section className="py-14 sm:py-18">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-2 lg:items-center">
                <div>
                    <h1 className="text-[var(--fs-display)] font-bold tracking-tight leading-[1.05]">
                        Themed landing page
                        <span className="block text-[rgb(var(--muted-fg))]">with a mini-game + events</span>
                    </h1>
                    <p className="mt-5 max-w-xl text-[var(--fs-body)] text-[rgb(var(--muted-fg))] leading-relaxed">
                        Start editing tokens in <code>src/index.css</code> to change the whole look instantly.
                    </p>
                </div>

                <Card className="p-5 sm:p-6">
                    <div className="text-[var(--fs-h2)] font-semibold">Showcases (placeholder)</div>
                    <p className="mt-2 text-[rgb(var(--muted-fg))]">
                        Next: add your three JS demos here.
                    </p>
                </Card>
            </div>
        </section>
    );
}