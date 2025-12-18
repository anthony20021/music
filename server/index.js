import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import spotifyUrlInfo from 'spotify-url-info'
import fetch from 'node-fetch'

const { getTracks } = spotifyUrlInfo(fetch)

const __dirname = dirname(fileURLToPath(import.meta.url))

// Normalise une chaîne (enlève accents, minuscules, espaces superflus)
const normalizeString = (str) => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlève les accents
    .replace(/[^a-z0-9\s]/g, '') 
    .trim()
}
const themes = JSON.parse(readFileSync(join(__dirname, '../src/data/themes.json'), 'utf-8')).themes

const PORT = process.env.PORT || 3001
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json())

const distPath = join(__dirname, '../dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
}

app.get('/api/preview/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params
    const tracks = await getTracks(`https://open.spotify.com/track/${trackId}`)
    
    if (tracks && tracks.length > 0 && tracks[0].previewUrl) {
      res.json({ previewUrl: tracks[0].previewUrl })
    } else {
      res.json({ previewUrl: null })
    }
  } catch {
    res.json({ previewUrl: null })
  }
})

const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
})

const rooms = new Map()

function getRandomTheme() {
  return themes[Math.floor(Math.random() * themes.length)]
}

function checkRoundComplete(room) {
  const submissions = Object.keys(room.submissions)
  if (submissions.length === 2 && room.players.length === 2) {
    const [player1Id, player2Id] = submissions
    const tracks1 = room.submissions[player1Id].map(t => t.id)
    const tracks2 = room.submissions[player2Id].map(t => t.id)
    
    const matches = tracks1.filter(id => tracks2.includes(id))
    
    matches.forEach(() => {
      room.scores[player1Id] = (room.scores[player1Id] || 0) + 1
      room.scores[player2Id] = (room.scores[player2Id] || 0) + 1
    })
    
    return {
      player1: {
        id: player1Id,
        pseudo: room.players.find(p => p.id === player1Id)?.pseudo,
        tracks: room.submissions[player1Id]
      },
      player2: {
        id: player2Id,
        pseudo: room.players.find(p => p.id === player2Id)?.pseudo,
        tracks: room.submissions[player2Id]
      },
      matches: matches,
      scores: room.scores
    }
  }
  return null
}

