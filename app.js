const SUPABASE_URL="https://tgvjbcbgxyhybmgxtdhd.supabase.co";
const SUPABASE_KEY=window.LEADFINDER_SUPABASE_KEY||"YOUR_SUPABASE_PUBLISHABLE_KEY";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
function showSignedOut(){$("authView").classList.remove("hidden");$("appView").classList.add("hidden")}
async function start(){const s=await db.auth.getSession();if(s.data.session){$("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("userEmail").textContent=s.data.session.user.email||""}else showSignedOut()}
start();