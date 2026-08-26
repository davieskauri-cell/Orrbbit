"""Iter54 — Complete Professional Verification on desktop/laptop.

Same account, same backend workflow, same Control Centre queue as mobile.
- POST /api/verification/desktop-link (auth): emails a secure single-use 24h link.
- GET  /api/verification/web?token=...  : branded, responsive web form.
- POST /api/verification/web/submit     : validates token, then submits through the
  exact same submit_verification handler used by the mobile app.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def build_web_verification(db, get_current_user, email_service, es_fire, professions: dict,
                           submit_handler, VerificationV2In):
    router = APIRouter(prefix="/verification")
    PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or os.environ.get("APP_URL") or "").rstrip("/")

    @router.post("/desktop-link")
    async def desktop_link(user: dict = Depends(get_current_user)):
        token = uuid.uuid4().hex + uuid.uuid4().hex
        await db.verification_web_links.insert_one({
            "token": token, "user_id": user["id"], "used": False,
            "created_at": now_iso(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        })
        link = f"{PUBLIC_BASE_URL}/api/verification/web?token={token}"
        es_fire(email_service.send("pro_desktop_verification", user=user,
                                   entity_id=token[:12], ctx={"action_url": link}))
        return {"ok": True, "sent_to_hint": (user.get("email") or "")[:2] + "•••"}

    async def _valid_link(token: str):
        link = await db.verification_web_links.find_one({"token": token})
        if not link or link.get("used"):
            return None
        if link["expires_at"] < now_iso():
            return None
        return link

    @router.get("/web", response_class=HTMLResponse)
    async def web_form(token: str = ""):
        link = await _valid_link(token)
        if not link:
            return HTMLResponse(_page("<h1>Link expired</h1><p class='sub'>This verification link has expired or was already used. "
                                      "Open Orrbbit on your phone → Professional → Get Verified → Complete on desktop/laptop to get a fresh link.</p>"))
        opts = "".join(f'<option value="{p}">{p}</option>' for p in professions.keys())
        cat_map = {p: professions[p] for p in professions}
        import json
        return HTMLResponse(_page(FORM_HTML
                                  .replace("__TOKEN__", token)
                                  .replace("__PROF_OPTIONS__", opts + '<option value="Other">Other</option>')
                                  .replace("__CAT_MAP__", json.dumps(cat_map))))

    class WebSubmitIn(BaseModel):
        token: str
        payload: dict

    @router.post("/web/submit")
    async def web_submit(body: WebSubmitIn):
        link = await _valid_link(body.token)
        if not link:
            raise HTTPException(status_code=401, detail="This verification link has expired or was already used.")
        user = await db.users.find_one({"id": link["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")
        try:
            data = VerificationV2In(**body.payload)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid submission: {str(e)[:160]}")
        # Same workflow, same database, same Control Centre queue
        result = await submit_handler(data, user)
        await db.verification_web_links.update_one({"token": body.token}, {"$set": {"used": True, "used_at": now_iso()}})
        return result

    return router


def _page(inner: str) -> str:
    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orrbbit — Professional Verification</title>
<style>
:root {{ --teal:#14B8A6; --navy:#0F172A; --sub:#64748B; --border:#E2E8F0; --bg:#F8FAFC; }}
* {{ box-sizing:border-box; font-family:'Quicksand',-apple-system,Segoe UI,sans-serif; }}
body {{ margin:0; background:var(--bg); color:var(--navy); }}
.wrap {{ max-width:720px; margin:0 auto; padding:32px 20px 80px; }}
.brand {{ display:flex; align-items:center; gap:10px; margin-bottom:24px; }}
.brand b {{ font-size:22px; }}
h1 {{ font-size:26px; margin:0 0 6px; }}
.sub {{ color:var(--sub); font-size:15px; line-height:1.5; }}
.card {{ background:#fff; border:1px solid var(--border); border-radius:16px; padding:24px; margin-top:18px; }}
label {{ display:block; font-weight:700; font-size:13px; margin:16px 0 6px; }}
input,select,textarea {{ width:100%; padding:12px; border:1px solid var(--border); border-radius:10px; font-size:15px; }}
.pills {{ display:flex; flex-wrap:wrap; gap:8px; }}
.pill {{ border:1px solid var(--border); border-radius:999px; padding:8px 14px; cursor:pointer; font-size:14px; background:#fff; }}
.pill.on {{ background:var(--teal); color:#fff; border-color:var(--teal); }}
button.primary {{ background:var(--teal); color:#fff; border:none; border-radius:999px; padding:14px 28px; font-size:16px; font-weight:800; cursor:pointer; margin-top:20px; }}
.note {{ background:#F0FDFA; border:1px solid #99F6E4; border-radius:10px; padding:12px; font-size:13px; color:#0F766E; margin-top:12px; }}
.err {{ color:#E11D48; font-size:14px; margin-top:10px; font-weight:700; }}
.docrow {{ display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-top:8px; font-size:14px; }}
.rm {{ color:#E11D48; cursor:pointer; font-weight:800; font-size:12px; }}
img.logo {{ height:34px; }}
</style></head><body><div class="wrap">
<div class="brand"><img class="logo" src="/api/email-assets/orrbbit-logo-v2.png" alt="Orrbbit"><b>Orrbbit</b></div>
{inner}
</div></body></html>"""


