<script setup>
import { ref, computed, watch } from 'vue'
import { searchTracks, getPreviewUrl } from '../../services/spotify'

const props = defineProps({
  roomId: String,
  pseudo: String,
  otherPlayer: Object,
  currentTheme: String,
  currentThemeType: String,
  opponentReady: Boolean,
  roundResult: Object,
  scores: Object,
  readyCount: Number,
  skipCount: Number
})

const gameProgress = computed(() => {
  return window.gameProgress || null
})

const emit = defineEmits(['submit', 'nextRound', 'skip', 'playAudio', 'stopAudio'])

const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const selectedTracks = ref([])
const hasSubmitted = ref(false)
const currentAudio = ref(null)
const playingTrackId = ref(null)
const loadingPreviewId = ref(null)

watch(() => props.roundResult, (result) => {
  if (result) {
    hasSubmitted.value = false
    selectedTracks.value = []
    searchResults.value = []
    searchQuery.value = ''
  }
})

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  isSearching.value = true
  try {
    searchResults.value = await searchTracks(searchQuery.value, 15)
  } catch (e) {
    console.error(e)
  }
  isSearching.value = false
}

const selectTrack = (track) => {
  if (hasSubmitted.value) return
  if (selectedTracks.value.find(t => t.id === track.id)) {
    selectedTracks.value = selectedTracks.value.filter(t => t.id !== track.id)
  } else if (selectedTracks.value.length < 3) {
    selectedTracks.value = [...selectedTracks.value, track]
  }
}

const isSelected = (trackId) => {
  return selectedTracks.value.some(t => t.id === trackId)
}

const handleSubmit = () => {
  if (selectedTracks.value.length === 3) {
    emit('submit', selectedTracks.value)
    hasSubmitted.value = true
  }
}

const handleNextRound = () => {
  emit('nextRound')
}

const handleSkip = () => {
  emit('skip')
}

const playPreview = async (track) => {
  if (playingTrackId.value === track.id) {
    stopAudio()
    return
  }

  if (loadingPreviewId.value === track.id) return

  stopAudio()

  let previewUrl = track.previewUrl

  if (!previewUrl) {
    loadingPreviewId.value = track.id
    previewUrl = await getPreviewUrl(track.id)
    loadingPreviewId.value = null

    if (previewUrl) {
      track.previewUrl = previewUrl
    }
  }

  if (!previewUrl) return

  currentAudio.value = new Audio(previewUrl)
  currentAudio.value.volume = 0.5
  currentAudio.value.play()
  playingTrackId.value = track.id

  currentAudio.value.onended = () => {
    playingTrackId.value = null
  }
}

const stopAudio = () => {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
    playingTrackId.value = null
  }
}

const isMatch = (trackId) => {
  return props.roundResult?.matches?.includes(trackId)
}

defineExpose({ stopAudio })
</script>

