# Morphogenesis Engine

**Turing Reaction-Diffusion · BMP / Noggin Particle System**

An interactive physics simulation based on Alan Turing's 1952 paper *"The Chemical Basis of Morphogenesis"*. Two proteins — BMP (Activator) and Noggin (Inhibitor) — interact via inverse-square forces and spontaneously self-organise into evenly-spaced spots or stripes. The same mathematics underlies leopard spots, zebra stripes, and the spacing of fingers in a developing embryo.

[**Live demo →**](https://editor.p5js.org/StormyGood/full/XJKDAvscT)

\---

## What you'll see

On load, 20 gold BMP particles and 20 cyan Noggin particles are placed on a dark canvas. Within about 10 seconds, the BMP clusters self-organise into 3–5 evenly-spaced glowing blobs — the Turing pattern. Noggin fills the gaps between them, suppressing new clusters from forming there.

Press **T** to switch to stripe mode and watch the blobs reorganise into filaments live, without restarting. Press **T** again to return to spot mode.

\---

## Controls

|Input|Action|
|-|-|
|`Left-click`|Inject BMP activator particles at cursor|
|`Right-click`|Inject Noggin inhibitor particles at cursor|
|`Drag`|Push nearby bodies in drag direction|
|`T`|Toggle spot ↔ stripe mode (live, no restart)|
|`V`|Toggle vector field overlay|
|`E`|Toggle kinetic energy bar overlay|
|`R`|Replay with same seed (deterministic)|
|`N`|Start with new random seed|
|`?` button|Open science explainer panel|

\---

## The science

### BMP — the Activator (gold)

BMP self-excites at short range (nearby BMP attracts more BMP) and repels other BMP clusters at long range. This causes it to form discrete, evenly-spaced blobs.

### Noggin — the Inhibitor (cyan)

Noggin is lighter and diffuses faster than BMP. It slowly drifts toward BMP and suppresses it wherever it reaches, filling the gaps between clusters and preventing new spots from forming there.

### The Turing Instability

Because Noggin diffuses faster than BMP, BMP can locally self-excite before Noggin arrives to suppress it — but Noggin then blankets the surrounding area. The result: stable evenly-spaced spots, with inhibitor-filled gaps between them. A uniform distribution is unstable; tiny fluctuations amplify into the pattern.

### Spot vs stripe mode

In spot mode, BMP attracts itself at short range → discrete blobs. In stripe mode, BMP repels at *all* distances → filaments. Turing proved both emerge from the same equations — only the parameter ratio changes. In real biology, a cheetah has spots on its body but stripes on its tail because the tail is thin enough that the stripe regime dominates there.

## Code structure

```
index.html   — page layout, HUD, info panel markup
style.css    — all styling: HUD, info panel, population bar, key badges
sketch.js    — full simulation logic
```

## Setup

No build step or dependencies required.

```bash
git clone https://github.com/YOUR\_USERNAME/morphogenesis-engine
cd morphogenesis-engine
open index.html   # or just double-click it
```

The only external dependency is p5.js, loaded automatically from the cdnjs CDN. All three files must be in the same directory.

\---

*WA2 · CEP · Term 2 Week 10*

