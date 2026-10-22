/** A user's TURA app linked to this business, as shown to whoever manages the links. */
export interface TuraLink {
  id: string;
  userId: string;
  /** The POS user TURA acts as through this link. */
  userName: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface TuraLinkRow {
  id: string;
  business_id: string;
  user_id: string;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

/** A link together with the name of its user, for listing. */
export interface TuraLinkWithUserRow extends TuraLinkRow {
  first_name: string;
  last_name: string;
}

/** A business's TURA as the platform admin sees it. */
export interface PlatformTuraStatus {
  /** Whether the business has the module (and it is on platform-wide). */
  enabled: boolean;
  links: TuraLink[];
}
