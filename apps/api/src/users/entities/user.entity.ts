export class User {
  id?:string
  email!:string
  name?:string
  image?: string
  password?:string
  isVerified:boolean=false
  createdAt?:any
  updatedAt?:any
}
