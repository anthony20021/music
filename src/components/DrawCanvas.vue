<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  canDraw: { type: Boolean, default: true },
  strokes: { type: Array, default: () => [] }
})

const emit = defineEmits(['stroke', 'clear'])

const canvas = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)
const currentColor = ref('#ffffff')
const brushSize = ref(4)
const lastPos = ref(null)

const colors = ['#ffffff', '#e94560', '#00d9ff', '#4ade80', '#fbbf24', '#a855f7', '#000000']

onMounted(() => {
  ctx.value = canvas.value.getContext('2d')
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
})

watch(() => props.strokes, (newStrokes) => {
  if (newStrokes.length > 0) {
    const lastStroke = newStrokes[newStrokes.length - 1]
    if (lastStroke.type === 'clear') {
      clearCanvas(false)
    } else {
      drawSegment(lastStroke)
    }
  }
}, { deep: true })

const resizeCanvas = () => {
  const rect = canvas.value.parentElement.getBoundingClientRect()
  canvas.value.width = rect.width
  canvas.value.height = rect.height
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
}

const getPos = (e) => {
  const rect = canvas.value.getBoundingClientRect()
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
  return { 
    x: x / rect.width, 
    y: y / rect.height 
  }
}

const startDrawing = (e) => {
  if (!props.canDraw) return
  isDrawing.value = true
  lastPos.value = getPos(e)
}

const draw = (e) => {
  if (!isDrawing.value || !props.canDraw) return
  e.preventDefault()
  
  const currentPos = getPos(e)
  
  const segment = {
    fromX: lastPos.value.x,
    fromY: lastPos.value.y,
    toX: currentPos.x,
    toY: currentPos.y,
    color: currentColor.value,
    size: brushSize.value
  }
  
  drawSegment(segment)
  emit('stroke', segment)
  
  lastPos.value = currentPos
}

const stopDrawing = () => {
  isDrawing.value = false
  lastPos.value = null
}

const drawSegment = (segment) => {
  const w = canvas.value.width
  const h = canvas.value.height
  
  ctx.value.strokeStyle = segment.color
  ctx.value.lineWidth = segment.size
  ctx.value.beginPath()
  ctx.value.moveTo(segment.fromX * w, segment.fromY * h)
  ctx.value.lineTo(segment.toX * w, segment.toY * h)
  ctx.value.stroke()
}

const clearCanvas = (emitEvent = true) => {
  ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
  if (emitEvent) {
    emit('clear')
  }
}

defineExpose({ clearCanvas })
</script>

<template>
  <div class="draw-canvas-container">
    <div class="canvas-wrapper">
      <canvas
        ref="canvas"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        @touchstart="startDrawing"
        @touchmove="draw"
        @touchend="stopDrawing"
        :class="{ drawing: canDraw }"
      ></canvas>
    </div>
    
    <div v-if="canDraw" class="tools">
      <div class="colors">
        <button
          v-for="color in colors"
          :key="color"
          class="color-btn"
          :class="{ active: currentColor === color }"
          :style="{ background: color }"
          @click="currentColor = color"
        ></button>
      </div>
      <div class="sizes">
        <button 
          v-for="size in [2, 4, 8, 12]" 
          :key="size"
          class="size-btn"
          :class="{ active: brushSize === size }"
          @click="brushSize = size"
        >
          <span :style="{ width: size + 'px', height: size + 'px' }"></span>
        </button>
      </div>
      <button class="clear-btn" @click="clearCanvas()">🗑️</button>
    </div>
  </div>
</template>

<style scoped>
.draw-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.canvas-wrapper {
  flex: 1;
  background: #2a2a3e;
  border-radius: 12px;
  overflow: hidden;
  min-height: 300px;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

canvas.drawing {
  cursor: crosshair;
}

.tools {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  margin-top: 0.75rem;
}

.colors {
  display: flex;
  gap: 0.4rem;
}

.color-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
}

.sizes {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

.size-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.size-btn span {
  background: white;
  border-radius: 50%;
}

.size-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.size-btn.active {
  background: rgba(0, 217, 255, 0.3);
  border: 1px solid #00d9ff;
}

.clear-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: rgba(233, 69, 96, 0.2);
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(233, 69, 96, 0.4);
}
</style>
