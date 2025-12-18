<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pseudo = ref('')

const enterGame = () => {
  if (pseudo.value.trim()) {
    localStorage.setItem('pseudo', pseudo.value.trim())
    router.push('/lobby')
  }
}
</script>

<template>
  <div class="home">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
    </div>
    
    <div class="content">
      <div class="logo">
        <span class="icon">🎵</span>
        <h1>Music Match</h1>
      </div>
      
      <p class="tagline">
        Choisis <strong>3 musiques</strong> sur un thème.<br>
        Matche au moins <strong>une musique</strong> avec ton ami pour gagner !
      </p>
      
      <div class="input-container">
        <input 
          v-model="pseudo" 
          type="text" 
          placeholder="Ton pseudo..."
          @keyup.enter="enterGame"
          maxlength="20"
        />
        <button @click="enterGame" :disabled="!pseudo.trim()">
          C'est parti 🚀
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
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
  filter: blur(80px);
  opacity: 0.6;
  animation: float 8s ease-in-out infinite;
}

.shape-1 {
  width: 400px;
  height: 400px;
  background: #e94560;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.shape-2 {
  width: 300px;
  height: 300px;
  background: #00d9ff;
  top: 50%;
  right: -80px;
  animation-delay: -2s;
}

.shape-3 {
  width: 250px;
  height: 250px;
  background: #ff6b35;
  bottom: -50px;
  left: 30%;
  animation-delay: -4s;
}

.shape-4 {
  width: 200px;
  height: 200px;
  background: #a855f7;
  top: 20%;
  left: 60%;
  animation-delay: -6s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
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
  max-width: 440px;
  margin: 1rem;
}

.logo {
  margin-bottom: 1.5rem;
}

.icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 0.5rem;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

h1 {
  font-size: 2.8rem;
  font-weight: 800;
  background: linear-gradient(135deg, #fff 0%, #e94560 50%, #00d9ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  letter-spacing: -1px;
}

.tagline {
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.1rem;
  line-height: 1.7;
  margin-bottom: 2rem;
}

.tagline strong {
  color: #00d9ff;
  font-weight: 600;
}

.input-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

input {
  padding: 1rem 1.5rem;
  font-size: 1.1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

input:focus {
  border-color: #e94560;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 20px rgba(233, 69, 96, 0.3);
}

button {
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

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

