// src/components/game/systems/ScanSystem.js
//
// V-key scan channel: target the nearest unscanned object (cosmic objects
// AND active anomalies), channel for SCAN_DURATION_MS with a ring + progress
// arc, cancel if the player leaves range, and emit "scan:complete" with a
// normalized discovery payload on success. Scanning an anomaly is
// independent of resolving it (each is once-only per object).
import Phaser from "phaser";
import { SCAN_RANGE, SCAN_DURATION_MS, SCAN_CANCEL_RANGE, ANOMALY_TYPE_MAP } from "../constants";
import { ANOMALY_SCAN_BASE } from "../world/researchValues.js";
import { getShipModifiers } from "../content/upgradeCatalog.js";
import { playSfx } from "../audio.js";
import { narrate, narrateOnce, pick, CURATOR } from "../narrator.js";
import {
  CLASSIFY_BUCKETS, isClassifiable, classifyResult, shouldPrompt,
} from "../world/classifyModel.js";
import { getClassifyRecord, recordClassifyCall } from "../wardenProgress.js";
import { ClassifyPrompt, showClassifyResult } from "../ui/classifyPrompt.js";
import { getClassInfo } from "../world/researchValues.js";
import { getChunkWeb } from "../world/densityField.js";
import { getChunkCoords } from "../utils";

// Survey streak: chaining scans builds a combo that makes scans FASTER and
// worth more RP, but a decay window means you have to keep moving/finding.
// Turns the game's most-repeated action from a passive wait into a flow game.
const STREAK_WINDOW_MS = 5200; // idle longer than this and the streak breaks
const STREAK_MAX_SPEEDUP = 9;  // streaks past this don't get faster
const STREAK_RP_PER = 0.05;    // +5% RP per streak step...
const STREAK_RP_CAP = 0.6;     // ...up to +60%

export class ScanSystem {
  constructor(scene) {
    this.scene = scene;
    this.scannedIds = new Set();
    this.active = null; // { target, elapsed, gfx }
    this.streak = 0;
    this.best = 0;
    this.lastScanAt = -Infinity;

    // Classify Before Scan. The prompt appears when an unscanned GALAXY is the
    // nearest scannable target - on approach, not on scan start. The channel
    // can be as short as ~380ms at a hot streak with Scanner 3, which is not
    // enough time for a four-way choice; forcing the call into that window
    // would make the mechanic punish the streak. The shape is legible while
    // you fly toward it, so that is when the decision actually happens.
    this.classify = new ClassifyPrompt(scene, (id) => this._callClass(id));
    this._nearestTimer = 0;
    this._bindClassifyKeys();
  }

  _bindClassifyKeys() {
    for (const bucket of CLASSIFY_BUCKETS) {
      // Resolve the KeyCodes NAME, not the printed digit. addKey("1") looks up
      // KeyCodes["1"] - undefined - and yields a key that can never fire.
      const code = Phaser.Input.Keyboard.KeyCodes[bucket.code];
      if (code === undefined) continue;
      const key = this.scene.input.keyboard.addKey(code);
      key.on("down", () => this._callClass(bucket.id));
    }
  }

  /** Lock in a call. Re-pressable until the channel ends; never blocks flow. */
  _callClass(bucketId) {
    if (this.scene.inputSystem?.isMinigameActive) return;
    if (!this.classify.shownFor) return;
    if (this.classify.setGuess(bucketId)) playSfx("uiClick");
  }

