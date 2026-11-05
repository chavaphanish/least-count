import rulebookUrl from '../../RULEBOOK.md?url'
import decisionsUrl from '../../docs/rule-clarifications.md?url'

const rules = [
  {
    title: 'Start with seven',
    text: 'Choose 2–8 players. Each round deals seven cards each. Up to four players use one deck plus one Printed Joker; five or more use two of each. A random player starts the first round; the starting seat rotates clockwise afterward.',
  },
  {
    title: 'Keep your count low',
    text: 'Ace is 1; number cards use their number; J, Q, and K are 10. Printed Jokers are 0. A Selected Joker indicator is removed each round, and all remaining cards of that rank are 0. A 7 can never be the Selected Joker. Jokers are not wild cards.',
  },
  {
    title: 'Discard, then draw',
    text: 'Select one card or multiple cards of the same rank. Discard them, then draw one replacement from the pile or the immediately preceding player’s eligible group. Never take an older card or your own discard. Matching the previously visible top rank is Match and Drop: you must skip the draw.',
  },
  {
    title: 'Watch the sevens',
    text: 'A 7 starts a two-card penalty after the initiating player completes any required normal draw. Respond with one or more 7s to add two, or draw the accumulated penalty and lose your normal turn. Multiple 7s in one action still add only two. If every active player responds, the penalty is cancelled and the initiator takes a normal turn. The initial face-up 7 has no power effect.',
  },
  {
    title: 'Call Show at five or less',
    text: 'Call Show at the beginning of your normal turn, before discarding. You cannot call it during a 7 penalty. Emptying your hand does not end the round: you must call Show on your next normal turn, without passing. A unique lowest Show scores 0; other players score their totals. A failed positive-point Show costs the caller 40 instead of their hand value; lowest opponents score 0 and the rest score their totals.',
  },
  {
    title: 'Zero ties share the round',
    text: 'If the caller has 0 and others also have 0, all zero-point players receive 0 penalty points. The caller does not get 40. Other players score their hand totals. Positive-point ties still fail Show. Opponents’ individual cards are never revealed, including at round results.',
  },
  {
    title: 'Stay below 100',
    text: 'Round penalties accumulate. At 100 or more, a player is eliminated. A tied round is not a shared match victory: keep scores and play ordinary rounds until one player remains. There is no special tiebreaker mode. For example, two players at 99 who tie on zero stay at 99 and play another round.',
  },
  {
    title: 'Finish within 60 seconds',
    text: 'The same timer covers your discard and required replacement draw. Invalid moves do not restart it. Running out of time eliminates you immediately and clears any 7 penalty. Accepting a penalty or timing out clears the previous group’s pickup eligibility. Refreshing does not renew the deadline.',
  },
]

export function RulesPage() {
  return (
    <section className="rules-page" aria-labelledby="rules-title">
      <a className="text-link back-link" href="#/">
        ← Back to the lounge
      </a>
      <div className="rules-intro">
        <p className="eyebrow">A LITTLE STRATEGY. A LITTLE LUCK.</p>
        <h1 id="rules-title">
          Know your <em>table.</em>
        </h1>
        <p>Reduce your hand. Choose your moment. Keep the rivalry friendly.</p>
        <div className="rules-note">
          <h2>Working rules, with confirmed clarifications</h2>
          <p>
            This local game uses the Edition 2.0 draft and the decisions
            recorded with it. The confirmed decisions override conflicting draft
            text. Online multiplayer is not available. Simulated opponents and
            all game state run on your device; this is not a secure online game.
          </p>
        </div>
      </div>
      <div className="rules-grid">
        {rules.map((rule, index) => (
          <article className="rule-tile" key={rule.title}>
            <span className="rule-number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2>{rule.title}</h2>
            <p>{rule.text}</p>
          </article>
        ))}
      </div>
      <div className="rules-note">
        <h2>When the draw pile runs out</h2>
        <p>
          Older discards are reshuffled, preserving the latest group and any
          group still available for pickup. If a required draw still cannot be
          completed, the round settles by hand totals: the lowest totals score
          0; everyone else scores their total. For an incomplete 7 penalty,
          available cards are drawn before settlement.
        </p>
      </div>
      <div className="rules-downloads">
        <a className="text-link" href={rulebookUrl} download="RULEBOOK.md">
          Download working rulebook ↓
        </a>
        <a
          className="text-link"
          href={decisionsUrl}
          download="rule-clarifications.md"
        >
          Download confirmed decisions ↓
        </a>
      </div>
      <a className="button button-primary" href="#/game">
        Play local practice <span aria-hidden="true">→</span>
      </a>
    </section>
  )
}
