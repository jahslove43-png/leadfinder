const SUPABASE_URL = "https://tgvjbcbgxyhybmgxtdhd.supabase.co";
const SUPABASE_KEY = ["sb_publishable","_X_tTXVFCI","-dwB2LKchp2yQ","_oO727tNt"].join("");
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
let signup = false;
let campaigns = [];

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
const csv = (value) => Array.isArray(value) ? value.join(", ") : "";
const date = (value) => value ? new Date(value).toLocaleString() : "—";
const toast = (value) => {
  const el = $("toast");
  el.textContent = value;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
};
const message = (id, value) => { $(id).textContent = value || ""; };

function signedIn(session) {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userEmail").textContent = session.user.email || "";
}
function signedOut() {
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}

$("toggleAuth").onclick = () => {
  signup = !signup;
  $("authTitle").textContent = signup ? "Create your LeadFinder account" : "Find businesses that need a website";
  $("authSubtitle").textContent = signup ? "Start building campaigns and collecting leads." : "Create an account to build campaigns and collect qualified leads.";
  $("authButton").textContent = signup ? "Create account" : "Sign in";
  $("toggleAuth").textContent = signup ? "Already have an account? Sign in" : "Create an account";
  $("nameLabel").classList.toggle("hidden", !signup);
  message("authMessage", "");
};

$("authForm").onsubmit = async (event) => {
  event.preventDefault();
  message("authMessage", "");
  const email = $("email").value.trim();
  const password = $("password").value;
  const result = signup
    ? await db.auth.signUp({ email, password, options: { data: { full_name: $("fullName").value.trim() } } })
    : await db.auth.signInWithPassword({ email, password });
  if (result.error) return message("authMessage", result.error.message);
  if (signup && !result.data.session) message("authMessage", "Account created. Check your email if confirmation is enabled.");
};

$("logoutButton").onclick = () => db.auth.signOut();
$("newCampaignButton").onclick = () => {
  $("campaignPanel").classList.remove("hidden");
  $("campaignName").focus();
};
$("closeCampaign").onclick = $("cancelCampaign").onclick = () => $("campaignPanel").classList.add("hidden");
$("refreshButton").onclick = load;

$("campaignForm").onsubmit = async (event) => {
  event.preventDefault();
  message("campaignMessage", "");
  const split = (id) => $(id).value.split(",").map((x) => x.trim()).filter(Boolean);
  const params = {
    p_name: $("campaignName").value.trim(),
    p_categories: split("categories"),
    p_keywords: split("keywords"),
    p_countries: split("countries"),
    p_regions: split("regions"),
    p_cities: split("cities"),
    p_worldwide: $("worldwide").checked,
    p_daily_target: Number($("dailyTarget").value) || 1000,
    p_scan_time: $("scanTime").value || "06:00",
    p_timezone: $("timezone").value || "Africa/Lagos",
    p_notification_email: $("notificationEmail").value.trim() || null
  };
  const result = await db.rpc("create_leadfinder_campaign", params);
  if (result.error) return message("campaignMessage", result.error.message);
  $("campaignPanel").classList.add("hidden");
  $("campaignForm").reset();
  $("dailyTarget").value = 1000;
  $("scanTime").value = "06:00";
  $("timezone").value = "Africa/Lagos";
  toast("Campaign created");
  load();
};

