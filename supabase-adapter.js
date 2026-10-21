/* Money Penny – Supabase adapter
 *
 * Gives the app the same small database interface it used inside Claude
 * (collection().doc().set() / delete() / onSnapshot(), doc("round/main"),
 * orderBy().limit()), backed by one Supabase table: public.mp_docs.
 * Sign-in is by email and password; access is limited to emails listed in public.mp_members.
 */
(function () {
  const cfg = window.MP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    window.mpSupabaseDb = null; // app falls back to saving in this browser only
    return;
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const TABLE = "mp_docs";
  let userEmail = "";

  /* ---------- errors → codes the app already understands ---------- */
  function mapErr(e) {
    const msg = String((e && (e.message || e.error_description)) || e || "");
    if ((e && e.code === "42501") || /row-level security|permission denied/i.test(msg)) return { code: "invalid_argument", message: msg };
    if (/Failed to fetch|NetworkError|network|timeout/i.test(msg)) return { code: "unavailable", message: msg };
    if (/too many|rate limit/i.test(msg)) return { code: "resource_exhausted", message: msg };
    return { code: "unknown", message: msg };
  }

  /* ---------- local cache + listeners ---------- */
  const cache = {};      // collection -> Map(id -> data)
  const loading = {};    // collection -> Promise
  const listeners = {};  // collection -> Set(fn)

  async function fetchCol(col) {
    const map = new Map();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(TABLE).select("id,data").eq("collection", col).range(from, from + PAGE - 1);
      if (error) throw mapErr(error);
      data.forEach(r => map.set(r.id, r.data || {}));
      if (data.length < PAGE) break;
    }
    cache[col] = map;
    return map;
  }
  function ensure(col) {
    if (!loading[col]) loading[col] = fetchCol(col).catch(e => { delete loading[col]; throw e; });
    return loading[col];
  }
  function emit(col) { (listeners[col] || []).forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  function listen(col, fn) {
    (listeners[col] = listeners[col] || new Set()).add(fn);
    return () => listeners[col].delete(fn);
  }
  async function refreshAll() {
    for (const col of Object.keys(cache)) {
      try { await fetchCol(col); emit(col); } catch (e) { console.warn("Refresh failed", col, e); }
    }
  }

  /* ---------- live updates ---------- */
  let channel = null, subscribedOnce = false;
  function subscribe() {
    channel = sb.channel("mp_docs_live")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, p => {
        const rec = p.eventType === "DELETE" ? p.old : p.new;
        if (!rec || !rec.collection || !cache[rec.collection]) return;
        if (p.eventType === "DELETE") cache[rec.collection].delete(rec.id);
        else cache[rec.collection].set(rec.id, rec.data || {});
        emit(rec.collection);
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          if (subscribedOnce) refreshAll(); // catch up on anything missed while disconnected
          subscribedOnce = true;
        }
      });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshAll(); });
  window.addEventListener("online", refreshAll);

  /* ---------- Firestore-style interface ---------- */
  function docRef(col, id) {
    return {
      async set(data) {
        if (!cache[col]) cache[col] = new Map();
        cache[col].set(id, data);
        const { error } = await sb.from(TABLE).upsert({
          collection: col, id, data, updated_at: new Date().toISOString(), updated_by: userEmail
        });
        if (error) throw mapErr(error);
      },
      async delete() {
        if (cache[col]) cache[col].delete(id);
        const { error } = await sb.from(TABLE).delete().eq("collection", col).eq("id", id);
        if (error) throw mapErr(error);
      },
      onSnapshot(cb, errCb) {
        const fire = () => {
          const d = cache[col] && cache[col].get(id);
          cb({ id, exists: d !== undefined, data: () => d });
        };
        const off = listen(col, fire);
        ensure(col).then(fire).catch(e => errCb && errCb(e));
        return off;
      }
    };
  }

  function query(col, order, lim) {
    return {
      doc: id => docRef(col, id),
      orderBy: (field, dir) => query(col, { field, dir: dir === "desc" ? -1 : 1 }, lim),
      limit: n => query(col, order, n),
      onSnapshot(cb, errCb) {
        const fire = () => {
          let docs = [...(cache[col] || new Map()).entries()].map(([id, d]) => ({ id, data: () => d, _d: d }));
          if (order) docs.sort((a, b) => {
            const x = a._d[order.field], y = b._d[order.field];
            return (x === y ? 0 : x == null ? -1 : y == null ? 1 : x < y ? -1 : 1) * order.dir;
          });
          if (lim) docs = docs.slice(0, lim);
          cb({ docs });
        };
        const off = listen(col, fire);
        ensure(col).then(fire).catch(e => errCb && errCb(e));
        return off;
      }
    };
  }

  const db = {
    collection: col => query(col),
    doc: path => { const [col, id] = String(path).split("/"); return docRef(col, id); }
  };

  /* ---------- sign-in screen ---------- */
  const css = `
  .mp-auth{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:var(--bg,#0F1C24)}
  .mp-auth-box{width:100%;max-width:380px;background:var(--surface,#132430);border:1px solid var(--line,#22384A);border-radius:16px;padding:28px 24px;box-shadow:var(--shadow)}
  .mp-auth h2{margin:0 0 4px;font-size:22px;font-weight:800;color:var(--ink,#fff)}
  .mp-auth p{margin:0 0 18px;color:var(--soft,#C9D3D8);font-size:14px}
  .mp-auth label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text)}
  .mp-auth input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line,#22384A);background:var(--bg,#0F1C24);color:var(--text,#fff);font-size:16px}
  .mp-auth button{width:100%;margin-top:14px;padding:11px;border-radius:10px;border:0;background:var(--accent,#9BF9C2);color:var(--accent-ink,#0F1C24);font-weight:700;cursor:pointer}
  .mp-auth button:disabled{opacity:.6;cursor:default}
  .mp-auth .err{color:var(--danger,#FF8F85);font-size:13px;margin-top:10px;min-height:1em}
  .mp-account{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;color:var(--muted);font-size:12.5px;padding:4px 0 28px}
  .mp-account button{background:none;border:0;color:var(--teal);cursor:pointer;font-size:12.5px;padding:0;text-decoration:underline}`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  function overlay(html) {
    let el = document.querySelector(".mp-auth");
    if (!el) { el = document.createElement("div"); el.className = "mp-auth"; document.body.appendChild(el); }
    el.innerHTML = `<div class="mp-auth-box">${html}</div>`;
    return el;
  }
  function closeOverlay() { const el = document.querySelector(".mp-auth"); if (el) el.remove(); }

  function askLogin() {
    return new Promise(resolve => {
      const el = overlay(`
        <h2>Money Penny</h2>
        <p>Sign in with your email and password.</p>
        <form data-f>
          <label for="mp-email">Email</label>
          <input id="mp-email" type="email" autocomplete="username" required autofocus>
          <label for="mp-pass" style="margin-top:12px">Password</label>
          <input id="mp-pass" type="password" autocomplete="current-password" required>
          <button type="submit">Sign in</button>
          <div class="err" role="alert"></div>
        </form>`);
      el.querySelector("[data-f]").addEventListener("submit", async ev => {
        ev.preventDefault();
        const email = el.querySelector("#mp-email").value.trim().toLowerCase();
        const password = el.querySelector("#mp-pass").value;
        const btn = el.querySelector("button"), err = el.querySelector(".err");
        btn.disabled = true; err.textContent = "";
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        if (error || !data.session) {
          err.textContent = /invalid/i.test((error && error.message) || "")
            ? "Email or password is wrong. Check both and try again."
            : "Couldn't sign in. Check your connection and try again.";
          return;
        }
        resolve(data.session);
      });
    });
  }

  async function signIn() {
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session;
    return askLogin();
  }

  async function isMember(email) {
    const { data, error } = await sb.from("mp_members").select("email").eq("email", email).limit(1);
    if (error) throw mapErr(error);
    return data.length > 0;
  }

  function showAccount(email) {
    const bar = document.createElement("div");
    bar.className = "mp-account wrap";
    bar.innerHTML = `<span>Signed in as ${email.replace(/[<>&"]/g, "")}</span><button type="button">Sign out</button>`;
    bar.querySelector("button").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
    const foot = document.getElementById("foot");
    if (foot && foot.parentNode) foot.parentNode.insertBefore(bar, foot.nextSibling); else document.body.appendChild(bar);
  }

  /* Called by the app's boot(): resolves to the db once the person is signed in. */
  window.mpSupabaseDb = async function () {
    const session = await signIn();
    userEmail = (session.user.email || "").toLowerCase();
    let ok = false;
    try { ok = await isMember(userEmail); } catch (e) { ok = false; }
    if (!ok) {
      const el = overlay(`
        <h2>No access yet</h2>
        <p>${userEmail.replace(/[<>&"]/g, "")} isn't on the list of people who can open this tracker. Ask the owner to add you.</p>
        <button type="button" data-out>Sign in with another email</button>`);
      el.querySelector("[data-out]").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
      return new Promise(() => {}); // stay on this screen
    }
    closeOverlay();
    showAccount(userEmail);
    subscribe();
    return db;
  };
})();