FORM_HTML = """
<h1>Professional Verification</h1>
<p class="sub">This secure page is linked to your Orrbbit account. Your submission goes to the same review team as the mobile app.</p>
<div class="card">
<label>Step 1 · Profession</label>
<select id="prof" onchange="profChanged()">__PROF_OPTIONS__</select>
<div id="profOtherWrap" style="display:none"><label>Please specify your profession</label><input id="profOther"></div>
<label>Step 2 · Categories</label>
<div class="pills" id="cats"></div>
<div id="catOtherWrap" style="display:none"><label>Please specify your category</label><input id="catOther"></div>

<label>Upload Credentials (required)</label>
<p class="sub" style="margin:0">PDF, JPG or PNG · max 5MB each.</p>
<input type="file" id="credFile" accept=".pdf,.jpg,.jpeg,.png">
<div class="note" id="prefillNote" style="display:none">We'll use the information in your uploaded document to help pre-fill the details below. Please review and edit the information before continuing.</div>
<label>Document Name</label><input id="docName" placeholder="e.g. CIPD Level 7 Certificate">
<label>Issuer</label><input id="issuer">
<label>Licence / Registration Number</label><input id="licnum">
<label>Expiry Date (YYYY-MM-DD, if any)</label><input id="expiry">
<button class="primary" type="button" style="padding:10px 20px;font-size:14px" onclick="addDoc()">+ Add Document</button>
<div id="docList"></div>

<label style="margin-top:28px">Identity — minimum 2 ID documents (private, admins only)</label>
<label>Full Legal Name</label><input id="fullName">
<label>Primary ID Type</label>
<select id="idType"><option>Passport</option><option>Driver Licence</option><option>Birth Certificate</option><option>Other</option></select>
<label>Add ID document</label>
<select id="idDocType"><option>Passport</option><option>Driver Licence</option><option>Birth Certificate</option><option>Other</option></select>
<div id="idOtherWrap" style="display:none"><label>Please specify the document type</label><input id="idOther"></div>
<input type="file" id="idFile" accept=".pdf,.jpg,.jpeg,.png">
<button class="primary" type="button" style="padding:10px 20px;font-size:14px" onclick="addId()">+ Add ID Document</button>
<div id="idList"></div>

<div class="err" id="err"></div>
<button class="primary" onclick="submitAll()">Submit for Review</button>
</div>
<script>
const CATMAP = __CAT_MAP__; const TOKEN = "__TOKEN__";
let cats = [], docs = [], ids = [], credB64 = "", credMeta = null;
function profChanged(){
  const p = document.getElementById('prof').value; cats = [];
  document.getElementById('profOtherWrap').style.display = p==='Other'?'block':'none';
  const el = document.getElementById('cats'); el.innerHTML='';
  (CATMAP[p]||[]).concat(['Other']).forEach(c=>{
    const d=document.createElement('div'); d.className='pill'; d.textContent=c;
    d.onclick=()=>{ if(c==='Other'){ const w=document.getElementById('catOtherWrap'); w.style.display=w.style.display==='none'?'block':'none'; d.classList.toggle('on'); return;}
      const i=cats.indexOf(c); if(i>=0){cats.splice(i,1); d.classList.remove('on');} else {cats.push(c); d.classList.add('on');}};
    el.appendChild(d);
  });
}
document.getElementById('idDocType').onchange=e=>{document.getElementById('idOtherWrap').style.display=e.target.value==='Other'?'block':'none';};
function readFile(input, cb){ const f=input.files[0]; if(!f) return cb(null);
  if(f.size>5*1024*1024) return cb('too_big');
  const r=new FileReader(); r.onload=()=>cb({b64:r.result.split(',')[1], type:f.type, name:f.name}); r.readAsDataURL(f); }
document.getElementById('credFile').onchange=function(){ readFile(this, m=>{ if(m==='too_big'){err('File too large (max 5MB)');return;}
  credMeta=m; if(m) document.getElementById('prefillNote').style.display='block'; }); };
function err(m){ document.getElementById('err').textContent=m||''; }
function addDoc(){ err('');
  if(!credMeta) return err('Upload the credential document first — it is required.');
  const name=document.getElementById('docName').value.trim(); if(!name) return err('Each document needs a name.');
  docs.push({doc_name:name, issuer:document.getElementById('issuer').value, license_number:document.getElementById('licnum').value,
    expiry_date:document.getElementById('expiry').value||null, file_b64:credMeta.b64, file_type:credMeta.type, file_name:credMeta.name});
  renderList('docList', docs); credMeta=null; document.getElementById('credFile').value='';
  ['docName','issuer','licnum','expiry'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('prefillNote').style.display='none'; }
function addId(){ err('');
  let t=document.getElementById('idDocType').value;
  if(t==='Other'){ const o=document.getElementById('idOther').value.trim(); if(!o) return err('Please specify the ID document type.'); t='Other — '+o; }
  readFile(document.getElementById('idFile'), m=>{ if(!m) return err('Attach the ID file.'); if(m==='too_big') return err('File too large (max 5MB)');
    ids.push({doc_name:t, issuer:'', license_number:'', expiry_date:null, file_b64:m.b64, file_type:m.type, file_name:m.name});
    renderList('idList', ids); document.getElementById('idFile').value=''; }); }
function renderList(id, arr){ const el=document.getElementById(id);
  el.innerHTML=arr.map((d,i)=>`<div class="docrow"><span>📄 ${d.doc_name} · ${d.file_name||''}</span><span class="rm" onclick="rm('${id}',${i})">REMOVE</span></div>`).join(''); }
function rm(id,i){ (id==='docList'?docs:ids).splice(i,1); renderList(id, id==='docList'?docs:ids); }
async function submitAll(){ err('');
  const p=document.getElementById('prof').value;
  const payload={ profession:p, categories:cats, profession_other:document.getElementById('profOther').value,
    categories_other:document.getElementById('catOther').value, full_name:document.getElementById('fullName').value,
    id_type:document.getElementById('idType').value, documents:docs, identity_documents:ids };
  if(docs.length===0) return err('Add at least one credential document.');
  if(ids.length<2) return err('Add at least 2 identity documents.');
  if(!payload.full_name.trim()) return err('Enter your full legal name.');
  const r=await fetch('/api/verification/web/submit',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({token:TOKEN, payload})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) return err(d.detail||'Submission failed.');
  document.querySelector('.card').innerHTML='<h1>Submitted ✓</h1><p class="sub">Your verification is with the Orrbbit review team. You can close this page and continue in the app.</p>';
}
profChanged();
</script>
"""
