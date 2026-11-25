import axios from 'axios'
import { apiClient, getApiErrorMessage } from './api'
import type { FoodNutritionCorrectionResponse as Correction, FoodNutritionCorrectionDetailResponse as Detail, FoodNutritionCorrectionsPage as Page, NutritionCorrectionStatus } from '@kajai/types'
export type { Correction, Detail, Page }
export type CorrectionFood = { id:string; name:string; category:string|null; type:'BASIC'|'PRODUCT'; nutrition:Record<string,unknown>|null; updatedAt:string }
export type Filters = { status:NutritionCorrectionStatus|''; page:number; limit:number; foodItemId?:string; submittedFrom?:string; submittedTo?:string }
export const correctionKeys = {
  private: ['nutrition-corrections'] as const,
  scope:(id:string)=>['nutrition-corrections',id] as const,
  mine:(id:string,f:Filters)=>['nutrition-corrections',id,'mine',f] as const,
  moderation:(id:string,f:Filters)=>['nutrition-corrections',id,'moderation',f] as const,
  detail:(actor:string,id:string)=>['nutrition-corrections',actor,'detail',id] as const,
  foods:['correction-foods'] as const,
  food:(id:string)=>['correction-foods',id] as const,
}
const endpoint=(id:string)=>'/moderation/nutrition-corrections/'+encodeURIComponent(id)
export const correctionsApi={
 async search(search:string,signal?:AbortSignal){return (await apiClient.get<CorrectionFood[]>('/foods',{params:{search},signal})).data},
 async food(id:string,signal?:AbortSignal){return (await apiClient.get<CorrectionFood>('/foods/'+encodeURIComponent(id),{signal})).data},
 async submit(id:string,nutrition:Record<string,number|null>,reason:string){return (await apiClient.post<Correction>('/foods/'+encodeURIComponent(id)+'/nutrition-corrections',{nutrition,reason:reason.trim()})).data},
 async mine(f:Filters,signal?:AbortSignal){return (await apiClient.get<Page>('/nutrition-corrections/mine',{params:params(f),signal})).data},
 async list(f:Filters,signal?:AbortSignal){return (await apiClient.get<Page>('/moderation/nutrition-corrections',{params:params(f),signal})).data},
 async detail(id:string,signal?:AbortSignal){return (await apiClient.get<Detail>(endpoint(id),{signal})).data},
 async approve(id:string){return (await apiClient.post<Correction>(endpoint(id)+'/approve',{})).data},
 async reject(id:string,reason:string){return (await apiClient.post<Correction>(endpoint(id)+'/reject',{reason:reason.trim()})).data},
}
function params(f:Filters){return Object.fromEntries(Object.entries(f).filter(([,v])=>v!==''&&v!==undefined))}
export function correctionStatus(error:unknown){return axios.isAxiosError(error)?error.response?.status:undefined}
export function correctionError(error:unknown){
 const status=correctionStatus(error)
 if(status===401)return 'A munkameneted lejárt. Jelentkezz be újra.'
 if(status===429)return 'Túl sok beküldési próbálkozás. Várj egy percet, majd próbáld újra.'
 if(status&&status>=500)return 'Szerverhiba történt. Próbáld újra később.'
 return getApiErrorMessage(error,({400:'Ellenőrizd a megadott adatokat.',403:'Nincs jogosultságod ehhez a művelethez.',404:'A rekordot törölték vagy nem található.',409:'Az adatok időközben megváltoztak vagy már van függő javaslatod. Frissítés szükséges.'} as Record<number,string>)[status??0]??'Nem sikerült kapcsolódni a szerverhez.')
}
