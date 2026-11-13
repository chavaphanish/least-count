import { useMobileLandscape } from '../components/MobileOrientation'
import { ScreenPages } from '../components/ScreenPages'
import rulebookUrl from '../../docs/RULEBOOK.md?url'
import decisionsUrl from '../../docs/rule-clarifications.md?url'

const rules = [
  {
    title: 'Start with seven',
    text: 'Choose 2–8 players. Each round deals seven cards each. Up to four players use one deck plus one Printed Joker; five or more use two of each. A random player starts the first round; the starting seat rotates clockwise afterward.',
  },
  {
    title: 'Drop first, including the opening',
    text: 'Each round starts with a public face-up card. Unless it is a 7, the starter drops first. If a replacement is required, choose that eligible opening card or the draw pile. Matching the opening rank skips drawing; playing a 7 starts its penalty without replacement. Least is allowed before dropping at five or less. One deadline covers the complete turn.',
  },
  {
    title: 'Keep your count low',
    text: 'Ace is 1; number cards use their number; J, Q, and K are 10. Printed Jokers are 0. A Round Joker indicator is removed each round, and all remaining cards of that rank are 0. A 7 can never be the Round Joker. Jokers are not wild cards.',
  },
  {
    title: 'Drop, then draw',
    text: 'Select one card or multiple cards of the same rank. Commit a legal drop first, then choose any required replacement. The previous eligible group remains available while your new drop is on top. Drop animation finishes before pickup animation. You may draw from the pile or the immediately preceding player’s eligible group. Never take an older card or your own drop. Without an eligible open pickup, a required replacement is drawn automatically in the same action. Matching the previously visible top rank is Match and Drop: you must skip the draw. Playing 7s also skips replacement drawing.',
  },
  {
    title: 'Watch the sevens',
    text: 'Playing one or more 7s ends the action immediately without drawing a replacement, even when the top rank differs. The next player faces a two-card penalty. Respond with one or more 7s to add two, or draw the accumulated penalty and lose your normal turn. Multiple 7s in one action still add only two. If every active player responds, the penalty is cancelled and the initiator takes a normal turn. An opening 7 immediately makes the starter respond to a two-card penalty, automatically drawn if they hold no 7. The computer does not count as a full-cycle participant. After every active player actually responds, the starter takes a normal turn. With the existing 7 supply, an opening full cycle cannot naturally occur at four/eight players.',
  },
  {
    title: 'Declare Least at five or less',
    text: 'Declare Least at the beginning of your normal turn, before dropping. You cannot call it during a 7 penalty. Emptying your hand does not end the round: you must declare Least on your next normal turn, without passing. A successful Least scores 0; each other player scores their hand total capped at 40. A failed Least costs only the caller 40; every other player scores 0.',
  },
  {
    title: 'Zero ties share the round',
    text: 'If the caller has 0 and others also have 0, all zero-point players receive 0 penalty points. The caller does not get 40. Other players score their hand totals capped at 40. Positive-point ties still fail Least. Opponents’ individual cards are never revealed, including at round results.',
  },
  {
    title: 'Stay below 100',
    text: 'Round penalties accumulate. At 100 or more, a player is eliminated. A tied round is not a shared match victory: keep scores and play ordinary rounds until one player remains. There is no special tiebreaker mode. For example, two players at 99 who tie on zero stay at 99 and play another round.',
  },
  {
    title: 'Finish within 60 seconds',
    text: 'The same timer covers your drop and required replacement draw. Invalid moves do not restart it. Running out of time eliminates you immediately and clears any 7 penalty. Accepting a penalty or timing out clears the previous group’s pickup eligibility. Refreshing does not renew the deadline.',
  },
]

export function RulesPage() {
  const mobile = useMobileLandscape()
  return (
    <section className="rules-page" aria-labelledby="rules-title">
      <a className="text-link back-link" href="#/">
        ← Back to the Lounge
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
            Online rooms and local practice use the current rulebook and
            confirmed decisions. Online hands, actions, and timers are enforced
            by the server. Local practice uses simulated opponents on your
            device. Online hosts can change the cutoff or choose untimed play.
          </p>
        </div>
      </div>
      <div className="rules-pages">
        <ScreenPages
          label="Rule sections"
          pages={[
            ...(mobile
              ? [
                  {
                    label: 'About these rules',
                    content: (
                      <div className="rules-note">
                        <h2>Working rules, with confirmed clarifications</h2>
                        <p>
                          Online rooms and local practice use the current
                          rulebook and confirmed decisions. Online hands,
                          actions, and timers are enforced by the server. Local
                          practice uses simulated opponents on your device.
                          Online hosts can change the cutoff or choose untimed
                          play.
                        </p>
                      </div>
                    ),
                  },
                ]
              : []),
            ...rules.map((rule, index) => ({
              label: rule.title,
              content: (
                <article className="rule-tile">
                  <span className="rule-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2>{rule.title}</h2>
                  <p>{rule.text}</p>
                </article>
              ),
            })),
            {
              label: 'Draw pile',
              content: (
                <div className="rules-note">
                  <h2>When the draw pile runs out</h2>
                  <p>
                    Older drops are reshuffled, preserving the latest group and
                    any group still available for pickup. If a required draw
                    still cannot be completed, the round settles by hand totals:
                    the lowest totals score 0; everyone else scores their total.
                    For an incomplete 7 penalty, available cards are drawn
                    before settlement.
                  </p>
                </div>
              ),
            },
            {
              label: 'Rulebook downloads',
              content: (
                <div className="rules-downloads">
                  <a
                    className="text-link"
                    href={rulebookUrl}
                    download="RULEBOOK.md"
                  >
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
              ),
            },
          ]}
        />
      </div>
      <a className="button button-primary" href="#/game">
        Play local practice <span aria-hidden="true">→</span>
      </a>
    </section>
  )
}
