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
    .replace(/[^a-z0-9\s]/g, '') // Enlève la ponctuation
    .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul
    .trim()
}

// Fonction pour calculer la similarité entre deux chaînes (distance de Levenshtein simplifiée)
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 1
  
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1
  
  // Si la chaîne plus courte est contenue dans la plus longue, c'est bon
  if (longer.includes(shorter)) return 0.9
  
  // Comparaison par mots
  const words1 = str1.split(/\s+/).filter(w => w.length > 2)
  const words2 = str2.split(/\s+/).filter(w => w.length > 2)
  
  if (words1.length === 0 || words2.length === 0) return 0
  
  // Compter les mots en commun
  let commonWords = 0
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        commonWords++
        break
      }
    }
  }
  
  const similarity = commonWords / Math.max(words1.length, words2.length)
  return similarity
}

// Vérifie si deux chaînes correspondent (tolérant aux fautes)
const matchesString = (guess, correct) => {
  if (!guess || !correct) return false
  
  const normalizedGuess = normalizeString(guess)
  const normalizedCorrect = normalizeString(correct)
  
  // Correspondance exacte
  if (normalizedGuess === normalizedCorrect) return true
  
  // L'un contient l'autre
  if (normalizedCorrect.includes(normalizedGuess) || normalizedGuess.includes(normalizedCorrect)) {
    return true
  }
  
  // Similarité élevée (au moins 70% de similarité)
  const similarity = calculateSimilarity(normalizedGuess, normalizedCorrect)
  if (similarity >= 0.7) return true
  
  // Vérifier si au moins 2/3 des mots correspondent
  const wordsGuess = normalizedGuess.split(/\s+/).filter(w => w.length > 2)
  const wordsCorrect = normalizedCorrect.split(/\s+/).filter(w => w.length > 2)
  
  if (wordsGuess.length === 0 || wordsCorrect.length === 0) return false
  
  let matchingWords = 0
  for (const wordGuess of wordsGuess) {
    for (const wordCorrect of wordsCorrect) {
      if (wordGuess === wordCorrect || 
          wordGuess.includes(wordCorrect) || 
          wordCorrect.includes(wordGuess) ||
          (wordGuess.length > 4 && wordCorrect.length > 4 && 
           Math.abs(wordGuess.length - wordCorrect.length) <= 1 &&
           (wordGuess.startsWith(wordCorrect.substring(0, 3)) || 
            wordCorrect.startsWith(wordGuess.substring(0, 3))))) {
        matchingWords++
        break
      }
    }
  }
  
  // Au moins 2/3 des mots doivent correspondre
  return matchingWords >= Math.ceil(wordsGuess.length * 0.67) || 
         matchingWords >= Math.ceil(wordsCorrect.length * 0.67)
}
const themesData = JSON.parse(readFileSync(join(__dirname, '../src/data/themes.json'), 'utf-8'))
const themes = themesData.themes
const artists = themesData.artists

let blindtestThemes = null
try {
  blindtestThemes = JSON.parse(readFileSync(join(__dirname, '../src/data/themes_blindtest.json'), 'utf-8'))
} catch (e) {
  console.warn('Impossible de charger themes_blindtest.json:', e.message)
  blindtestThemes = { categories: [] }
}

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

