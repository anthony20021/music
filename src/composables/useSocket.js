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
const socketId = ref(socket.id || null)
const gameStarted = ref(false)
const currentMode = ref(null)
const currentTheme = ref(null)
const currentThemeType = ref(null) // 'theme' ou 'artist'
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

// Blind Test states
const blindtestTracks = shallowRef([])
const blindtestCurrentTrackIndex = ref(0)
const blindtestCurrentTrack = shallowRef(null)
const blindtestAnswerResult = shallowRef(null)
const blindtestRoundResult = shallowRef(null)
const blindtestReadyCount = ref(0)
const blindtestGameEnded = ref(false)

socket.on('connect', () => {
  isConnected.value = true
  socketId.value = socket.id
})

socket.on('disconnect', () => {
  isConnected.value = false
  players.value = []
  messages.value = []
  triggerRef(players)
  triggerRef(messages)
})

socket.on('reconnect', () => {
  socketId.value = socket.id
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

socket.on('game-started', (data) => {
  const { theme, themeType, mode, game2NextChooser: nextChooserId, totalRounds, currentRound, themeSequence } = data

  gameStarted.value = true
  currentMode.value = mode
  currentTheme.value = theme
  currentThemeType.value = themeType || 'theme'
  opponentReady.value = false
  roundResult.value = null
  readyCount.value = 0
  if (nextChooserId) {
    game2NextChooser.value = nextChooserId
  }
  // Stocker les infos de progression si disponibles
  if (totalRounds !== undefined) {
    window.gameProgress = { totalRounds, currentRound }
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

socket.on('new-round', ({ theme, themeType, totalRounds, currentRound }) => {
  currentTheme.value = theme
  currentThemeType.value = themeType || 'theme'
  opponentReady.value = false
  roundResult.value = null
  readyCount.value = 0
  skipCount.value = 0
  // Mettre à jour la progression
  if (totalRounds !== undefined && currentRound !== undefined) {
    window.gameProgress = { totalRounds, currentRound }
  }
})

socket.on('game-ended', ({ scores }) => {
  // Le jeu est terminé
  currentTheme.value = null
  currentThemeType.value = null
  scores.value = scores
  triggerRef(scores)
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

// Blind Test events
socket.on('blindtest-tracks-set', ({ tracks, currentIndex }) => {
  blindtestTracks.value = tracks
  blindtestCurrentTrackIndex.value = currentIndex
  blindtestCurrentTrack.value = tracks[currentIndex] || null
  blindtestAnswerResult.value = null
  blindtestRoundResult.value = null
  blindtestReadyCount.value = 0
  blindtestGameEnded.value = false
  triggerRef(blindtestTracks)
  triggerRef(blindtestCurrentTrack)
})

socket.on('blindtest-next-track', ({ currentIndex, track }) => {
  blindtestCurrentTrackIndex.value = currentIndex
  blindtestCurrentTrack.value = track
  blindtestAnswerResult.value = null
  blindtestRoundResult.value = null
  blindtestReadyCount.value = 0
  triggerRef(blindtestCurrentTrack)
})

socket.on('blindtest-answer-result', (result) => {
  blindtestAnswerResult.value = result
  scores.value = { ...scores.value, ...result.scores }
  triggerRef(blindtestAnswerResult)
  triggerRef(scores)
})

socket.on('blindtest-round-result', (result) => {
  blindtestRoundResult.value = result
  scores.value = result.scores
  triggerRef(blindtestRoundResult)
  triggerRef(scores)
})

socket.on('blindtest-ready-count', (count) => {
  blindtestReadyCount.value = count
})

socket.on('blindtest-game-ended', ({ scores }) => {
  blindtestGameEnded.value = true
  scores.value = scores
  triggerRef(scores)
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
    currentThemeType.value = null
    opponentReady.value = false
    roundResult.value = null
    scores.value = {}
    readyCount.value = 0
    isCreator.value = false
    // Réinitialiser les états du blind test
    blindtestTracks.value = []
    blindtestCurrentTrackIndex.value = 0
    blindtestCurrentTrack.value = null
    blindtestAnswerResult.value = null
    blindtestRoundResult.value = null
    blindtestReadyCount.value = 0
    blindtestGameEnded.value = false
    triggerRef(players)
    triggerRef(messages)
    triggerRef(blindtestTracks)
    triggerRef(blindtestCurrentTrack)
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

  // Blind Test functions
  const blindtestSetTracks = (roomId, tracks) => {
    console.log('blindtestSetTracks appelé:', { roomId, tracksCount: tracks?.length, socketConnected: socket.connected })
    if (!socket.connected) {
      console.warn('Socket non connecté, attente de la connexion...')
      socket.once('connect', () => {
        console.log('Socket connecté, envoi des tracks maintenant')
        socket.emit('blindtest-set-tracks', { roomId, tracks })
      })
      return
    }
    socket.emit('blindtest-set-tracks', { roomId, tracks })
    console.log('Événement blindtest-set-tracks émis')
  }

  const blindtestSubmitAnswer = (roomId, trackName, artistName) => {
    socket.emit('blindtest-submit-answer', { roomId, trackName, artistName })
  }

  const blindtestNextTrack = (roomId) => {
    socket.emit('blindtest-next-track', { roomId })
  }

  const blindtestAdjustScore = (roomId, playerId, delta) => {
    socket.emit('blindtest-adjust-score', { roomId, playerId, delta })
  }

  return {
    socket,
    socketId,
    players,
    messages,
    isConnected,
    gameStarted,
    currentMode,
    currentTheme,
    currentThemeType,
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
    game2NextRound,
    // Blind Test
    blindtestTracks,
    blindtestCurrentTrackIndex,
    blindtestCurrentTrack,
    blindtestAnswerResult,
    blindtestRoundResult,
    blindtestReadyCount,
    blindtestGameEnded,
    blindtestSetTracks,
    blindtestSubmitAnswer,
    blindtestNextTrack,
    blindtestAdjustScore
  }
}
