import express from "express";
import { createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isProd = process.env.NODE_ENV === "production";
const cookieName = isProd ? "__Host-appmgr" : "appmgr";
const stateCookie = isProd ? "__Host-appmgr-state" : "appmgr-state";
const secret = process.env.SESSION_SECRET || "";
const key = createHash("sha256").update(secret).digest();
const configured = () => Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && secret.length >= 32);
const cookieOptions = maxAge => ({ httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge });
const sign = value => createHmac("sha256", secret).update(value).digest("base64url");
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(p => p.trim()).filter(Boolean).map(p => { const i=p.indexOf("="); return [p.slice(0,i),decodeURIComponent(p.slice(i+1))]; }));
}
function seal(value) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  return payload + "." + sign(payload);
}
function unseal(value) {
  if (!value || !secret) return null;
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length) return null;
  const expected=Buffer.from(sign(payload)), actual=Buffer.from(signature);
  if (expected.length!==actual.length || !timingSafeEqual(expected,actual)) return null;
  try {
    const data=Buffer.from(payload,"base64url"), iv=data.subarray(0,12), tag=data.subarray(12,28), encrypted=data.subarray(28);
    const decipher=createDecipheriv("aes-256-gcm",key,iv); decipher.setAuthTag(tag);
    const session=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString("utf8"));
    return session.exp>Date.now() && typeof session.token==="string" ? session : null;
  } catch { return null; }
}
const sessionFor = req => unseal(cookies(req)[cookieName]);
function requireConfig(_req,res,next) {
  if (!configured()) return res.status(503).json({error:"GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and a SESSION_SECRET of at least 32 characters."});
  next();
}
function requireSession(req,res,next) {
  const session=sessionFor(req);
  if (!session) return res.status(401).json({error:"Connect GitHub to continue."});
  req.githubToken=session.token; next();
}
async function github(req,route) {
  const response=await fetch("https://api.github.com"+route,{headers:{accept:"application/vnd.github+json",authorization:"Bearer "+req.githubToken,"x-github-api-version":"2022-11-28"}});
  const body=await response.json().catch(()=>({}));
  if (!response.ok) { const error=new Error(body.message||"GitHub API request failed."); error.status=response.status===403?403:response.status===404?404:502; throw error; }
  return body;
}
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);