app.get('/themes_blindtest.json', (req, res) => {
  try {
    const themesBlindtestPath = join(__dirname, '../src/data/themes_blindtest.json')
    if (existsSync(themesBlindtestPath)) {
      const themesBlindtestData = readFileSync(themesBlindtestPath, 'utf-8')
      res.setHeader('Content-Type', 'application/json')
      res.send(themesBlindtestData)
    } else {
      res.status(404).json({ error: 'File not found' })
    }
  } catch (e) {
    res.status(500).json({ error: 'Error reading file' })
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

// Fonction pour mélanger un tableau (Fisher-Yates)
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Génère un tableau aléatoire alternant thèmes et artistes
function generateThemeSequence() {
  // Mélanger les thèmes et artistes séparément
  const shuffledThemes = shuffleArray(themes)
  const shuffledArtists = shuffleArray(artists)

  // Créer un tableau alternant thème/artiste
  const sequence = []
  const maxLength = Math.min(shuffledThemes.length, shuffledArtists.length) * 2

  for (let i = 0; i < maxLength; i++) {
    if (i % 2 === 0) {
      // Index pair = thème
      const themeIndex = Math.floor(i / 2)
      if (themeIndex < shuffledThemes.length) {
        sequence.push({ type: 'theme', value: shuffledThemes[themeIndex] })
      }
    } else {
      // Index impair = artiste
      const artistIndex = Math.floor(i / 2)
      if (artistIndex < shuffledArtists.length) {
        sequence.push({ type: 'artist', value: shuffledArtists[artistIndex] })
      }
    }
  }

  return sequence
}

// Récupère le thème/artiste suivant depuis la séquence
function getNextTheme(room) {
  if (!room.themeSequence || room.themeIndex === undefined) {
    return null
  }

  if (room.themeIndex >= room.themeSequence.length) {
    // Fin du jeu
    return null
  }

  return room.themeSequence[room.themeIndex]
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
      const themeData = typeof room.theme === 'string' ? { type: 'theme', value: room.theme } : room.theme
      if ((room.mode === 'pictionary' || room.mode === 'game2') && room.game2NextChooser) {
        socket.emit('game-started', { theme: themeData.value, themeType: themeData.type, mode: room.mode, game2NextChooser: room.game2NextChooser })
      } else if (room.mode === 'blindtest') {
        socket.emit('game-started', { mode: 'blindtest' })
        if (room.blindtestTracks && room.blindtestTracks.length > 0) {
          socket.emit('blindtest-tracks-set', { 
            tracks: room.blindtestTracks, 
            currentIndex: room.blindtestCurrentTrackIndex || 0 
          })
        }
      } else {
        const payload = {
          theme: themeData.value,
          themeType: themeData.type,
          mode: room.mode,
          totalRounds: room.themeSequence ? room.themeSequence.length : null,
          currentRound: room.themeIndex !== undefined ? room.themeIndex + 1 : null,
          themeSequence: room.themeSequence ? room.themeSequence.map(s => ({ type: s.type, value: s.value })) : null
        }
        socket.emit('game-started', payload)
      }
      socket.emit('scores-update', room.scores)
    } else if (room.mode === 'blindtest') {
      // Si le mode blindtest est déjà démarré mais sans theme
      socket.emit('game-started', { mode: 'blindtest' })
      if (room.blindtestTracks && room.blindtestTracks.length > 0) {
        socket.emit('blindtest-tracks-set', { 
          tracks: room.blindtestTracks, 
          currentIndex: room.blindtestCurrentTrackIndex || 0 
        })
      }
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
    if (!room) {
      return
    }
    room.mode = mode || 'match'

    // Pour le mode Match, générer la séquence de thèmes/artistes
    if (mode === 'match') {
      room.themeSequence = generateThemeSequence()
      room.themeIndex = 0
      room.theme = getNextTheme(room)
    } else if (mode === 'blindtest') {
      // Pour Blind Test, initialiser les tracks (sera chargé côté client)
      room.blindtestTracks = []
      room.blindtestCurrentTrackIndex = 0
      room.blindtestSubmissions = {}
      room.blindtestReadyForNext = []
    } else {
      // Pour Pictionary, on garde l'ancien système
      room.theme = { type: 'theme', value: themes[Math.floor(Math.random() * themes.length)] }
    }

    room.submissions = {}
    room.readyForNext = []

    // Pour le mode Pictionary, initialiser qui choisit la playlist (le créateur au début)
    if (mode === 'pictionary' || mode === 'game2') {
      // Réinitialiser tous les états du jeu Pictionary
      room.game2NextChooser = room.creator
      room.game2Track = null
      room.game2Drawer = null
      room.game2Guesser = null
      room.game2PlaylistTracks = []
      room.game2Ready = []
      io.to(roomId).emit('game-started', { theme: room.theme.value, themeType: room.theme.type, mode: room.mode, game2NextChooser: room.game2NextChooser })
      // Envoyer aussi un événement pour réinitialiser les états côté client
      io.to(roomId).emit('game2-new-round', { nextChooser: room.game2NextChooser })
    } else if (mode === 'blindtest') {
      // Pour Blind Test, envoyer l'événement de démarrage
      io.to(roomId).emit('game-started', { mode: 'blindtest' })
    } else {
      if (room.theme) {
        // Préparer la séquence pour l'envoi (s'assurer que c'est un tableau simple)
        let sequenceForClient = null
        if (room.themeSequence && Array.isArray(room.themeSequence)) {
          sequenceForClient = room.themeSequence.map(s => ({
            type: String(s.type),
            value: String(s.value)
          }))
        }

        const payload = {
          theme: String(room.theme.value),
          themeType: String(room.theme.type),
          mode: String(room.mode),
          totalRounds: room.themeSequence ? Number(room.themeSequence.length) : null,
          currentRound: room.themeIndex !== undefined ? Number(room.themeIndex + 1) : null,
          themeSequence: sequenceForClient
        }

        io.to(roomId).emit('game-started', payload)
      }
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
        // Passer au thème/artiste suivant
        if (room.themeSequence && room.themeIndex !== undefined) {
          room.themeIndex++
          room.theme = getNextTheme(room)

          if (!room.theme) {
            // Fin du jeu
            io.to(roomId).emit('game-ended', { scores: room.scores })
          } else {
            room.submissions = {}
            room.readyForNext = []
            room.skipVotes = []
            io.to(roomId).emit('new-round', {
              theme: room.theme.value,
              themeType: room.theme.type,
              totalRounds: room.themeSequence.length,
              currentRound: room.themeIndex + 1
            })
          }
        } else {
          // Fallback pour les anciennes parties
          room.theme = { type: 'theme', value: themes[Math.floor(Math.random() * themes.length)] }
          room.submissions = {}
          room.readyForNext = []
          room.skipVotes = []
          io.to(roomId).emit('new-round', { theme: room.theme.value, themeType: room.theme.type })
        }
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
        // Passer au thème/artiste suivant
        if (room.themeSequence && room.themeIndex !== undefined) {
          room.themeIndex++
          room.theme = getNextTheme(room)

          if (!room.theme) {
            // Fin du jeu
            io.to(roomId).emit('game-ended', { scores: room.scores })
          } else {
            room.submissions = {}
            room.readyForNext = []
            room.skipVotes = []
            io.to(roomId).emit('new-round', {
              theme: room.theme.value,
              themeType: room.theme.type,
              totalRounds: room.themeSequence.length,
              currentRound: room.themeIndex + 1
            })
          }
        } else {
          // Fallback pour les anciennes parties
          room.theme = { type: 'theme', value: themes[Math.floor(Math.random() * themes.length)] }
          room.submissions = {}
          room.readyForNext = []
          room.skipVotes = []
          io.to(roomId).emit('new-round', { theme: room.theme.value, themeType: room.theme.type })
        }
      }
    }
  })

  // === GAME 2: Pictionary Musical ===
  socket.on('game2-set-track', ({ roomId, track, playlistTracks }) => {
    const room = rooms.get(roomId)
    if (room) {
      // Vérifier que c'est bien le joueur qui doit choisir
      if (room.game2NextChooser && room.game2NextChooser !== socket.id) {
        return // Ce n'est pas ton tour de choisir
      }

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
        io.to(room.game2Guesser).emit('game2-wait-drawing')
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
      let isCorrect = false

      // Si guess est un objet avec trackId, comparer directement les IDs
      if (typeof guess === 'object' && guess.trackId) {
        isCorrect = guess.trackId === room.game2Track.id
      } else {
        // Sinon, comparer par nom/artiste (compatibilité)
        const trackNameNorm = normalizeString(room.game2Track.name)
        const artistNorm = normalizeString(room.game2Track.artist)
        const guessNorm = normalizeString(typeof guess === 'string' ? guess : guess.trackName || '')

        isCorrect = trackNameNorm.includes(guessNorm) ||
          artistNorm.includes(guessNorm) ||
          guessNorm.includes(trackNameNorm) ||
          guessNorm.includes(artistNorm)
      }

      if (isCorrect) {
        // Seul le guesser gagne un point
        room.scores[socket.id] = (room.scores[socket.id] || 0) + 1
      }

      io.to(roomId).emit('game2-result', {
        correct: isCorrect,
        guess: typeof guess === 'object' && guess.trackName ? guess.trackName : guess,
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

        // Alterner : celui qui était drawer devient guesser (et choisit la playlist)
        // On alterne toujours depuis le dernier chooser
        const lastChooser = room.game2NextChooser || room.creator
        const otherPlayer = room.players.find(p => p.id !== lastChooser)
        room.game2NextChooser = otherPlayer?.id || room.creator

        console.log('Pictionary alternance:', {
          lastChooser,
          newChooser: room.game2NextChooser,
          players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo }))
        })

        // Réinitialiser l'état du jeu
        room.game2Track = null
        room.game2PlaylistTracks = []
        room.game2Drawer = null
        room.game2Guesser = null

        io.to(roomId).emit('game2-new-round', { nextChooser: room.game2NextChooser })
      }
    }
  })

  // Blind Test handlers
  socket.on('blindtest-set-tracks', ({ roomId, tracks }) => {
    console.log('blindtest-set-tracks reçu:', { roomId, tracksCount: tracks?.length })
    const room = rooms.get(roomId)
    if (!room) {
      console.error('Room non trouvée:', roomId)
      return
    }
    if (room.mode !== 'blindtest') {
      console.error('Mode incorrect:', room.mode, 'attendu: blindtest')
      return
    }
    console.log('Initialisation des tracks blindtest...')
    room.blindtestTracks = tracks
    room.blindtestCurrentTrackIndex = 0
    room.blindtestSubmissions = {}
    room.blindtestReadyForNext = []
    const firstTrack = tracks && tracks.length > 0 ? tracks[0] : null
    console.log('Envoi blindtest-tracks-set avec', tracks?.length, 'tracks, première track:', firstTrack?.name)
    io.to(roomId).emit('blindtest-tracks-set', { tracks, currentIndex: 0 })
  })

  socket.on('blindtest-submit-answer', ({ roomId, trackName, artistName }) => {
    const room = rooms.get(roomId)
    if (room && room.mode === 'blindtest' && room.blindtestTracks && room.blindtestTracks.length > 0) {
      const currentTrack = room.blindtestTracks[room.blindtestCurrentTrackIndex]
      if (!currentTrack) return

      // Vérifier les correspondances avec une fonction plus souple
      const nameCorrect = trackName && matchesString(trackName, currentTrack.name)
      const artistCorrect = artistName && matchesString(artistName, currentTrack.artist)

      // Calculer le score
      let points = 0
      if (nameCorrect && artistCorrect) {
        points = 3
      } else if (nameCorrect || artistCorrect) {
        points = 1
      }

      // Ajouter les points
      if (points > 0) {
        room.scores[socket.id] = (room.scores[socket.id] || 0) + points
      }

      // Enregistrer la soumission
      room.blindtestSubmissions[socket.id] = {
        trackName,
        artistName,
        nameCorrect,
        artistCorrect,
        points,
        correctTrack: currentTrack
      }

      // Notifier l'autre joueur
      const otherPlayers = room.players.filter(p => p.id !== socket.id)
      otherPlayers.forEach(p => {
        io.to(p.id).emit('opponent-ready')
      })

      // Si les deux joueurs ont répondu, envoyer les résultats
      if (Object.keys(room.blindtestSubmissions).length === 2) {
        io.to(roomId).emit('blindtest-round-result', {
          submissions: room.blindtestSubmissions,
          scores: room.scores,
          currentTrack: currentTrack
        })
      } else {
        // Envoyer le résultat individuel
        socket.emit('blindtest-answer-result', {
          nameCorrect,
          artistCorrect,
          points,
          correctTrack: currentTrack
        })
      }
    }
  })

  socket.on('blindtest-next-track', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room && room.mode === 'blindtest') {
      if (!room.blindtestReadyForNext.includes(socket.id)) {
        room.blindtestReadyForNext.push(socket.id)
      }

      io.to(roomId).emit('blindtest-ready-count', room.blindtestReadyForNext.length)

      if (room.blindtestReadyForNext.length === 2) {
        room.blindtestCurrentTrackIndex++
        room.blindtestSubmissions = {}
        room.blindtestReadyForNext = []

        if (room.blindtestCurrentTrackIndex >= room.blindtestTracks.length) {
          // Fin du jeu
          io.to(roomId).emit('blindtest-game-ended', { scores: room.scores })
        } else {
          io.to(roomId).emit('blindtest-next-track', {
            currentIndex: room.blindtestCurrentTrackIndex,
            track: room.blindtestTracks[room.blindtestCurrentTrackIndex]
          })
        }
      }
    }
  })

  socket.on('blindtest-adjust-score', ({ roomId, playerId, delta }) => {
    const room = rooms.get(roomId)
    if (room && room.mode === 'blindtest' && room.creator === socket.id) {
      // Seul le créateur peut ajuster les scores
      if (room.scores[playerId] !== undefined) {
        room.scores[playerId] = Math.max(0, (room.scores[playerId] || 0) + delta)
        io.to(roomId).emit('scores-update', room.scores)
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
        // Supprimer la room si plus personne
        rooms.delete(roomId)
      } else {
        // Si un joueur reste et que c'était le créateur qui est parti, transférer le créateur
        if (room.creator === playerId && room.players.length > 0) {
          room.creator = room.players[0].id
        }
        
        // Réinitialiser les états du blind test si le jeu était en cours
        if (room.mode === 'blindtest') {
          room.blindtestTracks = []
          room.blindtestCurrentTrackIndex = 0
          room.blindtestSubmissions = {}
          room.blindtestReadyForNext = []
        }
        
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
