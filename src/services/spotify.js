const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

let accessToken = null
let tokenExpiry = null

async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
    },
    body: 'grant_type=client_credentials'
  })

  const data = await response.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  
  return accessToken
}

export async function getPreviewUrl(trackId) {
  try {
    const response = await fetch(`${SERVER_URL}/api/preview/${trackId}`)
    const data = await response.json()
    return data.previewUrl
  } catch (e) {
    return null
  }
}

export async function searchTracks(query, limit = 10) {
  const token = await getAccessToken()
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const data = await response.json()
  
  const tracks = data.tracks.items.map(track => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    image: track.album.images[1]?.url || track.album.images[0]?.url,
    previewUrl: null,
    duration: track.duration_ms
  }))

  return tracks
}

export async function getTrack(trackId) {
  const token = await getAccessToken()
  
  const response = await fetch(
    `https://api.spotify.com/v1/tracks/${trackId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const track = await response.json()
  
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    image: track.album.images[1]?.url || track.album.images[0]?.url,
    previewUrl: null,
    duration: track.duration_ms
  }
}

export function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export async function searchPlaylists(query, limit = 6) {
  const token = await getAccessToken()
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const data = await response.json()
  
  return data.playlists.items.filter(p => p).map(playlist => ({
    id: playlist.id,
    name: playlist.name,
    image: playlist.images?.[0]?.url || null,
    owner: playlist.owner?.display_name
  }))
}

export async function getPlaylistTracks(playlistId, limit = 5) {
  const token = await getAccessToken()
  
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const data = await response.json()
  
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
  
  // Récupérer les previewUrl pour chaque track via le serveur
  const tracksWithPreviews = await Promise.all(
    data.items
      .filter(item => item.track)
      .map(async (item) => {
        const track = item.track
        let previewUrl = null
        
        try {
          const previewResponse = await fetch(`${SERVER_URL}/api/preview/${track.id}`)
          if (previewResponse.ok) {
            const previewData = await previewResponse.json()
            previewUrl = previewData.previewUrl || null
          }
        } catch (e) {
          console.warn('Erreur récupération preview pour', track.id, e)
        }
        
        return {
          id: track.id,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          image: track.album.images?.[1]?.url || track.album.images?.[0]?.url,
          previewUrl: previewUrl,
          duration: track.duration_ms
        }
      })
  )
  
  return tracksWithPreviews
}

export async function getPopularTracksByCategory(searchTerm, limit = 20) {
  try {
    const token = await getAccessToken()
    if (!token) {
      throw new Error('Impossible d\'obtenir le token d\'accès Spotify')
    }
    
    // Rechercher des tracks populaires avec le terme de recherche (augmenter la limite pour avoir plus de choix)
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchTerm)}&type=track&limit=50&market=FR`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (!response.ok) {
      throw new Error(`Erreur API Spotify: ${response.status}`)
    }

    const data = await response.json()
    
    console.log(`Recherche "${searchTerm}": ${data.tracks?.items?.length || 0} tracks trouvées`)
    
    if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
      console.warn(`Aucune track trouvée pour "${searchTerm}"`)
      return []
    }
    
    // Trier par popularité (champ popularity de 0 à 100) - ne pas filtrer par preview_url maintenant
    const sortedTracks = data.tracks.items
      .filter(track => track && track.id) // Juste vérifier que la track existe
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10) // Prendre les 10 plus populaires
    
    console.log(`Après tri: ${sortedTracks.length} tracks (popularité: ${sortedTracks[0]?.popularity || 'N/A'})`)
    
    if (sortedTracks.length === 0) {
      console.warn(`Aucune track valide après tri pour "${searchTerm}"`)
      return []
    }
    
    // Sélectionner une track au hasard parmi les 10 plus populaires
    const randomTrack = sortedTracks[Math.floor(Math.random() * sortedTracks.length)]
    
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
    
    // Récupérer le previewUrl pour la track sélectionnée
    let previewUrl = randomTrack.preview_url || null
    
    // Essayer de récupérer via le serveur si pas de preview_url direct
    if (!previewUrl) {
      try {
        const previewResponse = await fetch(`${SERVER_URL}/api/preview/${randomTrack.id}`)
        if (previewResponse.ok) {
          const previewData = await previewResponse.json()
          previewUrl = previewData.previewUrl || null
        }
      } catch (e) {
        console.warn('Erreur récupération preview pour', randomTrack.id, e)
      }
    }
    
    // Si toujours pas de preview, essayer avec la track suivante dans la liste
    if (!previewUrl && sortedTracks.length > 1) {
      for (let i = 0; i < Math.min(5, sortedTracks.length); i++) {
        const track = sortedTracks[i]
        previewUrl = track.preview_url || null
        
        if (!previewUrl) {
          try {
            const previewResponse = await fetch(`${SERVER_URL}/api/preview/${track.id}`)
            if (previewResponse.ok) {
              const previewData = await previewResponse.json()
              previewUrl = previewData.previewUrl || null
              if (previewUrl) {
                // Utiliser cette track à la place
                return [{
                  id: track.id,
                  name: track.name,
                  artist: track.artists.map(a => a.name).join(', '),
                  album: track.album.name,
                  image: track.album.images?.[1]?.url || track.album.images?.[0]?.url,
                  previewUrl: previewUrl,
                  duration: track.duration_ms,
                  popularity: track.popularity
                }]
              }
            }
          } catch (e) {
            // Continuer avec la suivante
          }
        } else {
          // Utiliser cette track
          return [{
            id: track.id,
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            image: track.album.images?.[1]?.url || track.album.images?.[0]?.url,
            previewUrl: previewUrl,
            duration: track.duration_ms,
            popularity: track.popularity
          }]
        }
      }
    }
    
    // Retourner un tableau avec une seule track (pour compatibilité avec le code existant)
    if (!previewUrl) {
      console.warn(`Aucune preview disponible pour les tracks de "${searchTerm}"`)
      return []
    }
    
    return [{
      id: randomTrack.id,
      name: randomTrack.name,
      artist: randomTrack.artists.map(a => a.name).join(', '),
      album: randomTrack.album.name,
      image: randomTrack.album.images?.[1]?.url || randomTrack.album.images?.[0]?.url,
      previewUrl: previewUrl,
      duration: randomTrack.duration_ms,
      popularity: randomTrack.popularity
    }]
  } catch (e) {
    console.error('Erreur dans getPopularTracksByCategory:', e)
    throw e
  }
}
