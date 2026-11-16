export default function Home() {
  return (
    <main className="av-main">
      <section className="av-hero">
        <h1 className="flicker">Arcade Vault</h1>
        <p className="sub">
          Insert coin<span className="blink"> _</span>
        </p>
        <div style={{ marginTop: 32 }}>
          <button className="btn lg pulse">Empezar</button>
        </div>
      </section>
    </main>
  );
}
