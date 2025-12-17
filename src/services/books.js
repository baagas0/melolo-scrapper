import pool from '../db/database.js';
import { searchBooks, getBookDetail } from '../api/client.js';

/**
 * Save or update book in database
 * @param {Object} bookData - Book data from API
 * @returns {Promise<number>} Book database ID
 */
export async function saveBook(bookData) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      INSERT INTO books (
        book_id, book_name, author, abstract, thumb_url, age_gate,
        book_status, book_type, category_ids, serial_count, word_number,
        language, is_exclusive, creation_status, last_chapter_index,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      ON CONFLICT(book_id) DO UPDATE SET
        book_name = EXCLUDED.book_name,
        author = EXCLUDED.author,
        abstract = EXCLUDED.abstract,
        thumb_url = EXCLUDED.thumb_url,
        age_gate = EXCLUDED.age_gate,
        book_status = EXCLUDED.book_status,
        book_type = EXCLUDED.book_type,
        category_ids = EXCLUDED.category_ids,
        serial_count = EXCLUDED.serial_count,
        word_number = EXCLUDED.word_number,
        language = EXCLUDED.language,
        is_exclusive = EXCLUDED.is_exclusive,
        creation_status = EXCLUDED.creation_status,
        last_chapter_index = EXCLUDED.last_chapter_index,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      bookData.book_id,
      bookData.book_name || '',
      bookData.author || '',
      bookData.abstract || '',
      bookData.thumb_url || '',
      bookData.age_gate || '',
      bookData.book_status || '',
      bookData.book_type || '',
      bookData.category_v2_ids || '',
      parseInt(bookData.serial_count || '0', 10),
      bookData.word_number || '',
      bookData.language || '',
      bookData.is_exclusive || '',
      bookData.creation_status || '',
      bookData.last_chapter_index || ''
    ]);

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Search and save books to database
 * @param {Object} options - Search options
 * @param {number} options.limit - Number of results per page
 * @param {number} options.maxPages - Maximum pages to fetch (default: 1)
 * @returns {Promise<Object>} Search results
 */
export async function searchAndSaveBooks(options = {}) {
  const { limit = 20, maxPages = 1, ...searchOptions } = options;
  
  let offset = searchOptions.offset || 0;
  let totalSaved = 0;
  let hasMore = true;
  let currentPage = 0;
  const allBooks = [];

  try {
    while (hasMore && currentPage < maxPages) {
      console.log(`\nFetching page ${currentPage + 1}...`);
      
      const response = await searchBooks({
        ...searchOptions,
        offset,
        limit
      });

      if (response.code !== 0) {
        const errorMsg = response.message || JSON.stringify(response);
        throw new Error(`API error: ${errorMsg}`);
      }

      const books = response.data?.cell?.books || [];
      hasMore = response.data?.has_more || false;
      
      console.log(`Found ${books.length} books on page ${currentPage + 1}`);

      // Save each book
      for (const book of books) {
        try {
          await saveBook(book);
          allBooks.push({
            id: book.book_id,
            name: book.book_name,
            author: book.author,
            episodes: book.serial_count
          });
          totalSaved++;
        } catch (error) {
          console.error(`Error saving book ${book.book_id}:`, error.message);
        }
      }

      offset = response.data?.next_offset || offset + limit;
      currentPage++;

      // Small delay to avoid rate limiting
      if (hasMore && currentPage < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      totalSaved,
      books: allBooks,
      hasMore
    };
  } catch (error) {
    console.error('Error in searchAndSaveBooks:', error.message);
    throw error;
  }
}

/**
 * Get all books from database
 * @param {Object} options - Query options
 * @param {boolean} options.scrapedOnly - Filter only scraped books
 * @param {number} options.limit - Limit results
 * @returns {Promise<Array>} Books list
 */
export async function getBooks(options = {}) {
  const { scrapedOnly = false, limit = 100 } = options;
  const client = await pool.connect();
  
  try {
    let query = 'SELECT * FROM books';
    const params = [];
    
    if (scrapedOnly) {
      query += ' WHERE scraped = $1';
      params.push(true);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Mark book as scraped
 * @param {string} bookId - Book ID
 * @returns {Promise<void>}
 */
export async function markBookAsScraped(bookId) {
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE books 
      SET scraped = true, updated_at = CURRENT_TIMESTAMP 
      WHERE book_id = $1
    `, [bookId]);
  } finally {
    client.release();
  }
}

/**
 * Get books that haven't been scraped
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} Unscraped books
 */
export async function getUnscrapedBooks(limit = 10) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT * FROM books 
      WHERE scraped = false 
      ORDER BY created_at ASC 
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Delete book from database
 * @param {string} bookId - Book ID
 * @returns {Promise<void>}
 */
export async function deleteBook(bookId) {
  const client = await pool.connect();
  
  try {
    await client.query('DELETE FROM books WHERE book_id = $1', [bookId]);
  } finally {
    client.release();
  }
}

