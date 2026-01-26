<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getPopularTracksByCategory } from '../../services/spotify'
import { useSocket } from '../../composables/useSocket'

const { socketId, players } = useSocket()

const themesBlindtest = ref({ categories: [] })

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
  skipCount: Number,
  isCreator: Boolean,
  blindtestTracks: Array,
  blindtestCurrentTrackIndex: Number,
  blindtestCurrentTrack: Object,
  blindtestAnswerResult: Object,
  blindtestRoundResult: Object,
  blindtestReadyCount: Number,
  blindtestGameEnded: Boolean
})

const emit = defineEmits([
  'blindtestSetTracks',
  'blindtestSubmitAnswer',
  'blindtestNextTrack',
  'blindtestAdjustScore'
])

const isLoadingTracks = ref(false)
const trackNameGuess = ref('')
const artistNameGuess = ref('')
const hasSubmitted = ref(false)
const currentAudio = ref(null)
const playingTrackId = ref(null)
const loadingPreviewId = ref(null)

// Phase: 'loading' | 'playing' | 'result' | 'ended'
const phase = computed(() => {
  if (props.blindtestGameEnded) return 'ended'
  if (props.blindtestRoundResult) return 'result'
  if (props.blindtestCurrentTrack) return 'playing'
  if (isLoadingTracks.value) return 'loading'
  return 'waiting'
})

const currentTrackNumber = computed(() => {
  return (props.blindtestCurrentTrackIndex || 0) + 1
})

const totalTracks = computed(() => {
  return props.blindtestTracks?.length || 10
})

// Charger le fichier JSON au montage
onMounted(async () => {
  // Charger le fichier JSON depuis le serveur Express
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
  try {
    const response = await fetch(`${SERVER_URL}/themes_blindtest.json`)
    if (response.ok) {
      themesBlindtest.value = await response.json()
      console.log('Catégories chargées:', themesBlindtest.value.categories.length)
    } else {
      console.error('Erreur HTTP:', response.status, response.statusText)
    }
  } catch (e) {
    console.warn('Impossible de charger themes_blindtest.json:', e)
  }
})

// Watch pour charger les tracks quand le jeu démarre
watch(() => [props.isCreator, props.blindtestTracks, themesBlindtest.value.categories.length], 
  ([isCreator, tracks, categoriesLength]) => {
    // Charger les tracks si :
    // - On est le créateur
    // - Les tracks ne sont pas encore chargés
    // - Les catégories sont disponibles
    // - On n'est pas en train de charger
    if (isCreator && !tracks?.length && categoriesLength > 0 && !isLoadingTracks.value) {
      console.log('Démarrage du chargement des tracks...')
      loadTracks()
    }
  },
  { immediate: true }
)


watch(() => props.blindtestCurrentTrack, (track) => {
  if (track) {
    hasSubmitted.value = false
    trackNameGuess.value = ''
    artistNameGuess.value = ''
    stopAudio()
  }
})

watch(() => props.blindtestRoundResult, (result) => {
  if (result) {
    stopAudio()
  }
})

const loadTracks = async () => {
  if (isLoadingTracks.value) {
    console.log('Chargement déjà en cours, on ignore')
    return
  }
  
  isLoadingTracks.value = true
  console.log('Début du chargement des tracks...')
  
  try {
    const categories = themesBlindtest.value.categories
    if (!categories || categories.length === 0) {
      console.error('Aucune catégorie disponible')
      alert('Impossible de charger les catégories. Veuillez réessayer.')
      isLoadingTracks.value = false
      return
    }
    
    console.log(`Chargement depuis ${categories.length} catégories disponibles`)
    const allTracks = []
    
    // Prendre des musiques de différentes catégories
    const shuffledCategories = [...categories].sort(() => Math.random() - 0.5)
    
    for (const category of shuffledCategories.slice(0, 5)) {
      // Prendre un terme de recherche aléatoire de la catégorie
      const searchTerm = category.searchTerms[Math.floor(Math.random() * category.searchTerms.length)]
      console.log(`Recherche dans la catégorie "${category.name}" avec le terme "${searchTerm}"`)
      
      try {
        const tracks = await getPopularTracksByCategory(searchTerm, 5)
        console.log(`Trouvé ${tracks.length} track(s) pour "${category.name}"`)
        
        // La fonction retourne déjà une track sélectionnée parmi les 10 plus populaires
        if (tracks.length > 0) {
          allTracks.push(...tracks)
          console.log(`Ajouté ${tracks.length} track(s). Total: ${allTracks.length}`)
        }
        
        if (allTracks.length >= 10) break
      } catch (e) {
        console.error(`Erreur chargement catégorie ${category.name}:`, e)
      }
    }
    
    // S'assurer d'avoir exactement 10 tracks
    const finalTracks = allTracks.slice(0, 10)
    console.log(`Chargement terminé. ${finalTracks.length} tracks au total`)
    
    if (finalTracks.length > 0) {
      console.log('Envoi des tracks au serveur...')
      emit('blindtestSetTracks', finalTracks)
    } else {
      console.error('Aucune track chargée')
      alert('Impossible de charger les musiques. Vérifiez que le serveur est démarré (npm run server) et que les identifiants Spotify sont configurés.')
    }
  } catch (e) {
    console.error('Erreur chargement tracks:', e)
    const errorMessage = e.message?.includes('ERR_CONNECTION_REFUSED') || e.message?.includes('Failed to fetch')
      ? 'Le serveur n\'est pas démarré. Lancez "npm run server" dans un terminal.'
      : 'Erreur lors du chargement des musiques. Vérifiez que le serveur est démarré et que les identifiants Spotify sont configurés.'
    alert(errorMessage)
  }
  isLoadingTracks.value = false
}

