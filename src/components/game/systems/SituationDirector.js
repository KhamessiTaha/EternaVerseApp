// src/components/game/systems/SituationDirector.js
//
// The thing that makes a 30-minute session have a shape.
//
// Ascension is ~400 simulation steps away and civilizations don't exist until
// ~130, so most sessions end with nothing having HAPPENED. Missions covered
// that with counters, which complete by accident. This schedules real events:
// one every 15-20 minutes, timed, located, interruptible, with the payoff
// stated up front.
//
// It stages nothing of its own. Every situation is an existing system given a
// deadline, a place, a name and a countdown:
//   cascade   SurgeSystem, larger and with a clock
//   distress  a siege that already exists, promoted to a headline
//   windfall  a CosmicEventSystem object worth crossing the map for
//
// It also awards nothing. Each of those systems already pays for itself -
// surge containment, breaking a siege, claiming an event - so the Director
// adds framing and stakes without a single new reward path or server route.
// Its whole job is to make the player NOTICE.
import { civDesignation } from "../utils";
import { playSfx } from "../audio.js";
import { narrate, pick, CURATOR } from "../narrator.js";
import { besiegedWorlds } from "../combat/fleetModel.js";
import { civLocation } from "../world/civPlacement.js";
import { cosmicProfile } from "../world/cosmicProfile.js";
import {
  SITUATIONS, pickSituation, scheduleNext, situationProgress, bearingTo, MIN_GAP_MS,
} from "../situations/situationModel.js";

const POLL_MS = 500; // how often we re-check a running situation

export class SituationDirector {
  constructor(scene) {
    this.scene = scene;
    this.active = null;
    this.lastId = null;
    this.nextAt = scheduleNext(scene.time.now, { isFirst: true });
    this._lastPoll = 0;
    this.completed = 0;
  }

  /** Banner state for the HUD, or null when nothing is running. */
  getSituation() {
    const p = situationProgress(this.active, this.scene.time.now);
    if (!p) return null;
    // Where it is, relative to the player. Staging always records a position;
    // until now nothing ever showed it, so a situation could time out while
    // the player looked for it.
    const player = this.scene.player;
    const bearing = player ? bearingTo({ x: player.x, y: player.y }, p) : null;
    return { ...p, bearing };
  }

  update(time) {
    if (this.active) {
      if (time - this._lastPoll < POLL_MS) return;
      this._lastPoll = time;
      this._poll(time);
      return;
    }
    if (time < this.nextAt) return;

    const def = pickSituation(this._ctx(), { lastId: this.lastId });
    if (!def) {
      // The world can't support anything right now - try again shortly rather
      // than forcing something that would point at nothing.
      this.nextAt = time + 45000;
      return;
    }
    this._begin(time, def);
  }

  /**
   * Dev console: stage a specific situation right now.
   *
   * The real cadence is 7 minutes to the first and 15-20 between, which makes
   * this feature effectively untestable by playing. Returns false if the world
   * genuinely can't support it (no siege exists for a distress call), because
   * that's a real answer worth seeing rather than one to fake past.
   */
  forceSituation(id) {
    if (this.active) this._end(false);
    const def = SITUATIONS.find((s) => s.id === id);
    if (!def) return false;
    if (!def.eligible(this._ctx())) return false;
    this._begin(this.scene.time.now, def);
    return !!this.active;
  }

  /** What the world can currently support. */
  _ctx() {
    const s = this.scene;
    return {
      scale: s.world?.scale ?? "galactic",
      stability: s.universe?.currentState?.stabilityIndex ?? 1,
      besiegedCount: besiegedWorlds(
        s.universe?.civilizations || [],
        s.universe?.activeWars || []
      ).length,
      surgeActive: !!s.surgeSystem?.active,
      eventActive: !!s.cosmicEventSystem?.active,
      minigameActive: !!s.inputSystem?.isMinigameActive,
    };
  }