<template>
  <div class="match-mode">
    <div class="theme-banner" v-if="currentTheme">
      <div class="theme-header">
        <span class="theme-label">{{ currentThemeType === 'artist' ? 'Artiste' : 'Thème' }}</span>
        <span v-if="gameProgress" class="round-counter">Round {{ gameProgress.currentRound }}/{{
          gameProgress.totalRounds }}</span>
      </div>
      <span class="theme-name">{{ currentTheme }}</span>
    </div>

    <div v-if="!currentTheme" class="waiting-start">
      <div class="loader"></div>
      <p>En attente du lancement...</p>
    </div>

    <div v-else-if="!roundResult" class="selection-phase">
      <div class="search-section">
        <div class="search-bar">
          <input v-model="searchQuery" type="text" placeholder="Rechercher une musique..." @keyup.enter="handleSearch"
            :disabled="hasSubmitted" />
          <button @click="handleSearch" :disabled="isSearching || hasSubmitted">
            {{ isSearching ? '...' : '🔍' }}
          </button>
        </div>

        <div class="search-results" v-if="searchResults.length">
          <div v-for="track in searchResults" :key="track.id" class="track-item"
            :class="{ selected: isSelected(track.id), disabled: hasSubmitted }" @click="selectTrack(track)">
            <img :src="track.image" :alt="track.name" class="track-image" />
            <div class="track-info">
              <span class="track-name">{{ track.name }}</span>
              <span class="track-artist">{{ track.artist }}</span>
            </div>
            <button class="play-btn" :class="{ loading: loadingPreviewId === track.id }"
              @click.stop="playPreview(track)" title="Écouter">
              <span v-if="loadingPreviewId === track.id" class="btn-loader"></span>
              <span v-else>{{ playingTrackId === track.id ? '⏸' : '▶' }}</span>
            </button>
            <span v-if="isSelected(track.id)" class="check">✓</span>
          </div>
        </div>
      </div>

      <div class="selected-section">
        <h3>Tes choix ({{ selectedTracks.length }}/3)</h3>
        <div class="selected-tracks">
          <div v-for="(track, index) in selectedTracks" :key="track.id" class="selected-track">
            <span class="track-number">{{ index + 1 }}</span>
            <img :src="track.image" :alt="track.name" />
            <div class="track-info">
              <span class="track-name">{{ track.name }}</span>
              <span class="track-artist">{{ track.artist }}</span>
            </div>
            <button class="play-btn small" :class="{ loading: loadingPreviewId === track.id }"
              @click="playPreview(track)">
              <span v-if="loadingPreviewId === track.id" class="btn-loader"></span>
              <span v-else>{{ playingTrackId === track.id ? '⏸' : '▶' }}</span>
            </button>
            <button v-if="!hasSubmitted" class="remove-btn" @click="selectTrack(track)">✕</button>
          </div>
          <div v-for="i in (3 - selectedTracks.length)" :key="'empty-' + i" class="selected-track empty">
            <span class="track-number">{{ selectedTracks.length + i }}</span>
            <span class="empty-text">Choisis une musique</span>
          </div>
        </div>

        <div class="submit-section">
          <button v-if="!hasSubmitted" class="btn-submit" :disabled="selectedTracks.length !== 3" @click="handleSubmit">
            Valider mes choix
          </button>
          <div v-else class="waiting-opponent">
            <div class="mini-loader"></div>
            <span v-if="!opponentReady">En attente de {{ otherPlayer?.pseudo }}...</span>
            <span v-else>{{ otherPlayer?.pseudo }} a validé !</span>
          </div>
          <button class="btn-skip" @click="handleSkip">
            Skip ({{ skipCount }}/2)
          </button>
        </div>
      </div>
    </div>

    <div v-else class="results-phase">
      <h2>Résultats</h2>

      <div class="matches-info">
        <span class="matches-count">{{ roundResult.matches.length }}</span>
        <span class="matches-label">musique{{ roundResult.matches.length > 1 ? 's' : '' }} en commun !</span>
      </div>

      <div class="results-grid">
        <div class="player-results">
          <h4>{{ pseudo }} (toi)</h4>
          <div
            v-for="track in roundResult.player1?.pseudo === pseudo ? roundResult.player1.tracks : roundResult.player2.tracks"
            :key="track.id" class="result-track" :class="{ match: isMatch(track.id) }">
            <img :src="track.image" :alt="track.name" />
            <div class="track-info">
              <span class="track-name">{{ track.name }}</span>
              <span class="track-artist">{{ track.artist }}</span>
            </div>
            <button class="play-btn small" :class="{ loading: loadingPreviewId === track.id }"
              @click="playPreview(track)">
              <span v-if="loadingPreviewId === track.id" class="btn-loader"></span>
              <span v-else>{{ playingTrackId === track.id ? '⏸' : '▶' }}</span>
            </button>
            <span v-if="isMatch(track.id)" class="match-badge">🎯</span>
          </div>
        </div>

        <div class="player-results">
          <h4>{{ otherPlayer?.pseudo }}</h4>
          <div
            v-for="track in roundResult.player1?.pseudo !== pseudo ? roundResult.player1.tracks : roundResult.player2.tracks"
            :key="track.id" class="result-track" :class="{ match: isMatch(track.id) }">
            <img :src="track.image" :alt="track.name" />
            <div class="track-info">
              <span class="track-name">{{ track.name }}</span>
              <span class="track-artist">{{ track.artist }}</span>
            </div>
            <button class="play-btn small" :class="{ loading: loadingPreviewId === track.id }"
              @click="playPreview(track)">
              <span v-if="loadingPreviewId === track.id" class="btn-loader"></span>
              <span v-else>{{ playingTrackId === track.id ? '⏸' : '▶' }}</span>
            </button>
            <span v-if="isMatch(track.id)" class="match-badge">🎯</span>
          </div>
        </div>
      </div>

      <div class="next-round-section">
        <button class="btn-next" @click="handleNextRound">
          Manche suivante ({{ readyCount }}/2)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.match-mode {
  height: 100%;
}

