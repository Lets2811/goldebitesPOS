import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

@Injectable()
export class PushNotificationsRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Saves the device's subscription for this user (a device moves to the last user who subscribed on it). */
  async upsert(data: {
    userId: string;
    businessId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO push_subscriptions (user_id, business_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         business_id = EXCLUDED.business_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent`,
      [
        data.userId,
        data.businessId,
        data.endpoint,
        data.p256dh,
        data.auth,
        data.userAgent,
      ],
    );
  }

  async remove(userId: string, endpoint: string): Promise<void> {
    await this.db.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint],
    );
  }

  async removeById(id: string): Promise<void> {
    await this.db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [id]);
  }

  async findForUser(userId: string): Promise<PushSubscriptionRow[]> {
    const result = await this.db.query<PushSubscriptionRow>(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
      [userId],
    );
    return result.rows;
  }

  async touch(id: string): Promise<void> {
    await this.db.query(
      `UPDATE push_subscriptions SET last_used_at = now() WHERE id = $1`,
      [id],
    );
  }
}