async function load() {
  const userResult = await db.auth.getUser();
  if (!userResult.data.user) return;
  const userId = userResult.data.user.id;
  const [campaignResult, leadResult, scanResult, exportResult] = await Promise.all([
    db.from("campaigns").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("leads").select("*,businesses(*)").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    db.from("scans").select("*,campaigns(name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    db.from("csv_exports").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30)
  ]);
  campaigns = campaignResult.data || [];
  const leads = leadResult.data || [];
  const scans = scanResult.data || [];
  const exports = exportResult.data || [];
  $("metricCampaigns").textContent = campaigns.length;
  $("metricLeads").textContent = leads.length;
  $("metricNoWebsite").textContent = leads.filter((x) => x.businesses?.website_status === "NO_WEBSITE_FOUND").length;
  $("metricScans").textContent = scans.length;
  renderCampaigns();
  renderLeads(leads);
  renderScans(scans);
  renderExports(exports);
}

function renderCampaigns() {
  const el = $("campaignList");
  if (!campaigns.length) {
    el.className = "list empty";
    el.textContent = "No campaigns yet.";
    return;
  }
  el.className = "list";
  el.innerHTML = campaigns.map((campaign) => {
    const location = campaign.worldwide ? "Worldwide" : (csv(campaign.countries) || csv(campaign.cities) || "Selected locations");
    return '<div class="campaign-item"><div><b>' + esc(campaign.name) + '</b> <span class="status">' + (campaign.active ? "ACTIVE" : "PAUSED") + '</span><p>' + esc(csv(campaign.categories) || "All categories") + ' · ' + esc(location) + ' · Target ' + campaign.daily_target + '/day</p></div><div class="campaign-actions"><button class="ghost" onclick="runScan(\'' + campaign.id + '\')">Run scan</button><button class="ghost" onclick="toggleCampaign(\'' + campaign.id + '\',' + (!campaign.active) + ')">' + (campaign.active ? "Pause" : "Activate") + '</button></div></div>';
  }).join("");
}

function renderLeads(leads) {
  $("leadTable").innerHTML = leads.length ? leads.map((lead) => {
    const business = lead.businesses || {};
    return '<tr><td><b>' + esc(business.name || "Unknown") + '</b><br><span class="muted">' + esc(business.category || "") + '</span></td><td>' + esc([business.city, business.state, business.country].filter(Boolean).join(", ")) + '</td><td><span class="badge">' + esc(business.website_status || "NEEDS_VERIFICATION") + '</span></td><td>' + (lead.lead_score ?? "—") + '</td><td><span class="badge">' + esc(lead.status || "NEW") + '</span></td></tr>';
  }).join("") : '<tr><td colspan="5" class="empty">No leads yet.</td></tr>';
}

function renderScans(scans) {
  $("scanTable").innerHTML = scans.length ? scans.map((scan) => '<tr><td>' + date(scan.created_at) + '</td><td>' + esc(scan.campaigns?.name || "—") + '</td><td><span class="status">' + esc(scan.status) + '</span></td><td>' + (scan.discovered_count ?? 0) + '</td><td>' + (scan.no_website_count ?? 0) + '</td></tr>').join("") : '<tr><td colspan="5" class="empty">No scans yet.</td></tr>';
}

function renderExports(exports) {
  const el = $("exportList");
  if (!exports.length) {
    el.className = "list empty";
    el.textContent = "No exports yet.";
    return;
  }
  el.className = "list";
  el.innerHTML = exports.map((item) => '<div class="campaign-item"><div><b>' + esc(item.file_name) + '</b><p>' + (item.row_count || 0) + ' rows · ' + date(item.created_at) + '</p></div><button class="ghost" onclick="downloadExport(\'' + item.id + '\')">Download CSV</button></div>').join("");
}

async function toggleCampaign(id, active) {
  const result = await db.from("campaigns").update({ active }).eq("id", id);
  if (result.error) return toast(result.error.message);
  toast(active ? "Campaign activated" : "Campaign paused");
  load();
}

async function runScan(id) {
  const result = await db.functions.invoke("run-business-scan", { body: { campaign_id: id } });
  if (result.error) return toast(result.error.message || "Scan failed");
  toast(result.data?.message || "Scan started");
  load();
}

async function downloadExport(id) {
  const result = await db.from("csv_exports").select("storage_path").eq("id", id).single();
  if (result.error) return toast(result.error.message);
  const signed = await db.storage.from("leadfinder-exports").createSignedUrl(result.data.storage_path, 300);
  if (signed.error) return toast(signed.error.message);
  window.location.href = signed.data.signedUrl;
}

window.toggleCampaign = toggleCampaign;
window.runScan = runScan;
window.downloadExport = downloadExport;

(async () => {
  const sessionResult = await db.auth.getSession();
  if (sessionResult.data.session) {
    signedIn(sessionResult.data.session);
    await load();
  } else {
    signedOut();
  }
  db.auth.onAuthStateChange((_event, session) => {
    if (session) {
      signedIn(session);
      load();
    } else {
      signedOut();
    }
  });
})();