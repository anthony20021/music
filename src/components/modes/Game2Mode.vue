<script setup>
const props = defineProps({
  roomId: String,
  pseudo: String,
  otherPlayer: Object,
  currentTheme: String
})

defineExpose({ stopAudio: () => {} })
</script>

<template>
  <div class="game2-mode">
    <div class="coming-soon">
      <span class="icon">🎲</span>
      <h2>Jeu 2</h2>
      <p>Ce mode arrive bientôt !</p>
      <p class="hint">Thème actuel : {{ currentTheme }}</p>
    </div>
  </div>
</template>

<style scoped>
.game2-mode {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coming-soon {
  text-align: center;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
}

.icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

h2 {
  color: white;
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
}

p {
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.hint {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 217, 255, 0.1);
  border-radius: 8px;
  color: #00d9ff;
  font-weight: 500;
}
</style>

