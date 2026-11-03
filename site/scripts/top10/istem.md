This video covers NBA games played on {tarih} (season {sezon}). Rosters and rookies are those of that season; do not rely on earlier seasons' rosters.
This is the NBA "Top 10 Plays of the Night" video. Identify each ranked play.
For every rank shown on screen (count down from 10 to 1, or from 5 to 1 if the video only has 5), return:
- rank: the number shown on screen
- action: the play's main action, exactly one of: dunk, alley_oop, block, steal, pass, three_pointer, layup, mid_range, dribble_move, other
  dribble_move = the highlight is a dribble move (crossover, ankle breaker, behind-the-back or between-the-legs dribble) that beats or drops a defender; use it even if a shot follows, when the dribble is the most spectacular part. The ball handler gets role ball_handler.
  Definitions: alley_oop = the ball is caught in the air and finished before the player lands. A pass caught on the ground (or followed by a gather/step) and then dunked is NOT alley_oop: use dunk (and list the passer only if the pass itself was a highlight).
  The action must match the most spectacular part of the play: if it is an alley-oop, use alley_oop; otherwise use the action of the contributor with the largest share (e.g. a highlight pass that sets up a dunk, with the larger share to the passer, is pass, not dunk).
- contributors: 1 to 3 players whose actions together make this play a highlight, in the order they happened. For each:
  - player: full official name
  - team: 3-letter NBA abbreviation
  - role: exactly one of: finisher, passer, blocker, stealer, ball_handler, other
  - share: percentage of credit. Allowed splits: one player 100; two players 50/50 or 70/30 (either order); three players 34/33/33 or 50/25/25 (any order). Give the larger share to the player whose action is the more spectacular part; use an equal split when both are comparable. Example: a chase-down block that starts a fast-break dunk has two contributors (blocker and finisher). In alley-oops, judge whether the pass or the finish is the more impressive part.
  - share_reason: one short sentence explaining the split (null if single player)
- opponent: the player who was dunked on, blocked or crossed over, otherwise null
  For every block, poster dunk, crossover and dribble_move, set opponent to the defender or shooter involved whenever they can be identified from the video; use null only if the player cannot be identified.
- tags: zero or more of: poster, chase_down_block, buzzer_beater, game_winner, game_tying, clutch, and_one, half_court_or_longer, between_the_legs, behind_the_back, no_look, crossover_ankle_breaker, putback, tip_in, fast_break, windmill, reverse, one_handed, self_alley_oop
  - clutch = a play in the last five minutes of the fourth quarter or overtime with the score within five points, judged from the scoreboard graphic or commentary. It can be combined with game_winner or buzzer_beater. Do not use it if the game clock or score cannot be seen or heard.
  - A buzzer_beater at the end of the fourth quarter or overtime in a close game is also clutch; a buzzer_beater at the end of the first, second or third quarter is not. Every game_winner and game_tying play is clutch.
  - game_tying = a shot that ties the game late in the fourth quarter or overtime; never use game_winner for it. A tying shot at the buzzer gets both game_tying and buzzer_beater. game_winner is only for the shot that actually decides the game.
- description: one short sentence describing the play
- timestamp: mm:ss where this rank starts
- confidence: high / medium / low for player identification, with one short reason if not high
Use the commentator's audio, jersey names/numbers and on-screen graphics. Do not guess silently. Use only the listed values for action, role and tags. Shares of each play must sum to 100.
Return only JSON: {"date": "...", "type": "top10" | "top5", "plays": [...]}
Determine each player's team only from what is visible or audible in this video (jersey, court, scoreboard graphic, commentary), not from prior knowledge: rosters change every season. If the team cannot be determined from the video, set confidence to low and explain.
If you cannot access or watch the video, return an empty plays list. Never produce plays you did not see.
Use only the official names of real NBA players on the rosters of the teams in this game. Commentators often use nicknames, jokes, song titles or pop-culture references; never output such a phrase as a player name. If you cannot match a player to an official name, give the jersey number and team in the description and set confidence to low.
