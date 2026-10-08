import { getRole, ROLE_DEFINITIONS } from "./roles.js";

export function h(strings, ...values) {
  return strings.reduce((out, part, index) => out + part + (values[index] ?? ""), "");
}

export function render(app, html) {
  app.innerHTML = html;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function button(label, action, extra = "") {
  return `<button class="btn ${extra}" data-action="${action}" type="button">${label}</button>`;
}

export function smallButton(label, action, extra = "") {
  return `<button class="btn small ${extra}" data-action="${action}" type="button">${label}</button>`;
}

export function holdRevealButton(label = "長押しでカードを見る") {
  return `<button class="btn hold primary" data-hold-reveal="true" type="button">${label}</button>`;
}

export function page(title, body, footer = "") {
  return `
    <section class="page">
      <header class="top">
        <div class="badge">2 PLAYER MIND CARD</div>
        <h1>${title}</h1>
      </header>
      ${body}
      ${footer ? `<footer class="footer">${footer}</footer>` : ""}
    </section>
  `;
}

export function roleCard(roleId, options = {}) {
  const role = getRole(roleId);
  if (!role) return `<article class="role-card"><h3>不明なカード</h3></article>`;
  return `
    <article class="role-card" style="--role-color:${role.color}">
      ${roleImage(role.id)}
      <div class="role-info">
        <h3>${role.name}</h3>
        <p>${role.ability.text}</p>
        ${options.showCamp ? `<span class="pill">${campName(role.camp)}</span>` : ""}
      </div>
    </article>
  `;
}

export function roleImage(roleId, className = "") {
  const role = getRole(roleId);
  if (!role) return `<div class="role-art ${className}"><strong>不明</strong></div>`;
  const nameClass = role.name.length >= 5 ? " role-name-long" : "";
  return `
    <div class="role-art ${className}" aria-label="${escapeHtml(role.name)}">
      <span class="role-sigil role-${role.icon}" aria-hidden="true"></span>
      <span class="role-code">${escapeHtml(role.id.split("_").map((part) => part[0]).join("").toUpperCase())}</span>
      <strong class="role-art-label${nameClass}">${escapeHtml(role.name)}</strong>
    </div>
  `;
}

export function roleToggleList(selectedRoleIds) {
  return ROLE_DEFINITIONS.map((role) => `
    <label class="toggle-card" style="--role-color:${role.color}">
      <input type="checkbox" name="role" value="${role.id}" ${selectedRoleIds.includes(role.id) ? "checked" : ""}>
      ${roleImage(role.id, "toggle-role-art")}
      <span>
        <strong>${role.name}</strong>
        <small>${role.ability.text}</small>
      </span>
    </label>
  `).join("");
}

export function choiceName(choice) {
  return choice === "handshake" ? "協定" : choice === "protect" ? "警戒" : "未選択";
}

export function actionCard(choice, className = "") {
  const kind = choice === "handshake" ? "handshake" : "protect";
  return `
    <span class="choice-art action-${kind} ${className}">
      <span class="action-mark" aria-hidden="true">${kind === "handshake" ? "LINK" : "GUARD"}</span>
      <strong class="action-label">${choiceName(choice)}</strong>
    </span>
  `;
}

function campName(camp) {
  return camp === "werewolf" ? "シャドウ側" : "ライト側";
}

export function playerLabel(names, playerId) {
  return names?.[playerId] || (playerId === "p1" ? "プレイヤー1" : "プレイヤー2");
}

export function tablePicker(round, maxCount, selected = []) {
  return `
    <div class="table-cards">
      ${round.table.map((card) => `
        <label class="field-card">
          <input type="${maxCount === 1 ? "radio" : "checkbox"}" name="tableIndex" value="${card.index}" ${selected.includes(card.index) ? "checked" : ""}>
          <span>
            <i>?</i>
            <b>場のカード ${card.index + 1}</b>
          </span>
        </label>
      `).join("")}
    </div>
  `;
}

export function revealedPeek(log) {
  const peeks = (log || []).filter((item) => item.type === "peek");
  if (!peeks.length) return `<p class="muted">見たカードはありません。</p>`;
  return `
    <div class="peek-results">
      ${peeks.map((item) => {
        const role = getRole(item.roleId);
        return `
          <article class="peek-card">
            <small>場のカード ${Number(item.index) + 1}</small>
            ${roleImage(item.roleId, "peek-role-art")}
            ${role ? `<span class="pill">${campName(role.camp)}</span>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

export function toast(text) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = text;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
