/**
 * PII Redactor for AI Agent
 *
 * Replaces personally identifiable information (names, emails, phones, etc.)
 * with opaque placeholders like [[Member 1]], [[Member Email 1]], etc.
 * The AI never sees real PII — only stable per-request placeholder labels.
 *
 * Non-identifying data (notes, tasks, statuses, tags, loan types, dates)
 * passes through unmodified.
 */

export class PiiRedactor {
  private clientCounter = 0;
  private clientIdToLabel = new Map<string, number>();

  /**
   * Get (or assign) a stable numeric label for a client ID within this request.
   * Returns e.g. 1, 2, 3 — consistent for the same clientId in one redactor instance.
   */
  private labelFor(clientId: string): number {
    const existing = this.clientIdToLabel.get(clientId);
    if (existing !== undefined) return existing;
    this.clientCounter += 1;
    this.clientIdToLabel.set(clientId, this.clientCounter);
    return this.clientCounter;
  }

  /** Replace a client name with [[Member N]] */
  redactName(clientId: string): string {
    return `[[Member ${this.labelFor(clientId)}]]`;
  }

  /** Replace a client email with [[Member Email N]] */
  redactEmail(clientId: string): string {
    return `[[Member Email ${this.labelFor(clientId)}]]`;
  }

  /** Replace a client phone with [[Member Phone N]] */
  redactPhone(clientId: string): string {
    return `[[Member Phone ${this.labelFor(clientId)}]]`;
  }

  /** Generic redaction for any named PII field */
  redactField(clientId: string, fieldLabel: string): string {
    return `[[Member ${fieldLabel} ${this.labelFor(clientId)}]]`;
  }
}
