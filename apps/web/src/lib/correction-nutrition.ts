export const nutrientLabels={energyKcal:'Energia',protein:'Fehérje',carbs:'Szénhidrát',sugar:'Cukor',fat:'Zsír',saturatedFat:'Telített zsír',fiber:'Rost',salt:'Só'} as const
export type Nutrient=keyof typeof nutrientLabels
export const nutrients=Object.keys(nutrientLabels) as Nutrient[]
export function correctionAccess(user?:{id?:string;role?:string;isBanned?:boolean}|null,moderator=false){return !!user?.id?.trim()&&!user.isBanned&&(moderator?['ADMIN','MODERATOR']:['USER','MODERATOR','ADMIN']).includes(user.role??'')}
export function normalizeNutrition(value:unknown):Record<string,unknown>{
 if(value==null)return {}
 if(typeof value!=='object'||Array.isArray(value))throw Error('Nem támogatott tárolt tápértékadat. Moderátori adatellenőrzés szükséges.')
 const data={...value} as Record<string,unknown>
 for(const [legacy,key] of Object.entries({kcal:'energyKcal',proteinG:'protein',carbsG:'carbs',fatG:'fat'})){if(!Object.hasOwn(data,key)&&Object.hasOwn(data,legacy))data[key]=data[legacy];delete data[legacy]}
 if(Object.keys(data).some(k=>!nutrients.includes(k as Nutrient)&&k!=='per'&&k!=='unit'))throw Error('Nem támogatott legacy metadata található. A javaslat nem küldhető be; moderátori adatellenőrzés szükséges.')
 if((data.per!==undefined&&data.per!==100)||(data.unit!==undefined&&!['g','ml'].includes(String(data.unit))))throw Error('Nem támogatott tápértékegység.')
 for(const k of nutrients)if(data[k]!=null&&(typeof data[k]!=='number'||!Number.isFinite(data[k])))throw Error('Nem olvasható tápértékadat.')
 return data
}
export function draftValues(data:Record<string,unknown>){return Object.fromEntries(nutrients.map(k=>[k,data[k]==null?'':String(data[k])])) as Record<Nutrient,string>}
export function buildCorrection(original:Record<string,unknown>,draft:Record<Nutrient,string>,reason:string){
 if(!reason.trim()||reason.trim().length>1000)throw Error('Az indoklás 1–1000 karakter legyen.')
 const full={...original};const patch:Record<string,number|null>={}
 for(const k of nutrients){const text=draft[k].trim();const n=text===''?null:Number(text.replace(',','.'));if(n!==null&&(!Number.isFinite(n)||n<0||n>(k==='energyKcal'?900:100)))throw Error('A tápérték nemnegatív, véges szám legyen; energia legfeljebb 900, más érték legfeljebb 100.')
 if(n!==(original[k]??null)){patch[k]=n;full[k]=n}}
 if(!Object.keys(patch).length)throw Error('Legalább egy tápértéket változtass meg.')
 const n=(k:Nutrient)=>typeof full[k]==='number'?full[k] as number:null
 if(n('sugar')!==null&&n('carbs')!==null&&n('sugar')!>n('carbs')!)throw Error('A cukor nem lehet több a szénhidrátnál.')
 if(n('saturatedFat')!==null&&n('fat')!==null&&n('saturatedFat')!>n('fat')!)throw Error('A telített zsír nem lehet több a zsírnál.')
 // Decimal-aligned sum using the textual decimal representation, avoiding binary rounding.
 const amounts=['protein','carbs','fat','fiber','salt'].map(k=>String(n(k as Nutrient)??0))
 const precision=Math.max(...amounts.map(s=>{const [a,e='0']=s.toLowerCase().split('e');return Math.max(0,(a.split('.')[1]?.length??0)-Number(e))}))
 const scaled=amounts.map(s=>{const [a,e='0']=s.toLowerCase().split('e');const digits=a.replace('.','');return BigInt(digits)*10n**BigInt(precision+Number(e)-(a.split('.')[1]?.length??0))})
 if(scaled.reduce((a,b)=>a+b,0n)>100n*10n**BigInt(precision))throw Error('A fehérje, szénhidrát, zsír, rost és só összege legfeljebb 100 lehet.')
 return {patch,full,reason:reason.trim()}
}
export function nutritionDisplay(data:unknown,key:Nutrient){
 if(data==null)return 'Nincs adat'
 try{const d=normalizeNutrition(data);if(!Object.hasOwn(d,key))return 'Nincs adat';if(d[key]===null)return 'Ismeretlen';return new Intl.NumberFormat('hu-HU',{maximumFractionDigits:8}).format(d[key] as number)+(key==='energyKcal'?' kcal':' g')}catch{return 'Nem támogatott adat'}
}
