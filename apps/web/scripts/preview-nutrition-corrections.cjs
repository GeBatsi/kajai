/* eslint-disable @typescript-eslint/no-require-imports -- Local fixture preview, never part of the application bundle. */
// Real admin components, React Query, Radix UI and theme provider; memory-only API/session.
// No connection string, real session cookie or backend request is used by this preview.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { execFileSync } = require('node:child_process')
const web = path.resolve(__dirname, '..')
const root = path.resolve(web, '../..')
const store = path.join(root, 'node_modules/.pnpm')
const esbuildPackage = fs.readdirSync(store).find((name) => name.startsWith('esbuild@'))
if (!esbuildPackage) throw new Error('A workspace esbuild csomagja szükséges az elkülönített előnézethez.')
const esbuild = require(path.join(store, esbuildPackage, 'node_modules/esbuild'))
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'kai77-nutrition-preview-'))
const port = Number(process.argv[2] || process.env.ADMIN_PREVIEW_PORT || 4177)
const shims = {
  'next/link': `import React from 'react'; export default function Link({href,children,...props}) { return <a {...props} href={href} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey){e.preventDefault();history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))}}}>{children}</a> }`,
  'next/image': `import React from 'react';export default function Image(props){return <img {...props}/>}`,
  'next/navigation': `const go=url=>{history.replaceState({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({replace:go,push:go});`,
  'next-auth/react': `import React,{createContext,useContext} from 'react';export const FixtureSession=createContext({});export const useSession=()=>useContext(FixtureSession);export const signOut=async()=>{};`,
}
const entry = "\nimport React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ThemeProvider} from 'next-themes';import {FixtureSession} from 'next-auth/react';import {AxiosError} from 'axios';import {apiClient} from '@/lib/api';import {CorrectionShell,CorrectionPrivacyGuard} from '@/components/nutrition-corrections/shared';import {Submission} from '@/components/nutrition-corrections/submission';import {CorrectionList} from '@/components/nutrition-corrections/list';import {ModerationDetail} from '@/components/nutrition-corrections/detail';import {AppThemeToggle} from '@/components/theme/app-theme-toggle';import '@kajai/ui/tokens.css';\nconst food={id:'food',name:'Csirkemell',category:'Hús és hal',type:'BASIC',nutrition:{energyKcal:180,protein:29,carbs:0,sugar:0,fat:5,saturatedFat:1,per:100,unit:'g'},updatedAt:'2026-11-23T10:00:00Z'};let identity={id:'actor',role:'MODERATOR',name:'Teszt Moderátor',isBanned:false};let conflict=false;let getFailure=false;\nlet rows=[{id:'correction',foodItemId:'food',foodItem:{id:'food',name:food.name},submittedById:'user',submittedBy:{id:'user',name:'Kiss Anna'},reason:'A gyártó frissített tápértéktáblázata alapján.',status:'PENDING',originalNutrition:food.nutrition,proposedNutrition:{...food.nutrition,energyKcal:165,protein:31,fat:3.6},currentFood:food,canApprove:true,isStale:false,approvalBlockedReason:null,submittedAt:food.updatedAt,reviewedAt:null,rejectionReason:null}];\napiClient.defaults.adapter=async config=>{await new Promise(r=>setTimeout(r,120));let data;const path=config.url;const body=config.data?JSON.parse(config.data):{};const fail=(status,message)=>{throw new AxiosError(message,'ERR_BAD_RESPONSE',config,null,{status,data:{message},headers:{},config})};if(config.method==='get'&&getFailure)return fail(500,'Teszt GET-hiba');if(config.method!=='get'&&conflict)return fail(409,'Az adatok időközben megváltoztak. Frissítés szükséges.');if(path==='/foods')data=[food];else if(path==='/foods/food')data=food;else if(path.startsWith('/foods/')&&config.method==='post'){data={...rows[0],id:'created',submittedById:identity.id,status:'PENDING',reason:body.reason,proposedNutrition:{...food.nutrition,...body.nutrition}};rows.push(data)}else if(path.endsWith('/mine')||path==='/moderation/nutrition-corrections'){const f=config.params;const filtered=rows.filter(r=>(!path.endsWith('/mine')||r.submittedById===identity.id)&&(!f.status||r.status===f.status));data={data:filtered,meta:{page:1,limit:20,total:filtered.length,totalPages:1}}}else{const row=rows.find(r=>path.includes('/'+r.id));if(!row)return fail(404,'Nem található.');if(config.method==='post'){if(path.endsWith('approve')){food.nutrition={...row.proposedNutrition};food.updatedAt=new Date().toISOString();row.currentFood={...food};row.isStale=true;}row.status=path.endsWith('approve')?'APPROVED':'REJECTED';row.reviewedAt=new Date().toISOString();row.reviewedBy={id:identity.id,name:identity.name};row.rejectionReason=body.reason??null;row.canApprove=false;row.approvalBlockedReason='A javaslatot már elbírálták.'}data={...row}}return{data,status:200,headers:{},config}};\nconst cache=new QueryClient();function Preview(){const [route,setRoute]=useState(location.pathname),[role,setRole]=useState('MODERATOR');useEffect(()=>{const f=()=>setRoute(location.pathname);addEventListener('popstate',f);return()=>removeEventListener('popstate',f)},[]);const moderator=route.startsWith('/moderator');return <ThemeProvider attribute=\"class\" defaultTheme=\"light\"><QueryClientProvider client={cache}><FixtureSession.Provider value={{data:{user:identity},status:'authenticated',update:async()=>({user:identity})}}><CorrectionPrivacyGuard/><div className=\"flex flex-wrap gap-4 bg-accent p-3 text-accent-foreground\"><strong>Elkülönített UI-próba · mintaadatok</strong><select aria-label=\"Teszt szerepkör\" value={role} onChange={e=>{identity={...identity,role:e.target.value};setRole(e.target.value)}}>{['USER','MODERATOR','ADMIN'].map(r=><option key={r}>{r}</option>)}</select><label><input type=\"checkbox\" onChange={e=>conflict=e.target.checked}/> 409-es konfliktus</label><label><input type=\"checkbox\" onChange={e=>getFailure=e.target.checked}/> GET-hiba</label></div><CorrectionShell moderator={moderator}>{route.endsWith('/new')?<Submission initialFoodId={new URLSearchParams(location.search).get('foodId')||''}/>:route.endsWith('/mine')?<CorrectionList/>:route.endsWith('/correction')?<ModerationDetail id=\"correction\"/>:<CorrectionList moderator/>}</CorrectionShell><AppThemeToggle className=\"fixed bottom-4 right-4 z-40\"/></FixtureSession.Provider></QueryClientProvider></ThemeProvider>};createRoot(document.getElementById('root')).render(<Preview/>);\n"
async function main() {
  await esbuild.build({ absWorkingDir: web, stdin: { contents: entry, resolveDir: web, sourcefile: 'admin-preview.tsx', loader: 'tsx' }, bundle: true, outdir: output, entryNames: 'preview', assetNames: 'assets/[name]-[hash]', format: 'iife', jsx: 'automatic', loader: { '.woff2': 'file', '.woff': 'file' }, define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_API_URL': '"http://preview.invalid"' },
    plugins: [{ name: 'memory-only-preview', setup(build) {
      build.onResolve({ filter: /^next\/(link|image|navigation)$|^next-auth\/react$/ }, args => ({ path: args.path, namespace: 'fixture' }))
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: shims[args.path], loader: 'jsx', resolveDir: web }))
      build.onResolve({ filter: /^@\// }, args => { const base = path.join(web, 'src', args.path.slice(2)); const file = ['.tsx', '.ts', '.jsx', '.js'].map(ext => base + ext).find(fs.existsSync); if (!file) throw new Error('Unknown source: ' + args.path); return { path: file } })
    } }],
  })
  const tailwind = path.join(path.dirname(require.resolve('tailwindcss/package.json')), 'lib/cli.js')
  execFileSync(process.execPath, [tailwind, '-i', path.join(web, 'src/app/globals.css'), '-o', path.join(output, 'tailwind.css'), '-c', path.join(web, 'tailwind.config.ts')], { cwd: web, windowsHide: true, stdio: 'pipe' })
  const html = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KajAI admin · elkülönített UI-próba</title><link rel="stylesheet" href="/preview.css"><link rel="stylesheet" href="/tailwind.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname === '/__mobile') { const theme = new URL(req.url, 'http://localhost').searchParams.get('theme') === 'dark' ? 'dark' : 'light'; res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end('<!doctype html><html lang="hu"><meta charset="utf-8"><title>KajAI · 390px mobil előnézet</title><body style="margin:0;background:#222;color:white;font:16px sans-serif;padding:16px"><p>390 × 844 · elkülönített mobilnézet</p><iframe title="KajAI mobilnézet" src="/admin/users?theme='+theme+'" style="width:390px;height:844px;border:0;border-radius:20px"></iframe></body></html>') }
    if (pathname === '/Kajai.webp') { res.setHeader('Content-Type', 'image/webp'); return res.end(fs.readFileSync(path.join(web, 'public/Kajai.webp'))) }
    if ((pathname.startsWith('/nutrition-corrections') || pathname.startsWith('/moderator')) || pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html) }
    const file = path.resolve(output, '.' + pathname)
    if (!file.startsWith(output + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end() }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/woff2')
    res.end(fs.readFileSync(file))
  })
  server.listen(port, '127.0.0.1', () => process.stdout.write('Local: http://127.0.0.1:' + port + '/nutrition-corrections/new · PID: ' + process.pid + '\n'))
  const stop = () => { server.close(() => {
    const resolved = path.resolve(output)
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('kai77-nutrition-preview-')) throw new Error('Unsafe preview cleanup target')
    fs.rmSync(resolved, { recursive: true, force: true }); process.exit(0)
  }) }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
