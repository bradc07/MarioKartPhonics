import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { PLAYER_KART_IMAGE } from './assets'

const SPELLING_WORDS = [
  'because', 'friend', 'again', 'said', 'could',
  'would', 'should', 'people', 'water', 'there',
  'their', "they're", 'where', 'were', 'your',
  "you're", 'many', 'any', 'busy', 'beautiful'
]

const QUESTION_INTERVAL = 5000
const PLAYER_ADVANCE = 140
const AI_ADVANCE_MIN = 90
const AI_ADVANCE_MAX = 180
const TRACK_LENGTH = 2000
const VIEWPORT_HEIGHT = 640
const LANE_WIDTH = 120

interface Kart {
  id: string
  lane: number
  progress: number
  color: string
  isPlayer: boolean
}

interface Question {
  word: string
  options: string[]
  correctIndex: number
  revealed: boolean
}

type GameState = 'countdown' | 'racing' | 'finished'
type PowerUpType = 'green-shell' | 'red-shell' | 'mushroom' | 'banana' | 'star'

const POWER_UP_ICONS: Record<PowerUpType, string> = {
  'green-shell': '🟢',
  'red-shell': '🔴',
  'mushroom': '🍄',
  'banana': '🍌',
  'star': '⭐',
}

function App() {
  const [gameState, setGameState] = useState<GameState>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [karts, setKarts] = useState<Kart[]>([
    { id: 'player', lane: 1, progress: 0, color: '#FF1744', isPlayer: true },
    { id: 'ai1', lane: 0, progress: 0, color: '#2196F3', isPlayer: false },
    { id: 'ai2', lane: 2, progress: 0, color: '#4CAF50', isPlayer: false },
    { id: 'ai3', lane: 3, progress: 0, color: '#FFC107', isPlayer: false },
  ])
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [heldPowerUp, setHeldPowerUp] = useState<PowerUpType | null>(null)
  const [message, setMessage] = useState('')

  const gameStateRef = useRef<GameState>('countdown')
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playerKart = useMemo(() => karts.find(k => k.isPlayer)!, [karts])
  const finishLineReached = karts.some(k => k.progress >= TRACK_LENGTH)

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    if (gameState === 'countdown') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setGameState('racing')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameState])

  useEffect(() => {
    if (gameState !== 'racing') return

    spawnQuestion()
    if (questionTimerRef.current) clearInterval(questionTimerRef.current)
    questionTimerRef.current = setInterval(spawnQuestion, QUESTION_INTERVAL)

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current)
    }
  }, [gameState])

  useEffect(() => {
    if (gameState !== 'racing') return

    const aiInterval = setInterval(() => {
      setKarts(prev =>
        prev.map(kart => {
          if (kart.isPlayer) return kart
          const jump = Math.floor(Math.random() * (AI_ADVANCE_MAX - AI_ADVANCE_MIN + 1)) + AI_ADVANCE_MIN
          return { ...kart, progress: Math.min(TRACK_LENGTH, kart.progress + jump) }
        })
      )
    }, 2500)

    return () => clearInterval(aiInterval)
  }, [gameState])

  useEffect(() => {
    if (finishLineReached && gameState !== 'finished') {
      setGameState('finished')
      if (questionTimerRef.current) clearInterval(questionTimerRef.current)
    }
  }, [finishLineReached, gameState])

  const spawnQuestion = () => {
    const word = SPELLING_WORDS[Math.floor(Math.random() * SPELLING_WORDS.length)]
    const options = buildOptions(word)
    const correctIndex = options.indexOf(word)
    const newQuestion: Question = {
      word,
      options,
      correctIndex,
      revealed: false,
    }
    setQuestion(newQuestion)
    setSelectedOption(null)
    setMessage('')
    speakWord(word)
  }

  const buildOptions = (word: string) => {
    const variations = new Set<string>([word])
    while (variations.size < 4) {
      const swapIndex = Math.floor(Math.random() * word.length)
      const chars = word.split('')
      const swapWith = Math.floor(Math.random() * word.length)
      ;[chars[swapIndex], chars[swapWith]] = [chars[swapWith], chars[swapIndex]]
      const candidate = chars.join('')
      variations.add(candidate)
    }
    return Array.from(variations).sort(() => Math.random() - 0.5)
  }

  const speakWord = (word: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.rate = 0.9
      utterance.pitch = 1
      speechSynthesis.speak(utterance)
    }
  }

  const movePlayerForward = (distance: number) => {
    setKarts(prev =>
      prev.map(kart => kart.isPlayer ? { ...kart, progress: Math.min(TRACK_LENGTH, kart.progress + distance) } : kart)
    )
  }

  const applyPowerUp = (powerUp: PowerUpType) => {
    switch (powerUp) {
      case 'mushroom':
      case 'star':
        movePlayerForward(90)
        setMessage('Boost!')
        break
      case 'green-shell':
      case 'red-shell':
        setKarts(prev => {
          const leader = prev.filter(k => !k.isPlayer).sort((a, b) => b.progress - a.progress)[0]
          if (!leader) return prev
          return prev.map(k => k.id === leader.id ? { ...k, progress: Math.max(0, k.progress - 60) } : k)
        })
        setMessage('Opponent slowed!')
        break
      case 'banana':
        setMessage('Defensive banana ready!')
        break
    }
    setHeldPowerUp(null)
  }

  const handleAnswer = (option: string, index: number) => {
    if (!question || selectedOption !== null) return

    const isCorrect = option === question.word
    setSelectedOption(index)
    setQuestion(prev => prev ? { ...prev, revealed: true } : prev)

    if (isCorrect) {
      movePlayerForward(PLAYER_ADVANCE)
      const newPower = Object.keys(POWER_UP_ICONS)[Math.floor(Math.random() * 5)] as PowerUpType
      setHeldPowerUp(newPower)
      setMessage('Great job! You earned a power-up!')
    } else {
      setMessage('Almost! Watch for the highlighted answer.')
    }
  }

  const resetGame = () => {
    setGameState('countdown')
    setCountdown(3)
    setKarts([
      { id: 'player', lane: 1, progress: 0, color: '#FF1744', isPlayer: true },
      { id: 'ai1', lane: 0, progress: 0, color: '#2196F3', isPlayer: false },
      { id: 'ai2', lane: 2, progress: 0, color: '#4CAF50', isPlayer: false },
      { id: 'ai3', lane: 3, progress: 0, color: '#FFC107', isPlayer: false },
    ])
    setQuestion(null)
    setSelectedOption(null)
    setHeldPowerUp(null)
    setMessage('')
  }

  const positionDisplay = useMemo(() => {
    const sorted = [...karts].sort((a, b) => b.progress - a.progress)
    const playerIndex = sorted.findIndex(k => k.isPlayer)
    return playerIndex + 1
  }, [karts])

  const viewportOffset = useMemo(() => {
    const desiredOffset = Math.max(0, playerKart.progress - VIEWPORT_HEIGHT * 0.4)
    const maxOffset = Math.max(0, TRACK_LENGTH - VIEWPORT_HEIGHT)
    return Math.min(desiredOffset, maxOffset)
  }, [playerKart.progress])

  return (
    <div className="game-container">
      {gameState === 'countdown' && (
        <div className="countdown-screen">
          <div className="game-title">Mario Kart Phonics</div>
          <div className="countdown-number">{countdown}</div>
          <div className="instruction">Get ready to listen and pick the right spelling!</div>
        </div>
      )}

      {gameState !== 'countdown' && (
        <>
          <div className="hud">
            <div className="position-display">Position: {positionDisplay}/4</div>
            <div className="timer-display">
              {gameState === 'finished' ? 'Race Finished!' : 'Answer to speed ahead!'}
            </div>
            <div className="powerup-display">
              Power-Up: {heldPowerUp ? `${POWER_UP_ICONS[heldPowerUp]} ${heldPowerUp}` : 'None'}
              {heldPowerUp && (
                <button className="powerup-button" onClick={() => applyPowerUp(heldPowerUp)}>
                  Use
                </button>
              )}
            </div>
          </div>

          <div className="track-container">
            <div
              className="track"
              style={{ height: `${TRACK_LENGTH + 200}px`, transform: `translateY(-${viewportOffset}px)` }}
            >
              <div className="finish-line" style={{ bottom: `${TRACK_LENGTH}px` }}>
                Finish
              </div>

              {[0, 1, 2, 3].map(lane => (
                <div key={lane} className="lane" style={{ left: `${LANE_WIDTH * lane}px` }} />
              ))}

              {karts.map(kart => (
                <div
                  key={kart.id}
                  className={`kart ${kart.isPlayer ? 'player' : ''}`}
                  style={{
                    left: `${LANE_WIDTH * kart.lane + LANE_WIDTH / 2}px`,
                    bottom: `${kart.progress}px`,
                  }}
                >
                  {kart.isPlayer ? (
                    <img src={PLAYER_KART_IMAGE} alt="Player Kart" className="kart-image" />
                  ) : (
                    <div className="kart-emoji">🏎️</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="question-panel">
            <div className="question-header">
              <div className="question-word">Listen for the word!</div>
              {question && (
                <button className="replay-button" onClick={() => speakWord(question.word)}>
                  🔊 Replay Word
                </button>
              )}
            </div>

            {question && (
              <div className="options-grid">
                {question.options.map((option, idx) => {
                  const isCorrect = idx === question.correctIndex
                  const isSelected = idx === selectedOption
                  const showReveal = question.revealed && isCorrect
                  return (
                    <button
                      key={option + idx}
                      className={`option-button ${isSelected ? 'selected' : ''} ${showReveal ? 'correct' : ''}`}
                      onClick={() => handleAnswer(option, idx)}
                      disabled={selectedOption !== null}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="message-row">{message}</div>
          </div>

          {gameState === 'finished' && (
            <div className="finish-banner">
              <div className="finish-title">Race complete!</div>
              <button className="restart-button" onClick={resetGame}>Race Again</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
