import postgres from 'postgres';

// Create PostgreSQL connection for Neon
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
});

// Helper function to execute queries
export async function query<T = any>(
  queryText: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result = await sql.unsafe(queryText, params);
    return result as unknown as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Database helper functions for common operations
export const db = {
  // Users
  async getUserByClerkId(clerkId: string) {
    const result = await query(
      'SELECT * FROM users WHERE clerk_id = $1',
      [clerkId]
    );
    return result[0] || null;
  },

  async createUser(data: { clerk_id: string; email: string; name?: string }) {
    const result = await query(
      `INSERT INTO users (clerk_id, email, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.clerk_id, data.email, data.name || null]
    );
    return result[0];
  },

  // Strategies
  async getStrategiesByUserId(userId: string) {
    return await query(
      'SELECT * FROM strategies WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
  },

  async getStrategyById(id: string) {
    const result = await query(
      'SELECT * FROM strategies WHERE id = $1',
      [id]
    );
    return result[0] || null;
  },

  async createStrategy(data: any) {
    const result = await query(
      `INSERT INTO strategies (
        user_id, client_name, industry, goals, target_audience,
        brand_voice, frequency, content_length, keywords
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.user_id,
        data.client_name,
        data.industry,
        JSON.stringify(data.goals),
        data.target_audience,
        data.brand_voice,
        data.frequency,
        data.content_length,
        data.keywords,
      ]
    );
    return result[0];
  },

  // Topics
  async getTopicsByStrategyId(strategyId: string) {
    return await query(
      'SELECT * FROM topics WHERE strategy_id = $1 ORDER BY position',
      [strategyId]
    );
  },

  async createTopic(data: any) {
    const result = await query(
      `INSERT INTO topics (
        strategy_id, title, keyword, outline, seo_intent, word_count, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.strategy_id,
        data.title,
        data.keyword,
        JSON.stringify(data.outline),
        data.seo_intent,
        data.word_count,
        data.position,
      ]
    );
    return result[0];
  },

  // Posts
  async getPostsByUserId(userId: string) {
    return await query(
      'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
  },

  async getPostById(id: string) {
    const result = await query(
      'SELECT * FROM posts WHERE id = $1',
      [id]
    );
    return result[0] || null;
  },

  async createPost(data: any) {
    const result = await query(
      `INSERT INTO posts (
        topic_id, user_id, title, meta_description, content,
        word_count, fact_checks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.topic_id,
        data.user_id,
        data.title,
        data.meta_description,
        data.content,
        data.word_count,
        JSON.stringify(data.fact_checks || []),
      ]
    );
    return result[0];
  },

  async updatePost(id: string, data: any) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(data.content);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.meta_description !== undefined) {
      updates.push(`meta_description = $${paramCount++}`);
      values.push(data.meta_description);
    }

    values.push(id);
    const result = await query(
      `UPDATE posts SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result[0];
  },

  // Usage logs
  async logUsage(data: {
    user_id: string;
    operation_type: string;
    cost_usd: number;
    tokens_used: number;
    metadata?: any;
  }) {
    await query(
      `INSERT INTO usage_logs (user_id, operation_type, cost_usd, tokens_used, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.user_id,
        data.operation_type,
        data.cost_usd,
        data.tokens_used,
        JSON.stringify(data.metadata || {}),
      ]
    );
  },
};
