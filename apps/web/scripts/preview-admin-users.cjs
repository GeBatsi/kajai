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
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'kai77-admin-preview-'))
const port = Number(process.argv[2] || process.env.ADMIN_PREVIEW_PORT || 4177)
const shims = {
  'next/link': `import React from 'react'; export default function Link({href,children,...props}) { return <a {...props} href={href} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey){e.preventDefault();history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))}}}>{children}</a> }`,
  'next/image': `import React from 'react';export default function Image(props){return <img {...props}/>}`,
  'next/navigation': `const go=url=>{history.replaceState({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({replace:go,push:go});export const usePathname=()=>location.pathname;`,
  'next-auth/react': `import React,{createContext,useContext} from 'react';export const FixtureSession=createContext({});export const useSession=()=>useContext(FixtureSession);export const signOut=async()=>{};`,
}
const entry = `
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from 'next-themes';
import {FixtureSession} from 'next-auth/react';
import {AxiosError} from 'axios';
import {apiClient} from '@/lib/api';
import {AdminShell} from '@/components/admin/admin-shell';
import {AdminUsersList} from '@/components/admin/admin-users-list';
import {AdminUserDetail} from '@/components/admin/admin-user-detail';
import {AdminUserCreate} from '@/components/admin/admin-user-create';
import {RecipeBookDashboard} from '@/components/recipe-book/recipe-book-dashboard';
import FoodForm from '@/components/foods/food-form';
import FoodPicker from '@/components/foods/food-picker';
import FoodEditor from '@/components/foods/food-editor';
import {AppThemeToggle} from '@/components/theme/app-theme-toggle';
import '@kajai/ui/tokens.css';
let identity={id:'preview-admin',name:'Teszt Admin',email:'admin@example.test',role:'ADMIN',isBanned:false};
let count=0,report=()=>{},conflict=false;
let rows=Array.from({length:62},(_,i)=>({id:i===0?'preview-admin':'user-'+i,email:i===0?'admin@example.test':'felhasznalo'+i+'@example.test',name:['Kiss Anna','Nagy Balázs','Tóth Dóra','Szabó Márton'][i%4],image:null,role:i===0?'ADMIN':i%5===0?'MODERATOR':'USER',isVerified:i%3!==0,bannedAt:i%7===0&&i!==0?'2026-11-18T12:00:00Z':null,banReason:i%7===0&&i!==0?'Ismétlődő szabálysértés':null,createdAt:'2026-11-18T12:00:00Z',updatedAt:'2026-11-18T12:00:00Z'}));
const fail=(config,status,message)=>{throw new AxiosError(message,'ERR_BAD_RESPONSE',config,null,{status,data:{message},statusText:'Error',headers:{},config})};
const summary=({bannedAt,banReason,...rest})=>rest;
const previewFood={id:'food',name:'Csirkemell',type:'BASIC',category:'Hús',nutrition:{per:100,unit:'g',energyKcal:180,protein:29,fat:5,carbs:0},allergens:{},imageUrl:null};
globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/foods?')?[previewFood]:String(url).includes('/foods/food')?previewFood:{}),{status:200,headers:{'Content-Type':'application/json'}});
apiClient.defaults.adapter=async config=>{
  report(++count);await new Promise(resolve=>setTimeout(resolve,160));
  if(identity.role!=='ADMIN'||identity.isBanned) return fail(config,403,'Nincs jogosultságod.');
  const method=config.method,path=config.url,body=config.data?JSON.parse(config.data):{},parts=path.split('/').filter(Boolean);
  let data;
  if(method!=='get'&&conflict)return fail(config,409,'A felhasználó receptjeire más felhasználók adatai hivatkoznak; a művelet nem végezhető el.');
  if(parts.length===1&&method==='get'){
    const p=config.params,search=(p.search||'').toLowerCase();const filtered=rows.filter(u=>(!search||(u.name+' '+u.email).toLowerCase().includes(search))&&(!p.role||u.role===p.role)&&(!p.status||(p.status==='banned')===!!u.bannedAt));
    data={data:filtered.slice((p.page-1)*p.limit,p.page*p.limit),meta:{page:p.page,limit:p.limit,total:filtered.length,totalPages:Math.ceil(filtered.length/p.limit)}};
  }else if(parts.length===1&&method==='post'){
    const created={...rows[1],id:'created-'+count,email:body.email,name:body.name||null,role:body.role,isVerified:false,bannedAt:null,banReason:null};rows.push(created);data=summary(created);
  }else{
    const id=decodeURIComponent(parts[1]),u=rows.find(u=>u.id===id);if(!u)return fail(config,404,'A felhasználó már nem található.');
    if(method==='get')data={...u};
    else if(method==='delete'){rows=rows.filter(u=>u.id!==id);data=summary(u)}
    else if(parts[2]==='role'){u.role=body.role;data={...u}}
    else if(parts[2]==='ban'){u.bannedAt=new Date().toISOString();u.banReason=body.reason;data={...u}}
    else if(parts[2]==='unban'){u.bannedAt=null;u.banReason=null;data={...u}}
    else{u.name=body.name;u.image=body.image;data=summary(u)}
    if(method!=='get')u.updatedAt=new Date().toISOString();
  }
  return {data,status:200,statusText:'OK',headers:{},config};
};
const queryClient=new QueryClient();
function Preview(){
  const [pathname,setPath]=useState(location.pathname),[role,setRole]=useState('ADMIN'),[requests,setRequests]=useState(0);
  useEffect(()=>{report=setRequests;const listener=()=>setPath(location.pathname);addEventListener('popstate',listener);return()=>removeEventListener('popstate',listener)},[]);
  const detail=pathname.match(/^\\/admin\\/users\\/([^/]+)$/),child=pathname==='/admin/users/new'?<AdminUserCreate/>:detail?<AdminUserDetail id={decodeURIComponent(detail[1])}/>:<AdminUsersList/>;
  const content=pathname==='/recipe-book'?<RecipeBookDashboard/>:pathname==='/moderator/foods/new'?<FoodForm apiBaseUrl="http://preview.invalid" backHref="/recipe-book" title="Alapanyag létrehozása"/>:pathname==='/moderator/foods/edit'?<FoodPicker apiBaseUrl="http://preview.invalid"/>:pathname==='/moderator/foods/food/edit'?<FoodEditor apiBaseUrl="http://preview.invalid" foodId="food"/>:<AdminShell>{child}</AdminShell>;
  return <ThemeProvider attribute="class" defaultTheme="light" forcedTheme={new URLSearchParams(location.search).get('theme')||undefined}><QueryClientProvider client={queryClient}><FixtureSession.Provider value={{data:{user:identity},status:'authenticated',update:async()=>({user:identity})}}>
    <div style={{padding:'12px 20px',background:'#18332d',color:'white',fontFamily:'sans-serif',fontSize:14,display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}><strong>Elkülönített UI-próba · csak mintadatok</strong><label>Session: <select aria-label="Teszt session" value={role} onChange={e=>{const value=e.target.value;identity={...identity,role:value==='BANNED'?'ADMIN':value,isBanned:value==='BANNED'};setRole(value)}} style={{color:'black'}}>{['ADMIN','USER','MODERATOR','BANNED'].map(value=><option key={value}>{value}</option>)}</select></label><label><input type="checkbox" onChange={e=>{conflict=e.target.checked}}/> 409-es konfliktus szimulálása</label><span>Kérések: {requests}</span></div>
    {content}<AppThemeToggle className="fixed bottom-4 right-4 z-40"/>
  </FixtureSession.Provider></QueryClientProvider></ThemeProvider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
`
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
    if (pathname.startsWith('/admin') || pathname.startsWith('/moderator/foods') || pathname === '/recipe-book' || pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html) }
    const file = path.resolve(output, '.' + pathname)
    if (!file.startsWith(output + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end() }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/woff2')
    res.end(fs.readFileSync(file))
  })
  server.listen(port, '127.0.0.1', () => process.stdout.write('Local: http://127.0.0.1:' + port + '/admin/users · PID: ' + process.pid + '\n'))
  const stop = () => { server.close(() => {
    const resolved = path.resolve(output)
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('kai77-admin-preview-')) throw new Error('Unsafe preview cleanup target')
    fs.rmSync(resolved, { recursive: true, force: true }); process.exit(0)
  }) }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
