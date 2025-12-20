<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'
import MatchMode from '../components/modes/MatchMode.vue'
import PictionaryMode from '../components/modes/PictionaryMode.vue'

const route = useRoute()
const router = useRouter()
const {
  players, messages, isConnected, currentMode, currentTheme, currentThemeType, opponentReady,
  roundResult, scores, readyCount, skipCount, isCreator,
  joinRoom, leaveRoom, sendMessage, submitTracks, readyNextRound, skipRound,
  // Game 2
  game2Role, game2Track, game2Strokes, game2Result, game2ReadyCount, game2PlaylistTracks, game2NextChooser,
  game2SetTrack, game2DrawStroke, game2ClearCanvas, game2Guess, game2NextRound
} = useSocket()

const pseudo = ref('')
const roomId = computed(() => route.params.roomId)
const newMessage = ref('')
const chatContainer = ref(null)
const modeRef = ref(null)

const modeComponents = {
  match: MatchMode,
  game2: PictionaryMode
}

const currentModeComponent = computed(() => {
  return modeComponents[currentMode.value] || MatchMode
})

const otherPlayer = computed(() => {
  return players.value.find(p => p.pseudo !== pseudo.value)
})

const myScore = computed(() => {
  const myPlayer = players.value.find(p => p.pseudo === pseudo.value)
  return myPlayer ? (scores.value[myPlayer.id] || 0) : 0
})

const opponentScore = computed(() => {
  const opponent = players.value.find(p => p.pseudo !== pseudo.value)
  return opponent ? (scores.value[opponent.id] || 0) : 0
})

watch(messages, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}, { deep: true })

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
    return
  }
  joinRoom(roomId.value, pseudo.value)
})

onUnmounted(() => {
  if (modeRef.value?.stopAudio) {
    modeRef.value.stopAudio()
  }
  leaveRoom(roomId.value)
})

const handleSendMessage = () => {
  if (newMessage.value.trim()) {
    sendMessage(roomId.value, pseudo.value, newMessage.value)
    newMessage.value = ''
  }
}

const handleSubmit = (tracks) => {
  submitTracks(roomId.value, tracks)
}

const handleNextRound = () => {
  readyNextRound(roomId.value)
}

const handleSkip = () => {
  skipRound(roomId.value)
}

// Game 2 handlers
const handleGame2SetTrack = (data) => {
  game2SetTrack(roomId.value, data)
}

const handleGame2DrawStroke = (stroke) => {
  game2DrawStroke(roomId.value, stroke)
}

const handleGame2ClearCanvas = () => {
  game2ClearCanvas(roomId.value)
}

const handleGame2Guess = (guess) => {
  game2Guess(roomId.value, guess)
}

const handleGame2NextRound = () => {
  game2NextRound(roomId.value)
}
</script>

<template>
  <div class="game">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <div class="game-container">
      <div class="game-header">
        <div class="room-info">
          <span class="room-label">Room</span>
          <span class="room-code">{{ roomId }}</span>
          <span class="mode-badge" v-if="currentMode">{{ currentMode === 'match' ? '🎯 Match' : '🎨 Pictionary'
          }}</span>
        </div>
        <div class="scores">
          <span class="score you">{{ pseudo }}: {{ myScore }} pts</span>
          <span class="vs">•</span>
          <span class="score other">{{ otherPlayer?.pseudo || '...' }}: {{ opponentScore }} pts</span>
        </div>
      </div>

      <div class="game-content">
        <div class="game-area">
          <component :is="currentModeComponent" ref="modeRef" :roomId="roomId" :pseudo="pseudo"
            :otherPlayer="otherPlayer" :currentTheme="currentTheme" :currentThemeType="currentThemeType"
            :opponentReady="opponentReady" :roundResult="roundResult" :scores="scores" :readyCount="readyCount"
            :skipCount="skipCount" :isCreator="isCreator" :game2Role="game2Role" :game2Track="game2Track"
            :game2Strokes="game2Strokes" :game2Result="game2Result" :game2ReadyCount="game2ReadyCount"
            :game2PlaylistTracks="game2PlaylistTracks" :game2NextChooser="game2NextChooser" @submit="handleSubmit"
            @nextRound="handleNextRound" @skip="handleSkip" @game2SetTrack="handleGame2SetTrack"
            @game2DrawStroke="handleGame2DrawStroke" @game2ClearCanvas="handleGame2ClearCanvas"
            @game2Guess="handleGame2Guess" @game2NextRound="handleGame2NextRound" />
        </div>

        <div class="chat-panel">
          <div class="chat-header">
            <span>💬</span> Chat
          </div>
          <div class="chat-messages" ref="chatContainer">
            <div v-if="messages.length === 0" class="no-messages">
              Dis bonjour ! 👋
            </div>
            <div v-for="msg in messages" :key="msg.id" class="message" :class="{ own: msg.pseudo === pseudo }">
              <span class="message-author">{{ msg.pseudo }}</span>
              <span class="message-content">{{ msg.message }}</span>
            </div>
          </div>
          <div class="chat-input">
            <input v-model="newMessage" type="text" placeholder="Message..." @keyup.enter="handleSendMessage"
              maxlength="200" autocomplete="off" />
            <button @click="handleSendMessage" :disabled="!newMessage.trim()">
              ➤
            </button>
          </div>
        </div>
      </div>

      <button class="btn-leave" @click="router.push('/lobby')">
        ← Quitter la partie
      </button>
    </div>
  </div>
