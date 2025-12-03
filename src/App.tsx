import { useState, useEffect, useCallback } from 'react'
import './App.css'

type GameState = 'countdown' | 'racing' | 'finished'
type Lane = 0 | 1 | 2

interface Kart {
  id: string
  lane: Lane
  position: number
  speed: number
  color: string
  isPlayer: boolean
}

const LANE_WIDTH = 120
const LANE_OFFSET = 50
const RACE_DURATION = 60000 // 60 seconds in milliseconds
const FINISH_LINE_POSITION = 10000

function App() {
  const [gameState, setGameState] = useState<GameState>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [raceTime, setRaceTime] = useState(0)
  const [trackOffset, setTrackOffset] = useState(0)

  const [playerKart, setPlayerKart] = useState<Kart>({
    id: 'player',
    lane: 1,
    position: 0,
    speed: 5,
    color: '#FF1744',
    isPlayer: true,
  })

  const [aiKarts, setAiKarts] = useState<Kart[]>([
    {
      id: 'ai1',
      lane: 0,
      position: 500,
      speed: 4.5,
      color: '#2196F3',
      isPlayer: false,
    },
    {
      id: 'ai2',
      lane: 1,
      position: 800,
      speed: 4.8,
      color: '#4CAF50',
      isPlayer: false,
    },
    {
      id: 'ai3',
      lane: 2,
      position: 1200,
      speed: 4.3,
      color: '#FFC107',
      isPlayer: false,
    },
  ])

  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())

  // Calculate positions
  const calculatePosition = useCallback(() => {
    const allKarts = [playerKart, ...aiKarts].sort((a, b) => b.position - a.position)
    const playerPos = allKarts.findIndex(k => k.id === 'player') + 1
    return playerPos
  }, [playerKart, aiKarts])

  // Countdown timer
  useEffect(() => {
    if (gameState === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (gameState === 'countdown' && countdown === 0) {
      setTimeout(() => setGameState('racing'), 500)
    }
  }, [gameState, countdown])

  // Race timer
  useEffect(() => {
    if (gameState === 'racing') {
      const timer = setInterval(() => {
        setRaceTime(prev => {
          const newTime = prev + 16
          if (newTime >= RACE_DURATION) {
            setGameState('finished')
            return RACE_DURATION
          }
          return newTime
        })
      }, 16)
      return () => clearInterval(timer)
    }
  }, [gameState])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'racing' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        setPressedKeys(prev => new Set(prev).add(e.key))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys(prev => {
        const newSet = new Set(prev)
        newSet.delete(e.key)
        return newSet
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameState])

  // Handle lane changes
  useEffect(() => {
    if (gameState !== 'racing') return

    const interval = setInterval(() => {
      if (pressedKeys.has('ArrowLeft')) {
        setPlayerKart(prev => ({
          ...prev,
          lane: Math.max(0, prev.lane - 1) as Lane,
        }))
      } else if (pressedKeys.has('ArrowRight')) {
        setPlayerKart(prev => ({
          ...prev,
          lane: Math.min(2, prev.lane + 1) as Lane,
        }))
      }
    }, 200)

    return () => clearInterval(interval)
  }, [gameState, pressedKeys])

  // Game loop - update positions
  useEffect(() => {
    if (gameState !== 'racing') return

    const gameLoop = setInterval(() => {
      // Update player position
      setPlayerKart(prev => ({
        ...prev,
        position: prev.position + prev.speed,
      }))

      // Update AI karts
      setAiKarts(prev =>
        prev.map(kart => {
          let newKart = { ...kart }

          // Update position
          newKart.position += kart.speed

          // Occasionally change lanes (random)
          if (Math.random() < 0.01) {
            const direction = Math.random() < 0.5 ? -1 : 1
            newKart.lane = Math.max(0, Math.min(2, kart.lane + direction)) as Lane
          }

          // Slight speed variation
          if (Math.random() < 0.05) {
            newKart.speed = kart.speed + (Math.random() - 0.5) * 0.3
            newKart.speed = Math.max(3.5, Math.min(5.5, newKart.speed))
          }

          return newKart
        })
      )

      // Update track offset for scrolling effect
      setTrackOffset(prev => (prev + 3) % 100)
    }, 16)

    return () => clearInterval(gameLoop)
  }, [gameState])

  // Check for finish line
  useEffect(() => {
    if (gameState === 'racing') {
      const allKarts = [playerKart, ...aiKarts]
      const anyFinished = allKarts.some(k => k.position >= FINISH_LINE_POSITION)
      if (anyFinished) {
        setGameState('finished')
      }
    }
  }, [gameState, playerKart, aiKarts])

  const resetGame = () => {
    setGameState('countdown')
    setCountdown(3)
    setRaceTime(0)
    setTrackOffset(0)
    setPlayerKart({
      id: 'player',
      lane: 1,
      position: 0,
      speed: 5,
      color: '#FF1744',
      isPlayer: true,
    })
    setAiKarts([
      {
        id: 'ai1',
        lane: 0,
        position: 500,
        speed: 4.5,
        color: '#2196F3',
        isPlayer: false,
      },
      {
        id: 'ai2',
        lane: 1,
        position: 800,
        speed: 4.8,
        color: '#4CAF50',
        isPlayer: false,
      },
      {
        id: 'ai3',
        lane: 2,
        position: 1200,
        speed: 4.3,
        color: '#FFC107',
        isPlayer: false,
      },
    ])
  }

  const renderKart = (kart: Kart) => {
    const screenPosition = kart.position - playerKart.position
    const laneX = LANE_OFFSET + kart.lane * LANE_WIDTH

    // Only render if on screen (within reasonable bounds)
    if (screenPosition < -200 || screenPosition > 600) return null

    return (
      <div
        key={kart.id}
        className="kart"
        style={{
          left: `${laneX}px`,
          bottom: `${300 - screenPosition}px`,
          backgroundColor: kart.color,
          border: kart.isPlayer ? '4px solid white' : 'none',
          boxShadow: kart.isPlayer ? '0 0 20px rgba(255, 255, 255, 0.8)' : 'none',
        }}
      >
        {kart.isPlayer ? '🏎️' : ''}
      </div>
    )
  }

  const renderFinishLine = () => {
    const screenPosition = FINISH_LINE_POSITION - playerKart.position

    if (screenPosition < -50 || screenPosition > 700) return null

    return (
      <div
        className="finish-line"
        style={{
          bottom: `${300 - screenPosition}px`,
        }}
      >
        🏁 FINISH LINE 🏁
      </div>
    )
  }

  const getFinalResults = () => {
    return [playerKart, ...aiKarts]
      .sort((a, b) => b.position - a.position)
      .map((kart, index) => ({
        kart,
        position: index + 1,
      }))
  }

  if (gameState === 'countdown') {
    return (
      <div className="game-container">
        <div className="countdown-screen">
          <h1 className="game-title">🏁 Mario Kart Phonics 🏁</h1>
          <div className="countdown-number">
            {countdown > 0 ? countdown : 'GO!'}
          </div>
          <p className="instruction">Use ← → arrow keys to change lanes!</p>
        </div>
      </div>
    )
  }

  if (gameState === 'finished') {
    const results = getFinalResults()
    const playerResult = results.find(r => r.kart.id === 'player')

    return (
      <div className="game-container">
        <div className="results-screen">
          <h1 className="game-title">🏁 Race Complete! 🏁</h1>
          <div className="final-position">
            You finished in {playerResult?.position}
            {playerResult?.position === 1 ? 'st' :
             playerResult?.position === 2 ? 'nd' :
             playerResult?.position === 3 ? 'rd' : 'th'} place!
          </div>
          <div className="results-list">
            <h2>Final Results:</h2>
            {results.map((result) => (
              <div
                key={result.kart.id}
                className={`result-item ${result.kart.isPlayer ? 'player-result' : ''}`}
              >
                <span className="position-badge">{result.position}</span>
                <div
                  className="result-kart"
                  style={{ backgroundColor: result.kart.color }}
                />
                <span className="result-name">
                  {result.kart.isPlayer ? 'YOU' : `Racer ${result.kart.id.slice(-1)}`}
                </span>
              </div>
            ))}
          </div>
          <button className="play-again-btn" onClick={resetGame}>
            Race Again!
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="game-container">
      <div className="hud">
        <div className="position-display">
          Position: {calculatePosition()}/{aiKarts.length + 1}
        </div>
        <div className="timer-display">
          Time: {Math.floor(raceTime / 1000)}s
        </div>
      </div>

      <div className="track-container">
        <div
          className="track"
          style={{
            backgroundPositionY: `${trackOffset}px`,
          }}
        >
          <div className="lane-markers">
            <div className="lane-line" style={{ left: `${LANE_OFFSET + LANE_WIDTH}px` }} />
            <div className="lane-line" style={{ left: `${LANE_OFFSET + LANE_WIDTH * 2}px` }} />
          </div>

          {renderFinishLine()}
          {renderKart(playerKart)}
          {aiKarts.map((kart) => renderKart(kart))}
        </div>
      </div>
    </div>
  )
}

export default App
