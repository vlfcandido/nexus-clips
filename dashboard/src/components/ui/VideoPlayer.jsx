import { useState } from 'react'
import { Play, Pause, Maximize2, Volume2, VolumeX, X } from 'lucide-react'

export default function VideoPlayer({ src, poster, onClose, className = '' }) {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)

  function togglePlay() {
    const video = document.getElementById('nx-player')
    if (!video) return
    if (video.paused) { video.play(); setPlaying(true) }
    else { video.pause(); setPlaying(false) }
  }

  if (!src) return null

  return (
    <div className={`relative bg-black rounded-2xl overflow-hidden group ${className}`}>
      <video
        id="nx-player"
        src={src}
        poster={poster}
        muted={muted}
        className="w-full aspect-[9/16] max-h-[480px] object-contain bg-black"
        onClick={togglePlay}
        onEnded={() => setPlaying(false)}
      />

      {/* Overlay controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
        <div className="flex items-center gap-2">
          <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
            {playing ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
          </button>
          <button onClick={() => setMuted(!muted)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            {muted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
          </button>
          <div className="flex-1" />
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Play overlay when paused */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
            <Play className="w-6 h-6 text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  )
}

export function VideoThumbnail({ src, duration, onClick, className = '' }) {
  return (
    <div
      className={`relative bg-surface-4 rounded-xl overflow-hidden cursor-pointer group ${className}`}
      onClick={onClick}
    >
      {src ? (
        <img src={src} className="w-full h-full object-cover" alt="" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Play className="w-5 h-5 text-content-4" />
        </div>
      )}

      {/* Hover play */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-3.5 h-3.5 text-white ml-0.5" />
        </div>
      </div>

      {/* Duration */}
      {duration && (
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-mono text-white">
          {duration}
        </span>
      )}
    </div>
  )
}
