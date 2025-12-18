<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'

const route = useRoute()
const router = useRouter()
const { players, isConnected, gameStarted, joinRoom, leaveRoom, startGame } = useSocket()

const pseudo = ref('')
const roomId = computed(() => route.params.roomId)
const copiedCode = ref(false)
const copiedLink = ref(false)

// L'autre joueur (pas nous)
const otherPlayer = computed(() => {
  return players.value.find(p => p.pseudo !== pseudo.value)
})

// Quand la partie commence, rediriger vers la page de jeu
watch(gameStarted, (started) => {
  if (started) {
    router.push(`/game/${roomId.value}`)
  }
})

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
    return
  }
  
  joinRoom(roomId.value, pseudo.value)
})

onUnmounted(() => {
  leaveRoom(roomId.value)
})

const copyRoomCode = async () => {
  await navigator.clipboard.writeText(roomId.value)
  copiedCode.value = true
  setTimeout(() => copiedCode.value = false, 2000)
}

const copyRoomLink = async () => {
  const link = `${window.location.origin}/room/${roomId.value}`
  await navigator.clipboard.writeText(link)
  copiedLink.value = true
  setTimeout(() => copiedLink.value = false, 2000)
}

const handleStartGame = () => {
  startGame(roomId.value)
}
</script>

<template>
  <div class="room">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <div class="content">
      <div class="room-header">
        <h1>Room <span class="room-code">{{ roomId }}</span></h1>
        <div class="copy-buttons">
          <button class="copy-btn" @click="copyRoomCode">
            {{ copiedCode ? '✓ Copié !' : '📋 Code' }}
          </button>
          <button class="copy-btn copy-link" @click="copyRoomLink">
            {{ copiedLink ? '✓ Copié !' : '🔗 Lien' }}
          </button>
        </div>
        <div class="connection-status" :class="{ connected: isConnected }">
          {{ isConnected ? '🟢 Connecté' : '🔴 Déconnecté' }}
        </div>
      </div>

      <div v-if="!otherPlayer" class="waiting">
        <div class="loader"></div>
        <p>En attente d'un autre joueur...</p>
        <p class="hint">Partage le code <strong>{{ roomId }}</strong> à ton ami !</p>
      </div>

      <div v-else class="ready">
        <span class="ready-icon">🎉</span>
        <p>Vous êtes prêts !</p>
      </div>

      <div class="players">
        <div class="player you">
          <span class="avatar">🎮</span>
          <span class="name">{{ pseudo }} (toi)</span>
        </div>
        <div class="player" :class="otherPlayer ? 'other' : 'waiting-player'">
          <span class="avatar">{{ otherPlayer ? '🎮' : '❓' }}</span>
          <span class="name">{{ otherPlayer ? otherPlayer.pseudo : 'En attente...' }}</span>
        </div>
      </div>

      <div class="actions">
        <button 
          v-if="otherPlayer" 
          class="btn-start" 
          @click="handleStartGame"
        >
          🎵 Commencer la partie
        </button>

        <button class="btn-back" @click="router.push('/lobby')">
          ← Retour au lobby
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
  font-family: 'Outfit', sans-serif;
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
  filter: blur(100px);
  opacity: 0.4;
  animation: pulse 6s ease-in-out infinite;
}

.shape-1 {
  width: 350px;
  height: 350px;
  background: #e94560;
  top: 10%;
  left: 10%;
}

.shape-2 {
  width: 300px;
  height: 300px;
  background: #00d9ff;
  bottom: 10%;
  right: 10%;
  animation-delay: -2s;
}

.shape-3 {
  width: 250px;
  height: 250px;
  background: #a855f7;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -4s;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

.content {
  text-align: center;
  z-index: 10;
  padding: 2.5rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  min-width: 400px;
  margin: 1rem;
}

.room-header {
  margin-bottom: 2rem;
}

h1 {
  font-size: 1.6rem;
  font-weight: 600;
  color: white;
  margin: 0 0 1rem 0;
}

.room-code {
  font-family: 'JetBrains Mono', monospace;
  background: linear-gradient(135deg, #00d9ff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: 3px;
}

.copy-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.copy-btn {
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.copy-link {
  background: rgba(0, 217, 255, 0.15);
  border: 1px solid rgba(0, 217, 255, 0.3);
}

.copy-link:hover {
  background: rgba(0, 217, 255, 0.25);
}

.connection-status {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.connection-status.connected {
  color: #4ade80;
}

.waiting {
  margin: 2rem 0;
}

.ready {
  margin: 2rem 0;
}

.ready-icon {
  font-size: 3rem;
  display: block;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.ready p {
  color: #4ade80;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.loader {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00d9ff;
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.waiting p {
  color: rgba(255, 255, 255, 0.7);
  margin: 0.5rem 0;
}

.hint {
  font-size: 0.9rem;
}

.hint strong {
  color: #00d9ff;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 2px;
}

.players {
  display: flex;
  gap: 1rem;
  margin: 2rem 0;
}

.player {
  flex: 1;
  padding: 1.2rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.player.you {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
}

.player.other {
  border-color: #00d9ff;
  background: rgba(0, 217, 255, 0.1);
}

.player.waiting-player {
  border-style: dashed;
  opacity: 0.6;
}

.avatar {
  font-size: 2rem;
}

.name {
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-start {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #e94560 0%, #ff6b35 100%);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
}

.btn-back {
  padding: 0.8rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}
</style>