io.on('connection', (socket) => {

  socket.on('join-room', ({ roomId, pseudo }) => {
    socket.join(roomId)
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { 
        players: [], 
        messages: [],
        creator: socket.id,
        mode: null,
        theme: null,
        submissions: {},
        scores: {},
        readyForNext: [],
        skipVotes: []
      })
    }
    
    const room = rooms.get(roomId)
    const existingPlayer = room.players.find(p => p.id === socket.id)
    
    if (!existingPlayer) {
      room.players.push({ id: socket.id, pseudo })
      room.scores[socket.id] = room.scores[socket.id] || 0
    }
    
    io.to(roomId).emit('players-update', room.players)
    socket.emit('room-info', { isCreator: room.creator === socket.id })
    socket.emit('chat-history', room.messages)
    
    if (room.theme) {
      socket.emit('game-started', { theme: room.theme, mode: room.mode })
      socket.emit('scores-update', room.scores)
    }
    
    // Si le jeu Pictionary a déjà commencé, envoyer les infos
    if (room.game2Track) {
      if (room.game2Drawer === socket.id) {
        socket.emit('game2-start-drawing', { track: room.game2Track })
      } else if (room.game2Guesser === socket.id) {
        socket.emit('game2-wait-drawing')
        if (room.game2PlaylistTracks) {
          socket.emit('game2-playlist-tracks', { tracks: room.game2PlaylistTracks })
        }
      }
    }
  })

  socket.on('start-game', ({ roomId, mode }) => {
    const room = rooms.get(roomId)
    if (room) {
      room.mode = mode || 'match'
      room.theme = getRandomTheme()
      room.submissions = {}
      room.readyForNext = []
      io.to(roomId).emit('game-started', { theme: room.theme, mode: room.mode })
    }
  })

  socket.on('submit-tracks', ({ roomId, tracks }) => {
    const room = rooms.get(roomId)
    if (room) {
      room.submissions[socket.id] = tracks
      
      const otherPlayers = room.players.filter(p => p.id !== socket.id)
      otherPlayers.forEach(p => {
        io.to(p.id).emit('opponent-ready')
      })
      
      const result = checkRoundComplete(room)
      if (result) {
        io.to(roomId).emit('round-result', result)
      }
    }
  })

  socket.on('ready-next-round', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room) {
      if (!room.readyForNext.includes(socket.id)) {
        room.readyForNext.push(socket.id)
      }
      
      io.to(roomId).emit('ready-count', room.readyForNext.length)
      
      if (room.readyForNext.length === 2) {
        room.theme = getRandomTheme()
        room.submissions = {}
        room.readyForNext = []
        room.skipVotes = []
        io.to(roomId).emit('new-round', { theme: room.theme })
      }
    }
  })

  socket.on('skip-round', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room) {
      if (!room.skipVotes.includes(socket.id)) {
        room.skipVotes.push(socket.id)
      }
      
      io.to(roomId).emit('skip-count', room.skipVotes.length)
      
      if (room.skipVotes.length === 2) {
        room.theme = getRandomTheme()
        room.submissions = {}
        room.readyForNext = []
        room.skipVotes = []
        io.to(roomId).emit('new-round', { theme: room.theme })
      }
    }
  })

  // === GAME 2: Pictionary Musical ===
  socket.on('game2-set-track', ({ roomId, track, playlistTracks }) => {
    const room = rooms.get(roomId)
    if (room) {
      room.game2Track = track
      room.game2PlaylistTracks = playlistTracks || []
      room.game2Drawer = room.players.find(p => p.id !== socket.id)?.id
      room.game2Guesser = socket.id
      
      // Envoyer la track au dessinateur
      if (room.game2Drawer) {
        io.to(room.game2Drawer).emit('game2-start-drawing', { track })
      }
      // Envoyer les tracks de la playlist au guesser pour qu'il puisse choisir
      if (room.game2Guesser) {
        io.to(room.game2Guesser).emit('game2-playlist-tracks', { tracks: room.game2PlaylistTracks })
      }
    }
  })

  socket.on('game2-draw-stroke', ({ roomId, stroke }) => {
    const room = rooms.get(roomId)
    if (room && room.game2Guesser) {
      io.to(room.game2Guesser).emit('game2-stroke', stroke)
    }
  })

  socket.on('game2-clear-canvas', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room && room.game2Guesser) {
      io.to(room.game2Guesser).emit('game2-clear')
    }
  })

  socket.on('game2-guess', ({ roomId, guess }) => {
    const room = rooms.get(roomId)
    if (room && room.game2Track) {
      const trackNameNorm = normalizeString(room.game2Track.name)
      const artistNorm = normalizeString(room.game2Track.artist)
      const guessNorm = normalizeString(guess)
      
      // Vérifier si la réponse est correcte (contient le nom ou l'artiste)
      const isCorrect = trackNameNorm.includes(guessNorm) || 
                        artistNorm.includes(guessNorm) ||
                        guessNorm.includes(trackNameNorm) ||
                        guessNorm.includes(artistNorm)
      
      if (isCorrect) {
        room.scores[socket.id] = (room.scores[socket.id] || 0) + 1
        if (room.game2Drawer) {
          room.scores[room.game2Drawer] = (room.scores[room.game2Drawer] || 0) + 1
        }
      }
      
      io.to(roomId).emit('game2-result', {
        correct: isCorrect,
        guess,
        track: room.game2Track,
        scores: room.scores
      })
      
      room.game2Track = null
      room.game2Drawer = null
      room.game2Guesser = null
    }
  })

  socket.on('game2-next-round', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room) {
      if (!room.game2Ready) room.game2Ready = []
      if (!room.game2Ready.includes(socket.id)) {
        room.game2Ready.push(socket.id)
      }
      
      io.to(roomId).emit('game2-ready-count', room.game2Ready.length)
      
      if (room.game2Ready.length === 2) {
        room.game2Ready = []
        // Inverser les rôles
        io.to(roomId).emit('game2-new-round')
      }
    }
  })

  socket.on('chat-message', ({ roomId, pseudo, message }) => {
    const room = rooms.get(roomId)
    if (room) {
      const chatMessage = {
        id: Date.now(),
        pseudo,
        message,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }
      
      room.messages.push(chatMessage)
      
      if (room.messages.length > 50) {
        room.messages.shift()
      }
      
      io.to(roomId).emit('chat-message', chatMessage)
    }
  })

  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId)
    removePlayerFromRoom(socket.id, roomId)
  })

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      removePlayerFromRoom(socket.id, roomId)
    })
  })

  function removePlayerFromRoom(playerId, roomId) {
    const room = rooms.get(roomId)
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId)
      
      if (room.players.length === 0) {
        rooms.delete(roomId)
      } else {
        io.to(roomId).emit('players-update', room.players)
      }
    }
  }
})

if (existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(join(distPath, 'index.html'))
    } else {
      next()
    }
  })
}

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
