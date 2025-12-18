import { ref, shallowRef, triggerRef } from 'vue'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true
})

const players = shallowRef([])
const messages = shallowRef([])
const isConnected = ref(false)
const gameStarted = ref(false)
const currentMode = ref(null)
const currentTheme = ref(null)
const opponentReady = ref(false)
const roundResult = shallowRef(null)
const scores = shallowRef({})
const readyCount = ref(0)
const skipCount = ref(0)

socket.on('connect', () => {
  isConnected.value = true
})

socket.on('disconnect', () => {
  isConnected.value = false
  players.value = []
  messages.value = []
  triggerRef(players)
  triggerRef(messages)
})

socket.on('players-update', (updatedPlayers) => {
  players.value = updatedPlayers
  triggerRef(players)
})

socket.on('chat-history', (history) => {
  messages.value = history
  triggerRef(messages)
})

socket.on('chat-message', (message) => {
  messages.value = [...messages.value, message]
  triggerRef(messages)
})

socket.on('game-started', ({ theme, mode }) => {
  gameStarted.value = true
  currentMode.value = mode
  currentTheme.value = theme
  opponentReady.value = false
  roundResult.value = null
  readyCount.value = 0
})

socket.on('theme-update', (theme) => {
  currentTheme.value = theme
})

socket.on('scores-update', (newScores) => {
  scores.value = newScores
  triggerRef(scores)
})

socket.on('opponent-ready', () => {
  opponentReady.value = true
})

socket.on('round-result', (result) => {
  roundResult.value = result
  scores.value = result.scores
  triggerRef(roundResult)
  triggerRef(scores)
})

socket.on('ready-count', (count) => {
  readyCount.value = count
})

socket.on('new-round', ({ theme }) => {
  currentTheme.value = theme
  opponentReady.value = false
  roundResult.value = null
  readyCount.value = 0
  skipCount.value = 0
})

socket.on('skip-count', (count) => {
  skipCount.value = count
})

export function useSocket() {
  const joinRoom = (roomId, pseudo) => {
    if (socket.connected) {
      socket.emit('join-room', { roomId, pseudo })
    } else {
      socket.once('connect', () => {
        socket.emit('join-room', { roomId, pseudo })
      })
    }
  }

  const leaveRoom = (roomId) => {
    socket.emit('leave-room', { roomId })
    players.value = []
    messages.value = []
    gameStarted.value = false
    currentMode.value = null
    currentTheme.value = null
    opponentReady.value = false
    roundResult.value = null
    scores.value = {}
    readyCount.value = 0
    triggerRef(players)
    triggerRef(messages)
  }

  const sendMessage = (roomId, pseudo, message) => {
    if (message.trim()) {
      socket.emit('chat-message', { roomId, pseudo, message: message.trim() })
    }
  }

  const startGame = (roomId, mode = 'match') => {
    socket.emit('start-game', { roomId, mode })
  }

  const submitTracks = (roomId, tracks) => {
    socket.emit('submit-tracks', { roomId, tracks })
  }

  const readyNextRound = (roomId) => {
    socket.emit('ready-next-round', { roomId })
  }

  const skipRound = (roomId) => {
    socket.emit('skip-round', { roomId })
  }

  return {
    socket,
    players,
    messages,
    isConnected,
    gameStarted,
    currentMode,
    currentTheme,
    opponentReady,
    roundResult,
    scores,
    readyCount,
    skipCount,
    joinRoom,
    leaveRoom,
    sendMessage,
    startGame,
    submitTracks,
    readyNextRound,
    skipRound
  }
}
