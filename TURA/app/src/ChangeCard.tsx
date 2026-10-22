/**
 * A change TURA made in the POS, as it was left ("Listo: "Papa" quedó en
 * 18 kg."). Shown besides what TURA says, so it can be read back at a glance.
 */
export function ChangeCard({ message }: { message: string }) {
  return (
    <section className="action-card action-card--done" aria-live="polite">
      <p className="action-card__label">Cambio hecho</p>
      <p className="action-card__summary">{message}</p>
    </section>
  );
}
