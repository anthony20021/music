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
const isCreator = ref(false)

// Game 2 states
const game2Role = ref(null) // 'drawer' | 'guesser' | null
const game2Track = shallowRef(null)
const game2Strokes = shallowRef([])
const game2Result = shallowRef(null)
const game2ReadyCount = ref(0)
const game2PlaylistTracks = shallowRef([])
const game2NextChooser = ref(null) // ID du joueur qui doit choisir la playlist

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

socket.on('game-started', ({ theme, mode, game2NextChooser: nextChooserId }) => {
  gameStarted.value = true
  currentMode.value = mode
  currentTheme.value = theme
  opponentReady.value = false
  roundResult.value = null
  readyCount.value = 0
  if (nextChooserId) {
    game2NextChooser.value = nextChooserId
  }
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

socket.on('room-info', ({ isCreator: creator }) => {
  isCreator.value = creator
})

// Game 2 events
socket.on('game2-start-drawing', ({ track }) => {
  game2Role.value = 'drawer'
  game2Track.value = track
  game2Strokes.value = []
  game2Result.value = null
  triggerRef(game2Track)
})

socket.on('game2-wait-drawing', () => {
  game2Role.value = 'guesser'
  game2Track.value = null
  game2Strokes.value = []
  game2Result.value = null
})

socket.on('game2-playlist-tracks', ({ tracks }) => {
  game2PlaylistTracks.value = tracks
  triggerRef(game2PlaylistTracks)
})

socket.on('game2-stroke', (stroke) => {
  game2Strokes.value = [...game2Strokes.value, stroke]
  triggerRef(game2Strokes)
})

socket.on('game2-clear', () => {
  game2Strokes.value = [{ type: 'clear' }]
  triggerRef(game2Strokes)
})

socket.on('game2-result', (result) => {
  game2Result.value = result
  scores.value = result.scores
  triggerRef(game2Result)
  triggerRef(scores)
})

socket.on('game2-ready-count', (count) => {
  game2ReadyCount.value = count
})

socket.on('game2-new-round', ({ nextChooser }) => {
  game2Role.value = null
  game2Track.value = null
  game2Strokes.value = []
  game2Result.value = null
  game2ReadyCount.value = 0
  game2NextChooser.value = nextChooser
  triggerRef(game2Strokes)
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
    isCreator.value = false
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

  // Game 2 functions
  const game2SetTrack = (roomId, data) => {
    socket.emit('game2-set-track', { roomId, ...data })
  }

  const game2DrawStroke = (roomId, stroke) => {
    socket.emit('game2-draw-stroke', { roomId, stroke })
  }

  const game2ClearCanvas = (roomId) => {
    socket.emit('game2-clear-canvas', { roomId })
  }

  const game2Guess = (roomId, guess) => {
    socket.emit('game2-guess', { roomId, guess })
  }

  const game2NextRound = (roomId) => {
    socket.emit('game2-next-round', { roomId })
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
    isCreator,
    joinRoom,
    leaveRoom,
    sendMessage,
    startGame,
    submitTracks,
    readyNextRound,
    skipRound,
    // Game 2
    game2Role,
    game2Track,
    game2Strokes,
    game2Result,
    game2ReadyCount,
    game2PlaylistTracks,
    game2NextChooser,
    game2SetTrack,
    game2DrawStroke,
    game2ClearCanvas,
    game2Guess,
    game2NextRound
  }
}
