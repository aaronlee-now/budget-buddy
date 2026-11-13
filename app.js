(() => {
  "use strict";

  const STORAGE_KEY = "budget-buddy-v1";

  const STAGES = [
    { min: 0, name: "Seedling", mood: "Tiny and curious — every dollar helps me grow." },
    { min: 0.2, name: "Sprout", mood: "Feeling stretchy! Keep those savings coming." },
    { min: 0.4, name: "Buddy", mood: "Energized! Your budget habits are working." },
    { min: 0.65, name: "Champion", mood: "Sparkling with savings power!" },
    { min: 0.9, name: "Legend", mood: "Goal in sight — I'm fully charged!" },
  ];

  const DEFAULTS = {
    goal: 500,
    have: 0,
    spend: 0,
    petName: "Sunny",
  };

  const els = {
    form: document.getElementById("budget-form"),
    goal: document.getElementById("goal"),
    have: document.getElementById("have"),
    spend: document.getElementById("spend"),
    petNameInput: document.getElementById("petName"),
    resetBtn: document.getElementById("reset-btn"),
    petBody: document.getElementById("pet-body"),
    petName: document.getElementById("pet-name"),
    petMood: document.getElementById("pet-mood"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    progressBar: document.getElementById("progress-bar"),
    energyFill: document.getElementById("energy-fill"),
    energyLabel: document.getElementById("energy-label"),
    energyBar: document.getElementById("energy-bar"),
    energyAura: document.getElementById("energy-aura"),
    stageBadge: document.getElementById("stage-badge"),
    statKept: document.getElementById("stat-kept"),
    statNeeded: document.getElementById("stat-needed"),
    statGoal: document.getElementById("stat-goal"),
    formMsg: document.getElementById("form-msg"),
    mouth: document.querySelector(".mouth"),
  };

  function money(n) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return {
        goal: Number(parsed.goal) >= 0 ? Number(parsed.goal) : DEFAULTS.goal,
        have: Number(parsed.have) >= 0 ? Number(parsed.have) : DEFAULTS.have,
        spend: Number(parsed.spend) >= 0 ? Number(parsed.spend) : DEFAULTS.spend,
        petName:
          typeof parsed.petName === "string" && parsed.petName.trim()
            ? parsed.petName.trim().slice(0, 24)
            : DEFAULTS.petName,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function compute(state) {
    const goal = Math.max(0, state.goal);
    const have = Math.max(0, state.have);
    const spend = Math.max(0, state.spend);
    const kept = Math.max(0, have - spend);
    const progress = goal > 0 ? clamp(kept / goal, 0, 1) : 0;
    // Energy rises with progress but dips if spending eats most of what you have
    const spendRatio = have > 0 ? clamp(spend / have, 0, 1) : spend > 0 ? 1 : 0;
    const energy = clamp(progress * (1 - spendRatio * 0.35) + progress * 0.15, 0, 1);
    let stageIndex = 0;
    for (let i = STAGES.length - 1; i >= 0; i -= 1) {
      if (progress >= STAGES[i].min) {
        stageIndex = i;
        break;
      }
    }
    if (progress >= 1) stageIndex = STAGES.length - 1;
    return {
      goal,
      have,
      spend,
      kept,
      needed: Math.max(0, goal - kept),
      progress,
      energy,
      stageIndex,
      stage: STAGES[stageIndex],
    };
  }

  function showMessage(text, isError) {
    els.formMsg.hidden = !text;
    els.formMsg.textContent = text || "";
    els.formMsg.classList.toggle("error", Boolean(isError));
  }

  function fillForm(state) {
    els.goal.value = state.goal === 0 ? "" : String(state.goal);
    els.have.value = state.have === 0 ? "" : String(state.have);
    els.spend.value = state.spend === 0 ? "" : String(state.spend);
    els.petNameInput.value = state.petName;
  }

  function render(state) {
    const view = compute(state);
    const pct = Math.round(view.progress * 100);
    const energyPct = Math.round(view.energy * 100);

    els.petName.textContent = state.petName || "Sunny";
    els.petMood.textContent =
      view.kept <= 0 && view.have === 0
        ? "Waiting for your first save…"
        : view.progress >= 1
          ? "Goal reached! I'm bursting with pride."
          : view.stage.mood;

    for (let i = 0; i <= 4; i += 1) {
      els.petBody.classList.toggle(`stage-${i}`, i === view.stageIndex);
    }

    const auraLevel = view.stageIndex; // 0–4
    els.energyAura.dataset.level = String(auraLevel);

    els.progressFill.style.width = `${pct}%`;
    els.progressLabel.textContent = `${pct}%`;
    els.progressBar.setAttribute("aria-valuenow", String(pct));

    els.energyFill.style.width = `${energyPct}%`;
    els.energyLabel.textContent = `${energyPct}%`;
    els.energyBar.setAttribute("aria-valuenow", String(energyPct));

    els.stageBadge.textContent = `Stage ${view.stageIndex + 1} · ${view.stage.name}`;

    els.statKept.textContent = money(view.kept);
    els.statNeeded.textContent = money(view.needed);
    els.statGoal.textContent = money(view.goal);

    // Smile wider as progress grows
    if (els.mouth) {
      if (view.progress >= 0.9) {
        els.mouth.setAttribute("d", "M140 196 Q160 222 180 196");
      } else if (view.progress >= 0.4) {
        els.mouth.setAttribute("d", "M145 198 Q160 212 175 198");
      } else if (view.kept > 0) {
        els.mouth.setAttribute("d", "M148 200 Q160 208 172 200");
      } else {
        els.mouth.setAttribute("d", "M150 204 Q160 200 170 204");
      }
    }
  }

  function readForm() {
    const goal = Number(els.goal.value);
    const have = Number(els.have.value);
    const spend = Number(els.spend.value);
    const petName = (els.petNameInput.value || "").trim().slice(0, 24) || DEFAULTS.petName;

    if (![goal, have, spend].every((n) => Number.isFinite(n))) {
      return { error: "Please enter valid numbers for goal, have, and spend." };
    }
    if (goal < 0 || have < 0 || spend < 0) {
      return { error: "Amounts can’t be negative." };
    }
    if (goal === 0) {
      return { error: "Set a savings goal greater than zero so your pet has something to grow toward." };
    }

    return { state: { goal, have, spend, petName } };
  }

  let state = loadState();
  fillForm(state);
  render(state);

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = readForm();
    if (result.error) {
      showMessage(result.error, true);
      return;
    }
    state = result.state;
    saveState(state);
    render(state);
    const view = compute(state);
    showMessage(
      view.progress >= 1
        ? `${state.petName} is legendary — you hit your savings goal!`
        : `Saved! ${state.petName} is now a ${view.stage.name}.`,
      false
    );
  });

  // Live preview while typing (still persists only on submit / blur of last known good)
  ["goal", "have", "spend", "petName"].forEach((id) => {
    els[id === "petName" ? "petNameInput" : id].addEventListener("input", () => {
      const goal = Number(els.goal.value);
      const have = Number(els.have.value);
      const spend = Number(els.spend.value);
      if (![goal, have, spend].every((n) => Number.isFinite(n) && n >= 0)) return;
      const preview = {
        goal: goal || state.goal,
        have,
        spend,
        petName: (els.petNameInput.value || "").trim().slice(0, 24) || state.petName,
      };
      // Don't require goal > 0 for live preview of empty field mid-edit
      render({
        ...preview,
        goal: goal > 0 ? goal : state.goal,
      });
    });
  });

  els.resetBtn.addEventListener("click", () => {
    if (!window.confirm("Reset Budget Buddy? This clears saved data in this browser.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { ...DEFAULTS };
    fillForm(state);
    render(state);
    showMessage("Reset complete. Set a new goal to wake your pet.", false);
  });
})();
