import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { PLAYER_KART_IMAGE } from './assets'

type GameState = 'countdown' | 'racing' | 'finished'
type Lane = 0 | 1 | 2
type PowerUpType = 'green-shell' | 'red-shell' | 'mushroom' | 'banana' | 'star'

interface Kart {
  id: string
  lane: Lane
  position: number
  speed: number
  baseSpeed: number
  color: string
  isPlayer: boolean
}

interface ItemBox {
  id: string
  lane: Lane
  position: number
  collected: boolean
}

interface SpellingQuestion {
  word: string
  active: boolean
}

interface Projectile {
  id: string
  type: 'green-shell' | 'red-shell'
  lane: Lane
  position: number
  speed: number
  targetKartId?: string
}

interface Obstacle {
  id: string
  type: 'banana'
  lane: Lane
  position: number
  timestamp: number
}

interface KartEffect {
  spinning: boolean
  spinEndTime: number
  boosted: boolean
  boostEndTime: number
  star: boolean
  starEndTime: number
}

const LANE_WIDTH = 120
const LANE_OFFSET = 50
const RACE_DURATION = 60000
const FINISH_LINE_POSITION = 10000
const ITEM_BOX_SPACING = 1200
const QUESTION_TIME_LIMIT = 10000
const PROJECTILE_SPEED = 10
const SPIN_DURATION = 2000
const BOOST_DURATION = 2000
const STAR_DURATION = 4000
const BANANA_LIFETIME = 10000

const SPELLING_WORDS = [
  'because', 'friend', 'again', 'said', 'could',
  'would', 'should', 'people', 'water', 'there',
  'their', 'they\'re', 'where', 'were', 'your',
  'you\'re', 'many', 'any', 'busy', 'beautiful'
]

