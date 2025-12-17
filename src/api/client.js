import axios from 'axios';

const BASE_URL = 'https://api31-normal-myb.tmtreader.com';

// Default headers from Postman collection
const DEFAULT_HEADERS = {
  'Cookie': 'install_id=7582059766660351752; ttreq=1$29e601ce77dc82162406c6d5de09b944321983fe; odin_tt=44d85a54f262e35b427efbb16d45b30a754c14933b53dcf7630ad2597ac3f9ab1c33fe96dcd7d29a55a8370767134d2be86da6b83a454ce9b8717daa5bd48b9e38ece52522f8bc92e754bb83958518cf; msToken=CrspTWZz7D3RBFtDhtyAUTAlafkVu94O-m3acfNczOJOkec8Rl7gENqWQaDlc8gQVPrFpD2QNy4xspgy0ffdd4Y6Ahfg9mdZCRBAZpmcSrs=',
  'Accept': 'application/json; charset=utf-8,application/x-protobuf',
  'Accept-Encoding': 'gzip, deflate',
  'Age-Range': '2',
  'Host': 'api31-normal-myb.tmtreader.com',
  'passport-sdk-version': '50357',
  'User-Agent': 'com.worldance.drama/50819 (Linux; U; Android 16; en; sdk_gphone64_arm64; Build/BE2A.250530.026.F3; Cronet/TTNetVersion:8f366453 2024-12-24 QuicVersion:ef6c341e 2024-11-14)',
  'X-Argus': 's6ZnD/qir0gUn17XQTqniVlvQSZTb6HZ8OY0KtENVL3HOnClG5APMT62s/x/qcnl6qwt1Ypl9/WgORHUxv4lTFzXtB9DZHVsztjAAzYU5yBZlNcMiyf850peIpCnrKbmFQlEW4VmVzni/+7fG/SsiKWoLuuFTLSMLQqs+ceMdbAr2T+1jIX2LM9sygvqqwPDW0xoCqOcF992Qkwtz0MiHRP+SzsJBe9vhdXindw15Cm7IJ6KX2Yevat9Wm1s6zgzGeKjNfczbn6F7YvKlPFvxM8IQE4zqaOBtWjv9+mLFkVj0rFsLgvJrscEACWe5dHyLQbcDupb3D5VlXc623/dY3QgK1U8g+9lxJaiu8GMcN4f7CsM0O5U0Khc6/IeTSE26f8FtCoWsfxhM5JE9bo+rLTFrSKiP4s5N7KgFxsDxEOLTfWcz7mYs0gw84w+af/zxpiDUqf6fHdxKEHtEcsWlaY61OwSmXMbKv9gx8d/0NiVvP44nJ7/HwGWr3bH6Ax6aVPpLUP0e4TSbDh0r+HBo2EItOLNuE02Z3RiGZmHJeWGMQ==',
  'x-common-params-v2': 'iid=7582059766660351752&device_id=7582058219984668168&ac=wifi&channel=gp&aid=645713&app_name=Melolo&version_code=50819&version_name=5.0.8&device_platform=android&ssmix=a&device_type=sdk_gphone64_arm64&device_brand=google&language=en&os_api=36&os_version=16&openudid=59d32b94ddbb5d04&manifest_version_code=50819&resolution=1080*2292&dpi=320&update_version_code=50819&cdid=b98ed372-b4d5-4392-bb4a-075eb26914ed',
  'X-Gorgon': '8404c0d0000070b30c1f2f3e775f5a3219abd061942acbe7c800',
  'X-Khronos': '1765347070',
  'X-Ladon': 'nttmCFWzc7hE5w6jXgwh3lQqf5uclX5cSAQkTpVPySlaaQ5L',
  'X-SS-DP': '645713',
  'x-tt-trace-id': '00-06e37e54106938e1c7948446081cffff-06e37e54106938e1-01',
  'x-vc-bdturing-sdk-version': '2.2.1.i18n',
  'X-Xs-From-Web': 'false'
};

// Generate common query params
function getCommonParams() {
  const rticket = Date.now();
  return {
    iid: '7582059766660351752',
    device_id: '7582058219984668168',
    ac: 'wifi',
    channel: 'gp',
    aid: '645713',
    app_name: 'Melolo',
    version_code: '50819',
    version_name: '5.0.8',
    device_platform: 'android',
    os: 'android',
    ssmix: 'a',
    device_type: 'sdk_gphone64_arm64',
    device_brand: 'google',
    language: 'en',
    os_api: '36',
    os_version: '16',
    openudid: '59d32b94ddbb5d04',
    manifest_version_code: '50819',
    resolution: '1080*2292',
    dpi: '320',
    update_version_code: '50819',
    _rticket: rticket.toString(),
    current_region: 'US',
    app_language: 'id', // Changed from 'en' to 'id'
    sys_language: 'en',
    app_region: 'US',
    sys_region: 'US',
    user_language: 'id',
    time_zone: 'Asia/Jakarta',
    ui_language: 'en',
    cdid: 'b98ed372-b4d5-4392-bb4a-075eb26914ed'
  };
}