app.get("/auth/github",requireConfig,(req,res)=>{
  const state=randomBytes(32).toString("base64url");
  res.cookie(stateCookie,state+"."+sign(state),cookieOptions(600000));
  const query=new URLSearchParams({client_id:process.env.GITHUB_CLIENT_ID,redirect_uri:new URL("/auth/github/callback",process.env.APP_URL||"http://localhost:3001").toString(),scope:"read:user repo",state});
  res.redirect("https://github.com/login/oauth/authorize?"+query);
});
app.get("/auth/github/callback",requireConfig,asyncRoute(async(req,res)=>{
  const c=cookies(req), [expected,signature]=(c[stateCookie]||"").split(".");
  res.clearCookie(stateCookie,{path:"/",secure:isProd,sameSite:"lax"});
  if (!req.query.state||!expected||!signature||req.query.state!==expected||sign(expected)!==signature) return res.status(400).send("OAuth state validation failed. Return to App Manager and retry.");
  if (typeof req.query.code!=="string") return res.status(400).send("GitHub did not return an authorization code.");
  const tokenResponse=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{accept:"application/json","content-type":"application/json"},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code:req.query.code})});
  const body=await tokenResponse.json();
  if (!tokenResponse.ok||!body.access_token) return res.status(502).send("GitHub authorization failed. Please retry.");
  res.cookie(cookieName,seal({token:body.access_token,exp:Date.now()+8*60*60*1000}),cookieOptions(8*60*60*1000));
  res.redirect("/");
}));
app.post("/auth/logout",(req,res)=>{res.clearCookie(cookieName,{path:"/",secure:isProd,sameSite:"lax"});res.status(204).end();});
app.get("/api/session",(req,res)=>{const session=sessionFor(req);res.json({configured:configured(),connected:Boolean(session),expiresAt:session?.exp||null});});
app.get("/api/repos",requireConfig,requireSession,asyncRoute(async(req,res)=>{
  const repos=await github(req,"/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member");
  res.json({repositories:repos.map(r=>({fullName:r.full_name,name:r.name,private:r.private,defaultBranch:r.default_branch,htmlUrl:r.html_url,permissions:r.permissions,updatedAt:r.updated_at}))});
}));
app.get("/api/repos/:owner/:repo/diagnose",requireConfig,requireSession,asyncRoute(async(req,res)=>{
  const owner=encodeURIComponent(req.params.owner), repoName=encodeURIComponent(req.params.repo), base="/repos/"+owner+"/"+repoName;
  const repo=await github(req,base);
  const settled=await Promise.allSettled([
    github(req,base+"/commits?per_page=5"),github(req,base+"/issues?state=open&per_page=100"),
    github(req,base+"/pulls?state=open&per_page=50"),github(req,base+"/actions/runs?per_page=5"),github(req,base+"/contents")
  ]);
  const value=i=>settled[i].status==="fulfilled"?settled[i].value:null;
  const contents=value(4), runs=value(3)?.workflow_runs, latest=runs?.[0]||null;
  const issues=(value(1)||[]).filter(i=>!i.pull_request), pulls=value(2)||[];
  const checks=[
    {name:"Repository API",status:"passed",detail:"GitHub returned repository metadata."},
    {name:"Default branch",status:repo.default_branch?"passed":"warning",detail:repo.default_branch||"Default branch not reported."},
    {name:"Project manifests",status:contents?(contents.some(i=>["package.json","pyproject.toml","Cargo.toml","go.mod","pom.xml"].includes(i.name))?"passed":"warning"):"skipped",detail:contents?"Root directory inspected; dependency analysis is limited to root manifest detection.":"Root directory access unavailable."},
    {name:"Latest GitHub Actions run",status:latest?(latest.status!=="completed"?"warning":latest.conclusion==="success"?"passed":"failed"):"skipped",detail:latest?latest.name+": "+latest.status+(latest.conclusion?" / "+latest.conclusion:""):"No workflow run returned or Actions access unavailable.",url:latest?.html_url||null},
    {name:"Open issues",status:value(1)?(issues.length?"warning":"passed"):"skipped",detail:value(1)?issues.length+" open issues found.":"Issue access unavailable."},
    {name:"Open pull requests",status:value(2)?(pulls.length?"warning":"passed"):"skipped",detail:value(2)?pulls.length+" open pull requests found.":"Pull request access unavailable."}
  ];
  res.json({repository:{fullName:repo.full_name,private:repo.private,defaultBranch:repo.default_branch,htmlUrl:repo.html_url,description:repo.description,permissions:repo.permissions,pushedAt:repo.pushed_at},
    commits:(value(0)||[]).map(c=>({sha:c.sha,message:c.commit.message.split("\n")[0],date:c.commit.author?.date,url:c.html_url})),
    issues:issues.map(i=>({number:i.number,title:i.title,url:i.html_url,labels:(i.labels||[]).map(l=>l.name)})),
    pulls:pulls.map(p=>({number:p.number,title:p.title,url:p.html_url,draft:p.draft})),checks,
    limitations:["Read-only diagnostic; no repository files are changed.","Builds and tests are not executed by this API; displayed workflow data comes from GitHub Actions.","Dependency advisories and review comments require additional endpoints and permissions."]});
}));
app.get("/api/repos/:owner/:repo/file",requireConfig,requireSession,asyncRoute(async(req,res)=>{
  const filePath=typeof req.query.path==="string"?req.query.path:"";
  if (!filePath||filePath.startsWith("/")||filePath.split("/").some(part=>part===".."||!part)) return res.status(400).json({error:"Provide a valid repository-relative file path."});
  const encoded=filePath.split("/").map(encodeURIComponent).join("/");
  const file=await github(req,"/repos/"+encodeURIComponent(req.params.owner)+"/"+encodeURIComponent(req.params.repo)+"/contents/"+encoded);
  if (Array.isArray(file)||!file.content) return res.status(400).json({error:"Path is not a readable file."});
  res.json({path:file.path,sha:file.sha,size:file.size,encoding:file.encoding,content:file.encoding==="base64"?Buffer.from(file.content.replace(/\n/g,""),"base64").toString("utf8"):file.content,htmlUrl:file.html_url});
}));
app.use("/api",(_req,res)=>res.status(404).json({error:"API endpoint not found."}));
app.use((error,_req,res,_next)=>res.status(Number.isInteger(error.status)?error.status:502).json({error:error.message||"Unexpected server error."}));
if(isProd){app.use(express.static(path.join(root,"dist"),{index:false}));app.get("*path",async(_req,res)=>{try{res.type("html").send(await readFile(path.join(root,"dist","index.html"),"utf8"));}catch{res.status(503).send("App Manager frontend is not built. Run npm run build.");}});}
const port=Number(process.env.PORT||3001);
if(process.env.NODE_ENV!=="test")app.listen(port,()=>console.log("App Manager API listening on port "+port));
export {app,configured,sessionFor,seal,unseal};