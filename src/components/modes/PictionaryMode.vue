<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { searchPlaylists, getPlaylistTracks } from '../../services/spotify'
import DrawCanvas from '../DrawCanvas.vue'
import { useSocket } from '../../composables/useSocket'

const { socketId } = useSocket()

const props = defineProps({
  roomId: String,
  pseudo: String,
  otherPlayer: Object,
  currentTheme: String,
  isCreator: Boolean,
  game2Role: String,
  game2Track: Object,
  game2Strokes: Array,
  game2Result: Object,
  game2ReadyCount: Number,
  game2PlaylistTracks: Array,
  game2NextChooser: String,
  scores: Object
})

const emit = defineEmits(['game2SetTrack', 'game2DrawStroke', 'game2ClearCanvas', 'game2Guess', 'game2NextRound'])

// Phase: 'select' | 'drawing' | 'result'
const phase = computed(() => {
  if (props.game2Result) return 'result'
  if (props.game2Role) return 'drawing'
  return 'select'
})

// Vérifier si c'est mon tour de choisir la playlist
const isMyTurnToChoose = computed(() => {
  // Si on a déjà un rôle (drawer ou guesser), on n'est plus en phase de sélection
  if (props.game2Role) return false
  
  // Si game2NextChooser est défini, utiliser celui-ci (après la première manche)
  if (props.game2NextChooser && socketId.value) {
    return socketId.value === props.game2NextChooser
  }
  
  // Sinon, au démarrage, c'est toujours le créateur qui choisit
  return props.isCreator
})

// Sélection du thème
const searchQuery = ref('')
const playlists = ref([])
const isSearching = ref(false)
const selectedPlaylist = ref(null)
const isLoadingTracks = ref(false)

// Réinitialiser l'état de sélection quand on passe à la phase de dessin
watch(() => props.game2Role, (newRole) => {
  if (newRole) {
    selectedPlaylist.value = null
    playlists.value = []
    searchQuery.value = ''
    isLoadingTracks.value = false
  }
})

// Watch pour déboguer l'alternance
watch(() => [props.game2NextChooser, socketId.value, props.game2Role], ([nextChooser, socket, role]) => {
  console.log('Pictionary alternance:', { nextChooser, socket, role, isMyTurn: nextChooser === socket })
}, { immediate: true })

// Audio
const currentAudio = ref(null)
const playingTrackId = ref(null)
const loadingPreviewId = ref(null)

const myScore = computed(() => {
  const me = props.scores?.[Object.keys(props.scores || {}).find(id => {
    return props.pseudo // On cherche notre score
  })]
  return me || 0
})

const handleSearchPlaylists = async () => {
  if (!searchQuery.value.trim()) return
  isSearching.value = true
  try {
    playlists.value = await searchPlaylists(searchQuery.value)
  } catch (e) {
    console.error(e)
  }
  isSearching.value = false
}

const selectPlaylist = async (playlist) => {
  selectedPlaylist.value = playlist
  isLoadingTracks.value = true
  try {
    // Récupère les 5 premières tracks (les plus populaires)
    const tracks = await getPlaylistTracks(playlist.id, 5)
    if (tracks.length > 0) {
      // Choisit une track au hasard
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)]
      // Envoie la track sélectionnée ET toutes les tracks de la playlist
      emit('game2SetTrack', { track: randomTrack, playlistTracks: tracks })
      // Réinitialise la sélection pour passer à la phase suivante
      selectedPlaylist.value = null
      playlists.value = []
      searchQuery.value = ''
    } else {
      selectedPlaylist.value = null
    }
  } catch (e) {
    console.error(e)
    selectedPlaylist.value = null
  }
  isLoadingTracks.value = false
}

const backToPlaylists = () => {
  selectedPlaylist.value = null
}

const handleStroke = (stroke) => {
  emit('game2DrawStroke', stroke)
}

const handleClear = () => {
  emit('game2ClearCanvas')
}

const handleSelectTrack = (track) => {
  // Envoyer l'ID de la track sélectionnée pour comparaison précise
  emit('game2Guess', { trackId: track.id, trackName: track.name })
}

const handleNextRound = () => {
  emit('game2NextRound')
  playlists.value = []
  searchQuery.value = ''
  selectedPlaylist.value = null
  stopAudio()
}

const playPreview = async (track) => {
  stopAudio()
  
  if (!track?.previewUrl) return
  
  loadingPreviewId.value = track.id
  
  try {
    currentAudio.value = new Audio(track.previewUrl)
    currentAudio.value.volume = 0.5
    await currentAudio.value.play()
    playingTrackId.value = track.id
    
    currentAudio.value.onended = () => {
      playingTrackId.value = null
    }
  } catch (e) {
    console.error('Erreur lecture audio:', e)
  }
  
  loadingPreviewId.value = null
}