</template>

<style scoped>
.game {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
  font-family: 'Outfit', sans-serif;
  padding: 1rem;
}

.background-shapes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.3;
}

.shape-1 {
  width: 400px;
  height: 400px;
  background: #e94560;
  top: -100px;
  left: -100px;
}

.shape-2 {
  width: 350px;
  height: 350px;
  background: #00d9ff;
  bottom: -100px;
  right: -100px;
}

.shape-3 {
  width: 300px;
  height: 300px;
  background: #a855f7;
  top: 40%;
  left: 50%;
}

.game-container {
  position: relative;
  z-index: 10;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: calc(100vh - 2rem);
  height: calc(100vh - 2rem);
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.room-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.room-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
}

.room-code {
  font-family: 'JetBrains Mono', monospace;
  color: #00d9ff;
  font-weight: 600;
  letter-spacing: 2px;
}

.mode-badge {
  margin-left: 0.75rem;
  padding: 0.3rem 0.75rem;
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 20px;
  color: #a855f7;
  font-size: 0.8rem;
  font-weight: 500;
}

.scores {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.score {
  font-weight: 600;
  font-size: 0.9rem;
}

.score.you {
  color: #e94560;
}

.score.other {
  color: #00d9ff;
}

.vs {
  color: rgba(255, 255, 255, 0.3);
}

.game-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
}

.game-area {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.chat-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  color: white;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.no-messages {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
  text-align: center;
  margin: auto;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.own {
  background: rgba(233, 69, 96, 0.15);
  border: 1px solid rgba(233, 69, 96, 0.2);
}

.message-author {
  font-weight: 600;
  color: #00d9ff;
  font-size: 0.7rem;
}

.message.own .message-author {
  color: #e94560;
}

.message-content {
  color: white;
  font-size: 0.85rem;
  word-break: break-word;
}

.chat-input {
  display: flex;
  gap: 0.4rem;
  padding: 0.6rem;
  background: rgba(0, 0, 0, 0.2);
}

.chat-input input {
  flex: 1;
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  outline: none;
  font-family: inherit;
}

.chat-input input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.chat-input input:focus {
  border-color: #00d9ff;
}

.chat-input button {
  padding: 0.5rem 0.7rem;
  border: none;
  border-radius: 6px;
  background: #00d9ff;
  color: #1a1a2e;
  cursor: pointer;
  transition: all 0.2s;
}

.chat-input button:hover:not(:disabled) {
  transform: scale(1.05);
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-leave {
  align-self: flex-start;
  padding: 0.5rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-leave:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.game-area::-webkit-scrollbar,
.chat-messages::-webkit-scrollbar {
  width: 5px;
}

.game-area::-webkit-scrollbar-track,
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.game-area::-webkit-scrollbar-thumb,
.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

@media (max-width: 900px) {
  .game {
    padding: 0.5rem;
  }

  .game-container {
    min-height: calc(100vh - 1rem);
    height: auto;
    max-height: calc(100vh - 1rem);
  }

  .game-content {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
    min-height: 0;
  }

  .game-area {
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .chat-panel {
    max-height: 250px;
    min-height: 200px;
  }
}
</style>
