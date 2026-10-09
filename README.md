# enclave

Thomas Schelling's segregation model in the browser. Households of two to
four groups live on a grid. Each one is content as long as enough of its
neighbours belong to its own group; a discontented household moves to an
empty home. Even when nobody minds being in the minority, the town sorts
itself into enclaves.

**Live demo:** https://fushanbobfan.github.io/enclave/

Schelling's point, made with coins on a checkerboard in 1969–71, was that
mild individual preferences can add up to a sharply divided whole. A
household here that is perfectly happy with two unlike neighbours for every
like one still ends up, after the moving settles, with about three quarters
of its neighbours like itself. Nobody chose that outcome; it is what the
moves add up to.

No build step and no dependencies. The grid, the moving rules, the
measures, the renderer and the share links are plain ES modules covered by
a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later, no dependencies).

## What to try

- **A third is enough** (the default). Press Play. Similarity climbs from
  the 50% you would get by chance to about 74% and the town settles in
  twenty or so sweeps.
- **Wanting half.** Asking for an even split carves out large, solid
  enclaves, near 87% alike.
- **Majority and minority.** A 75/25 town under the same one-third rule.
  The majority settles at once; minority households that move to a random
  empty home mostly land among the majority again, and some are still
  moving hundreds of sweeps later.
- **Four groups.** A random block is only a quarter alike, so wanting a
  third is a real demand, and the town ends up around 70% alike.
- **Short moves.** Households take the nearest home that suits them. The
  town settles sooner and a little less sorted than with long random moves.
- **Mixers.** Nobody needs like neighbours, but everyone leaves a block
  more than 60% like them. The town ends up *less* alike than chance.
- **Too demanding.** Wanting three quarters alike with few empty homes:
  the town sorts almost completely, yet some households never stop moving.

Drag the preference sliders while the town runs: the households change
their minds without the town being reshuffled.

## Painting by hand

Pick a group (or *Empty*) under **Paint** and drag across the town to move
households in by hand. Painting wakes a settled town, so you can watch what
a single change sets off: drop one household into the middle of another
group's enclave under a floor of 50% and it moves straight out again; paint
a whole street of newcomers and the enclave around them reorganises.
Painting changes the group sizes shown in the legend and the chance
baseline. It is not kept in share links and does not affect the tipping
chart, which always starts from the seeded town; **Reset** undoes it.

## Where each preference leads

Under the sweep chart, **Run every floor** rebuilds the same starting town
for every preference floor from 0% up to the ceiling, in steps of 5, runs
each to rest (or for at most 200 sweeps) and plots where it ended up. On
the default 60 × 60 town the curve is Schelling's in miniature:

- below 20% almost nobody moves and the town stays at chance, 50% alike;
- from a quarter to a half, a small change in what households want buys a
  big change in the town: 74% alike at a floor of 30%, 88% at 50%;
- by 70% the groups have separated completely, 99% alike;
- above about 85% nobody can be satisfied, the random moves never stop,
  and the town stays as mixed as it began, with nearly everyone
  discontented.

Filled dots are runs that came to rest; rings are runs still moving when
the 200 sweeps ran out. Click the chart to set the floor there.

## Controls

- **Run**: play or pause, run one full sweep, reset to the starting
  layout, or shuffle a new town. Speed sets how many households take their
  turn each frame.
- **Preference**: the smallest and largest share of a household's
  occupied neighbours that may come from its own group.
- **Town**: grid size, number of groups, the largest group's share, the
  share of empty homes, the neighbourhood (8 around, 4 across or the 24
  within two steps), the moving rule and whether the edges wrap.
- **Paint**: a brush for each group and for empty homes, and its size.
- **Keep**: copy a link that rebuilds the same town, or save a PNG.

Keyboard: <kbd>Space</kbd> play or pause, <kbd>S</kbd> one sweep,
<kbd>R</kbd> reset, <kbd>N</kbd> new town.

## How it works

- **Contentment.** A household is content when the share of its occupied
  neighbours from its own group lies within the chosen band. A household
  with no occupied neighbours is content.
- **Sweeps.** Each sweep lists the discontented households, shuffles them,
  and gives each a turn. A household still discontented when its turn
  comes moves according to the rule: *any empty home* (the textbook
  version), *a random home that suits* or *the nearest home that suits*,
  searched ring by ring outwards. When it is weighing a home, the one it is
  leaving counts as empty.
- **Endings.** The town has *settled* when nobody is discontented. It is
  *stuck* when a whole sweep passes without a move: under the rules that
  only move to suitable homes, that means no empty home suits anyone who
  is left. Under the textbook rule a demanding town can churn forever.
- **Neighbours alike** is the average share of a household's occupied
  neighbours from its own group. **Alike by chance** is the same average
  for a random layout, Σ (n<sub>g</sub>/N)(n<sub>g</sub> − 1)/(N − 1),
  since any other household is equally likely to sit next door.
- **Mixed contacts** is the share of neighbouring pairs of households that
  belong to different groups: the length of the borders between groups.
- **Entropy index H** is Theil's multigroup segregation index over 6 × 6
  blocks: 0 when every block has the town's mix, 1 when every block holds
  a single group.
- **Tipping chart.** Each floor starts again from the town's seed, so the
  points differ only in the floor. The runs are split into slices of a few
  thousand household turns per frame; a sliced run gives exactly the same
  result as an unsliced one.

The tests check the neighbour lists on wrapped and walled grids, the group
sizes, the measures on a checkerboard and on a town split in two, that
random towns sit at the random baseline and near zero on H, that moves
keep every household and the list of empty homes in step, that the
content-seeking rules only ever move a household somewhere it is content,
that the nearest rule finds the closest such home, that painting keeps the group sizes and the empty homes in step and
wakes a settled town, that splitting a sweep
across frames changes nothing, that the tipping curve climbs with the
floor and collapses when the floor is out of reach, that each preset behaves as its note says,
and that share links survive a round trip and clamp hostile values.

## References

- Thomas C. Schelling, "Models of segregation", *American Economic Review*
  59(2) (1969), 488–493.
- Thomas C. Schelling, "Dynamic models of segregation", *Journal of
  Mathematical Sociology* 1(2) (1971), 143–186.
- Thomas C. Schelling, *Micromotives and Macrobehavior* (1978).
- Henri Theil and Anthony J. Finizza, "A note on the measurement of racial
  integration of schools by means of informational concepts", *Journal of
  Mathematical Sociology* 1(2) (1971), 187–193.

## License

MIT
