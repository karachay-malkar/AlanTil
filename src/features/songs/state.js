export const songsState = {
  currentScreen: "playlists",
  selectedPlaylistId: null,
  selectedSongId: null,
  searchQuery: "",
  scrollPositions: {},
  player: {
    songId: null,
    currentTime: 0,
    duration: 0,
    playing: false,
  },
};

export function resetPlayerState() {
  songsState.player = {
    songId: null,
    currentTime: 0,
    duration: 0,
    playing: false,
  };
}

export function resetSongsState() {
  songsState.currentScreen = "playlists";
  songsState.selectedPlaylistId = null;
  songsState.selectedSongId = null;
  songsState.searchQuery = "";
  songsState.scrollPositions = {};
  resetPlayerState();
}