const POWER_UP_ICONS: Record<PowerUpType, string> = {
  'green-shell': '🟢',
  'red-shell': '🔴',
  'mushroom': '🍄',
  'banana': '🍌',
  'star': '⭐'
}

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
    baseSpeed: 5,
    color: '#FF1744',
    isPlayer: true,
  })

  const [aiKarts, setAiKarts] = useState<Kart[]>([
    {
      id: 'ai1',
      lane: 0,
      position: 500,
      speed: 4.5,
      baseSpeed: 4.5,
      color: '#2196F3',
      isPlayer: false,
    },
    {
      id: 'ai2',
      lane: 1,
      position: 800,
      speed: 4.8,
      baseSpeed: 4.8,
      color: '#4CAF50',
      isPlayer: false,
    },
    {
      id: 'ai3',
      lane: 2,
      position: 1200,
      speed: 4.3,
      baseSpeed: 4.3,
      color: '#FFC107',
      isPlayer: false,
    },
  ])

  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())
  const [itemBoxes, setItemBoxes] = useState<ItemBox[]>([])
  const [spellingQuestion, setSpellingQuestion] = useState<SpellingQuestion>({
    word: '',
    active: false,
  })
  const [userAnswer, setUserAnswer] = useState('')
  const [questionTimer, setQuestionTimer] = useState(QUESTION_TIME_LIMIT)
  const [heldPowerUp, setHeldPowerUp] = useState<PowerUpType | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [frozenPosition, setFrozenPosition] = useState(0)

  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [playerEffect, setPlayerEffect] = useState<KartEffect>({
    spinning: false,
    spinEndTime: 0,
    boosted: false,
    boostEndTime: 0,
    star: false,
    starEndTime: 0,
  })
  const [aiEffects, setAiEffects] = useState<Record<string, KartEffect>>({})
  const [aiItemUseCount, setAiItemUseCount] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const projectileIdCounter = useRef(0)
  const obstacleIdCounter = useRef(0)
  const gameStateRef = useRef(gameState)
  const spellingQuestionRef = useRef(spellingQuestion)
  const heldPowerUpRef = useRef(heldPowerUp)

  // Keep refs in sync
  useEffect(() => {
    gameStateRef.current = gameState
    spellingQuestionRef.current = spellingQuestion
    heldPowerUpRef.current = heldPowerUp
  }, [gameState, spellingQuestion, heldPowerUp])

  // Initialize item boxes
  useEffect(() => {
    if (gameState === 'racing' && itemBoxes.length === 0) {
      const boxes: ItemBox[] = []
      for (let i = 0; i < 10; i++) {
        boxes.push({
          id: `box-${i}`,
          lane: Math.floor(Math.random() * 3) as Lane,
          position: 1000 + (i * ITEM_BOX_SPACING),
          collected: false,
        })
      }
      setItemBoxes(boxes)
    }
  }, [gameState, itemBoxes.length])

  // Calculate positions
  const calculatePosition = useCallback(() => {
    const allKarts = [playerKart, ...aiKarts].sort((a, b) => b.position - a.position)
    const playerPos = allKarts.findIndex(k => k.id === 'player') + 1
    return playerPos
  }, [playerKart, aiKarts])

  // Speak word using Web Speech API
  const speakWord = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.rate = 0.8
      utterance.pitch = 1
      speechSynthesis.speak(utterance)
    }
  }

  // Use power-up
  const usePowerUp = (powerUpType: PowerUpType) => {
    const now = Date.now()

    switch (powerUpType) {
      case 'green-shell': {
        const newProjectile: Projectile = {
          id: `projectile-${projectileIdCounter.current++}`,
          type: 'green-shell',
          lane: playerKart.lane,
          position: playerKart.position + 100,
          speed: PROJECTILE_SPEED,
        }
        setProjectiles(prev => [...prev, newProjectile])
        break
      }

      case 'red-shell': {
        const opponentsAhead = aiKarts.filter(k => k.position > playerKart.position)
        if (opponentsAhead.length > 0) {
          const nearest = opponentsAhead.reduce((closest, kart) =>
            kart.position < closest.position ? kart : closest
          )
          const newProjectile: Projectile = {
            id: `projectile-${projectileIdCounter.current++}`,
            type: 'red-shell',
            lane: playerKart.lane,
            position: playerKart.position + 100,
            speed: PROJECTILE_SPEED,
            targetKartId: nearest.id,
          }
          setProjectiles(prev => [...prev, newProjectile])
        }
        break
      }

      case 'mushroom': {
        setPlayerEffect(prev => ({
          ...prev,
          boosted: true,
          boostEndTime: now + BOOST_DURATION,
        }))
        setPlayerKart(prev => ({ ...prev, speed: prev.baseSpeed * 2 }))
        break
      }

      case 'banana': {
        const newObstacle: Obstacle = {
          id: `obstacle-${obstacleIdCounter.current++}`,
          type: 'banana',
          lane: playerKart.lane,
          position: playerKart.position - 100,
          timestamp: now,
        }
        setObstacles(prev => [...prev, newObstacle])
        break
      }

      case 'star': {
        setPlayerEffect(prev => ({
          ...prev,
          star: true,
          starEndTime: now + STAR_DURATION,
          boosted: true,
          boostEndTime: now + STAR_DURATION,
        }))
        setPlayerKart(prev => ({ ...prev, speed: prev.baseSpeed * 1.5 }))
        break
      }
    }

    setHeldPowerUp(null)
  }

  // Apply spin-out effect to kart
  const applySpinOut = (kartId: string, isPlayer: boolean) => {
    const now = Date.now()

    if (isPlayer) {
      if (playerEffect.star) return // Immune during star
      setPlayerEffect(prev => ({
        ...prev,
        spinning: true,
        spinEndTime: now + SPIN_DURATION,
      }))
      setPlayerKart(prev => ({ ...prev, speed: prev.baseSpeed * 0.3 }))
    } else {
      setAiEffects(prev => ({
        ...prev,
        [kartId]: {
          ...prev[kartId],
          spinning: true,
          spinEndTime: now + SPIN_DURATION,
          boosted: false,
          boostEndTime: 0,
          star: false,
          starEndTime: 0,
        },
      }))
      setAiKarts(prev =>
        prev.map(k => k.id === kartId ? { ...k, speed: k.baseSpeed * 0.3 } : k)
      )
    }
  }

  // AI item usage
  useEffect(() => {
    if (gameState !== 'racing' || aiItemUseCount >= 3) return

    const interval = setInterval(() => {
      if (Math.random() < 0.05) {
        const randomAi = aiKarts[Math.floor(Math.random() * aiKarts.length)]
        const itemType = Math.random() < 0.5 ? 'banana' : 'green-shell'
        const now = Date.now()

        if (itemType === 'banana') {
          const newObstacle: Obstacle = {
            id: `obstacle-${obstacleIdCounter.current++}`,
            type: 'banana',
            lane: randomAi.lane,
            position: randomAi.position - 100,
            timestamp: now,
          }
          setObstacles(prev => [...prev, newObstacle])
        } else {
          const newProjectile: Projectile = {
            id: `projectile-${projectileIdCounter.current++}`,
            type: 'green-shell',
            lane: randomAi.lane,
            position: randomAi.position - 100,
            speed: -PROJECTILE_SPEED,
          }
          setProjectiles(prev => [...prev, newProjectile])
        }

        setAiItemUseCount(prev => prev + 1)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [gameState, aiKarts, aiItemUseCount])

  // Update effects
  useEffect(() => {
    if (gameState !== 'racing') return

    const interval = setInterval(() => {
      const now = Date.now()

      // Update player effects
      setPlayerEffect(prev => {
        let updated = { ...prev }

        if (prev.spinning && now >= prev.spinEndTime) {
          updated.spinning = false
          setPlayerKart(k => ({ ...k, speed: k.baseSpeed }))
        }

        if (prev.boosted && now >= prev.boostEndTime && !prev.star) {
          updated.boosted = false
          setPlayerKart(k => ({ ...k, speed: k.baseSpeed }))
        }

        if (prev.star && now >= prev.starEndTime) {
          updated.star = false
          updated.boosted = false
          setPlayerKart(k => ({ ...k, speed: k.baseSpeed }))
        }

        return updated
      })

      // Update AI effects
      setAiEffects(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(kartId => {
          if (updated[kartId].spinning && now >= updated[kartId].spinEndTime) {
            updated[kartId].spinning = false
            setAiKarts(karts =>
              karts.map(k => k.id === kartId ? { ...k, speed: k.baseSpeed } : k)
            )
          }
        })
        return updated
      })

      // Remove expired bananas
      setObstacles(prev =>
        prev.filter(o => now - o.timestamp < BANANA_LIFETIME)
      )
    }, 100)

    return () => clearInterval(interval)
  }, [gameState])

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
    if (gameState === 'racing' && !spellingQuestion.active) {
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
  }, [gameState, spellingQuestion.active])

  // Question timer
  useEffect(() => {
    if (spellingQuestion.active && questionTimer > 0) {
      const timer = setInterval(() => {
        setQuestionTimer(prev => {
          const newTime = prev - 100
          if (newTime <= 0) {
            handleWrongAnswer()
            return 0
          }
          return newTime
        })
      }, 100)
      return () => clearInterval(timer)
    }
  }, [spellingQuestion.active, questionTimer])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('Key pressed:', e.key, 'Game state:', gameStateRef.current, 'Modal active:', spellingQuestionRef.current.active)

      if (gameStateRef.current === 'racing' && !spellingQuestionRef.current.active) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          console.log('Arrow key detected, updating pressedKeys')
          setPressedKeys(prev => {
            const newSet = new Set(prev)
            newSet.add(e.key)
            console.log('New pressed keys:', Array.from(newSet))
            return newSet
          })
        } else if (e.key === ' ' && heldPowerUpRef.current) {
          e.preventDefault()
          console.log('Spacebar pressed, using power-up:', heldPowerUpRef.current)
          usePowerUp(heldPowerUpRef.current)
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        console.log('Key released:', e.key)
        setPressedKeys(prev => {
          const newSet = new Set(prev)
          newSet.delete(e.key)
          return newSet
        })
      }
    }

    console.log('Adding keyboard event listeners')
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      console.log('Removing keyboard event listeners')
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Handle lane changes
  useEffect(() => {
    if (gameState !== 'racing' || spellingQuestion.active) {
      console.log('Lane change effect skipped - gameState:', gameState, 'modal:', spellingQuestion.active)
      return
    }

    console.log('Setting up lane change interval, pressed keys:', Array.from(pressedKeys))

    const interval = setInterval(() => {
      if (pressedKeys.has('ArrowLeft')) {
        console.log('Moving left')
        setPlayerKart(prev => {
          const newLane = Math.max(0, prev.lane - 1) as Lane
          console.log('Lane change:', prev.lane, '->', newLane)
          return {
            ...prev,
            lane: newLane,
          }
        })
      } else if (pressedKeys.has('ArrowRight')) {
        console.log('Moving right')
        setPlayerKart(prev => {
          const newLane = Math.min(2, prev.lane + 1) as Lane
          console.log('Lane change:', prev.lane, '->', newLane)
          return {
            ...prev,
            lane: newLane,
          }
        })
      }
    }, 200)

    return () => {
      console.log('Clearing lane change interval')
      clearInterval(interval)
    }
  }, [gameState, pressedKeys, spellingQuestion.active])

  // Collision detection - Item boxes
  useEffect(() => {
    if (gameState !== 'racing' || spellingQuestion.active) return

    itemBoxes.forEach(box => {
      if (box.collected) return

      const distance = Math.abs(box.position - playerKart.position)
      const sameLane = box.lane === playerKart.lane

      if (sameLane && distance < 50) {
        setItemBoxes(prev =>
          prev.map(b => (b.id === box.id ? { ...b, collected: true } : b))
        )

        const randomWord = SPELLING_WORDS[Math.floor(Math.random() * SPELLING_WORDS.length)]
        setFrozenPosition(playerKart.position)
        setSpellingQuestion({ word: randomWord, active: true })
        setUserAnswer('')
        setQuestionTimer(QUESTION_TIME_LIMIT)
        setFeedbackMessage('')

        setTimeout(() => speakWord(randomWord), 300)
        setTimeout(() => inputRef.current?.focus(), 400)
      }
    })
  }, [gameState, playerKart, itemBoxes, spellingQuestion.active])

  // Collision detection - Obstacles
  useEffect(() => {
    if (gameState !== 'racing') return

    // Player hitting bananas
    if (!playerEffect.star) {
      obstacles.forEach(obstacle => {
        const distance = Math.abs(obstacle.position - playerKart.position)
        const sameLane = obstacle.lane === playerKart.lane

        if (sameLane && distance < 50) {
          setObstacles(prev => prev.filter(o => o.id !== obstacle.id))
          applySpinOut('player', true)
        }
      })
    }

    // AI hitting bananas
    aiKarts.forEach(kart => {
      obstacles.forEach(obstacle => {
        const distance = Math.abs(obstacle.position - kart.position)
        const sameLane = obstacle.lane === kart.lane

        if (sameLane && distance < 50) {
          setObstacles(prev => prev.filter(o => o.id !== obstacle.id))
          applySpinOut(kart.id, false)
        }
      })
    })
  }, [gameState, playerKart, aiKarts, obstacles, playerEffect.star])

  // Collision detection - Star mode
  useEffect(() => {
    if (gameState !== 'racing' || !playerEffect.star) return

    aiKarts.forEach(kart => {
      const distance = Math.abs(kart.position - playerKart.position)
      const sameLane = kart.lane === playerKart.lane

      if (sameLane && distance < 100) {
        applySpinOut(kart.id, false)
      }
    })
  }, [gameState, playerKart, aiKarts, playerEffect.star])

  // Update projectiles
  useEffect(() => {
    if (gameState !== 'racing') return

    const interval = setInterval(() => {
      setProjectiles(prev => {
        const updated = prev.map(proj => {
          let newProj = { ...proj }

          if (proj.type === 'red-shell' && proj.targetKartId) {
            const target = aiKarts.find(k => k.id === proj.targetKartId)
            if (target) {
              if (target.lane < proj.lane) newProj.lane = Math.max(0, proj.lane - 1) as Lane
              else if (target.lane > proj.lane) newProj.lane = Math.min(2, proj.lane + 1) as Lane
            }
          }

          newProj.position += proj.speed
          return newProj
        })

        return updated.filter(proj =>
          proj.position >= -200 && proj.position <= FINISH_LINE_POSITION + 500
        )
      })
    }, 16)

    return () => clearInterval(interval)
  }, [gameState, aiKarts])

  // Collision detection - Projectiles
  useEffect(() => {
    if (gameState !== 'racing') return

    // Projectiles hitting AI
    projectiles.forEach(proj => {
      aiKarts.forEach(kart => {
        const distance = Math.abs(proj.position - kart.position)
        const sameLane = proj.lane === kart.lane

        if (sameLane && distance < 70) {
          setProjectiles(prev => prev.filter(p => p.id !== proj.id))
          applySpinOut(kart.id, false)
        }
      })

      // Backward projectiles hitting player
      if (proj.speed < 0) {
        const distance = Math.abs(proj.position - playerKart.position)
        const sameLane = proj.lane === playerKart.lane

        if (sameLane && distance < 70) {
          setProjectiles(prev => prev.filter(p => p.id !== proj.id))
          applySpinOut('player', true)
        }
      }
    })
  }, [gameState, projectiles, aiKarts, playerKart])

  // Game loop - update positions
  useEffect(() => {
    if (gameState !== 'racing') return

    const gameLoop = setInterval(() => {
      if (!spellingQuestion.active) {
        setPlayerKart(prev => ({
          ...prev,
          position: prev.position + prev.speed,
        }))
      }

      setAiKarts(prev =>
        prev.map(kart => {
          let newKart = { ...kart }
          newKart.position += kart.speed

          if (Math.random() < 0.01) {
            const direction = Math.random() < 0.5 ? -1 : 1
            newKart.lane = Math.max(0, Math.min(2, kart.lane + direction)) as Lane
          }

          if (Math.random() < 0.05 && !aiEffects[kart.id]?.spinning) {
            newKart.speed = kart.baseSpeed + (Math.random() - 0.5) * 0.3
            newKart.speed = Math.max(3.5, Math.min(5.5, newKart.speed))
          }

          return newKart
        })
      )

      if (!spellingQuestion.active) {
        setTrackOffset(prev => (prev + 3) % 100)
      }
    }, 16)

    return () => clearInterval(gameLoop)
  }, [gameState, spellingQuestion.active, aiEffects])

  // Check for finish line
  useEffect(() => {
    if (gameState === 'racing' && !spellingQuestion.active) {
      const allKarts = [playerKart, ...aiKarts]
      const anyFinished = allKarts.some(k => k.position >= FINISH_LINE_POSITION)
      if (anyFinished) {
        setGameState('finished')
      }
    }
  }, [gameState, playerKart, aiKarts, spellingQuestion.active])

  const handleWrongAnswer = () => {
    setFeedbackMessage(`Wrong - it was "${spellingQuestion.word}"`)
    setTimeout(() => {
      setSpellingQuestion({ word: '', active: false })
      setFeedbackMessage('')
    }, 2000)
  }

  const handleSubmitAnswer = () => {
    const correct = userAnswer.trim().toLowerCase() === spellingQuestion.word.toLowerCase()

    if (correct) {
      const powerUps: PowerUpType[] = ['green-shell', 'red-shell', 'mushroom', 'banana', 'star']
      const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)]
      setHeldPowerUp(randomPowerUp)
      setFeedbackMessage('Correct! You got a power-up!')

      setTimeout(() => {
        setSpellingQuestion({ word: '', active: false })
        setFeedbackMessage('')
      }, 1500)
    } else {
      handleWrongAnswer()
    }
  }

  const resetGame = () => {
    setGameState('countdown')
    setCountdown(3)
    setRaceTime(0)
    setTrackOffset(0)
    setItemBoxes([])
    setSpellingQuestion({ word: '', active: false })
    setHeldPowerUp(null)
    setUserAnswer('')
    setFeedbackMessage('')
    setProjectiles([])
    setObstacles([])
    setPlayerEffect({
      spinning: false,
      spinEndTime: 0,
      boosted: false,
      boostEndTime: 0,
      star: false,
      starEndTime: 0,
    })
    setAiEffects({})
    setAiItemUseCount(0)

    setPlayerKart({
      id: 'player',
      lane: 1,
      position: 0,
      speed: 5,
      baseSpeed: 5,
      color: '#FF1744',
      isPlayer: true,
    })
    setAiKarts([
      {
        id: 'ai1',
        lane: 0,
        position: 500,
        speed: 4.5,
        baseSpeed: 4.5,
        color: '#2196F3',
        isPlayer: false,
      },
      {
        id: 'ai2',
        lane: 1,
        position: 800,
        speed: 4.8,
        baseSpeed: 4.8,
        color: '#4CAF50',
        isPlayer: false,
      },
      {
        id: 'ai3',
        lane: 2,
        position: 1200,
        speed: 4.3,
        baseSpeed: 4.3,
        color: '#FFC107',
        isPlayer: false,
      },
    ])
  }

  const renderKart = (kart: Kart) => {
    const screenPosition = kart.position - (spellingQuestion.active ? frozenPosition : playerKart.position)
    const laneX = LANE_OFFSET + kart.lane * LANE_WIDTH

    if (screenPosition < -200 || screenPosition > 600) return null

    const isSpinning = kart.isPlayer ? playerEffect.spinning : aiEffects[kart.id]?.spinning
    const hasStar = kart.isPlayer && playerEffect.star
    const isBoosted = kart.isPlayer && playerEffect.boosted

    return (
      <div
        key={kart.id}
        className={`kart ${isSpinning ? 'spinning' : ''} ${hasStar ? 'star-mode' : ''} ${isBoosted ? 'boosted' : ''}`}
        style={{
          left: `${laneX}px`,
          bottom: `${300 - screenPosition}px`,
          backgroundColor: kart.color,
          border: kart.isPlayer ? '4px solid white' : 'none',
          boxShadow: kart.isPlayer ? '0 0 20px rgba(255, 255, 255, 0.8)' : 'none',
        }}
      >
        {kart.isPlayer ? (
          <img
            src={PLAYER_KART_IMAGE}
            alt="Player Kart"
            className="kart-image"
            onError={(e) => {
              // Fallback to emoji if image doesn't load
              e.currentTarget.style.display = 'none'
              e.currentTarget.parentElement!.textContent = '🏎️'
            }}
          />
        ) : ''}
        {isBoosted && !hasStar && <div className="speed-lines" />}
      </div>
    )
  }

  const renderProjectile = (proj: Projectile) => {
    const screenPosition = proj.position - (spellingQuestion.active ? frozenPosition : playerKart.position)
    const laneX = LANE_OFFSET + proj.lane * LANE_WIDTH

    if (screenPosition < -200 || screenPosition > 700) return null

    return (
      <div
        key={proj.id}
        className="projectile"
        style={{
          left: `${laneX}px`,
          bottom: `${300 - screenPosition}px`,
        }}
      >
        {proj.type === 'green-shell' ? '🟢' : '🔴'}
      </div>
    )
  }

  const renderObstacle = (obstacle: Obstacle) => {
    const screenPosition = obstacle.position - (spellingQuestion.active ? frozenPosition : playerKart.position)
    const laneX = LANE_OFFSET + obstacle.lane * LANE_WIDTH

    if (screenPosition < -200 || screenPosition > 700) return null

    return (
      <div
        key={obstacle.id}
        className="obstacle"
        style={{
          left: `${laneX}px`,
          bottom: `${300 - screenPosition}px`,
        }}
      >
        🍌
      </div>
    )
  }

  const renderItemBox = (box: ItemBox) => {
    if (box.collected) return null

    const screenPosition = box.position - (spellingQuestion.active ? frozenPosition : playerKart.position)
    const laneX = LANE_OFFSET + box.lane * LANE_WIDTH

    if (screenPosition < -200 || screenPosition > 700) return null

    return (
      <div
        key={box.id}
        className="item-box"
        style={{
          left: `${laneX}px`,
          bottom: `${300 - screenPosition}px`,
        }}
      >
        <div className="item-box-inner">?</div>
      </div>
    )
  }

  const renderFinishLine = () => {
    const screenPosition = FINISH_LINE_POSITION - (spellingQuestion.active ? frozenPosition : playerKart.position)

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
          <p className="instruction">Hit item boxes to answer spelling questions!</p>
          <p className="instruction">Press SPACE to use power-ups!</p>
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
        {heldPowerUp && (
          <div className="item-slot">
            <div className="item-icon">{POWER_UP_ICONS[heldPowerUp]}</div>
            <div className="item-label">Press SPACE</div>
          </div>
        )}
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
          {obstacles.map(obstacle => renderObstacle(obstacle))}
          {itemBoxes.map(box => renderItemBox(box))}
          {projectiles.map(proj => renderProjectile(proj))}
          {renderKart(playerKart)}
          {aiKarts.map((kart) => renderKart(kart))}
        </div>
      </div>

      {spellingQuestion.active && (
        <div className="modal-overlay">
          <div className="spelling-modal">
            <h2 className="modal-title">Spelling Challenge!</h2>
            <div className="timer-bar-container">
              <div
                className="timer-bar"
                style={{
                  width: `${(questionTimer / QUESTION_TIME_LIMIT) * 100}%`,
                }}
              />
            </div>
            <div className="question-time">{Math.ceil(questionTimer / 1000)}s</div>

            {!feedbackMessage ? (
              <>
                <p className="modal-instruction">Type the word you hear:</p>
                <button className="speak-again-btn" onClick={() => speakWord(spellingQuestion.word)}>
                  🔊 Hear Again
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  className="spelling-input"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                  placeholder="Type your answer..."
                  autoComplete="off"
                />
                <button className="submit-btn" onClick={handleSubmitAnswer}>
                  Submit Answer
                </button>
              </>
            ) : (
              <div className={`feedback-message ${feedbackMessage.startsWith('Correct') ? 'correct' : 'wrong'}`}>
                {feedbackMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
