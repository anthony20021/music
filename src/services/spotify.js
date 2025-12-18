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
  
  return data.items.filter(item => item.track).map(item => ({
    id: item.track.id,
    name: item.track.name,
    artist: item.track.artists.map(a => a.name).join(', '),
    image: item.track.album.images?.[1]?.url || item.track.album.images?.[0]?.url
  }))
}
