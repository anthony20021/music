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
        theme: null,
        submissions: {},
        scores: {},
        readyForNext: []
      })
    }
    
    const room = rooms.get(roomId)
    const existingPlayer = room.players.find(p => p.id === socket.id)
    
    if (!existingPlayer) {
      room.players.push({ id: socket.id, pseudo })
      room.scores[socket.id] = room.scores[socket.id] || 0
    }
    
    io.to(roomId).emit('players-update', room.players)
    socket.emit('chat-history', room.messages)
    
    if (room.theme) {
      socket.emit('theme-update', room.theme)
      socket.emit('scores-update', room.scores)
    }
  })

  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room) {
      room.theme = getRandomTheme()
      room.submissions = {}
      room.readyForNext = []
      io.to(roomId).emit('game-started', { theme: room.theme })
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
        io.to(roomId).emit('new-round', { theme: room.theme })
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
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
