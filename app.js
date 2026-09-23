const SUPABASE_URL="https://tgvjbcbgxyhybmgxtdhd.supabase.co";
const SUPABASE_KEY=window.LEADFINDER_SUPABASE_KEY||"YOUR_SUPABASE_PUBLISHABLE_KEY";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let signup=false,campaigns=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&#39;",""":"&quot;","'":"&#39;"}[m]));
const csv=a=>a?.join(", ")||"";
const date=v=>v?new Date(v).toLocaleString():"—";
const toast=x=>{const t=$("toast");t.textContent=x;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)};
const msg=(id,x)=>$(id).textContent=x||"";

function signedIn(s){$("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("userEmail").textContent=s.user.email||""}
function signedOut(){$("authView").classList.remove("hidden");$("appView").classList.add("hidden")}

$("toggleAuth").onclick=()=>{signup=!signup;$("authTitle").textContent=signup?"Create your LeadFinder account":"Find businesses that need a website";$("authSubtitle").textContent=signup?"Start building campaigns and collecting leads.":"Create an account to build campaigns and collect qualified leads.";$("authButton").textContent=signup?"Create account":"Sign in";$("toggleAuth").textContent=signup?"Already have an account? Sign in":"Create an account";$("nameLabel").classList.toggle("hidden",!signup);msg("authMessage","")};

$("authForm").onsubmit=async e=>{
 e.preventDefault();msg("authMessage","");
 const email=$("email").value.trim(),password=$("password").value;
 const r=signup?await db.auth.signUp({email,password,options:{data:{full_name:$("fullName").value.trim()}}}):await db.auth.signInWithPassword({email,password});
 if(r.error)return msg("authMessage",r.error.message);
 if(signup&&!r.data.session)msg("authMessage","Account created. Check your email if confirmation is enabled.");
};

$("logoutButton").onclick=()=>db.auth.signOut();
$("newCampaignButton").onclick=()=>{$("campaignPanel").classList.remove("hidden");$("campaignName").focus()};
$("closeCampaign").onclick=$("cancelCampaign").onclick=()=>$("campaignPanel").classList.add("hidden");
$("refreshButton").onclick=load;

$("campaignForm").onsubmit=async e=>{
 e.preventDefault();msg("campaignMessage","");
 const split=id=>$(id).value.split(",").map(x=>x.trim()).filter(Boolean);
 const p={p_name:$("campaignName").value.trim(),p_categories:split("categories"),p_keywords:split("keywords"),p_countries:split("countries"),p_regions:split("regions"),p_cities:split("cities"),p_worldwide:$("worldwide").checked,p_daily_target:+$("dailyTarget").value||1000,p_scan_time:$("scanTime").value||"06:00",p_timezone:$("timezone").value||"Africa/Lagos",p_notification_email:$("notificationEmail").value.trim()||null};
 const r=await db.rpc("create_leadfinder_campaign",p);
 if(r.error)return msg("campaignMessage",r.error.message);
 $("campaignPanel").classList.add("hidden");$("campaignForm").reset();$("dailyTarget").value=1000;$("scanTime").value="06:00";$("timezone").value="Africa/Lagos";toast("Campaign created");load();
};

async function load(){
 const u=await db.auth.getUser();if(!u.data.user)return;
 const id=u.data.user.id;
 const [c,l,s,x]=await Promise.all([
  db.from("campaigns").select("*").eq("user_id",id).order("created_at",{ascending:false}),
  db.from("leads").select("*,businesses(*)").eq("user_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("scans").select("*,campaigns(name)").eq("user_id",id).order("created_at",{ascending:false}).limit(50),
  db.from("csv_exports").select("*").eq("user_id",id).order("created_at",{ascending:false}).limit(30)
 ]);
 campaigns=c.data||[];const leads=l.data||[],scans=s.data||[],exports=x.data||[];
 $("metricCampaigns").textContent=campaigns.length;$("metricLeads").textContent=leads.length;$("metricNoWebsite").textContent=leads.filter(z=>z.businesses?.website_status==="NO_WEBSITE_FOUND").length;$("metricScans").textContent=scans.length;
 renderCampaigns();renderLeads(leads);renderScans(scans);renderExports(exports);
}

function renderCampaigns(){
 const el=$("campaignList");
 if(!campaigns.length){el.className="list empty";el.textContent="No campaigns yet.";return}
 el.className="list";
 el.innerHTML=campaigns.map(c=>'<div class="campaign-item"><div><b>'+esc(c.name)+'</b> <span class="status">'+(c.active?"ACTIVE":"PAUSED")+'</span><p>'+esc(csv(c.categories)||"All categories")+' · '+(c.worldwide?"Worldwide":esc(csv(c.countries)||csv(c.cities)||"Selected locations"))+' · Target '+c.daily_target+'/day</p></div><div class="campaign-actions"><button class="ghost" onclick="runScan(\''+c.id+'\')">Run scan</button><button class="ghost" onclick="toggleCampaign(\''+c.id+'\','+(!c.active)+')">'+(c.active?"Pause":"Activate")+'</button></div></div>').join("");
}
function renderLeads(a){
 $("leadTable").innerHTML=a.length?a.map(x=>{const b=x.businesses||{};return '<tr><td><b>'+esc(b.name||"Unknown")+'</b><br><span class="muted">'+esc(b.category||"")+'</span></td><td>'+esc([b.city,b.state,b.country].filter(Boolean).join(", "))+'</td><td><span class="badge">'+esc(b.website_status||"NEEDS_VERIFICATION")+'</span></td><td>'+(x.lead_score??"—")+'</td><td><span class="badge">'+esc(x.status||"NEW")+'</span></td></tr>'}).join(""):'<tr><td colspan="5" class="empty">No leads yet.</td></tr>';
}
function renderScans(a){
 $("scanTable").innerHTML=a.length?a.map(s=>'<tr><td>'+date(s.created_at)+'</td><td>'+esc(s.campaigns?.name||"—")+'</td><td><span class="status">'+esc(s.status)+'</span></td><td>'+(s.discovered_count??0)+'</td><td>'+(s.no_website_count??0)+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">No scans yet.</td></tr>';
}
function renderExports(a){
 const el=$("exportList");if(!a.length){el.className="list empty";el.textContent="No exports yet.";return}
 el.className="list";el.innerHTML=a.map(x=>'<div class="campaign-item"><div><b>'+esc(x.file_name)+'</b><p>'+(x.row_count||0)+' rows · '+date(x.created_at)+'</p></div><button class="ghost" onclick="downloadExport(\''+x.id+'\')">Download CSV</button></div>').join("");
}

async function toggleCampaign(id,active){const r=await db.from("campaigns").update({active}).eq("id",id);if(r.error)return toast(r.error.message);toast(active?"Campaign activated":"Campaign paused");load()}
async function runScan(id){const r=await db.functions.invoke("run-business-scan",{body:{campaign_id:id}});if(r.error)return toast(r.error.message||"Scan failed");toast(r.data?.message||"Scan started");load()}
async function downloadExport(id){const r=await db.from("csv_exports").select("storage_path").eq("id",id).single();if(r.error)return toast(r.error.message);const s=await db.storage.from("leadfinder-exports").createSignedUrl(r.data.storage_path,300);if(s.error)return toast(s.error.message);location.href=s.data.signedUrl}

window.toggleCampaign=toggleCampaign;window.runScan=runScan;window.downloadExport=downloadExport;
(async()=>{const r=await db.auth.getSession();if(r.data.session){signedIn(r.data.session);await load()}else signedOut();db.auth.onAuthStateChange((_e,s)=>s?signedIn(s):signedOut())})();