(() => {
  "use strict";

  const STORAGE_KEY = "budget-buddy-v2";
  const LEGACY_KEY = "budget-buddy-v1";

  const STAGES = [
    { min: 0, name: "Seedling", mood: "Tiny and curious — every dollar helps me grow." },
    { min: 0.2, name: "Sprout", mood: "Feeling stretchy! Keep those savings coming." },
    { min: 0.4, name: "Buddy", mood: "Energized! Your budget habits are working." },
    { min: 0.65, name: "Champion", mood: "Sparkling with savings power!" },
    { min: 0.9, name: "Legend", mood: "Goal in sight — I'm fully charged!" },
  ];

  const DEFAULTS = {
    goal: 500,
    deadline: "",
    petName: "Sunny",
    income: [],
    spend: [],
  };

  const ACTIONS = [
    { cls: "act-run-right", ms: 1400, line: "Zooming to the right — savings sprint!" },
    { cls: "act-run-left", ms: 1400, line: "Dashing left like free money!" },
    { cls: "act-hop", ms: 1000, line: "Boing! Compound interest hops." },
    { cls: "act-spin", ms: 1150, line: "Spinning on good habits!" },
    { cls: "act-zoom", ms: 1550, line: "Lap around the budget yard!" },
    { cls: "act-dance", ms: 1450, line: "Dance break — you earned it." },
    { cls: "act-peek", ms: 1650, line: "Peeking at your progress…" },
    { cls: "act-stretch", ms: 1300, line: "Big stretch before the next save." },
    { cls: "act-shake", ms: 750, line: "Shaking off overspending vibes." },
  ];

  const PLEAD_ACTIONS = [
    { cls: "act-shake", ms: 750, line: "Please earn something — I'm getting wobbly…" },
    { cls: "act-peek", ms: 1650, line: "Any paycheck coming? Asking for a friend (me)." },
    { cls: "act-hop", ms: 1000, line: "Hopeless for income… feed me a deposit!" },
  ];

  // Hours since last income before the pet starts pleading / gets desperate
  const PLEAD_AFTER_HOURS = 18;
  const PLEAD_HARD_HOURS = 48;

  const els = {
    settingsForm: document.getElementById("settings-form"),
    incomeForm: document.getElementById("income-form"),
    spendForm: document.getElementById("spend-form"),
    goal: document.getElementById("goal"),
    deadline: document.getElementById("deadline"),
    petNameInput: document.getElementById("petName"),
    deadlineBadge: document.getElementById("deadline-badge"),
    statDeadline: document.getElementById("stat-deadline"),
    incomeAmount: document.getElementById("income-amount"),
    incomeSource: document.getElementById("income-source"),
    spendAmount: document.getElementById("spend-amount"),
    spendSource: document.getElementById("spend-source"),
    incomeList: document.getElementById("income-list"),
    spendList: document.getElementById("spend-list"),
    resetBtn: document.getElementById("reset-btn"),
    petBody: document.getElementById("pet-body"),
    petMover: document.getElementById("pet-mover"),
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
    statIncome: document.getElementById("stat-income"),
    statSpent: document.getElementById("stat-spent"),
    statKept: document.getElementById("stat-kept"),
    statNeeded: document.getElementById("stat-needed"),
    statGoal: document.getElementById("stat-goal"),
    formMsg: document.getElementById("form-msg"),
    mouth: document.querySelector(".mouth"),
    earnWarning: document.getElementById("earn-warning"),
    earnWarningTitle: document.getElementById("earn-warning-title"),
    earnWarningSecs: document.getElementById("earn-warning-secs"),
  };

  let actionBusy = false;
  let actionTimer = null;
  let lastMood = "";
  let baseMood = "";
  let pleadLevel = 0; // 0 none, 1 soft, 2 hard
  let previousPleadLevel = -1;
  let warnHideTimer = null;
  let warnTickTimer = null;
  let warnVisible = false;

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

  function uid() {
    return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeEntries(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        const amount = Number(item && item.amount);
        const source = typeof (item && item.source) === "string" ? item.source.trim().slice(0, 40) : "";
        if (!(amount > 0) || !source) return null;
        return {
          id: typeof (item && item.id) === "string" ? item.id : uid(),
          amount,
          source,
          at: typeof (item && item.at) === "string" ? item.at : new Date().toISOString(),
        };
      })
      .filter(Boolean);
  }

  function sumEntries(list) {
    return list.reduce((total, item) => total + item.amount, 0);
  }

  function todayLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function defaultDeadlineISO() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function normalizeDeadline(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
  }

  function parseLocalDate(iso) {
    const parts = iso.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function daysUntil(iso) {
    const target = parseLocalDate(iso);
    if (!target) return null;
    const start = parseLocalDate(todayLocalISO());
    const ms = target.getTime() - start.getTime();
    return Math.round(ms / 86400000);
  }

  function formatDeadlineLabel(iso) {
    const date = parseLocalDate(iso);
    if (!date) return "—";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function deadlineStatus(iso, progress) {
    if (!iso) {
      return {
        text: "No deadline set",
        short: "—",
        tone: "",
        mood: null,
      };
    }
    const days = daysUntil(iso);
    const label = formatDeadlineLabel(iso);
    if (progress >= 1) {
      return {
        text: `Goal met · was due ${label}`,
        short: label,
        tone: "done",
        mood: null,
        days,
      };
    }
    if (days === null) {
      return { text: label, short: label, tone: "", mood: null, days };
    }
    if (days < 0) {
      const late = Math.abs(days);
      return {
        text: `Deadline passed · ${late} day${late === 1 ? "" : "s"} overdue`,
        short: `${late}d late`,
        tone: "missed",
        mood: "Deadline slipped — let's catch up and grow again.",
        days,
      };
    }
    if (days === 0) {
      return {
        text: `Due today · ${label}`,
        short: "Due today",
        tone: "urgent",
        mood: "Today's the day — push for that last bit of savings!",
        days,
      };
    }
    if (days <= 7) {
      return {
        text: `${days} day${days === 1 ? "" : "s"} left · ${label}`,
        short: `${days}d left`,
        tone: "urgent",
        mood: "Deadline is close — every dollar counts right now.",
        days,
      };
    }
    if (days <= 21) {
      return {
        text: `${days} days left · ${label}`,
        short: `${days}d left`,
        tone: "warn",
        mood: "Clock's ticking — keep feeding those savings.",
        days,
      };
    }
    return {
      text: `${days} days left · ${label}`,
      short: `${days}d left`,
      tone: "",
      mood: null,
      days,
    };
  }

  function migrateLegacy(parsed) {
    const income = [];
    const spend = [];
    const have = Number(parsed.have);
    const spent = Number(parsed.spend);
    if (have > 0) {
      income.push({ id: uid(), amount: have, source: "Starting balance", at: new Date().toISOString() });
    }
    if (spent > 0) {
      spend.push({ id: uid(), amount: spent, source: "Earlier spending", at: new Date().toISOString() });
    }
    return {
      goal: Number(parsed.goal) >= 0 ? Number(parsed.goal) : DEFAULTS.goal,
      deadline: normalizeDeadline(parsed.deadline) || defaultDeadlineISO(),
      petName:
        typeof parsed.petName === "string" && parsed.petName.trim()
          ? parsed.petName.trim().slice(0, 24)
          : DEFAULTS.petName,
      income,
      spend,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          goal: Number(parsed.goal) >= 0 ? Number(parsed.goal) : DEFAULTS.goal,
          deadline: normalizeDeadline(parsed.deadline) || defaultDeadlineISO(),
          petName:
            typeof parsed.petName === "string" && parsed.petName.trim()
              ? parsed.petName.trim().slice(0, 24)
              : DEFAULTS.petName,
          income: normalizeEntries(parsed.income),
          spend: normalizeEntries(parsed.spend),
        };
      }

      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const migrated = migrateLegacy(JSON.parse(legacyRaw));
        saveState(migrated);
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    } catch {
      /* fall through */
    }
    return {
      goal: DEFAULTS.goal,
      deadline: defaultDeadlineISO(),
      petName: DEFAULTS.petName,
      income: [],
      spend: [],
    };
  }

  function saveState(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function hoursSinceLastIncome(income) {
    if (!income || income.length === 0) return Infinity;
    let latest = 0;
    income.forEach((entry) => {
      const t = Date.parse(entry.at);
      if (Number.isFinite(t) && t > latest) latest = t;
    });
    if (!latest) return Infinity;
    return (Date.now() - latest) / 3600000;
  }

  function incomeHunger(income) {
    const hours = hoursSinceLastIncome(income);
    if (!Number.isFinite(hours) || hours >= PLEAD_HARD_HOURS) {
      const days = Math.floor(hours / 24);
      return {
        level: 2,
        hours,
        mood:
          income.length === 0
            ? "I haven't eaten a single dollar… please log some income!"
            : `It's been ${days >= 1 ? `${days}+ day${days === 1 ? "" : "s"}` : "ages"} with no earnings — I'm pleading!`,
      };
    }
    if (hours >= PLEAD_AFTER_HOURS) {
      const hrs = Math.floor(hours);
      return {
        level: 1,
        hours,
        mood: `No income for ~${hrs} hours… pretty please earn something?`,
      };
    }
    return { level: 0, hours, mood: null };
  }

  function compute(current) {
    const goal = Math.max(0, current.goal);
    const have = sumEntries(current.income);
    const spend = sumEntries(current.spend);
    const kept = Math.max(0, have - spend);
    const progress = goal > 0 ? clamp(kept / goal, 0, 1) : 0;
    const spendRatio = have > 0 ? clamp(spend / have, 0, 1) : spend > 0 ? 1 : 0;
    let energy = clamp(progress * (1 - spendRatio * 0.35) + progress * 0.15, 0, 1);
    const hunger = incomeHunger(current.income);
    if (hunger.level === 1) energy = clamp(energy * 0.7, 0, 1);
    if (hunger.level === 2) energy = clamp(energy * 0.4, 0, 1);
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
      hunger,
    };
  }

  function showMessage(text, isError) {
    els.formMsg.hidden = !text;
    els.formMsg.textContent = text || "";
    els.formMsg.classList.toggle("error", Boolean(isError));
  }

  function fillSettings(current) {
    els.goal.value = current.goal === 0 ? "" : String(current.goal);
    const deadline = current.deadline || defaultDeadlineISO();
    els.deadline.value = deadline;
    // Allow showing an overdue saved deadline; otherwise don't pick days in the past.
    els.deadline.min = deadline < todayLocalISO() ? deadline : todayLocalISO();
    els.petNameInput.value = current.petName;
  }

  function renderEntryList(listEl, entries, kind) {
    listEl.innerHTML = "";

    entries
      .slice()
      .reverse()
      .forEach((entry) => {
        const li = document.createElement("li");
        li.className = `entry-row ${kind}`;
        li.dataset.id = entry.id;

        const main = document.createElement("div");
        main.className = "entry-main";

        const source = document.createElement("span");
        source.className = "entry-source";
        source.textContent = entry.source;

        const amount = document.createElement("strong");
        amount.className = "entry-amount";
        amount.textContent = money(entry.amount);

        main.appendChild(source);
        main.appendChild(amount);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "entry-remove";
        remove.dataset.id = entry.id;
        remove.dataset.kind = kind;
        remove.setAttribute("aria-label", `Remove ${entry.source}`);
        remove.textContent = "Remove";

        li.appendChild(main);
        li.appendChild(remove);
        listEl.appendChild(li);
      });
  }

  function render(current) {
    const view = compute(current);
    const pct = Math.round(view.progress * 100);
    const energyPct = Math.round(view.energy * 100);

    const due = deadlineStatus(current.deadline, view.progress);
    pleadLevel = view.hunger.level;

    els.petName.textContent = current.petName || "Sunny";
    baseMood =
      view.hunger.mood
        ? view.hunger.mood
        : view.kept <= 0 && view.have === 0
          ? "Waiting for your first save…"
          : view.progress >= 1
            ? "Goal reached! I'm bursting with pride."
            : due.mood || view.stage.mood;
    if (!actionBusy) {
      els.petMood.textContent = baseMood;
      lastMood = baseMood;
    }
    els.petMood.classList.toggle("is-pleading", pleadLevel > 0);

    els.petBody.classList.toggle("is-pleading", pleadLevel === 1);
    els.petBody.classList.toggle("is-pleading-hard", pleadLevel === 2);

    // Big on-screen warning when the pet starts (or escalates) pleading
    if (pleadLevel > 0 && pleadLevel > previousPleadLevel) {
      showEarnWarning(pleadLevel);
    } else if (pleadLevel === 0 && previousPleadLevel > 0) {
      hideEarnWarning();
    }
    previousPleadLevel = pleadLevel;

    if (els.deadlineBadge) {
      els.deadlineBadge.hidden = false;
      els.deadlineBadge.textContent = due.text;
      els.deadlineBadge.className = `deadline-badge${due.tone ? ` ${due.tone}` : ""}`;
    }
    if (els.statDeadline) {
      els.statDeadline.textContent = due.short;
    }

    for (let i = 0; i <= 4; i += 1) {
      els.petBody.classList.toggle(`stage-${i}`, i === view.stageIndex);
    }

    els.energyAura.dataset.level = String(view.stageIndex);

    els.progressFill.style.width = `${pct}%`;
    els.progressLabel.textContent = `${pct}%`;
    els.progressBar.setAttribute("aria-valuenow", String(pct));

    els.energyFill.style.width = `${energyPct}%`;
    els.energyLabel.textContent = `${energyPct}%`;
    els.energyBar.setAttribute("aria-valuenow", String(energyPct));

    els.stageBadge.textContent = `Stage ${view.stageIndex + 1} · ${view.stage.name}`;

    els.statIncome.textContent = money(view.have);
    els.statSpent.textContent = money(view.spend);
    els.statKept.textContent = money(view.kept);
    els.statNeeded.textContent = money(view.needed);
    els.statGoal.textContent = money(view.goal);

    renderEntryList(els.incomeList, current.income, "income");
    renderEntryList(els.spendList, current.spend, "spend");

    if (els.mouth) {
      if (pleadLevel >= 2) {
        els.mouth.setAttribute("d", "M145 210 Q160 198 175 210");
      } else if (pleadLevel === 1) {
        els.mouth.setAttribute("d", "M148 208 Q160 200 172 208");
      } else if (view.progress >= 0.9) {
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

  function readSettings() {
    const goal = Number(els.goal.value);
    const deadline = normalizeDeadline(els.deadline.value);
    const petName = (els.petNameInput.value || "").trim().slice(0, 24) || DEFAULTS.petName;
    if (!Number.isFinite(goal) || goal <= 0) {
      return { error: "Enter a goal." };
    }
    if (!deadline) {
      return { error: "Pick a deadline." };
    }
    return { goal, deadline, petName };
  }

  function readEntry(amountEl, sourceEl, label) {
    const amount = Number(amountEl.value);
    const source = (sourceEl.value || "").trim().slice(0, 40);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Enter an amount." };
    }
    if (!source) {
      return { error: label === "income" ? "Enter a source." : "Enter a category." };
    }
    return {
      entry: {
        id: uid(),
        amount,
        source,
        at: new Date().toISOString(),
      },
    };
  }

  function hideEarnWarning() {
    if (warnHideTimer) {
      window.clearTimeout(warnHideTimer);
      warnHideTimer = null;
    }
    if (warnTickTimer) {
      window.clearInterval(warnTickTimer);
      warnTickTimer = null;
    }
    warnVisible = false;
    if (els.earnWarning) els.earnWarning.hidden = true;
  }

  function showEarnWarning(level) {
    if (!els.earnWarning) return;
    hideEarnWarning();
    warnVisible = true;

    if (els.earnWarningTitle) {
      els.earnWarningTitle.textContent = level >= 2 ? "Earn money now!" : "Earn money!";
    }
    if (els.earnWarningSecs) els.earnWarningSecs.textContent = "7";

    els.earnWarning.hidden = false;

    let remaining = 7;
    warnTickTimer = window.setInterval(() => {
      remaining -= 1;
      if (els.earnWarningSecs) {
        els.earnWarningSecs.textContent = String(Math.max(0, remaining));
      }
      if (remaining <= 0 && warnTickTimer) {
        window.clearInterval(warnTickTimer);
        warnTickTimer = null;
      }
    }, 1000);

    warnHideTimer = window.setTimeout(() => {
      hideEarnWarning();
    }, 7000);
  }

  function clearActionClasses() {
    if (!els.petMover) return;
    ACTIONS.forEach((action) => els.petMover.classList.remove(action.cls));
  }

  function playRandomAction() {
    if (!els.petMover || actionBusy) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pool = pleadLevel > 0 ? PLEAD_ACTIONS : ACTIONS;
    const action = pool[Math.floor(Math.random() * pool.length)];
    actionBusy = true;
    clearActionClasses();
    void els.petMover.offsetWidth;
    els.petMover.classList.add(action.cls);
    els.petMood.textContent = action.line;
    lastMood = action.line;

    window.setTimeout(() => {
      clearActionClasses();
      actionBusy = false;
      els.petMood.textContent = baseMood || lastMood;
    }, action.ms);
  }

  function scheduleNextAction() {
    if (actionTimer) window.clearTimeout(actionTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const energyPct = Number(els.energyBar?.getAttribute("aria-valuenow") || 0);
    // Plead more often when hungry for income
    const minGap =
      pleadLevel >= 2 ? 1600 : pleadLevel === 1 ? 2000 : energyPct >= 65 ? 2200 : energyPct >= 30 ? 3200 : 4200;
    const maxGap =
      pleadLevel >= 2 ? 3600 : pleadLevel === 1 ? 4800 : energyPct >= 65 ? 5200 : energyPct >= 30 ? 7000 : 9000;
    const delay = minGap + Math.random() * (maxGap - minGap);
    actionTimer = window.setTimeout(() => {
      playRandomAction();
      scheduleNextAction();
    }, delay);
  }

  let state = loadState();
  fillSettings(state);
  render(state);
  scheduleNextAction();

  if (els.petMover) {
    els.petMover.style.cursor = "pointer";
    els.petMover.addEventListener("click", () => {
      playRandomAction();
    });
  }

  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = readSettings();
    if (result.error) {
      showMessage(result.error, true);
      return;
    }
    state = { ...state, goal: result.goal, deadline: result.deadline, petName: result.petName };
    saveState(state);
    render(state);
    showMessage("", false);
  });

  els.incomeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = readEntry(els.incomeAmount, els.incomeSource, "income");
    if (result.error) {
      showMessage(result.error, true);
      return;
    }
    state = { ...state, income: [...state.income, result.entry] };
    saveState(state);
    render(state);
    els.incomeForm.reset();
    els.incomeAmount.focus();
    showMessage("", false);
  });

  els.spendForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = readEntry(els.spendAmount, els.spendSource, "spending");
    if (result.error) {
      showMessage(result.error, true);
      return;
    }
    state = { ...state, spend: [...state.spend, result.entry] };
    saveState(state);
    render(state);
    els.spendForm.reset();
    els.spendAmount.focus();
    showMessage("", false);
  });

  function onRemoveClick(event) {
    const btn = event.target.closest(".entry-remove");
    if (!btn) return;
    const { id, kind } = btn.dataset;
    if (!id || !kind) return;
    if (kind === "income") {
      state = { ...state, income: state.income.filter((item) => item.id !== id) };
    } else {
      state = { ...state, spend: state.spend.filter((item) => item.id !== id) };
    }
    saveState(state);
    render(state);
    showMessage("", false);
  }

  els.incomeList.addEventListener("click", onRemoveClick);
  els.spendList.addEventListener("click", onRemoveClick);

  function previewFromSettings() {
    const goal = Number(els.goal.value);
    const deadline = normalizeDeadline(els.deadline.value);
    render({
      ...state,
      goal: Number.isFinite(goal) && goal > 0 ? goal : state.goal,
      deadline: deadline || state.deadline,
      petName: (els.petNameInput.value || "").trim().slice(0, 24) || state.petName,
    });
  }

  els.goal.addEventListener("input", previewFromSettings);
  els.deadline.addEventListener("change", previewFromSettings);
  els.deadline.addEventListener("input", previewFromSettings);

  els.petNameInput.addEventListener("input", previewFromSettings);

  els.resetBtn.addEventListener("click", () => {
    if (!window.confirm("Reset Budget Buddy? This clears saved data in this browser.")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    state = {
      goal: DEFAULTS.goal,
      deadline: defaultDeadlineISO(),
      petName: DEFAULTS.petName,
      income: [],
      spend: [],
    };
    fillSettings(state);
    render(state);
    showMessage("", false);
  });
})();
