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

/** A business's TURA as the platform admin sees it. */
export interface PlatformTuraStatus {
  /** Whether the business has the TURA module (and it is on platform-wide). */
  enabled: boolean;
  links: TuraLink[];
}