  _begin(time, def) {
    const staged = this[`_stage_${def.kind}`]?.(def);
    if (!staged) {
      // Staging can legitimately fail (no loaded chunk, the siege ended in the
      // moment between picking and staging). Never announce a situation that
      // doesn't exist.
      this.nextAt = time + 30000;
      return;
    }

    this.active = {
      id: def.id,
      kind: def.kind,
      title: def.title,
      brief: staged.brief,
      payoff: def.payoff,
      durationMs: def.durationMs,
      startedAt: time,
      x: staged.x,
      y: staged.y,
      check: staged.check,
    };
    this.lastId = def.id;

    playSfx("surgeAlarm");
    this.scene.cameras.main.flash(220, 90, 60, 30, false);
    narrate(pick(CURATOR.situation[def.kind]), "warning");
    this.scene.onHint?.(`${def.title} — ${staged.brief}`, "warn", 9000);
  }

  _poll(time) {
    const p = situationProgress(this.active, time);
    if (this.active.check?.()) return this._end(true);
    if (p.expired) return this._end(false);
  }

  _end(success) {
    const { kind } = this.active;
    this.active = null;
    this.nextAt = this.scene.time.now + MIN_GAP_MS;

    if (success) {
      this.completed += 1;
      playSfx("surveyMilestone");
      narrate(pick(CURATOR.situation.resolved), "proud");
    } else {
      narrate(pick(CURATOR.situation.missed[kind] ?? CURATOR.situation.missed.generic), "grim");
    }
  }

  // ------------------------------------------------------------- staging

  _stage_cascade(def) {
    const stability = this.scene.universe?.currentState?.stabilityIndex ?? 1;
    const tears = def.tearsFor(stability);
    const ids = this.scene.surgeSystem?.forceSurge?.(tears);
    if (!ids || ids.length === 0) return null;

    const p = this.scene.player;
    return {
      brief: def.brief(ids.length),
      x: p.x,
      y: p.y,
      // The running count, so the banner can say 3/6 instead of restating the
      // demand. SurgeSystem already tallies this every frame.
      progress: () => {
        const s = this.scene.surgeSystem?.getSurge?.();
        if (!s?.active) return null;
        return { done: s.resolved, total: s.total };
      },
      // Contained when the surge system says the cluster is gone.
      check: () => !this.scene.surgeSystem?.active,
    };
  }

  _stage_distress(def) {
    const civs = this.scene.universe?.civilizations || [];
    const sieges = besiegedWorlds(civs, this.scene.universe?.activeWars || []);
    if (sieges.length === 0) return null;

    const { civ } = sieges[0];
    // Same density profile the world is rendered with, so the waypoint points
    // at where the beacon actually is rather than where it would be in a
    // differently-aged cosmos.
    const cp = cosmicProfile(this.scene.universe?.currentState);
    const loc = civLocation(civ, this.scene.universe?.seed, cp);
    const name = civDesignation(civ.id);

    return {
      brief: def.brief(name),
      x: loc?.x ?? civ.location?.x,
      y: loc?.y ?? civ.location?.y,
      // Resolved when this world is no longer under siege - either you broke
      // it, or the war ended. Losing the world reads as a failure because the
      // civ goes extinct and drops out of besiegedWorlds too, so the deadline
      // is what separates the two outcomes.
      check: () => {
        const live = this.scene.universe?.civilizations || [];
        const still = besiegedWorlds(live, this.scene.universe?.activeWars || []);
        return !still.some((s) => s.civ.id === civ.id);
      },
    };
  }

  _stage_windfall(def) {
    const spawned = this.scene.cosmicEventSystem?.forceEvent?.("derelict");
    if (!spawned) return null;
    return {
      brief: def.brief(),
      x: spawned.x,
      y: spawned.y,
      check: () => !this.scene.cosmicEventSystem?.active,
    };
  }

  destroy() {
    this.active = null;
  }
}
