export interface CreateLinkCodeData {
  businessId: string;
  codeHash: string;
  /** The user generating the code, who is also who the link will act as. */
  createdBy: string;
  expiresAt: Date;
}

export interface RedeemLinkCodeData {
  codeHash: string;
  tokenHash: string;
}

/** A freshly generated code. The only time it is readable: only its hash is stored. */
export interface TuraLinkCode {
  code: string;
  expiresAt: Date;
}

/** Who a link belongs to, as TURA presents it to the person. */
export interface TuraLinkIdentity {
  userName: string;
  businessName: string;
}

export interface RedeemedTuraLink extends TuraLinkIdentity {
  /** Long-lived secret the TURA app keeps and exchanges for access tokens. */
  linkToken: string;
}

export interface TuraAccessToken extends TuraLinkIdentity {
  accessToken: string;
  expiresIn: number;
}
