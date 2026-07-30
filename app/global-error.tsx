"use client";

/**
 * Fallback di ultima istanza (errori nel layout radice): HTML minimo
 * autonomo, senza dipendenze dall'app.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fc",
          fontFamily: "system-ui, sans-serif",
          color: "#111827",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>
            Qualcosa è andato storto
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            Ricarica la pagina per riprendere il lavoro.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#ff6b00",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ricarica
          </button>
          {error.digest ? (
            <p style={{ marginTop: 12, fontSize: 10, color: "#9aa7b8" }}>
              codice: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
