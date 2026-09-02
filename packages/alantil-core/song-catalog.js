function first(row, names, fallback = '') {
  for (const name of names) {
    const value = row?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

export function normalizeSongRow(row, index = 0, defaultPlaylistTitle = 'Песни') {
  if (!row || typeof row !== 'object') return null;
  const title = first(row, ['title','song','song_title','song_name','name','название','песня']);
  const playlistTitle = first(row, ['playlist_title','playlistTitle','playlist_name','playlist','album','плейлист','сборник'], defaultPlaylistTitle);
  const playlistId = first(row, ['playlist_id','playlistId','playlist_code','album_id'], slug(playlistTitle) || 'songs');
  const id = first(row, ['id','song_id','code'], `${playlistId}-${slug(title) || index + 1}`);
  const lyrics = first(row, ['lyrics','lyrics_kb','lyrics_alan','text_kb','original_text','text','song_text','alan_text','текст']);
  const translation = first(row, ['translation','lyrics_ru','text_ru','russian_text','translation_text','trans','перевод']);
  if (!id || !title) return null;
  return {
    id,
    title,
    artist: first(row, ['artist','performer','performer_name','singer','author','исполнитель','автор']),
    audioUrl: first(row, ['audio_url','audioUrl','audio_link','audio_src','audio','mp3','file_url','ссылка_аудио']),
    lyrics,
    translation,
    info: first(row, ['info','description','about','note','информация','описание']),
    order: toNumber(first(row, ['song_order','order','position','порядок']), index + 1),
    playlistId,
    playlistTitle,
    playlistDescription: first(row, ['playlist_description','playlistDescription','playlist_info','album_description','описание_плейлиста']),
    playlistOrder: toNumber(first(row, ['playlist_order','playlistOrder','album_order','порядок_плейлиста']), 0),
    coverUrl: first(row, ['cover_url','coverUrl','cover','image_url','обложка']),
    metadata: first(row, ['metadata','tags','keywords','метаданные']),
  };
}

export function normalizeSongCollection(collection, defaultPlaylistTitle = 'Песни') {
  const normalized = (Array.isArray(collection) ? collection : []).map((row,index) => normalizeSongRow(row,index,defaultPlaylistTitle)).filter(Boolean);
  const unique = new Map();
  normalized.forEach((song) => unique.set(song.id,song));
  return [...unique.values()].sort((left,right) => left.playlistOrder-right.playlistOrder || left.playlistTitle.localeCompare(right.playlistTitle,'ru') || left.order-right.order || left.title.localeCompare(right.title,'ru'));
}

export function buildSongPlaylists(collection) {
  const grouped = new Map();
  normalizeSongCollection(collection).forEach((song) => {
    if (!grouped.has(song.playlistId)) grouped.set(song.playlistId,{id:song.playlistId,title:song.playlistTitle,description:song.playlistDescription,order:song.playlistOrder,coverUrl:song.coverUrl,count:0});
    grouped.get(song.playlistId).count += 1;
  });
  return [...grouped.values()].sort((left,right) => left.order-right.order || left.title.localeCompare(right.title,'ru'));
}