  /**
   * Keep the prompt pinned to the nearest unscanned galaxy. Throttled - a
   * per-frame nearest-candidate sweep over every loaded chunk is the one thing
   * here that could actually cost something.
   */
  _updateClassifyTarget(delta) {
    // While channelling, the prompt stays on the target being scanned so a
    // late call still lands.
    if (this.active) {
      const t = this.active.target;
      if (this._wantsPrompt(t.discovery)) this.classify.show(t.id, t.x, t.y);
      return;
    }

    this._nearestTimer -= delta;
    if (this._nearestTimer > 0) return;
    this._nearestTimer = 140;

    const player = this.scene.player;
    if (!player) return;
    let nearest = null;
    let best = SCAN_RANGE * this._mods().scanRange;
    for (const c of this._candidates()) {
      if (!this._wantsPrompt(c.discovery)) continue;
      const d = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
      if (d < best) { best = d; nearest = c; }
    }

    if (nearest) {
      this.classify.show(nearest.id, nearest.x, nearest.y);
      this._maybeTeachPrior(nearest);
    } else {
      this.classify.hide();
    }
  }

  /**
   * Whether to OFFER a call on this object.
   *
   * A certified family is never asked about again - that is the deal
   * certification makes, and the reason this mechanic doesn't wear out. The
   * bonus still pays (classifyModel.classifyResult), so nothing is lost by
   * going quiet.
   */
  _wantsPrompt(discovery) {
    return isClassifiable(discovery) && shouldPrompt(discovery.objectClass, this._record());
  }

  /** The player's account-wide morphology record; cached per scan cycle. */
  _record() {
    return getClassifyRecord();
  }

  /**
   * The moment a family goes quiet for good. Said once, loudly enough to read
   * as a reward rather than as a feature switching off - because that is
   * exactly what the player just earned.
   */
  _announceCertified(bucketId) {
    const bucket = CLASSIFY_BUCKETS.find((b) => b.id === bucketId);
    const label = bucket?.full ?? bucketId;
    playSfx('surveyMilestone');
    this.scene.cameras.main.flash(220, 78, 200, 220, false);
    narrate(
      `You don't need to be asked about ${label.toLowerCase()} galaxies any more. ` +
      `You know one when you see it - the bonus is yours from here.`,
      'proud'
    );
  }

  /**
   * The density-morphology relation, offered once, at the only moment it's
   * actionable. objectGenerator weights ellipticals to 50% inside clusters and
   * spirals/barred to 59% out in the field, so a player who knows this can use
   * their surroundings as a prior before looking closely. That second-order
   * layer is what stops the mechanic being a lookup table.
   */
  _maybeTeachPrior(target) {
    const { chunkX, chunkY } = getChunkCoords(target.x, target.y);
    const { webClass } = getChunkWeb(this.scene.worldSeed(), chunkX, chunkY);
    if (webClass !== "cluster") return;
    narrateOnce("classify-cluster-prior", pick(CURATOR.classify.clusterPrior), "curious");
  }

  // Multiplier the streak grants to research (mirrored/clamped server-side).
  surveyMult() {
    return 1 + Math.min(this.streak * STREAK_RP_PER, STREAK_RP_CAP);
  }

  // Streak state for the HUD: current, best, and the decay bar (1 -> 0).
  getSurvey() {
    const remaining = this.streak > 0
      ? Math.max(0, 1 - (this.scene.time.now - this.lastScanAt) / STREAK_WINDOW_MS)
      : 0;
    return { streak: this.streak, best: this.best, remaining, mult: this.surveyMult() };
  }

  seedScanned(ids) {
    for (const id of ids || []) this.scannedIds.add(id);
  }

  isScanned(id) {
    return this.scannedIds.has(id);
  }

