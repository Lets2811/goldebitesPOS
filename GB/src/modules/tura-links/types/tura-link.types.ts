/** A user of this business whose TURA (the assistant) is linked to them. */
export interface TuraLink {
  id: string;
  userId: string;
  /** Full name of the POS user TURA acts as through this link. */
  userName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A one-time code to say or type to TURA. Only readable when it is generated. */
export interface TuraLinkCode {
  code: string;
  expiresAt: string;
}
