export const SONGS_CACHE_TTL_MS = 60 * 60 * 1000;

const GROUPS = {
  nart_songs: { title: 'Нарт джырла', order: 1 },
  classics: { title: 'Классика', order: 2 },
  modern: { title: 'Современные песни', order: 3 },
};

const CATALOG_ROWS = [
  ['S0001','nart_songs',1,'Нартланы жыйылыулары','Отаров Омар'],
  ['S0002','classics',1,'Белляу',''],['S0003','classics',2,'Къарачай джашла',''],['S0004','classics',3,'Къонакъгъа кел','Омар Отаров'],['S0005','classics',4,'Суу алыб келе',''],['S0006','classics',5,'Тюз тепсеу (къарлы таулагъа)',''],['S0007','classics',6,'Нёгерге сени берселе','Узденов Борисби'],['S0008','classics',7,'Айжаякъ',''],
  ['S0009','modern',1,'Салам джашнагъан джериме','Байкулов Солтан / гр. Салам'],['S0010','modern',2,'Алтыным','Аппаев Марат'],['S0011','modern',3,'Адамлагъ алгъыш тилек','Узденов Альберт'],['S0012','modern',4,'Къайдаса, ариуум','Катчиев Роберт'],['S0013','modern',5,'Къарамынгдан тоймайма','Токов Мурат'],['S0014','modern',6,'Ариудан ариу','Катчиев Роберт'],['S0015','modern',7,'Эки джюрекге','Токов Мурат'],['S0016','modern',8,'Излейме сени','Таукенов Алихан'],['S0017','modern',9,'Къарачайданма',''],['S0018','modern',10,'Марьям','Газаев Алим'],['S0019','modern',11,'Сюймеклик жара','Атмурзаев Эльдар'],['S0020','modern',12,'Ариу сёзле','Катчиев Роберт'],['S0021','modern',13,'Нек болады алай','Шунгаров Хорлам'],['S0022','modern',14,'Бол къатымда','Катчиев Роберт'],['S0023','modern',15,'Къарда атынгы джазама','Катчиев Роберт'],['S0024','modern',16,'Бюгюннгю къызгъа','Созаруков Дахир'],['S0025','modern',17,'Адамды бизни атыбыз','Атмурзаев Эльдар'],['S0026','modern',18,'Барсам, аллай джашха барлыкъма',''],['S0027','modern',19,'Ариугъа','Текеев Артур'],['S0028','modern',20,'Агъач къоянчыкъ','Байкулов Солтан'],['S0029','modern',21,'Къара чачынг','Текеев Артуур'],['S0030','modern',22,'Джаз сюймеклик','Занкишиев Марат'],['S0031','modern',23,'Ийнар','Катчиев Роберт'],['S0032','modern',24,'Къалай ариу эдинг','Катчиев Роберт'],['S0033','modern',25,'Джашлыкъ','Токов Мурат'],['S0034','modern',26,'Таулу байракъ','Атмурзаев Эльдар'],['S0035','modern',27,'Джюрекни джаныса','Аппаев Алим'],['S0036','modern',28,'Сени сакълай','Джанибеков Амиран'],['S0037','modern',29,'Уялма менден','Байкулов Солтан'],['S0038','modern',30,'Унутма мени','Тоторкулов Аслан'],['S0039','modern',31,'Бек сюйдюм','Эркенов Таулан'],['S0040','modern',32,'Джангы Малкъар','Атмурзаев Эльдар'],['S0041','modern',33,'Таулу той','Газаев Алим'],['S0042','modern',34,'Джуукъ барайым къатынга','Холамханов Къайсын'],['S0043','modern',35,'Эки джилтин','Чомаев Расул'],['S0044','modern',36,'Лейла',''],
];

export const BUNDLED_SONG_CATALOG = Object.freeze(CATALOG_ROWS.map(([id,playlistId,order,title,artist]) => {
  const group = GROUPS[playlistId] || { title: '', order: 0 };
  return Object.freeze({id,title,artist,audioUrl:'',lyrics:'',translation:'',info:id==='S0035'?'Слова: Марьям Хабичева-Бачиева':'',order,playlistId,playlistTitle:group.title,playlistDescription:'',playlistOrder:group.order,coverUrl:'',metadata:''});
}));

function text(value){return value == null ? '' : String(value);}
function number(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}

export function normalizeSupabaseSong(row){
  if(!row?.id)return null;
  return {
    id:text(row.id),
    title:text(row.title_alan_cyrillic || row.title_ru || row.title_en || row.title_tr || row.id),
    artist:text(row.performer || row.author),
    audioUrl:'',
    lyrics:text(row.lyrics_alan_cyrillic),
    translation:text(row.lyrics_ru),
    info:text(row.info),
    order:number(row.sort_order,0),
    playlistId:text(row.playlist_id || row.category || 'songs'),
    playlistTitle:text(row.playlist_title || row.category || 'Песни'),
    playlistDescription:text(row.playlist_description),
    playlistOrder:number(row.playlist_order,0),
    coverUrl:text(row.cover_url),
    metadata:row.metadata && typeof row.metadata==='object' ? JSON.stringify(row.metadata) : text(row.metadata),
    titleAlanCyrillic:text(row.title_alan_cyrillic),
    titleAlanTurkic:text(row.title_alan_turkic),
    titleRu:text(row.title_ru),
    titleEn:text(row.title_en),
    titleTr:text(row.title_tr),
    lyricsAlanTurkic:text(row.lyrics_alan_turkic),
    lyricsEn:text(row.lyrics_en),
    lyricsTr:text(row.lyrics_tr),
    updatedAt:text(row.updated_at),
  };
}

export function normalizeSupabaseSongs(rows=[]){
  const unique=new Map();
  for(const row of Array.isArray(rows)?rows:[]){const song=normalizeSupabaseSong(row);if(song)unique.set(song.id,song);}
  return Array.from(unique.values()).sort((a,b)=>a.playlistOrder-b.playlistOrder||a.playlistTitle.localeCompare(b.playlistTitle,'ru')||a.order-b.order||a.title.localeCompare(b.title,'ru'));
}

export function normalizeSongsCache(value){
  const rows=Array.isArray(value)?value:value?.songs;
  if(!Array.isArray(rows))return null;
  return {songs:rows,fetchedAt:Array.isArray(value)?0:Math.max(0,Number(value?.fetchedAt)||0)};
}

export function isSongsCacheFresh(fetchedAt,now=Date.now()){
  const age=Number(now)-Number(fetchedAt||0);
  return Number(fetchedAt)>0&&age>=0&&age<SONGS_CACHE_TTL_MS;
}