  // Collect scannable candidates as { id, x, y, discovery }.
  _candidates() {
    const out = [];

    this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
      for (const { descriptor } of chunk.objects) {
        if (this.scannedIds.has(descriptor.id)) continue;
        out.push({
          id: descriptor.id, x: descriptor.x, y: descriptor.y,
          discovery: {
            id: descriptor.id, name: descriptor.name, category: descriptor.category,
            objectClass: descriptor.objectClass, rarity: descriptor.rarity,
            research: descriptor.research, location: { x: descriptor.x, y: descriptor.y },
          },
        });
      }
      for (const anom of chunk.anomalies) {
        if (anom.resolved || this.scannedIds.has(`scan:${anom.id}`)) continue;
        out.push(this._anomalyCandidate(anom.id, anom.x, anom.y, anom.type, anom.severity, false));
      }
    });

    this.scene.anomalySystem.backendAnomalies.forEach((anom) => {
      if (!anom.visual || this.scannedIds.has(anom.id)) return;
      out.push(this._anomalyCandidate(anom.id, anom.location.x, anom.location.y, anom.type, anom.severity, true));
    });

    return out;
  }

  _anomalyCandidate(id, x, y, type, severity, isBackend) {
    const label = ANOMALY_TYPE_MAP[type]?.label ?? type;
    // Procedural anomaly ids collide with nothing server-side but are never
    // sent there anyway (GameplayPage routes them by the ":" convention);
    // prefix their scan-tracking key so a resolved+rescanned chunk regen
    // can't confuse them with object ids.
    return {
      id: isBackend ? id : `scan:${id}`, x, y,
      discovery: {
        id, name: `Anomaly · ${label}`, category: "anomaly",
        objectClass: type, rarity: severity >= 4 ? "rare" : severity >= 3 ? "uncommon" : "common",
        research: ANOMALY_SCAN_BASE * Math.max(1, Math.floor(severity || 1)),
        location: { x, y },
        isBackend,
      },
    };
  }

  // Scanner Array upgrade widens range and shortens channel time; read live
  // from the scene's universe so a purchase applies immediately.
  _mods() {
    return getShipModifiers(this.scene.universe?.upgrades, this.scene.universe?.doctrine);
  }

  tryStartScan() {
    if (this.active) return;
    const player = this.scene.player;
    let nearest = null;
    let best = SCAN_RANGE * this._mods().scanRange;
    for (const c of this._candidates()) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
      if (d < best) { best = d; nearest = c; }
    }
    if (!nearest) return;

    playSfx('scanStart');
    this.active = {
      target: nearest,
      elapsed: 0,
      gfx: this.scene.add.graphics().setDepth(50),
    };
  }

  update(delta) {
    // Streak decay runs whether or not a scan is in progress.
    if (this.streak > 0 && this.scene.time.now - this.lastScanAt > STREAK_WINDOW_MS) {
      this._breakStreak();
    }

    this._updateClassifyTarget(delta);

    if (!this.active) return;
    const { target, gfx } = this.active;
    const player = this.scene.player;
    const mods = this._mods();

    // Cancel range keeps the stock cancel/start ratio, scaled with the upgrade
    const cancelRange = SCAN_RANGE * mods.scanRange * (SCAN_CANCEL_RANGE / SCAN_RANGE);
    if (Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y) > cancelRange) {
      playSfx('scanCancel');
      this._cancel();
      return;
    }

    // A hot streak scans faster - flow is self-reinforcing.
    const speed = Math.max(0.45, 1 - Math.min(this.streak, STREAK_MAX_SPEEDUP) * 0.06);
    this.active.elapsed += delta;
    const t = Math.min(1, this.active.elapsed / (SCAN_DURATION_MS * mods.scanDuration * speed));

    gfx.clear();
    gfx.lineStyle(1.5, 0x4ec9e0, 0.5);
    gfx.strokeCircle(target.x, target.y, 34 + Math.sin(this.scene.time.now / 120) * 3);
    gfx.lineStyle(3, 0x4ec9e0, 0.95);
    gfx.beginPath();
    gfx.arc(target.x, target.y, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    gfx.strokePath();
    gfx.lineStyle(1, 0x4ec9e0, 0.35);
    gfx.lineBetween(player.x, player.y, target.x, target.y);

    if (t >= 1) this._complete();
  }

  _breakStreak() {
    if (this.streak >= 3) playSfx('surveyBreak');
    this.streak = 0;
  }

  _complete() {
    const { target, gfx } = this.active;
    gfx.destroy();
    this.active = null;

    // Resolve any Hubble call BEFORE the streak advances, so a correct one can
    // add its extra step and the reported multiplier includes it.
    const guess = this.classify.shownFor === target.id ? this.classify.called : null;
    const result = classifyResult(guess, target.discovery.objectClass, this._record());
    this.classify.hide();

    // Log it against the family that was actually correct, and say something
    // ONCE if this call is what certified them.
    if (result.called) {
      const earned = recordClassifyCall(result.answer, result.correct);
      for (const bucket of earned) this._announceCertified(bucket);
    }

    // Advance the survey streak: chain, juice, milestones. Knowing the answer
    // advances it an extra step - so understanding literally makes you faster,
    // because the streak speedup is what shortens the channel.
    this.streak += 1 + result.streakBonus;
    this.best = Math.max(this.best, this.streak);
    this.lastScanAt = this.scene.time.now;
    playSfx('surveyTick', { streak: this.streak });

    if (this.streak > 0 && this.streak % 5 === 0) {
      playSfx('surveyMilestone');
      this.scene.cameras.main.flash(180, 78, 200, 220, false);
      if (this.streak === 5) narrateOnce('survey-5', pick(CURATOR.survey.rhythm), 'amused');
      else if (this.streak === 10) narrateOnce('survey-10', pick(CURATOR.survey.hot), 'awe');
      else if (this.streak >= 15) narrate(pick(CURATOR.survey.blazing), 'awe');
    }

    playSfx('scanComplete');
    this.scannedIds.add(target.id);
    target.discovery.surveyStreak = this.streak;
    target.discovery.surveyMult = this.surveyMult();
    // Reported alongside surveyMult and clamped server-side the same way.
    target.discovery.classifyMult = result.mult;

    if (result.called) {
      const info = getClassInfo(target.discovery.objectClass);
      const guessed = CLASSIFY_BUCKETS.find((b) => b.id === guess);
      showClassifyResult(this.scene, target.x, target.y, {
        className: target.discovery.objectClass,
        label: info?.label ?? target.discovery.name,
        result: { ...result, guessLabel: guessed?.label ?? guess },
      });

      if (result.correct) {
        playSfx('surveyMilestone');
        narrateOnce('classify-first-correct', pick(CURATOR.classify.firstCorrect), 'proud');
      } else {
        narrateOnce('classify-first-wrong', pick(CURATOR.classify.firstWrong), 'amused');
      }
    }

    // Pulse effect
    const pulse = this.scene.add.graphics({ x: target.x, y: target.y }).setDepth(50);
    pulse.lineStyle(2, 0x4ec9e0, 0.9);
    pulse.strokeCircle(0, 0, 20);
    this.scene.tweens.add({
      targets: pulse, scaleX: 4, scaleY: 4, alpha: 0,
      duration: 600, ease: "Cubic.easeOut",
      onComplete: () => pulse.destroy(),
    });

    // Cataloged marker for cosmic objects still in a loaded chunk
    if (target.discovery.category !== "anomaly") {
      this.scene.chunkSystem.loadedChunks.forEach((chunk) => {
        const entry = chunk.objects.find((o) => o.descriptor.id === target.id);
        if (entry) this.attachCatalogedMarker(entry);
      });
    }

    this.scene.events.emit("scan:complete", { discovery: target.discovery });
  }

  attachCatalogedMarker(entry) {
    if (entry.marker) return;
    const { descriptor } = entry;
    entry.marker = this.scene.add.graphics({ x: descriptor.x, y: descriptor.y }).setDepth(8);
    entry.marker.lineStyle(1, 0x4fd1a5, 0.55);
    entry.marker.strokeCircle(0, 0, 10);
    entry.marker.lineBetween(-3, 0, -1, 3);
    entry.marker.lineBetween(-1, 3, 4, -3);
  }

  _cancel() {
    this.active?.gfx.destroy();
    this.active = null;
    // Flying out of range drops the call with the scan - no penalty, no
    // message. The prompt re-offers next time you come back.
    this.classify.hide();
  }

  destroy() {
    this._cancel();
    this.classify.destroy();
  }
}
