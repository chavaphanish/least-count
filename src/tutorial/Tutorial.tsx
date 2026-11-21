import { useCallback, useEffect, useState } from 'react'
import { TurnAnimation, cardRect } from '../components/TurnAnimation'
import type { TurnMotion } from '../components/TurnAnimation'
import { PlayingCard } from '../components/PlayingCard'
import { ResultScores } from '../components/ResultScores'
import { cardLabel, cardValue, handTotal } from '../game/deck'
import { latestGroup, pickupCards } from '../game/engine'
import { useFeedback } from '../feedback/FeedbackProvider'
import { buildLesson } from './lesson'
import './tutorial.css'

const topics = ['Meet the table','Card values','Your first turn','Matching cards','The seven rule','Two kinds of joker','Turn timeout','Declare Least','Round results','Alternate replay','The next round']
export function Tutorial() {
  const [frames] = useState(buildLesson)
  const [index,setIndex] = useState(0)
  const [selected,setSelected] = useState<string[]>([])
  const [seconds,setSeconds] = useState(3)
  const feedback = useFeedback()
  const {game, step, text, input, ids} = frames[index]
  const [motion,setMotion] = useState<TurnMotion | null>(null)
  const clearMotion = useCallback(() => setMotion(null),[])
  const next = useCallback(() => {
    const before = frames[index], after = frames[index + 1]
    if (!after) return
    const seat = before.game.players[before.game.current]
    const outgoing = before.ids.flatMap(id => {
      const card = seat.hand.find(c => c.id === id)
      const source = document.getElementById(id) ?? document.getElementById(seat.id)
      const from = cardRect(source?.querySelector('.playing-card') ?? null)
      return card && from ? [{card,from}] : []
    })
    let incoming: TurnMotion['incoming']
    if (before.game.round === after.game.round && after.game !== before.game && before.step !== 9) {
      for (const player of after.game.players) {
        const card = player.hand.find(c => !before.game.players.find(p => p.id === player.id)?.hand.some(old => old.id === c.id))
        const faceDown = before.input !== 'pickup'
        const from = cardRect(document.querySelector(faceDown ? '.lesson-draw .playing-card' : '[data-discard-target] .playing-card'))
        if (card && from) { incoming = {card,from,faceDown}; break }
      }
    }
    setMotion(outgoing.length || incoming ? {outgoing,incoming} : null)
    if (after.game.result && !before.game.result) feedback.sound('round_applause','tutorial-result')
    setSelected([]); setSeconds(3); setIndex(index + 1)
  },[frames,feedback,index])
  function go(i: number) { clearMotion(); setSelected([]); setSeconds(3); setIndex(i) }
  useEffect(() => {
    if (input !== 'watch' && input !== 'timer') return
    const timer = window.setTimeout(() => {
      if (input === 'timer' && seconds > 1) setSeconds(seconds - 1)
      else next()
    },input === 'timer' ? 700 : 1800)
    return () => clearTimeout(timer)
  },[next,input,seconds])
  const human = game.players[0]
  const top = input === 'pickup' ? pickupCards(game)[0] : latestGroup(game).at(-1)
  const finished = input === 'finish'
  return <section className="guided-lesson" data-step={step} aria-label="YAYDU tutorial">
    <aside className="lesson-guide">
      <small>Step {step} of 11 · Tutorial</small>
      <h1>{topics[step-1]}</h1>
      <p aria-live="polite">{text}</p>
      {input === 'next' && <button className="button button-primary" onClick={next}>Next</button>}
      {input === 'drop' && <button className="button button-primary" disabled={selected.length !== ids.length} onClick={next}>{game.phase === 'penalty' ? 'Play 7' : 'Drop Selected Cards'}</button>}
      {input === 'declare' && <button className="button button-primary" onClick={next}>Declare Least</button>}
      {input === 'ready' && <button className="button button-primary" onClick={next}>Next Round</button>}
      {finished && <><a className="button button-primary" href="#/">Return to Lounge</a><button className="text-button" onClick={() => go(0)}>Play Again</button></>}
      {!finished && <nav aria-label="Tutorial controls"><button disabled={!index} onClick={() => go(Math.max(0,frames.findIndex(f => f.step === step-1)))}>Back</button>
        <button onClick={() => go(frames.findIndex(f => f.step === step))}>Replay step</button>
        <button onClick={() => go(frames.length-1)}>Skip Tutorial</button><a href="#/">Exit Tutorial</a></nav>}
    </aside>
    <div className="game-table lesson-table">
      <div className="lesson-seats">{game.players.slice(1).map(p => <div key={p.id} id={p.id} data-hand-card={motion?.incoming && p.hand.some(c => c.id === motion.incoming!.card.id) ? motion.incoming.card.id : undefined}><PlayingCard faceDown/><strong>{p.name}</strong> · {p.forfeited ? 'Forfeited' : `${p.hand.length} cards`} · {p.score} pts</div>)}</div>
      {game.result ? <ResultScores players={game.players} result={game.result}/> : <>
        <div className="lesson-clock">{game.players[game.current].name} · {input === 'timer' ? seconds : 45}s {game.sevens && ` · Draw penalty +${game.sevens.amount}`}</div>
        <div className="lesson-piles">
          <button className="lesson-draw" disabled={input !== 'draw'} onClick={next}><PlayingCard faceDown/>Draw Pile</button>
          <button data-discard-target disabled={input !== 'pickup'} onClick={next}><PlayingCard key={top?.id} card={top}/>{input === 'pickup' ? 'Pick Up 5' : 'Drop Pile'}</button>
          <div><PlayingCard card={game.indicator}/>Round Joker</div>
        </div>
        <div className="lesson-hand" aria-label="Your hand">{human.hand.map(card => {
          const active = input === 'drop' && ids.includes(card.id)
          return <button key={card.id} id={card.id} data-hand-card={card.id} aria-label={cardLabel(card)} aria-pressed={selected.includes(card.id)} disabled={!active}
            onClick={() => setSelected(values => values.includes(card.id) ? values.filter(id => id !== card.id) : [...values,card.id])}>
            <PlayingCard card={card}/>{step === 2 && <small>{cardValue(card,game.indicator.rank)} pts</small>}</button>
        })}</div></>}
      <strong className="lesson-score">You · {human.score} penalty points · Hand total {handTotal(human.hand,game.indicator.rank)}</strong>
    </div>
    {motion && <TurnAnimation key={index} motion={motion} onComplete={clearMotion}/>}
  </section>
}
