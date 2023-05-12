# Res Deorum

Turn-based Card Game about Elements and Alchemy!

Developed this because was too lazy to finish my other projects
but needed a small project to entertain myself

The game is accessible here: [github pages](https://gxlg.github.io/res-deorum/).
If the server is not reachable, that means I restarted my server
and forgot to host the game. Please contact me on Discord about this.

# Elements

Five base elements: Ignis, Aqua, Aer, Terra, Vita

In begin:
* Infinitely cards in deck
* For each element: 22%
* Vita: 12%
* Two players, each gets 5 cards

Each turn:
* Need to use one card
* Using a card will show it to the other player
* After a turn the player should always have 5 or less cards,
more cards are given if less than 5.

Using a card:
* Use on enemy
* Put to "Tabula Alchimiae"
* Use on self
* Put into "Commutatio"

Exchange:
* Open cards in the "Commutatio", which can be added
or exchanged against other cards
* Maximum 5 cards can be put

Alchemy:
* Turns two elements into a new element
* Second card can only be added to the table if the resulting
pair would produce a new element following a recipe

Strength Circle:
* Aqua beats Ignis
* Terra beats Aqua
* Aer beats Terra
* Ignis beats Aer

```
  v/  Aqua <\
Ignis     Terra
  \>  Aer  /^
```

This means, to protect yourself from one element, you
have to use the stronger element. For example, to protect
yourself from Ignis, use Aqua.

Recipes:

Stronger:
* Ignis + Aer   = Fulgur    (Lightning)
* Aqua  + Ignis = Vapor     (Steam)
* Aer   + Terra = Tempestas (Storm)
* Terra + Ignis = Tremor    (Earthquake)

Longer/Protectors:
* Ignis + Vita  = Phoenix
* Aqua  + Vita  = Syrena    (Mermaid)
* Aer   + Vita  = Mediocris (Fairy)
* Terra + Vita  = Colossus  (Titan)
* Vita  + Vita  = Lumen     (Light)

Special:
* Aqua  + Aer   = Nebula    (Fog)
* Aqua  + Terra = Lutum     (Mud)

Use on self:
* Vita: regen 3 HP
* Elements (same as Stronger): resist effect against one attack
* Protectors: resist effect for next 3 attacks
* Lumen: regen 9 HP
* Nebula: next 2 cards don't open to opponent
* Lutum: next attack work only if basic attack (not longer or stronger)

Use on opponent:
* Vita: dmg 1 HP (always)
* Lumen: dmg 4 HP (always)
* Elements: dmg 2 HP if not resist effect else resist effect reduce
* Stronger: dmg 8 HP if not ...^
* Longer: dmg 3 HP for the next 3 rounds (effects mechanics still apply)
* Nebula: next attack can not be resisted, but has 30% chance
that will miss (but Lutum still works)
* Lutum: cannot use alchemy in the next 2 moves

# Mechanics

Pretty simple: when it's your turn, your statistics table glows up.
To make a turn, first click a card in your deck, then if you want -

* to attack: click on opponent's statistics table
* to use on you: click your own
* to put to Tabula Alchimiae: click the table image
* to put to Commutatio: click the exchange image
* to change the card with one from Commutatio: click on the card