const handleSubmit = () => {
  if (!trackNameGuess.value.trim() && !artistNameGuess.value.trim()) {
    return
  }
  
  if (hasSubmitted.value) return
  
  hasSubmitted.value = true
  emit('blindtestSubmitAnswer', trackNameGuess.value.trim(), artistNameGuess.value.trim())
}

const handleNextTrack = () => {
  emit('blindtestNextTrack')
}

const handleAdjustScore = (playerId, delta) => {
  emit('blindtestAdjustScore', { playerId, delta })
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

const myScore = computed(() => {
  const me = props.scores?.[Object.keys(props.scores || {}).find(id => {
    return props.pseudo
  })]
  return me || 0
})

defineExpose({ stopAudio })
</script>

<template>
  <div class="blindtest-mode">
    <!-- Phase de chargement -->
    <div v-if="phase === 'loading'" class="loading-phase">
      <div class="loader"></div>
      <p>Chargement des musiques...</p>
    </div>

    <!-- Phase d'attente (non créateur) -->
    <div v-else-if="phase === 'waiting'" class="waiting-phase">
      <div class="loader"></div>
      <p>{{ otherPlayer?.pseudo }} charge les musiques...</p>
    </div>

    <!-- Phase de jeu -->
    <div v-else-if="phase === 'playing'" class="playing-phase">
      <div class="track-header">
        <div class="track-counter">
          <span class="current">{{ currentTrackNumber }}</span>
          <span class="separator">/</span>
          <span class="total">{{ totalTracks }}</span>
        </div>
        <h2>Blind Test</h2>
      </div>

      <div class="track-player">
        <div class="track-image-container" :class="{ blurred: !hasSubmitted }">
          <img v-if="blindtestCurrentTrack?.image" :src="blindtestCurrentTrack.image" 
            :alt="blindtestCurrentTrack.name" class="track-image" />
          <div v-else class="track-image-placeholder">🎵</div>
        </div>
        
        <button 
          v-if="blindtestCurrentTrack?.previewUrl" 
          class="play-btn"
          :class="{ playing: playingTrackId === blindtestCurrentTrack?.id, loading: loadingPreviewId === blindtestCurrentTrack?.id }"
          @click="playingTrackId === blindtestCurrentTrack?.id ? stopAudio() : playPreview(blindtestCurrentTrack)"
          :disabled="loadingPreviewId === blindtestCurrentTrack?.id"
        >
          <span v-if="loadingPreviewId === blindtestCurrentTrack?.id" class="btn-loader"></span>
          <span v-else>{{ playingTrackId === blindtestCurrentTrack?.id ? '⏸️' : '▶️' }}</span>
        </button>
        <p v-else class="no-preview">Aucun aperçu disponible</p>
      </div>

      <div class="guess-section">
        <div class="input-group">
          <label for="track-name">Nom de la musique</label>
          <input 
            id="track-name"
            v-model="trackNameGuess" 
            type="text" 
            placeholder="Entrez le nom..."
            :disabled="hasSubmitted"
            @keyup.enter="handleSubmit"
          />
        </div>

        <div class="input-group">
          <label for="artist-name">Artiste</label>
          <input 
            id="artist-name"
            v-model="artistNameGuess" 
            type="text" 
            placeholder="Entrez l'artiste..."
            :disabled="hasSubmitted"
            @keyup.enter="handleSubmit"
          />
        </div>

        <button 
          class="submit-btn" 
          @click="handleSubmit"
          :disabled="hasSubmitted || (!trackNameGuess.trim() && !artistNameGuess.trim())"
        >
          {{ hasSubmitted ? 'Envoyé ✓' : 'Valider' }}
        </button>

        <!-- Résultat individuel (avant que l'autre joueur réponde) -->
        <div v-if="blindtestAnswerResult && !blindtestRoundResult" class="individual-result">
          <div class="result-badge" :class="{ 
            correct: blindtestAnswerResult.points > 0,
            partial: blindtestAnswerResult.points === 1,
            perfect: blindtestAnswerResult.points === 3
          }">
            <span class="result-icon">
              {{ blindtestAnswerResult.points === 3 ? '🎉' : 
                 blindtestAnswerResult.points === 1 ? '👍' : '😅' }}
            </span>
            <span class="result-text">
              {{ blindtestAnswerResult.points === 3 ? 'Parfait ! +3 pts' : 
                 blindtestAnswerResult.points === 1 ? 'Bien joué ! +1 pt' : 'Raté !' }}
            </span>
          </div>
          <p class="waiting-opponent">En attente de {{ otherPlayer?.pseudo }}...</p>
        </div>
      </div>
    </div>

    <!-- Phase de résultat -->
    <div v-else-if="phase === 'result'" class="result-phase">
      <div class="result-card">
        <h2>Résultats</h2>
        
        <div class="track-reveal">
          <img :src="blindtestRoundResult?.currentTrack?.image" 
            :alt="blindtestRoundResult?.currentTrack?.name" />
          <div class="track-info">
            <span class="track-name">{{ blindtestRoundResult?.currentTrack?.name }}</span>
            <span class="track-artist">{{ blindtestRoundResult?.currentTrack?.artist }}</span>
          </div>
        </div>

        <button 
          v-if="blindtestRoundResult?.currentTrack?.previewUrl" 
          class="play-btn-big"
          :class="{ playing: playingTrackId === blindtestRoundResult?.currentTrack?.id }"
          @click="playingTrackId === blindtestRoundResult?.currentTrack?.id ? stopAudio() : playPreview(blindtestRoundResult?.currentTrack)"
        >
          {{ playingTrackId === blindtestRoundResult?.currentTrack?.id ? '⏸️ Pause' : '▶️ Écouter' }}
        </button>

        <div class="results-comparison">
          <div class="player-result" v-for="(submission, playerId) in blindtestRoundResult?.submissions" :key="playerId">
            <h3>{{ (players || []).find(p => p.id === playerId)?.pseudo || 'Joueur' }}</h3>
            <div class="submission-details">
              <div class="guess-item" :class="{ correct: submission.nameCorrect }">
                <span class="label">Musique:</span>
                <span class="value">{{ submission.trackName || '—' }}</span>
                <span v-if="submission.nameCorrect" class="check">✓</span>
              </div>
              <div class="guess-item" :class="{ correct: submission.artistCorrect }">
                <span class="label">Artiste:</span>
                <span class="value">{{ submission.artistName || '—' }}</span>
                <span v-if="submission.artistCorrect" class="check">✓</span>
              </div>
              <div class="points-earned">
                <span class="points">+{{ submission.points }} pts</span>
                <div v-if="isCreator" class="score-adjustment">
                  <button class="adjust-btn minus" @click="handleAdjustScore(playerId, -1)" title="Retirer 1 point">
                    −
                  </button>
                  <button class="adjust-btn plus" @click="handleAdjustScore(playerId, 1)" title="Ajouter 1 point">
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="next-section">
          <button class="btn-next" @click="handleNextTrack">
            {{ currentTrackNumber >= totalTracks ? 'Voir les scores finaux' : `Musique suivante (${blindtestReadyCount}/2)` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Fin du jeu -->
    <div v-else-if="phase === 'ended'" class="ended-phase">
      <div class="final-scores">
        <h2>🎉 Blind Test terminé !</h2>
        <div class="scores-list">
          <div 
            v-for="player in players" 
            :key="player.id" 
            class="score-item"
            :class="{ winner: scores[player.id] === Math.max(...Object.values(scores)) }"
          >
            <span class="player-name">{{ player.pseudo }}</span>
            <span class="player-score">{{ scores[player.id] || 0 }} pts</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blindtest-mode {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Loading Phase */
.loading-phase,
.waiting-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
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
  to { transform: rotate(360deg); }
}

/* Playing Phase */
.playing-phase {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.track-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.track-counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
}

.track-counter .current {
  color: #00d9ff;
  font-weight: 700;
  font-size: 1.5rem;
}

.track-counter .separator {
  color: rgba(255, 255, 255, 0.4);
}

.track-counter .total {
  color: rgba(255, 255, 255, 0.6);
}

.track-header h2 {
  color: white;
  margin: 0;
  font-size: 1.5rem;
}

.track-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.track-image-container {
  width: 200px;
  height: 200px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: filter 0.3s ease;
}

.track-image-container.blurred {
  filter: blur(15px);
  -webkit-filter: blur(15px);
}

.track-image-container.blurred .track-image,
.track-image-container.blurred .track-image-placeholder {
  transform: scale(1.1);
}

.track-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.track-image-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.play-btn {
  width: 80px;
  height: 80px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #00d9ff, #a855f7);
  color: white;
  font-size: 2rem;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 5px 20px rgba(0, 217, 255, 0.4);
}

.play-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 8px 30px rgba(0, 217, 255, 0.6);
}

.play-btn.playing {
  background: linear-gradient(135deg, #e94560, #a855f7);
}

.play-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.no-preview {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}

.guess-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-group label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 500;
}

.input-group input {
  padding: 0.8rem 1rem;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  outline: none;
  font-family: inherit;
}

.input-group input:focus {
  border-color: #00d9ff;
}

.input-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-group input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.submit-btn {
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #00d9ff, #a855f7);
  color: white;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 217, 255, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.individual-result {
  margin-top: 1rem;
  text-align: center;
}

.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  margin-bottom: 0.5rem;
}

.result-badge.correct {
  background: rgba(74, 222, 128, 0.2);
  border: 2px solid rgba(74, 222, 128, 0.4);
}

.result-badge.partial {
  background: rgba(251, 191, 36, 0.2);
  border: 2px solid rgba(251, 191, 36, 0.4);
}

.result-badge.perfect {
  background: rgba(34, 197, 94, 0.2);
  border: 2px solid rgba(34, 197, 94, 0.4);
}

.result-icon {
  font-size: 1.5rem;
}

.result-text {
  color: white;
  font-weight: 600;
}

.waiting-opponent {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin: 0;
}

/* Result Phase */
.result-phase {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-card {
  width: 100%;
  max-width: 600px;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.result-card h2 {
  color: white;
  text-align: center;
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
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
  width: 80px;
  height: 80px;
  border-radius: 10px;
  object-fit: cover;
}

.track-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.track-name {
  color: white;
  font-weight: 600;
  font-size: 1.1rem;
}

.track-artist {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

.play-btn-big {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #00d9ff, #a855f7);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 1.5rem;
}

.play-btn-big:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 217, 255, 0.4);
}

.play-btn-big.playing {
  background: linear-gradient(135deg, #e94560, #a855f7);
}

.results-comparison {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.player-result {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.player-result h3 {
  color: white;
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.submission-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.guess-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.guess-item.correct {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.guess-item .label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  min-width: 60px;
}

.guess-item .value {
  flex: 1;
  color: white;
  font-weight: 500;
}

.guess-item .check {
  color: #4ade80;
  font-weight: 700;
}

.points-earned {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.points {
  color: #00d9ff;
  font-weight: 700;
  font-size: 1.1rem;
}

.score-adjustment {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.adjust-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.adjust-btn.plus {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.4);
}

.adjust-btn.plus:hover {
  background: rgba(74, 222, 128, 0.3);
  transform: scale(1.1);
}

.adjust-btn.minus {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.adjust-btn.minus:hover {
  background: rgba(239, 68, 68, 0.3);
  transform: scale(1.1);
}

.next-section {
  text-align: center;
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
  transition: all 0.3s;
}

.btn-next:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 217, 255, 0.4);
}

/* Ended Phase */
.ended-phase {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.final-scores {
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.final-scores h2 {
  color: white;
  margin: 0 0 2rem 0;
  font-size: 2rem;
}

.scores-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.score-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 2px solid transparent;
}

.score-item.winner {
  border-color: #00d9ff;
  background: rgba(0, 217, 255, 0.1);
}

.player-name {
  color: white;
  font-weight: 600;
  font-size: 1.1rem;
}

.player-score {
  color: #00d9ff;
  font-weight: 700;
  font-size: 1.3rem;
}

@media (max-width: 768px) {
  .track-image-container {
    width: 150px;
    height: 150px;
  }

  .play-btn {
    width: 60px;
    height: 60px;
    font-size: 1.5rem;
  }

  .result-card {
    padding: 1.5rem;
  }
}
</style>