const stopAudio = () => {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
    playingTrackId.value = null
  }
}

defineExpose({ stopAudio })
</script>

<template>
  <div class="game2-mode">
    <!-- Phase de sélection -->
    <div v-if="phase === 'select'" class="select-phase">
      <div class="phase-header">
        <span class="phase-icon">🎨</span>
        <h2>Pictionary Musical</h2>
        <p v-if="isMyTurnToChoose">Choisis un thème, le jeu piochera une musique au hasard !</p>
        <p v-else>{{ otherPlayer?.pseudo }} choisit la musique...</p>
      </div>

      <div v-if="isMyTurnToChoose" class="selection-area">
        <!-- Chargement des tracks -->
        <div v-if="isLoadingTracks" class="loading-selection">
          <div class="loader"></div>
          <p>Sélection d'une musique au hasard...</p>
        </div>
        
        <!-- Recherche de playlists -->
        <div v-else class="playlist-search">
          <div class="search-bar">
            <input 
              v-model="searchQuery"
              type="text"
              placeholder="Rechercher un genre, artiste, ambiance..."
              @keyup.enter="handleSearchPlaylists"
            />
            <button @click="handleSearchPlaylists" :disabled="isSearching">
              {{ isSearching ? '...' : '🔍' }}
            </button>
          </div>

          <div v-if="playlists.length" class="playlists-grid">
            <div 
              v-for="playlist in playlists" 
              :key="playlist.id"
              class="playlist-card"
              @click="selectPlaylist(playlist)"
            >
              <img v-if="playlist.image" :src="playlist.image" :alt="playlist.name" />
              <div v-else class="no-image">🎵</div>
              <span class="playlist-name">{{ playlist.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="waiting-selection">
        <div class="loader"></div>
        <p>En attente de la sélection...</p>
      </div>
    </div>

    <!-- Phase de dessin -->
    <div v-else-if="phase === 'drawing'" class="drawing-phase">
      <div v-if="game2Role === 'drawer'" class="drawer-view">
        <div class="track-to-draw">
          <img :src="game2Track?.image" :alt="game2Track?.name" />
          <div class="track-info">
            <span class="label">Fais deviner :</span>
            <span class="track-name">{{ game2Track?.name }}</span>
            <span class="track-artist">{{ game2Track?.artist }}</span>
          </div>
          <button 
            v-if="game2Track?.previewUrl"
            class="play-btn"
            :class="{ playing: playingTrackId === game2Track?.id }"
            @click="playingTrackId === game2Track?.id ? stopAudio() : playPreview(game2Track)"
          >
            {{ playingTrackId === game2Track?.id ? '⏸️' : '▶️' }}
          </button>
        </div>
        <DrawCanvas 
          :canDraw="true"
          @stroke="handleStroke"
          @clear="handleClear"
        />
      </div>

      <div v-else class="guesser-view">
        <div class="guess-header">
          <span class="icon">🤔</span>
          <p>{{ otherPlayer?.pseudo }} dessine... Devine la musique !</p>
        </div>
        <DrawCanvas 
          :canDraw="false"
          :strokes="game2Strokes"
        />
        <div class="guess-selection">
          <p class="selection-label">Choisis la musique dans la playlist :</p>
          <div class="tracks-grid">
            <div 
              v-for="track in game2PlaylistTracks" 
              :key="track.id"
              class="track-choice"
              @click="handleSelectTrack(track)"
            >
              <img :src="track.image" :alt="track.name" />
              <div class="track-info">
                <span class="track-name">{{ track.name }}</span>
                <span class="track-artist">{{ track.artist }}</span>
              </div>
              <button 
                v-if="track.previewUrl"
                class="play-preview-btn"
                @click.stop="playingTrackId === track.id ? stopAudio() : playPreview(track)"
              >
                {{ playingTrackId === track.id ? '⏸️' : '▶️' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Phase de résultat -->
    <div v-else-if="phase === 'result'" class="result-phase">
      <div class="result-card" :class="{ correct: game2Result?.correct }">
        <span class="result-icon">{{ game2Result?.correct ? '🎉' : '😅' }}</span>
        <h2>{{ game2Result?.correct ? 'Bravo !' : 'Raté !' }}</h2>
        
        <div class="track-reveal">
          <img :src="game2Result?.track?.image" :alt="game2Result?.track?.name" />
          <div class="track-info">
            <span class="track-name">{{ game2Result?.track?.name }}</span>
            <span class="track-artist">{{ game2Result?.track?.artist }}</span>
          </div>
        </div>
        
        <button 
          v-if="game2Result?.track?.previewUrl"
          class="play-btn-big"
          :class="{ playing: playingTrackId === game2Result?.track?.id }"
          @click="playingTrackId === game2Result?.track?.id ? stopAudio() : playPreview(game2Result?.track)"
        >
          {{ playingTrackId === game2Result?.track?.id ? '⏸️ Pause' : '▶️ Écouter' }}
        </button>

        <p v-if="!game2Result?.correct" class="guess-was">
          Proposition : "{{ game2Result?.guess }}"
        </p>

        <div class="next-round-section">
          <button class="btn-next" @click="handleNextRound">
            Manche suivante ({{ game2ReadyCount }}/2)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game2-mode {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Select Phase */
.select-phase {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.phase-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.phase-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
}

.phase-header h2 {
  color: white;
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.phase-header p {
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.selection-area {
  flex: 1;
  overflow-y: auto;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-bar input {
  flex: 1;
  padding: 0.8rem 1rem;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  outline: none;
  font-family: inherit;
}

.search-bar input:focus { border-color: #00d9ff; }
.search-bar input::placeholder { color: rgba(255, 255, 255, 0.4); }

.search-bar button {
  padding: 0.8rem 1.2rem;
  border: none;
  border-radius: 10px;
  background: #00d9ff;
  color: #1a1a2e;
  font-size: 1.1rem;
  cursor: pointer;
}

.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.playlist-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.playlist-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.playlist-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.playlist-card .no-image {
  width: 100%;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.playlist-name {
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.back-btn {
  background: none;
  border: none;
  color: #00d9ff;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  margin-bottom: 1rem;
}

.track-selection h3 {
  color: white;
  margin: 0 0 0.5rem 0;
}

.selection-hint {
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
}

.no-tracks {
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: 2rem;
}

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.track-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.track-card:hover {
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.track-card img {
  width: 50px;
  height: 50px;
  border-radius: 6px;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  display: block;
  color: white;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
}

.select-icon {
  color: #a855f7;
  font-size: 1.2rem;
}

.waiting-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
}

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00d9ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Drawing Phase */
.drawing-phase {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drawer-view, .guesser-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.track-to-draw {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(233, 69, 96, 0.2));
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.track-to-draw img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
}

.track-to-draw .label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.track-to-draw .track-name {
  font-size: 1.1rem;
  font-weight: 600;
}

.play-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 217, 255, 0.2);
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.play-btn:hover {
  background: rgba(0, 217, 255, 0.4);
  transform: scale(1.1);
}

.play-btn.playing {
  background: rgba(233, 69, 96, 0.3);
}

.play-btn-big {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 25px;
  background: linear-gradient(135deg, #00d9ff, #a855f7);
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1rem;
}

.play-btn-big:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.4);
}

.play-btn-big.playing {
  background: linear-gradient(135deg, #e94560, #a855f7);
}

.guess-header {
  text-align: center;
  padding: 1rem;
  background: rgba(0, 217, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 1rem;
}

.guess-header .icon {
  font-size: 2rem;
}

.guess-header p {
  color: #00d9ff;
  margin: 0.5rem 0 0 0;
  font-weight: 500;
}

.guess-selection {
  margin-top: 1rem;
}

.selection-label {
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.tracks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
}

.track-choice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.track-choice:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.4);
  transform: translateY(-2px);
}

.track-choice img {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  flex-shrink: 0;
}

.track-choice .track-info {
  flex: 1;
  min-width: 0;
}

.track-choice .track-name {
  display: block;
  color: white;
  font-weight: 500;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-choice .track-artist {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
}

.play-preview-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 217, 255, 0.2);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.play-preview-btn:hover {
  background: rgba(0, 217, 255, 0.4);
  transform: scale(1.1);
}

/* Result Phase */
.result-phase {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-card {
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 2px solid rgba(233, 69, 96, 0.3);
}

.result-card.correct {
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.1);
}

.result-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 0.5rem;
}

.result-card h2 {
  color: white;
  margin: 0 0 1.5rem 0;
}

.track-reveal {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  margin-bottom: 1rem;
}

.track-reveal img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
}

.track-reveal .track-info {
  text-align: left;
}

.track-reveal .track-name {
  font-size: 1.1rem;
}

.guess-was {
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  margin-bottom: 1.5rem;
}

.btn-next {
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: #00d9ff;
  color: #1a1a2e;
  cursor: pointer;
  font-family: inherit;
}

.loading-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.7);
}

.loading-selection p {
  margin-top: 1rem;
  color: #00d9ff;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}
</style>
