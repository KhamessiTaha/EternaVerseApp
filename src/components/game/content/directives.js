// src/components/game/content/directives.js
//
// THE LONG DIRECTIVE - Act II.
//
// firstSession.js runs Act I: five beats that teach the loop (move, scan,
// descend, contact, champion) and then get out of the way. After that the game
// says nothing more, which is a problem, because almost everything EternaVerse
// has to offer lives past that point - containment, morphology, harvesting,
// nucleosynthesis, crafting, sieges, artifacts, ascension. A player finished
// Act I and was handed a beautiful sandbox with no thread.
//
// This is the thread. Eight beats, from "hold the fabric together" to "carry a
// people to the stars", each one naming a thing the universe can do that you
// probably don't know about yet.
//
// THREE RULES, learned the hard way elsewhere in this codebase:
//
//   1. A beat is an EVENT, not a counter. "Take iron from a dying star", not
//      "harvest 5 times". Counters complete by accident; events are remembered.
//      (Same lesson as situations/situationModel.js.)
//
//   2. Nothing BLOCKS. Beats complete out of order and stay complete, so a
//      player who raises a monument before answering a distress call is simply
//      further along - never stuck behind a siege that hasn't happened yet.
//
//   3. Progress is DERIVED, never plumbed. Every beat is a pure predicate over
//      the universe and The Self, evaluated on sync. No call sites to wire, and
//      nothing to miss when a reward path changes.
//
// Account-wide, not per-universe: this is the warden's arc. You should not have
// to rediscover iron in every cosmos you're handed.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const held = (ctx, id) => num(ctx?.universe?.materials?.[id]);

export const DIRECTIVES = [
  {
    id: "contain",
    label: "Hold the fabric",
    hint: "F at a tear",
    instruction:
      "Something has torn. Fly into it and hold it closed — how cleanly you do it is the whole difference between a scar and a wound.",
    reward: "The universe is a thing that can be kept. That is the job.",
    done: (ctx) => num(ctx?.universe?.metrics?.anomaliesResolved) >= 1,
  },
  {
    id: "read",
    label: "Learn to read a sky",
    hint: "call a galaxy before scanning it",
    instruction:
      "Every galaxy wears its history in its shape. Name one correctly enough times and you will never need to be asked again.",
    reward: "You can read a sky now. Few can.",
    done: (ctx) => (ctx?.certified?.length || 0) >= 1,
  },
  {
    id: "iron",
    label: "Take iron from a dying star",
    hint: "harvest at a supernova",
    instruction:
      "Iron is where fusion stops paying. A star that reaches it collapses within a day — and scatters everything you will ever build with.",
    reward: "Matter, not just knowledge. You can make things now.",
    done: (ctx) => held(ctx, "iron") > 0,
  },
  {
    id: "forge",
    label: "Make something of it",
    hint: "U · craft a Mk2",
    instruction:
      "Research designs a thing. Matter builds it. Spend what you gathered and carry something out of this cosmos that it gave you.",
    reward: "The first thing you ever made from a dead star.",
    done: (ctx) => Object.values(ctx?.universe?.upgrades || {}).some((lvl) => num(lvl) >= 2),
  },
  {
    id: "answer",
    label: "Answer a call",
    hint: "break a siege",
    instruction:
      "Somewhere a world is being bombarded by people who were not asked. You are the only thing above them that can choose.",
    reward: "A people that exists because you turned toward them.",
    done: (ctx) => (ctx?.universe?.civilizations || []).some((c) => num(c?.rescues) > 0),
  },
  {
    id: "raise",
    label: "Raise something that outlives you",
    hint: "G · build",
    instruction:
      "Beacons, monuments, vaults. Universes end. What you build is copied to your name and survives the sky it stood under.",
    reward: "It will still be yours when this cosmos is gone.",
    done: (ctx) => (ctx?.universe?.artifacts || []).length >= 1,
  },
  {
    id: "gold",
    label: "Take gold from a collision",
    hint: "harvest at a kilonova",
    instruction:
      "Gold is not made in stars. It is made when two neutron stars collide — so a young universe has none, and no amount of looking will find any. Wait for one to be old enough, then be there.",
    reward: "You waited for a universe to make something, and it did.",
    done: (ctx) => held(ctx, "gold") > 0,
  },
  {
    id: "ascend",
    label: "Carry a people to the stars",
    hint: "shepherd a species to Type III",
    instruction:
      "Everything else is preparation. Take one species from fire to starlight before the sky closes. They will outlive the universe that made them, and they will remember who kept the lights on.",
    reward: "They reached the stars while you were keeping this place. That does not unhappen.",
    done: (ctx) => (ctx?.universe?.legacies || []).length >= 1,
  },
];

export const DIRECTIVE_IDS = DIRECTIVES.map((d) => d.id);

export const directiveById = (id) => DIRECTIVES.find((d) => d.id === id) || null;

/**
 * Which beats are satisfied by the world RIGHT NOW.
 *
 * Pure and total: a malformed universe yields an empty list rather than
 * throwing, because this runs on every sync and must never be able to take the
 * session down with it.
 */
export function satisfiedBy(ctx) {
  const out = [];
  for (const d of DIRECTIVES) {
    try {
      if (d.done(ctx)) out.push(d.id);
    } catch {
      /* a beat that can't be evaluated is simply not done yet */
    }
  }
  return out;
}

/**
 * The beat to show: the first in authored order that isn't finished.
 * Null once the whole arc is complete.
 */
export function currentDirective(completedIds) {
  const done = new Set(completedIds || []);
  return DIRECTIVES.find((d) => !done.has(d.id)) || null;
}

/** How far along the arc is, for the panel. */
export function directiveProgress(completedIds) {
  const done = new Set(completedIds || []);
  const count = DIRECTIVE_IDS.filter((id) => done.has(id)).length;
  return { done: count, total: DIRECTIVES.length, complete: count >= DIRECTIVES.length };
}