// Update timestamp headers
function updateTimestampHeaders(headers) {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    ...headers,
    'X-Khronos': timestamp.toString()
  };
}

/**
 * Get series detail including episodes list
 * @param {string} seriesId - Melolo series ID
 * @returns {Promise<Object>} Series detail with episodes
 */
export async function getSeriesDetail(seriesId) {
  const url = `${BASE_URL}/novel/player/video_detail/v1/`;
  const params = getCommonParams();
  
  const body = {
    biz_param: {
      detail_page_version: 0,
      from_video_id: '',
      need_all_video_definition: false,
      need_mp4_align: false,
      source: 4,
      use_os_player: false,
      use_server_dns: false,
      video_id_type: 1
    },
    series_id: seriesId
  };

  const headers = updateTimestampHeaders(DEFAULT_HEADERS);
  
  try {
    const response = await axios.post(url, body, {
      params,
      headers,
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching series detail for ${seriesId}:`, error.message);
    throw error;
  }
}

/**
 * Get video stream URL
 * @param {string} videoId - Melolo video ID
 * @returns {Promise<Object>} Video stream data
 */
export async function getVideoStream(videoId) {
  const url = `${BASE_URL}/novel/player/video_model/v1/`;
  const params = getCommonParams();
  
  const body = {
    biz_param: {
      detail_page_version: 0,
      device_level: 3,
      from_video_id: '',
      need_all_video_definition: true,
      need_mp4_align: false,
      use_os_player: false,
      use_server_dns: false,
      video_id_type: 0,
      video_platform: 3
    },
    video_id: videoId
  };

  const headers = updateTimestampHeaders(DEFAULT_HEADERS);
  
  try {
    const response = await axios.post(url, body, {
      params,
      headers,
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching video stream for ${videoId}:`, error.message);
    throw error;
  }
}

/**
 * Get multiple video streams
 * @param {string[]} videoIds - Array of Melolo video IDs
 * @returns {Promise<Object>} Multiple video streams data
 */
export async function getMultipleVideoStreams(videoIds) {
  const url = `${BASE_URL}/novel/player/multi_video_model/v1/`;
  const params = getCommonParams();
  
  const body = {
    biz_param: {
      detail_page_version: 0,
      device_level: 3,
      need_all_video_definition: true,
      need_mp4_align: false,
      use_os_player: false,
      use_server_dns: false,
      video_platform: 1024
    },
    video_id: videoIds.join(',')
  };

  const headers = updateTimestampHeaders(DEFAULT_HEADERS);
  
  try {
    const response = await axios.post(url, body, {
      params,
      headers,
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching multiple video streams:`, error.message);
    throw error;
  }
}

/**
 * Search books/series from bookmall
 * @param {Object} options - Search options
 * @param {string} options.tagId - Tag ID for filtering (default: 25)
 * @param {string} options.tagType - Tag type (default: 2)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @param {number} options.limit - Results per page (default: 20)
 * @param {string} options.cellId - Cell ID (default: 7450059162446200848)
 * @returns {Promise<Object>} Search results with books
 */
export async function searchBooks(options = {}) {
  const {
    tagId = '25',
    tagType = '2',
    offset = 0,
    limit = 20,
    cellId = '7450059162446200848'
  } = options;

  const url = `${BASE_URL}/i18n_novel/bookmall/cell/change/v1/`;
  
  // Build params in exact order from working curl
  const commonParams = getCommonParams();
  const params = {
    max_abstract_len: 0,
    selected_tag_id: tagId,
    selected_tag_type: tagType,
    offset: offset,
    is_preload: false,
    recommend_enable_write_client_session_cache_only: false,
    preference_strategy: 0,
    session_id: `202512101501045C6A9FEBAF21FC38E71A`,
    change_type: 0,
    enable_new_show_mechanism: false,
    time_zone: 'Asia/Jakarta',
    is_preference_force_insert: false,
    is_landing_page: 0,
    tab_scene: 3,
    tab_type: 0,
    limit: limit,
    start_offset: 0,
    cell_id: cellId,
    os: 'android',
    _rticket: commonParams._rticket,
    current_region: 'US',
    app_language: 'id', // Changed from 'en' to 'id'
    sys_language: 'en',
    app_region: 'US',
    sys_region: 'US',
    user_language: 'id',
    ui_language: 'en'
  };

  const headers = updateTimestampHeaders(DEFAULT_HEADERS);
  
  try {
    const response = await axios.get(url, {
      params,
      headers,
      timeout: 30000
    });
    console.log('===> client.js:231 ~ response', response);
    return response.data;
  } catch (error) {
    console.error(`Error searching books:`, error.message);
    throw error;
  }
}

/**
 * Get book detail by book ID
 * @param {string} bookId - Book ID
 * @returns {Promise<Object>} Book detail
 */
export async function getBookDetail(bookId) {
  const url = `${BASE_URL}/i18n_novel/book_detail/v1/`;
  const params = {
    ...getCommonParams(),
    book_id: bookId
  };

  const headers = updateTimestampHeaders(DEFAULT_HEADERS);
  
  try {
    const response = await axios.get(url, {
      params,
      headers,
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching book detail for ${bookId}:`, error.message);
    throw error;
  }
}

