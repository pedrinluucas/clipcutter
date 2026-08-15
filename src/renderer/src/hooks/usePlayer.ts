import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoInfo } from '@shared/types'

export function usePlayer(video: VideoInfo) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState(1)
  const [volume, setVolumeState] = useState(1)

  // requestAnimationFrame em vez de timeupdate: o evento nativo dispara
  // ~4x por segundo, o que faz o playhead andar aos trancos.
  useEffect(() => {
    let frame = 0
    const tick = (): void => {
      const element = videoRef.current
      if (element) setCurrentTime(element.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const seek = useCallback(
    (time: number) => {
      const element = videoRef.current
      if (!element) return
      element.currentTime = Math.min(Math.max(time, 0), video.duration)
      setCurrentTime(element.currentTime)
    },
    [video.duration],
  )

  const toggle = useCallback(() => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) {
      void element.play()
      setPlaying(true)
    } else {
      element.pause()
      setPlaying(false)
    }
  }, [])

  const nudge = useCallback(
    (delta: number) => seek((videoRef.current?.currentTime ?? 0) + delta),
    [seek],
  )

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const element = videoRef.current
      if (!element) return
      element.pause()
      setPlaying(false)
      const frame = video.fps > 0 ? 1 / video.fps : 1 / 30
      seek(element.currentTime + direction * frame)
    },
    [seek, video.fps],
  )

  const setRate = useCallback((value: number) => {
    setRateState(value)
    if (videoRef.current) videoRef.current.playbackRate = value
  }, [])

  const setVolume = useCallback((value: number) => {
    setVolumeState(value)
    if (videoRef.current) videoRef.current.volume = value
  }, [])

  return { videoRef, currentTime, playing, rate, volume, toggle, seek, nudge, stepFrame, setRate, setVolume }
}

export type Player = ReturnType<typeof usePlayer>
