import pool from './database.js';

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    // Create series table
    await client.query(`
      CREATE TABLE IF NOT EXISTS series (
        id SERIAL PRIMARY KEY,
        melolo_series_id TEXT UNIQUE NOT NULL,
        cover_url TEXT,
        intro TEXT,
        title TEXT NOT NULL,
        episode_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Series table created');

    // Create episodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        series_id INTEGER NOT NULL,
        melolo_vid_id TEXT UNIQUE NOT NULL,
        cover TEXT,
        title TEXT,
        index_sequence INTEGER NOT NULL,
        duration INTEGER,
        path TEXT,
        video_height INTEGER,
        video_weight INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
        UNIQUE(series_id, index_sequence)
      )
    `);
    console.log('✓ Episodes table created');

    // Create indexes for episodes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episodes_melolo_vid_id ON episodes(melolo_vid_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episodes_path ON episodes(path)
    `);
    console.log('✓ Episodes indexes created');

    // Create books table
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        book_id TEXT UNIQUE NOT NULL,
        book_name TEXT NOT NULL,
        author TEXT,
        abstract TEXT,
        thumb_url TEXT,
        age_gate TEXT,
        book_status TEXT,
        book_type TEXT,
        category_ids TEXT,
        serial_count INTEGER DEFAULT 0,
        word_number TEXT,
        language TEXT,
        is_exclusive TEXT,
        creation_status TEXT,
        last_chapter_index TEXT,
        scraped BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Books table created');

    // Create indexes for books
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_books_book_id ON books(book_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_books_scraped ON books(scraped)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_books_language ON books(language)
    `);
    console.log('✓ Books indexes created');

    console.log('\nDatabase migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Fatal migration error:', error);
  process.exit(1);
});