.waiting-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
}

.loader {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00d9ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.theme-banner {
  text-align: center;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(233, 69, 96, 0.2), rgba(168, 85, 247, 0.2));
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(233, 69, 96, 0.3);
}

.theme-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.theme-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.round-counter {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-weight: 500;
}

.theme-name {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
  color: white;
}

.selection-phase {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
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

.search-bar input:focus {
  border-color: #00d9ff;
}

.search-bar input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.search-bar input:disabled {
  opacity: 0.5;
}

.search-bar button {
  padding: 0.8rem 1.2rem;
  border: none;
  border-radius: 10px;
  background: #00d9ff;
  color: #1a1a2e;
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.search-bar button:hover:not(:disabled) {
  transform: scale(1.05);
}

.search-bar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.track-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.track-item:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.track-item.selected {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.15);
}

.track-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.track-image {
  width: 45px;
  height: 45px;
  border-radius: 6px;
  object-fit: cover;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  display: block;
  color: white;
  font-weight: 500;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.play-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 217, 255, 0.2);
  color: #00d9ff;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.play-btn:hover:not(.loading) {
  background: rgba(0, 217, 255, 0.3);
  transform: scale(1.1);
}

.play-btn.small {
  width: 30px;
  height: 30px;
  font-size: 0.8rem;
}

.play-btn.loading {
  opacity: 0.7;
  cursor: wait;
}

.btn-loader {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 217, 255, 0.3);
  border-top-color: #00d9ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

.check {
  color: #e94560;
  font-size: 1.2rem;
  font-weight: bold;
}

.selected-section h3 {
  color: white;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.selected-tracks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selected-track {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(233, 69, 96, 0.1);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 10px;
}

.selected-track.empty {
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.2);
}

.track-number {
  width: 24px;
  height: 24px;
  background: rgba(233, 69, 96, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
}

.selected-track.empty .track-number {
  background: rgba(255, 255, 255, 0.1);
}

.selected-track img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  flex-shrink: 0;
}

.empty-text {
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
}

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: rgba(233, 69, 96, 0.3);
  color: #e94560;
}

.submit-section {
  margin-top: 1rem;
  text-align: center;
}

.btn-submit {
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #e94560, #ff6b35);
  color: white;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-skip {
  margin-top: 0.75rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
}

.btn-skip:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
}

.waiting-opponent {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  padding: 1rem;
}

.mini-loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00d9ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.results-phase {
  text-align: center;
}

.results-phase h2 {
  color: white;
  margin: 0 0 1.5rem 0;
}

.matches-info {
  margin-bottom: 2rem;
}

.matches-count {
  display: inline-block;
  width: 60px;
  height: 60px;
  line-height: 60px;
  background: linear-gradient(135deg, #e94560, #ff6b35);
  border-radius: 50%;
  font-size: 1.8rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.matches-label {
  display: block;
  color: rgba(255, 255, 255, 0.7);
}

.results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  text-align: left;
  margin-bottom: 2rem;
}

.player-results h4 {
  color: white;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.result-track {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  border: 2px solid transparent;
}

.result-track.match {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.result-track img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
}

.match-badge {
  font-size: 1.2rem;
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
  transition: all 0.3s;
  font-family: inherit;
}

.btn-next:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 217, 255, 0.3);
}

.search-results::-webkit-scrollbar {
  width: 5px;
}

.search-results::-webkit-scrollbar-track {
  background: transparent;
}

.search-results::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

@media (max-width: 900px) {
  .results-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
