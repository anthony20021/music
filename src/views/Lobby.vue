<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pseudo = ref('')
const roomCode = ref('')
const showJoin = ref(false)

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
  }
})

const createRoom = () => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  router.push(`/room/${code}`)
}

const joinRoom = () => {
  if (roomCode.value.trim()) {
    router.push(`/room/${roomCode.value.trim().toUpperCase()}`)
  }
}
</script>

<template>
  <div class="lobby">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <div class="content">
      <div class="header">
        <span class="wave">👋</span>
        <h2>Salut <span class="pseudo">{{ pseudo }}</span> !</h2>
      </div>

      <div class="actions">
        <button class="btn-create" @click="createRoom">
          <span class="btn-icon">✨</span>
          Créer une room
        </button>

        <div class="divider">
          <span>ou</span>
        </div>

        <div v-if="!showJoin">
          <button class="btn-join" @click="showJoin = true">
            <span class="btn-icon">🔗</span>
            Rejoindre une room
          </button>
        </div>

        <div v-else class="join-form">
          <input v-model="roomCode" type="text" placeholder="Code de la room..." @keyup.enter="joinRoom"
            maxlength="6" />
          <button @click="joinRoom" :disabled="!roomCode.trim()">
            Go !
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
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
  opacity: 0.5;
}

.shape-1 {
  width: 500px;
  height: 500px;
  background: #a855f7;
  top: -150px;
  right: -150px;
}

.shape-2 {
  width: 400px;
  height: 400px;
  background: #00d9ff;
  bottom: -100px;
  left: -100px;
}

.content {
  text-align: center;
  z-index: 10;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  min-width: 360px;
  margin: 1rem;
}

.header {
  margin-bottom: 2.5rem;
}

.wave {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
  animation: wave 1.5s ease-in-out infinite;
}

@keyframes wave {

  0%,
  100% {
    transform: rotate(0deg);
  }

  25% {
    transform: rotate(20deg);
  }

  75% {
    transform: rotate(-10deg);
  }
}

h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: white;
  margin: 0;
}

.pseudo {
  background: linear-gradient(135deg, #e94560, #ff6b35);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-create,
.btn-join {
  width: 100%;
  padding: 1.2rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-create {
  background: linear-gradient(135deg, #e94560 0%, #ff6b35 100%);
  color: white;
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
}

.btn-join {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-join:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: #00d9ff;
}

.btn-icon {
  font-size: 1.3rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.join-form {
  display: flex;
  gap: 0.75rem;
}

.join-form input {
  flex: 1;
  padding: 1rem 1.25rem;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 600;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.join-form input::placeholder {
  color: rgba(255, 255, 255, 0.4);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.join-form input:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
}

.join-form button {
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: #00d9ff;
  color: #1a1a2e;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.join-form button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 217, 255, 0.4);
}

.join-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .join-form {
    flex-direction: column;
  }

  .join-form button {
    width: 100%;
  }
}
</style>
